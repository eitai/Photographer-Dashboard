/**
 * Supplier Products CRUD (Tier 3) — /api/supplier/products (cookie auth)
 *
 * Covers create validation (required fields, type enum, min/max photos),
 * reorder, delete-blocked-when-active-orders (409), ownership (403/404),
 * and auth (401).
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';
process.env.SUPPLIER_JWT_SECRET = 'test_supplier_secret_32_chars_ok!';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Admin = require('../src/models/Admin');
const Supplier = require('../src/models/Supplier');
const SupplierProduct = require('../src/models/SupplierProduct');

const SUFFIX = Date.now();
let app;
let admin, supplier, otherSupplier;
let cookie;
const base = '/api/supplier/products';

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({ name: 'SP Admin', email: `sp_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  supplier = await Supplier.create({ name: `SP Sup ${SUFFIX}`, email: `spsup_${SUFFIX}@test.com`, password: 'password123', isActive: true });
  otherSupplier = await Supplier.create({ name: `SP Other ${SUFFIX}`, email: `spother_${SUFFIX}@test.com`, password: 'password123', isActive: true });
  cookie = `supplier_token=${jwt.sign({ id: supplier.id }, process.env.SUPPLIER_JWT_SECRET, { expiresIn: '1d' })}`;
}, 30000);

afterAll(async () => {
  if (admin?.id) {
    await pool.query('DELETE FROM store_order_items WHERE order_id IN (SELECT id FROM store_orders WHERE admin_id = $1)', [admin.id]);
    await pool.query('DELETE FROM store_orders WHERE admin_id = $1', [admin.id]);
  }
  for (const s of [supplier, otherSupplier]) {
    if (s?.id) {
      await pool.query('DELETE FROM supplier_products WHERE supplier_id = $1', [s.id]);
      await pool.query('DELETE FROM suppliers WHERE id = $1', [s.id]);
    }
  }
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('POST /api/supplier/products', () => {
  test('valid product → 201', async () => {
    const res = await request(app).post(base).set('Cookie', cookie)
      .send({ name: 'Canvas', type: 'canvas', costPrice: 80, clientPrice: 150, minPhotos: 1, maxPhotos: 3 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Canvas');
    expect(res.body.type).toBe('canvas');
  });

  test('missing costPrice → 400', async () => {
    const res = await request(app).post(base).set('Cookie', cookie).send({ name: 'X', type: 'print' });
    expect(res.status).toBe(400);
  });

  test('invalid type → 400', async () => {
    const res = await request(app).post(base).set('Cookie', cookie).send({ name: 'X', type: 'hologram', costPrice: 10 });
    expect(res.status).toBe(400);
  });

  test('minPhotos > maxPhotos → 400', async () => {
    const res = await request(app).post(base).set('Cookie', cookie).send({ name: 'X', type: 'print', costPrice: 10, minPhotos: 5, maxPhotos: 2 });
    expect(res.status).toBe(400);
  });

  test('no auth cookie → 401', async () => {
    const res = await request(app).post(base).send({ name: 'X', type: 'print', costPrice: 10 });
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/supplier/products/reorder', () => {
  test('updates sort_order for owned products', async () => {
    const p1 = await SupplierProduct.create(supplier.id, { name: 'P1', type: 'print', costPrice: 10, sortOrder: 0 });
    const p2 = await SupplierProduct.create(supplier.id, { name: 'P2', type: 'print', costPrice: 10, sortOrder: 1 });

    const res = await request(app).put(`${base}/reorder`).set('Cookie', cookie)
      .send([{ id: p1.id, sortOrder: 10 }, { id: p2.id, sortOrder: 5 }]);
    expect(res.status).toBe(200);

    const { rows } = await pool.query('SELECT id, sort_order FROM supplier_products WHERE id = ANY($1::uuid[])', [[p1.id, p2.id]]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.sort_order]));
    expect(byId[p1.id]).toBe(10);
    expect(byId[p2.id]).toBe(5);
  });
});

describe('DELETE /api/supplier/products/:id', () => {
  test('blocked when an active order references the product → 409', async () => {
    const prod = await SupplierProduct.create(supplier.id, { name: 'Busy', type: 'print', costPrice: 20 });
    const { rows } = await pool.query(
      `INSERT INTO store_orders (admin_id, supplier_id, flow, status, payment_status, total_amount, currency, shipping_address)
       VALUES ($1, $2, 'photographer', 'sent_to_supplier', 'not_required', 20, 'ILS', '{}'::jsonb) RETURNING id`,
      [admin.id, supplier.id],
    );
    await pool.query(
      `INSERT INTO store_order_items (order_id, product_id, quantity, unit_cost_price, selected_image_ids)
       VALUES ($1, $2, 1, 20, '{}')`,
      [rows[0].id, prod.id],
    );

    const res = await request(app).delete(`${base}/${prod.id}`).set('Cookie', cookie);
    expect(res.status).toBe(409);
  });

  test('deletes a product with no active orders → 200', async () => {
    const prod = await SupplierProduct.create(supplier.id, { name: 'Free', type: 'print', costPrice: 20 });
    const res = await request(app).delete(`${base}/${prod.id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  test("another supplier's product → 403", async () => {
    const foreign = await SupplierProduct.create(otherSupplier.id, { name: 'Foreign', type: 'print', costPrice: 20 });
    const res = await request(app).delete(`${base}/${foreign.id}`).set('Cookie', cookie);
    expect(res.status).toBe(403);
  });
});
