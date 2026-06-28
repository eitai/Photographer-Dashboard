/**
 * Store Webhook Integration Tests (PayPlus IPN → order state machine)
 *
 * Covers the money-critical callback path: signature gate, more_info routing,
 * idempotency, success → paid/approved + auto-dispatch to exclusive supplier,
 * the C4 amount cross-check, and failure → cancelled. PayPlus + the
 * fire-and-forget email/receipt services are mocked so nothing hits the network.
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';
process.env.PAYPLUS_SECRET_KEY = 'test_webhook_secret';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

jest.mock('../src/utils/payplus', () => ({
  verifyWebhookSignature: jest.fn(() => true),
  generateStorePaymentLink: jest.fn(),
  generatePaymentLink: jest.fn(),
  chargeByToken: jest.fn(),
  issueDocument: jest.fn(),
  generateCardTokenPage: jest.fn(),
  setRecurringValid: jest.fn(),
  getTransactionDetails: jest.fn(),
}));
// Auto-mock the fire-and-forget side effects so the webhook can't send real
// email / issue real documents during tests.
jest.mock('../src/services/emailService');
jest.mock('../src/services/invoiceService');

const payplus = require('../src/utils/payplus');
const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');

const Admin = require('../src/models/Admin');
const Client = require('../src/models/Client');
const Gallery = require('../src/models/Gallery');
const Supplier = require('../src/models/Supplier');

let app;
const SUFFIX = Date.now();
let admin, client, gallery, supplier;

const WEBHOOK = '/api/store/webhook/payplus';

// Insert a fresh pending client order and return its id. Each test mutates its
// own order so they stay independent.
async function makePendingOrder({ total = 100, supplierId, paymentStatus = 'pending', status = 'pending_selection' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO store_orders
       (admin_id, client_id, gallery_id, supplier_id, flow, status, payment_status,
        total_amount, currency, shipping_address)
     VALUES ($1, $2, $3, $4, 'client', $5, $6, $7, 'ILS', '{}'::jsonb)
     RETURNING id`,
    [admin.id, client.id, gallery.id, supplierId ?? supplier.id, status, paymentStatus, total],
  );
  return rows[0].id;
}

function body(orderId, extra = {}) {
  return {
    more_info: JSON.stringify({ orderId, flow: 'client' }),
    more_info_signature: 'sig',
    status_code: '000',
    transaction_uid: 'tx_test',
    ...extra,
  };
}

async function getOrder(id) {
  const { rows } = await pool.query(
    'SELECT status, payment_status, payplus_transaction_uid, sent_to_supplier_at FROM store_orders WHERE id = $1',
    [id],
  );
  return rows[0];
}

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({ name: 'WH Admin', email: `wh_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  client = await Client.create({ adminId: admin.id, name: 'WH Buyer', email: `whbuyer_${SUFFIX}@test.com` });
  gallery = await Gallery.create({ name: 'WH Gallery', adminId: admin.id, clientId: client.id, isActive: true });

  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  supplier = await Supplier.create({ name: `WH Sup ${SUFFIX}`, email: `whsup_${SUFFIX}@test.com`, password: 'password123', isExclusive: true, isActive: true });
}, 30000);

afterAll(async () => {
  if (admin?.id) await pool.query('DELETE FROM store_orders WHERE admin_id = $1', [admin.id]);
  if (supplier?.id) await pool.query('DELETE FROM suppliers WHERE id = $1', [supplier.id]);
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

beforeEach(() => {
  payplus.verifyWebhookSignature.mockReturnValue(true);
});

describe('POST /api/store/webhook/payplus', () => {
  test('invalid signature → 400, order untouched', async () => {
    const orderId = await makePendingOrder();
    payplus.verifyWebhookSignature.mockReturnValueOnce(false);

    const res = await request(app).post(WEBHOOK).send(body(orderId));
    expect(res.status).toBe(400);

    const o = await getOrder(orderId);
    expect(o.payment_status).toBe('pending');
  });

  test('non-client flow is ignored → 200, order untouched', async () => {
    const orderId = await makePendingOrder();
    const res = await request(app).post(WEBHOOK).send({
      more_info: JSON.stringify({ orderId, flow: 'subscription' }),
      more_info_signature: 'sig',
      status_code: '000',
    });
    expect(res.status).toBe(200);
    const o = await getOrder(orderId);
    expect(o.payment_status).toBe('pending');
  });

  test('unknown order → 404', async () => {
    const res = await request(app).post(WEBHOOK).send(body('00000000-0000-0000-0000-000000000000'));
    expect(res.status).toBe(404);
  });

  test('idempotent — already paid order is a no-op → 200', async () => {
    const orderId = await makePendingOrder({ paymentStatus: 'paid', status: 'approved' });
    const res = await request(app).post(WEBHOOK).send(body(orderId, { transaction_uid: 'should_not_apply' }));
    expect(res.status).toBe(200);
    const o = await getOrder(orderId);
    expect(o.payment_status).toBe('paid');
    expect(o.payplus_transaction_uid).not.toBe('should_not_apply');
  });

  test('success (000) with matching amount → paid + auto-dispatched to exclusive supplier', async () => {
    const orderId = await makePendingOrder({ total: 100 });
    const res = await request(app).post(WEBHOOK).send(body(orderId, { amount: 100, transaction_uid: 'tx_ok' }));
    expect(res.status).toBe(200);

    const o = await getOrder(orderId);
    expect(o.payment_status).toBe('paid');
    expect(o.status).toBe('sent_to_supplier');          // exclusive supplier auto-dispatch
    expect(o.sent_to_supplier_at).not.toBeNull();
    expect(o.payplus_transaction_uid).toBe('tx_ok');
  });

  test('success (000) with no amount field still marks paid (C4 check skipped)', async () => {
    const orderId = await makePendingOrder({ total: 100 });
    const res = await request(app).post(WEBHOOK).send(body(orderId, { transaction_uid: 'tx_noamt' }));
    expect(res.status).toBe(200);
    const o = await getOrder(orderId);
    expect(o.payment_status).toBe('paid');
  });

  test('C4 — success (000) with MISMATCHED amount is NOT marked paid', async () => {
    const orderId = await makePendingOrder({ total: 100 });
    const res = await request(app).post(WEBHOOK).send(body(orderId, { amount: 5, transaction_uid: 'tx_bad' }));
    expect(res.status).toBe(200); // 200 stops PayPlus retries

    const o = await getOrder(orderId);
    expect(o.payment_status).toBe('pending'); // left for manual review
    expect(o.status).not.toBe('sent_to_supplier');
  });

  test('failure code → order cancelled / payment failed', async () => {
    const orderId = await makePendingOrder({ total: 100 });
    const res = await request(app).post(WEBHOOK).send(body(orderId, { status_code: '001', amount: 100 }));
    expect(res.status).toBe(200);
    const o = await getOrder(orderId);
    expect(o.payment_status).toBe('failed');
    expect(o.status).toBe('cancelled');
  });
});
