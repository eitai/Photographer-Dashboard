/**
 * Billing Engine + invoiceService Tests (Tier 1 money paths)
 *
 * billingService: closeCycle / retryUnpaidInvoices — invoice creation,
 * idempotency, charge success→paid, failure→failed + photographer blocked,
 * retry recovery. invoiceService: computeVat (3 VAT modes) + issueReceipt
 * idempotency. PayPlus + email are mocked; invoiceService runs for real.
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

jest.mock('../src/utils/payplus', () => ({
  chargeByToken: jest.fn(),
  issueDocument: jest.fn(),
  verifyWebhookSignature: jest.fn(() => true),
  generateStorePaymentLink: jest.fn(),
  generatePaymentLink: jest.fn(),
  generateCardTokenPage: jest.fn(),
  setRecurringValid: jest.fn(),
  getTransactionDetails: jest.fn(),
}));
// Email senders must return a Promise — production code calls `.catch()` on them.
jest.mock('../src/services/emailService', () => ({
  sendInvoiceEmail:           jest.fn().mockResolvedValue(undefined),
  sendDocumentEmail:          jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderToSupplier:        jest.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail:       jest.fn().mockResolvedValue(undefined),
  sendOrderStatusSms:         jest.fn().mockResolvedValue(undefined),
  sendProductOrderLinks:      jest.fn().mockResolvedValue(undefined),
}));

const payplus = require('../src/utils/payplus');
const { pool, connectDB } = require('../src/config/db');

const Admin = require('../src/models/Admin');
const Supplier = require('../src/models/Supplier');
const billingService = require('../src/services/billingService');
const invoiceService = require('../src/services/invoiceService');

const SUFFIX = Date.now();
const PERIOD = { periodStart: '2026-05-01', periodEnd: '2026-06-01' };

let adminPaid, adminFail, adminNoCard, supplier;

async function makeBillableOrder(adminId, total) {
  const { rows } = await pool.query(
    `INSERT INTO store_orders
       (admin_id, supplier_id, flow, is_direct, status, payment_status,
        total_amount, currency, shipping_address)
     VALUES ($1, $2, 'photographer', true, 'approved', 'not_required', $3, 'ILS', '{}'::jsonb)
     RETURNING id`,
    [adminId, supplier.id, total],
  );
  return rows[0].id;
}

async function setCard(adminId) {
  await pool.query("UPDATE admins SET payplus_card_token = 'tok_test' WHERE id = $1", [adminId]);
}

async function getInvoice(adminId) {
  const { rows } = await pool.query(
    'SELECT * FROM photographer_invoices WHERE admin_id = $1 ORDER BY period_start DESC LIMIT 1',
    [adminId],
  );
  return rows[0];
}

async function isBlocked(adminId) {
  const { rows } = await pool.query('SELECT billing_blocked FROM admins WHERE id = $1', [adminId]);
  return rows[0].billing_blocked;
}

beforeAll(async () => {
  await connectDB();
  adminPaid = await Admin.create({ name: 'Bill Paid', email: `billpaid_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  adminFail = await Admin.create({ name: 'Bill Fail', email: `billfail_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  adminNoCard = await Admin.create({ name: 'Bill NoCard', email: `billnocard_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  await setCard(adminPaid.id);
  await setCard(adminFail.id);

  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  supplier = await Supplier.create({ name: `Bill Sup ${SUFFIX}`, email: `billsup_${SUFFIX}@test.com`, password: 'password123', isExclusive: true, isActive: true });
}, 30000);

afterAll(async () => {
  const ids = [adminPaid?.id, adminFail?.id, adminNoCard?.id].filter(Boolean);
  if (ids.length) {
    await pool.query('DELETE FROM store_orders WHERE admin_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM photographer_invoices WHERE admin_id = ANY($1::uuid[])', [ids]);
  }
  await pool.query('DELETE FROM issued_documents WHERE recipient_email LIKE $1', [`%_${SUFFIX}@test.com`]);
  if (supplier?.id) await pool.query('DELETE FROM suppliers WHERE id = $1', [supplier.id]);
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('billingService.closeCycle', () => {
  test('creates an invoice, charges the card, marks paid, and attaches orders', async () => {
    const o1 = await makeBillableOrder(adminPaid.id, 100);
    const o2 = await makeBillableOrder(adminPaid.id, 50);
    payplus.chargeByToken.mockResolvedValue({ data: { transaction_uid: 'tx_1' } });

    const res = await billingService.closeCycle({ ...PERIOD, adminIds: [adminPaid.id] });
    expect(res.invoiced).toBe(1);
    expect(res.paid).toBe(1);
    expect(res.failed).toBe(0);

    const inv = await getInvoice(adminPaid.id);
    expect(inv.status).toBe('paid');
    expect(Number(inv.total_amount)).toBe(150);

    const { rows } = await pool.query(
      'SELECT invoice_id FROM store_orders WHERE id = ANY($1::uuid[])', [[o1, o2]],
    );
    expect(rows.every((r) => r.invoice_id === inv.id)).toBe(true);
    expect(await isBlocked(adminPaid.id)).toBe(false);
  });

  test('is idempotent — re-running the same period bills nothing new', async () => {
    payplus.chargeByToken.mockResolvedValue({ data: { transaction_uid: 'tx_2' } });
    const res = await billingService.closeCycle({ ...PERIOD, adminIds: [adminPaid.id] });
    expect(res.invoiced).toBe(0);
  });

  test('charge failure marks the invoice failed and blocks the photographer', async () => {
    await makeBillableOrder(adminFail.id, 80);
    payplus.chargeByToken.mockRejectedValueOnce(new Error('card declined'));

    const res = await billingService.closeCycle({ ...PERIOD, adminIds: [adminFail.id] });
    expect(res.failed).toBe(1);
    expect(res.paid).toBe(0);

    const inv = await getInvoice(adminFail.id);
    expect(inv.status).toBe('failed');
    expect(await isBlocked(adminFail.id)).toBe(true);
  });

  test('no card token → invoice fails immediately (no charge attempt)', async () => {
    await makeBillableOrder(adminNoCard.id, 70);
    const callsBefore = payplus.chargeByToken.mock.calls.length;

    const res = await billingService.closeCycle({ ...PERIOD, adminIds: [adminNoCard.id] });
    expect(res.failed).toBe(1);
    expect(payplus.chargeByToken.mock.calls.length).toBe(callsBefore); // never called

    const inv = await getInvoice(adminNoCard.id);
    expect(inv.status).toBe('failed');
  });
});

describe('billingService.retryUnpaidInvoices', () => {
  test('retries a failed invoice to paid, unblocks the photographer, creates nothing new', async () => {
    payplus.chargeByToken.mockResolvedValue({ data: { transaction_uid: 'tx_retry' } });
    const before = await getInvoice(adminFail.id);

    const res = await billingService.retryUnpaidInvoices({ adminIds: [adminFail.id] });
    expect(res.paid).toBeGreaterThanOrEqual(1);

    const after = await getInvoice(adminFail.id);
    expect(after.id).toBe(before.id);   // same invoice, not a new one
    expect(after.status).toBe('paid');
    expect(await isBlocked(adminFail.id)).toBe(false);
  });
});

describe('invoiceService.computeVat', () => {
  const withMode = (mode, rate, fn) => {
    const prevMode = process.env.INVOICE_VAT_MODE;
    const prevRate = process.env.INVOICE_VAT_RATE;
    process.env.INVOICE_VAT_MODE = mode;
    process.env.INVOICE_VAT_RATE = String(rate);
    try { fn(); } finally {
      process.env.INVOICE_VAT_MODE = prevMode;
      process.env.INVOICE_VAT_RATE = prevRate;
    }
  };

  test('exempt → vat 0, total unchanged', () => {
    withMode('exempt', 18, () => {
      expect(invoiceService.computeVat(100)).toEqual({ total: 100, vat: 0 });
    });
  });

  test('included → backs VAT out of the gross', () => {
    withMode('included', 18, () => {
      expect(invoiceService.computeVat(118)).toEqual({ total: 118, vat: 18 });
    });
  });

  test('added → adds VAT on top of the net', () => {
    withMode('added', 18, () => {
      expect(invoiceService.computeVat(100)).toEqual({ total: 118, vat: 18 });
    });
  });
});

describe('invoiceService.issueReceipt', () => {
  test('is idempotent per source — calling twice issues exactly one document', async () => {
    const sourceId = `00000000-0000-4000-8000-${String(SUFFIX).slice(-12).padStart(12, '0')}`;
    const recipient = { id: adminPaid.id, name: 'Recipient', email: `receipt_${SUFFIX}@test.com` };

    await invoiceService.issueReceipt({ sourceKind: 'store_order', sourceId, recipientKind: 'client', recipient, items: [{ name: 'P', quantity: 1, unitPrice: 100 }], amount: 100 });
    await invoiceService.issueReceipt({ sourceKind: 'store_order', sourceId, recipientKind: 'client', recipient, items: [{ name: 'P', quantity: 1, unitPrice: 100 }], amount: 100 });

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM issued_documents WHERE source_kind = 'store_order' AND source_id = $1`,
      [sourceId],
    );
    expect(rows[0].n).toBe(1);
  });
});
