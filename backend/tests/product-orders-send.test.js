/**
 * Send-to-supplier route (Tier 2) — POST /api/product-orders/:id/send-to-supplier
 *
 * Converts a submitted product order into a StoreOrder dispatched to the
 * exclusive supplier. Covers the happy path (creates + links store order),
 * 409 when the supplier has no products, the submitted/already-sent guards,
 * cross-admin isolation (404), and auth (401). Supplier email mocked.
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

jest.mock('../src/services/emailService', () => ({
  sendOrderToSupplier: jest.fn().mockResolvedValue(undefined),
}));

const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const Admin = require('../src/models/Admin');
const Client = require('../src/models/Client');
const Gallery = require('../src/models/Gallery');
const Supplier = require('../src/models/Supplier');
const SupplierProduct = require('../src/models/SupplierProduct');

const SUFFIX = Date.now();
let app;
let admin, otherAdmin, client, gallery, supplier, product;
let token, otherToken;

async function makeProductOrder({ status = 'submitted', galleryIds, storeOrderId = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO product_orders
       (admin_id, client_id, name, type, max_photos, allowed_gallery_ids, selected_photo_ids, status, store_order_id)
     VALUES ($1, $2, 'My Album', 'album', 1, $3::uuid[], '[]'::jsonb, $4, $5)
     RETURNING id`,
    [admin.id, client.id, galleryIds ?? [gallery.id], status, storeOrderId],
  );
  return rows[0].id;
}

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({ name: 'STS Admin', email: `sts_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  otherAdmin = await Admin.create({ name: 'STS Other', email: `stsother_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  otherToken = jwt.sign({ id: otherAdmin.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  client = await Client.create({ adminId: admin.id, name: 'STS Client', email: `stsc_${SUFFIX}@test.com`, addressStreet: 'Herzl 1', addressCity: 'Tel Aviv' });
  gallery = await Gallery.create({ name: 'STS Gallery', adminId: admin.id, clientId: client.id, isActive: true });

  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  supplier = await Supplier.create({ name: `STS Sup ${SUFFIX}`, email: `stssup_${SUFFIX}@test.com`, password: 'password123', isExclusive: true, isActive: true });
  product = await SupplierProduct.create(supplier.id, { name: 'Album', type: 'album', costPrice: 200, clientPrice: 350, isActive: true });
}, 30000);

afterAll(async () => {
  const ids = [admin?.id, otherAdmin?.id].filter(Boolean);
  if (ids.length) {
    await pool.query('DELETE FROM product_orders WHERE admin_id = ANY($1::uuid[])', [ids]);
    await pool.query('DELETE FROM store_order_items WHERE order_id IN (SELECT id FROM store_orders WHERE admin_id = ANY($1::uuid[]))', [ids]);
    await pool.query('DELETE FROM store_orders WHERE admin_id = ANY($1::uuid[])', [ids]);
  }
  if (supplier?.id) {
    await pool.query('DELETE FROM supplier_products WHERE supplier_id = $1', [supplier.id]);
    await pool.query('DELETE FROM suppliers WHERE id = $1', [supplier.id]);
  }
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('POST /api/product-orders/:id/send-to-supplier', () => {
  test('happy path — creates and links a store order (200)', async () => {
    const poId = await makeProductOrder();
    const res = await request(app).post(`/api/product-orders/${poId}/send-to-supplier`).set('Authorization', `Bearer ${token}`).send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.storeOrderId).toBeTruthy();
    expect(res.body.hasAddress).toBe(true);

    const { rows: po } = await pool.query('SELECT store_order_id FROM product_orders WHERE id = $1', [poId]);
    expect(po[0].store_order_id).toBe(res.body.storeOrderId);

    const { rows: so } = await pool.query('SELECT flow, status, supplier_id FROM store_orders WHERE id = $1', [res.body.storeOrderId]);
    expect(so[0].flow).toBe('photographer');
    expect(so[0].status).toBe('sent_to_supplier');
    expect(so[0].supplier_id).toBe(supplier.id);

    // Already sent → second attempt is rejected
    const again = await request(app).post(`/api/product-orders/${poId}/send-to-supplier`).set('Authorization', `Bearer ${token}`).send({});
    expect(again.status).toBe(400);
  });

  test('supplier has no active products → 409', async () => {
    await pool.query('UPDATE supplier_products SET is_active = false WHERE supplier_id = $1', [supplier.id]);
    const poId = await makeProductOrder();
    const res = await request(app).post(`/api/product-orders/${poId}/send-to-supplier`).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(409);
    await pool.query('UPDATE supplier_products SET is_active = true WHERE supplier_id = $1', [supplier.id]);
  });

  test('order not submitted → 400', async () => {
    const poId = await makeProductOrder({ status: 'pending' });
    const res = await request(app).post(`/api/product-orders/${poId}/send-to-supplier`).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  test('order of another admin → 404', async () => {
    const poId = await makeProductOrder();
    const res = await request(app).post(`/api/product-orders/${poId}/send-to-supplier`).set('Authorization', `Bearer ${otherToken}`).send({});
    expect(res.status).toBe(404);
  });

  test('no token → 401', async () => {
    const poId = await makeProductOrder();
    const res = await request(app).post(`/api/product-orders/${poId}/send-to-supplier`).send({});
    expect(res.status).toBe(401);
  });
});
