/**
 * Supplier Order Status route (Tier 2) — PUT /api/supplier/orders/:id/status
 *
 * Cookie-authenticated supplier portal. Covers the status state machine
 * (valid transitions, 409 on illegal jumps, 400 on unknown status), tracking
 * persistence, delivered → linked product_order marked delivered, cross-supplier
 * isolation (404), and auth (401). Email/SMS notifications are mocked.
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';
process.env.SUPPLIER_JWT_SECRET = 'test_supplier_secret_32_chars_ok!';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

jest.mock('../src/services/emailService', () => ({
  sendOrderStatusEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/smsService', () => ({
  sendOrderStatusSms: jest.fn().mockResolvedValue(undefined),
}));

const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Admin = require('../src/models/Admin');
const Client = require('../src/models/Client');
const Supplier = require('../src/models/Supplier');

const SUFFIX = Date.now();
let app;
let admin, client, supplier, otherSupplier;
let cookie, otherCookie;

async function makeOrder({ supplierId, status }) {
  const { rows } = await pool.query(
    `INSERT INTO store_orders
       (admin_id, client_id, supplier_id, flow, status, payment_status,
        total_amount, currency, shipping_address)
     VALUES ($1, $2, $3, 'photographer', $4, 'not_required', 100, 'ILS', '{}'::jsonb)
     RETURNING id`,
    [admin.id, client.id, supplierId, status],
  );
  return rows[0].id;
}

async function makeLinkedProductOrder(storeOrderId) {
  const { rows } = await pool.query(
    `INSERT INTO product_orders (admin_id, client_id, name, type, status, store_order_id)
     VALUES ($1, $2, 'Album order', 'album', 'submitted', $3) RETURNING id`,
    [admin.id, client.id, storeOrderId],
  );
  return rows[0].id;
}

async function pollStatus(id, want, tries = 20) {
  for (let k = 0; k < tries; k++) {
    const { rows } = await pool.query('SELECT status FROM product_orders WHERE id = $1', [id]);
    if (rows[0]?.status === want) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({ name: 'SO Admin', email: `so_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  client = await Client.create({ adminId: admin.id, name: 'SO Client', email: `soc_${SUFFIX}@test.com`, phone: '0501234567' });
  supplier = await Supplier.create({ name: `SO Sup ${SUFFIX}`, email: `sosup_${SUFFIX}@test.com`, password: 'password123', isActive: true });
  otherSupplier = await Supplier.create({ name: `SO Other ${SUFFIX}`, email: `soother_${SUFFIX}@test.com`, password: 'password123', isActive: true });

  cookie = `supplier_token=${jwt.sign({ id: supplier.id }, process.env.SUPPLIER_JWT_SECRET, { expiresIn: '1d' })}`;
  otherCookie = `supplier_token=${jwt.sign({ id: otherSupplier.id }, process.env.SUPPLIER_JWT_SECRET, { expiresIn: '1d' })}`;
}, 30000);

afterAll(async () => {
  if (admin?.id) {
    await pool.query('DELETE FROM product_orders WHERE admin_id = $1', [admin.id]);
    await pool.query('DELETE FROM store_orders WHERE admin_id = $1', [admin.id]);
  }
  for (const s of [supplier, otherSupplier]) {
    if (s?.id) await pool.query('DELETE FROM suppliers WHERE id = $1', [s.id]);
  }
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('PUT /api/supplier/orders/:id/status', () => {
  test('sent_to_supplier → in_production (200)', async () => {
    const id = await makeOrder({ supplierId: supplier.id, status: 'sent_to_supplier' });
    const res = await request(app).put(`/api/supplier/orders/${id}/status`).set('Cookie', cookie).send({ status: 'in_production' });
    expect(res.status).toBe(200);

    const { rows } = await pool.query('SELECT status FROM store_orders WHERE id = $1', [id]);
    expect(rows[0].status).toBe('in_production');
  });

  test('in_production → shipped persists tracking (200)', async () => {
    const id = await makeOrder({ supplierId: supplier.id, status: 'in_production' });
    const res = await request(app).put(`/api/supplier/orders/${id}/status`).set('Cookie', cookie)
      .send({ status: 'shipped', trackingNumber: 'TRK123', trackingCarrier: 'IsraelPost' });
    expect(res.status).toBe(200);

    const { rows } = await pool.query('SELECT status, tracking_number, tracking_carrier FROM store_orders WHERE id = $1', [id]);
    expect(rows[0].status).toBe('shipped');
    expect(rows[0].tracking_number).toBe('TRK123');
    expect(rows[0].tracking_carrier).toBe('IsraelPost');
  });

  test('shipped → delivered marks the linked product order delivered (200)', async () => {
    const id = await makeOrder({ supplierId: supplier.id, status: 'shipped' });
    const poId = await makeLinkedProductOrder(id);

    const res = await request(app).put(`/api/supplier/orders/${id}/status`).set('Cookie', cookie).send({ status: 'delivered' });
    expect(res.status).toBe(200);

    expect(await pollStatus(poId, 'delivered')).toBe(true);
  });

  test('unknown status → 400', async () => {
    const id = await makeOrder({ supplierId: supplier.id, status: 'sent_to_supplier' });
    const res = await request(app).put(`/api/supplier/orders/${id}/status`).set('Cookie', cookie).send({ status: 'approved' });
    expect(res.status).toBe(400);
  });

  test('illegal transition (sent_to_supplier → delivered) → 409', async () => {
    const id = await makeOrder({ supplierId: supplier.id, status: 'sent_to_supplier' });
    const res = await request(app).put(`/api/supplier/orders/${id}/status`).set('Cookie', cookie).send({ status: 'delivered' });
    expect(res.status).toBe(409);
  });

  test('another supplier cannot touch the order → 404', async () => {
    const id = await makeOrder({ supplierId: supplier.id, status: 'sent_to_supplier' });
    const res = await request(app).put(`/api/supplier/orders/${id}/status`).set('Cookie', otherCookie).send({ status: 'in_production' });
    expect(res.status).toBe(404);
  });

  test('no auth cookie → 401', async () => {
    const id = await makeOrder({ supplierId: supplier.id, status: 'sent_to_supplier' });
    const res = await request(app).put(`/api/supplier/orders/${id}/status`).send({ status: 'in_production' });
    expect(res.status).toBe(401);
  });
});
