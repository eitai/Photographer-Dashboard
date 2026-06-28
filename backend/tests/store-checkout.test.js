/**
 * Store Checkout Integration Tests (Flow B — client self-service store)
 *
 * Guards the client checkout path end-to-end, with PayPlus mocked so no network
 * call is made. The headline case is the C1 regression: a checkout that includes
 * selected photos must persist `selected_image_ids` as a real Postgres uuid[].
 * Before the fix the route passed `JSON.stringify([...])` into a `::uuid[]`
 * cast, producing a malformed array literal that rolled the whole order back.
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';
process.env.JWT_EXPIRES_IN = '7d';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

// Mock PayPlus so checkout never hits the network. The route reads
// data.payment_page_uid / data.payment_page_url off the result.
jest.mock('../src/utils/payplus', () => ({
  generateStorePaymentLink: jest.fn(async () => ({
    data: { payment_page_uid: 'uid_test', payment_page_url: 'https://pay.test/abc' },
  })),
  verifyWebhookSignature: jest.fn(() => true),
  generatePaymentLink: jest.fn(),
  generateCardTokenPage: jest.fn(),
  chargeByToken: jest.fn(),
  issueDocument: jest.fn(),
  setRecurringValid: jest.fn(),
  getTransactionDetails: jest.fn(),
}));

const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');

const Admin = require('../src/models/Admin');
const Client = require('../src/models/Client');
const Gallery = require('../src/models/Gallery');
const GalleryImage = require('../src/models/GalleryImage');
const Supplier = require('../src/models/Supplier');
const SupplierProduct = require('../src/models/SupplierProduct');

let app;
const SUFFIX = Date.now();

let admin, client, gallery, supplier, product, productNoPhotos;
let imageIds = [];

const ADDR = { name: 'Buyer', street: 'Herzl 1', city: 'Tel Aviv' };

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({
    name: 'Store Admin',
    email: `store_${SUFFIX}@test.com`,
    password: 'password123',
    role: 'admin',
  });
  client = await Client.create({
    adminId: admin.id,
    name: 'Buyer',
    email: `buyer_${SUFFIX}@test.com`,
    addressStreet: 'Herzl 1',
    addressCity: 'Tel Aviv',
  });
  gallery = await Gallery.create({
    name: 'Checkout Gallery',
    adminId: admin.id,
    clientId: client.id,
    isActive: true,
  });

  // The store resolves a single GLOBAL exclusive supplier. Demote any leftover
  // exclusive (from a crashed prior run) so our supplier is the one picked.
  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  supplier = await Supplier.create({
    name: `Supplier ${SUFFIX}`,
    email: `sup_${SUFFIX}@test.com`,
    password: 'password123',
    isExclusive: true,
    isActive: true,
  });

  product = await SupplierProduct.create(supplier.id, {
    name: 'Fine Print', type: 'print', costPrice: 60, clientPrice: 100,
    minPhotos: 1, maxPhotos: 3, isActive: true,
  });
  productNoPhotos = await SupplierProduct.create(supplier.id, {
    name: 'Gift Voucher', type: 'other', costPrice: 10, clientPrice: 20,
    minPhotos: 0, maxPhotos: 0, isActive: true,
  });

  const imgs = await GalleryImage.insertMany([
    { galleryId: gallery.id, filename: 'a.jpg', path: 'uploads/a.jpg' },
    { galleryId: gallery.id, filename: 'b.jpg', path: 'uploads/b.jpg' },
    { galleryId: gallery.id, filename: 'c.jpg', path: 'uploads/c.jpg' },
  ]);
  imageIds = imgs.map((i) => i.id);
}, 30000);

afterAll(async () => {
  if (admin?.id) {
    await pool.query(
      `DELETE FROM store_order_items WHERE order_id IN (SELECT id FROM store_orders WHERE admin_id = $1)`,
      [admin.id],
    );
    await pool.query('DELETE FROM store_orders WHERE admin_id = $1', [admin.id]);
  }
  if (supplier?.id) {
    await pool.query('DELETE FROM supplier_products WHERE supplier_id = $1', [supplier.id]);
    await pool.query('DELETE FROM suppliers WHERE id = $1', [supplier.id]);
  }
  // Galleries, images and clients cascade from the admin delete.
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('POST /api/store/:galleryToken/checkout', () => {
  // ── C1: the regression that this whole suite exists for ──────────────────────
  test('C1 — checkout with selected photos succeeds and persists a real uuid[]', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedImageIds: [imageIds[0], imageIds[1]] }],
        shippingAddress: ADDR,
      });

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeTruthy();
    expect(res.body.url).toBe('https://pay.test/abc');

    const { rows: items } = await pool.query(
      'SELECT selected_image_ids, quantity, unit_client_price FROM store_order_items WHERE order_id = $1',
      [res.body.orderId],
    );
    expect(items).toHaveLength(1);
    // pg returns a uuid[] column as a JS array of strings — proves the insert
    // stored an array, not a malformed JSON literal.
    expect(Array.isArray(items[0].selected_image_ids)).toBe(true);
    expect([...items[0].selected_image_ids].sort()).toEqual([imageIds[0], imageIds[1]].sort());

    const { rows: orders } = await pool.query(
      'SELECT total_amount, status, payment_status FROM store_orders WHERE id = $1',
      [res.body.orderId],
    );
    expect(Number(orders[0].total_amount)).toBe(100);
    expect(orders[0].status).toBe('pending_selection');
    expect(orders[0].payment_status).toBe('pending');
  });

  test('checkout of a no-photo product stores an empty array', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({ items: [{ productId: productNoPhotos.id, quantity: 2 }], shippingAddress: ADDR });

    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      'SELECT selected_image_ids FROM store_order_items WHERE order_id = $1',
      [res.body.orderId],
    );
    expect(rows[0].selected_image_ids).toEqual([]);

    const { rows: ord } = await pool.query(
      'SELECT total_amount FROM store_orders WHERE id = $1', [res.body.orderId],
    );
    expect(Number(ord[0].total_amount)).toBe(40); // 2 × 20
  });

  // ── C2: image-ownership validation ───────────────────────────────────────────
  test('C2 — an image from another gallery is rejected (422)', async () => {
    const otherGallery = await Gallery.create({
      name: 'Other', adminId: admin.id, clientId: client.id, isActive: true,
    });
    const [foreign] = await GalleryImage.insertMany([
      { galleryId: otherGallery.id, filename: 'x.jpg', path: 'uploads/x.jpg' },
    ]);

    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedImageIds: [foreign.id] }],
        shippingAddress: ADDR,
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/belong to this gallery/i);
  });

  test('C2 — a non-UUID image id is rejected (400)', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedImageIds: ['not-a-uuid'] }],
        shippingAddress: ADDR,
      });
    expect(res.status).toBe(400);
  });

  // ── Photo-count enforcement (checkPhotoCount) ────────────────────────────────
  test('min_photos not met → 422', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({ items: [{ productId: product.id, quantity: 1, selectedImageIds: [] }], shippingAddress: ADDR });
    expect(res.status).toBe(422);
  });

  test('max_photos exceeded → 422', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedImageIds: [imageIds[0], imageIds[1], imageIds[2], imageIds[0]] }],
        shippingAddress: ADDR,
      });
    expect(res.status).toBe(422);
  });

  // ── Body / resource validation ───────────────────────────────────────────────
  test('empty items → 400', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({ items: [], shippingAddress: ADDR });
    expect(res.status).toBe(400);
  });

  test('missing shippingAddress → 400', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({ items: [{ productId: product.id, quantity: 1, selectedImageIds: [imageIds[0]] }] });
    expect(res.status).toBe(400);
  });

  test('unknown product → 422', async () => {
    const res = await request(app)
      .post(`/api/store/${gallery.token}/checkout`)
      .send({
        items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        shippingAddress: ADDR,
      });
    expect(res.status).toBe(422);
  });

  test('bad gallery token → 404', async () => {
    const res = await request(app)
      .post('/api/store/deadbeefdeadbeef/checkout')
      .send({
        items: [{ productId: product.id, quantity: 1, selectedImageIds: [imageIds[0]] }],
        shippingAddress: ADDR,
      });
    expect(res.status).toBe(404);
  });
});
