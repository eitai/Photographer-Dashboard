/**
 * Store fulfillment + StoreOrder.createDirect (Tier 2, model/service level)
 *
 *  - dispatchStrandedOrders(): re-dispatch paid client orders the webhook missed (C3).
 *  - StoreOrder.createDirect(): photographer direct order — single-supplier
 *    enforcement, image-ownership validation, total = cost price.
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

const { pool, connectDB } = require('../src/config/db');

const Admin = require('../src/models/Admin');
const Gallery = require('../src/models/Gallery');
const GalleryImage = require('../src/models/GalleryImage');
const Supplier = require('../src/models/Supplier');
const SupplierProduct = require('../src/models/SupplierProduct');
const StoreOrder = require('../src/models/StoreOrder');
const { dispatchStrandedOrders } = require('../src/services/storeFulfillment');

const SUFFIX = Date.now();
let admin, gallery, exclusiveSupplier, otherSupplier;
let productA, productB; // A on exclusive supplier, B on the other supplier
let imageIds = [];

async function insertOrder({ supplierId, status, paymentStatus, sentAt = null }) {
  const { rows } = await pool.query(
    `INSERT INTO store_orders
       (admin_id, supplier_id, flow, status, payment_status, total_amount, currency,
        shipping_address, sent_to_supplier_at)
     VALUES ($1, $2, 'client', $3, $4, 50, 'ILS', '{}'::jsonb, $5)
     RETURNING id`,
    [admin.id, supplierId, status, paymentStatus, sentAt],
  );
  return rows[0].id;
}

beforeAll(async () => {
  await connectDB();

  admin = await Admin.create({ name: 'Direct Admin', email: `direct_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  gallery = await Gallery.create({ name: 'Direct Gallery', adminId: admin.id, isActive: true });

  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  exclusiveSupplier = await Supplier.create({ name: `Excl ${SUFFIX}`, email: `excl_${SUFFIX}@test.com`, password: 'password123', isExclusive: true, isActive: true });
  otherSupplier = await Supplier.create({ name: `Other ${SUFFIX}`, email: `other_${SUFFIX}@test.com`, password: 'password123', isExclusive: false, isActive: true });

  productA = await SupplierProduct.create(exclusiveSupplier.id, { name: 'Print A', type: 'print', costPrice: 60, clientPrice: 100, minPhotos: 1, maxPhotos: 0, isActive: true });
  productB = await SupplierProduct.create(otherSupplier.id, { name: 'Print B', type: 'print', costPrice: 30, clientPrice: 70, minPhotos: 0, maxPhotos: 0, isActive: true });

  const imgs = await GalleryImage.insertMany([
    { galleryId: gallery.id, filename: 'a.jpg', path: 'uploads/a.jpg' },
    { galleryId: gallery.id, filename: 'b.jpg', path: 'uploads/b.jpg' },
  ]);
  imageIds = imgs.map((i) => i.id);
}, 30000);

afterAll(async () => {
  if (admin?.id) {
    await pool.query('DELETE FROM store_order_items WHERE order_id IN (SELECT id FROM store_orders WHERE admin_id = $1)', [admin.id]);
    await pool.query('DELETE FROM store_orders WHERE admin_id = $1', [admin.id]);
  }
  for (const s of [exclusiveSupplier, otherSupplier]) {
    if (s?.id) {
      await pool.query('DELETE FROM supplier_products WHERE supplier_id = $1', [s.id]);
      await pool.query('DELETE FROM suppliers WHERE id = $1', [s.id]);
    }
  }
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('dispatchStrandedOrders (C3 sweep)', () => {
  test('re-dispatches a stranded paid/approved order for an exclusive supplier; leaves the rest', async () => {
    const stranded   = await insertOrder({ supplierId: exclusiveSupplier.id, status: 'approved',          paymentStatus: 'paid' });
    const alreadySent = await insertOrder({ supplierId: exclusiveSupplier.id, status: 'sent_to_supplier', paymentStatus: 'paid', sentAt: new Date().toISOString() });
    const unpaid     = await insertOrder({ supplierId: exclusiveSupplier.id, status: 'approved',          paymentStatus: 'pending' });
    const nonExcl    = await insertOrder({ supplierId: otherSupplier.id,     status: 'approved',          paymentStatus: 'paid' });

    const res = await dispatchStrandedOrders();

    expect(res.ids).toContain(stranded);
    expect(res.ids).not.toContain(alreadySent);
    expect(res.ids).not.toContain(unpaid);
    expect(res.ids).not.toContain(nonExcl);

    const { rows } = await pool.query(
      'SELECT id, status, sent_to_supplier_at FROM store_orders WHERE id = ANY($1::uuid[])',
      [[stranded, unpaid, nonExcl]],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[stranded].status).toBe('sent_to_supplier');
    expect(byId[stranded].sent_to_supplier_at).not.toBeNull();
    expect(byId[unpaid].status).toBe('approved');   // untouched
    expect(byId[nonExcl].status).toBe('approved');   // untouched
  });

  test('is idempotent — a second run dispatches nothing', async () => {
    const res = await dispatchStrandedOrders();
    expect(res.dispatched).toBe(0);
  });
});

describe('StoreOrder.createDirect (photographer direct order)', () => {
  test('creates an approved order with total = sum of cost prices', async () => {
    const order = await StoreOrder.createDirect({
      adminId: admin.id,
      items: [{ productId: productA.id, quantity: 2, selectedImageIds: [imageIds[0]] }],
      shippingAddress: { name: 'Studio', street: 'Herzl 1', city: 'Tel Aviv' },
      photographerNote: 'rush',
    });

    expect(order).toBeTruthy();
    expect(order.status).toBe('approved');
    expect(order.flow).toBe('photographer');
    expect(Number(order.totalAmount)).toBe(120); // 2 × 60 cost price
  });

  test('rejects items spanning more than one supplier (422)', async () => {
    await expect(StoreOrder.createDirect({
      adminId: admin.id,
      items: [
        { productId: productA.id, quantity: 1, selectedImageIds: [imageIds[0]] },
        { productId: productB.id, quantity: 1, selectedImageIds: [] },
      ],
      shippingAddress: { name: 'Studio', street: 'Herzl 1', city: 'Tel Aviv' },
    })).rejects.toMatchObject({ status: 422 });
  });

  test('rejects an image that does not belong to the admin (422)', async () => {
    // Foreign image in a gallery owned by a different admin
    const otherAdmin = await Admin.create({ name: 'Other', email: `otheradmin_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
    const otherGallery = await Gallery.create({ name: 'Foreign', adminId: otherAdmin.id, isActive: true });
    const [foreign] = await GalleryImage.insertMany([{ galleryId: otherGallery.id, filename: 'f.jpg', path: 'uploads/f.jpg' }]);

    await expect(StoreOrder.createDirect({
      adminId: admin.id,
      items: [{ productId: productA.id, quantity: 1, selectedImageIds: [foreign.id] }],
      shippingAddress: { name: 'Studio', street: 'Herzl 1', city: 'Tel Aviv' },
    })).rejects.toMatchObject({ status: 422 });
  });
});
