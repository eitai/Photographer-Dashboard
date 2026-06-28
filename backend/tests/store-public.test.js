/**
 * Public store/product-order reads (Tier 4) — no auth
 *   GET /api/store/products/:galleryToken
 *   GET /api/store/orders/:orderId/status
 *   GET /api/product-orders/gallery/:token
 *   GET /api/product-orders/order/:orderToken
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');
const crypto = require('crypto');

const Admin = require('../src/models/Admin');
const Client = require('../src/models/Client');
const Gallery = require('../src/models/Gallery');
const Supplier = require('../src/models/Supplier');
const SupplierProduct = require('../src/models/SupplierProduct');

const SUFFIX = Date.now();
let app, admin, client, gallery, expiredGallery, supplier;
let storeOrderId, productOrderToken, productOrderDisabledToken;

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({ name: 'Pub Admin', email: `pub_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  client = await Client.create({ adminId: admin.id, name: 'Pub Client', email: `pubc_${SUFFIX}@test.com` });
  gallery = await Gallery.create({ name: 'Pub Gallery', adminId: admin.id, clientId: client.id, isActive: true });
  expiredGallery = await Gallery.create({ name: 'Expired', adminId: admin.id, clientId: client.id, isActive: true, expiresAt: '2000-01-01' });

  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  supplier = await Supplier.create({ name: `Pub Sup ${SUFFIX}`, email: `pubsup_${SUFFIX}@test.com`, password: 'password123', isExclusive: true, isActive: true });
  await SupplierProduct.create(supplier.id, { name: 'First', type: 'print', costPrice: 10, clientPrice: 20, sortOrder: 0, isActive: true });
  await SupplierProduct.create(supplier.id, { name: 'Second', type: 'print', costPrice: 10, clientPrice: 20, sortOrder: 1, isActive: true });
  await SupplierProduct.create(supplier.id, { name: 'Hidden', type: 'print', costPrice: 10, clientPrice: 20, sortOrder: 2, isActive: false });

  // A client store order for the status endpoint
  const so = await pool.query(
    `INSERT INTO store_orders (admin_id, client_id, gallery_id, supplier_id, flow, status, payment_status, total_amount, currency, shipping_address)
     VALUES ($1, $2, $3, $4, 'client', 'approved', 'paid', 120, 'ILS', '{}'::jsonb) RETURNING id`,
    [admin.id, client.id, gallery.id, supplier.id],
  );
  storeOrderId = so.rows[0].id;

  // Product orders: one with an active link, one disabled — both linked to the store order
  productOrderToken = crypto.randomBytes(16).toString('hex');
  productOrderDisabledToken = crypto.randomBytes(16).toString('hex');
  await pool.query(
    `INSERT INTO product_orders (admin_id, client_id, name, type, max_photos, allowed_gallery_ids, selected_photo_ids, status, token, link_enabled, store_order_id)
     VALUES ($1, $2, 'Album', 'album', 1, $3::uuid[], '[]'::jsonb, 'submitted', $4, true, $5)`,
    [admin.id, client.id, [gallery.id], productOrderToken, storeOrderId],
  );
  await pool.query(
    `INSERT INTO product_orders (admin_id, client_id, name, type, max_photos, allowed_gallery_ids, selected_photo_ids, status, token, link_enabled)
     VALUES ($1, $2, 'Print', 'print', 1, $3::uuid[], '[]'::jsonb, 'pending', $4, false)`,
    [admin.id, client.id, [gallery.id], productOrderDisabledToken],
  );
}, 30000);

afterAll(async () => {
  if (admin?.id) {
    await pool.query('DELETE FROM product_orders WHERE admin_id = $1', [admin.id]);
    await pool.query('DELETE FROM store_orders WHERE admin_id = $1', [admin.id]);
  }
  if (supplier?.id) {
    await pool.query('DELETE FROM supplier_products WHERE supplier_id = $1', [supplier.id]);
    await pool.query('DELETE FROM suppliers WHERE id = $1', [supplier.id]);
  }
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('GET /api/store/products/:galleryToken', () => {
  test('returns the active catalog sorted by sort_order', async () => {
    const res = await request(app).get(`/api/store/products/${gallery.token}`);
    expect(res.status).toBe(200);
    expect(res.body.supplierId).toBe(supplier.id);
    expect(res.body.products.map((p) => p.name)).toEqual(['First', 'Second']); // Hidden excluded, sorted
  });

  test('clients_can_order = false → empty products', async () => {
    await pool.query('UPDATE admins SET clients_can_order = false WHERE id = $1', [admin.id]);
    const res = await request(app).get(`/api/store/products/${gallery.token}`);
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    await pool.query('UPDATE admins SET clients_can_order = true WHERE id = $1', [admin.id]);
  });

  test('no exclusive supplier → empty products', async () => {
    await pool.query('UPDATE suppliers SET is_exclusive = false WHERE id = $1', [supplier.id]);
    const res = await request(app).get(`/api/store/products/${gallery.token}`);
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    await pool.query('UPDATE suppliers SET is_exclusive = true WHERE id = $1', [supplier.id]);
  });

  test('unknown gallery token → 404', async () => {
    const res = await request(app).get('/api/store/products/nope_nope_nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/store/orders/:orderId/status', () => {
  test('returns the order status shape', async () => {
    const res = await request(app).get(`/api/store/orders/${storeOrderId}/status`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(storeOrderId);
    expect(res.body.status).toBe('approved');
    expect(res.body.paymentStatus).toBe('paid');
    expect(Number(res.body.totalAmount)).toBe(120);
    expect(res.body.receiptUrl).toBeNull();
  });

  test('invalid UUID → 400', async () => {
    const res = await request(app).get('/api/store/orders/not-a-uuid/status');
    expect(res.status).toBe(400);
  });

  test('unknown order → 404', async () => {
    const res = await request(app).get('/api/store/orders/00000000-0000-0000-0000-000000000000/status');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/product-orders/gallery/:token', () => {
  test('lists orders and attaches linked store-order status', async () => {
    const res = await request(app).get(`/api/product-orders/gallery/${gallery.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const linked = res.body.find((o) => o.storeOrderId === storeOrderId);
    expect(linked).toBeTruthy();
    expect(linked.supplierStatus).toBe('approved');
  });

  test('expired gallery → 410', async () => {
    const res = await request(app).get(`/api/product-orders/gallery/${expiredGallery.token}`);
    expect(res.status).toBe(410);
  });
});

describe('GET /api/product-orders/order/:orderToken', () => {
  test('active link → 200 with attached store status', async () => {
    const res = await request(app).get(`/api/product-orders/order/${productOrderToken}`);
    expect(res.status).toBe(200);
    expect(res.body.supplierStatus).toBe('approved');
  });

  test('disabled link → 403', async () => {
    const res = await request(app).get(`/api/product-orders/order/${productOrderDisabledToken}`);
    expect(res.status).toBe(403);
  });

  test('unknown token → 404', async () => {
    const res = await request(app).get('/api/product-orders/order/deadbeefdeadbeefdeadbeefdeadbeef');
    expect(res.status).toBe(404);
  });
});
