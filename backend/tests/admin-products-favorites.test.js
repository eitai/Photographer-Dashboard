/**
 * Admin Products — supplier catalog + favorites (Tier 3)
 *   GET/POST/DELETE /api/admin-products/... (admin Bearer auth)
 *
 * Favoriting a supplier product flips isFavorite and floats it to the top of
 * the catalog. Covers mark/unmark, the isFavorite flag, sort-first ordering,
 * and auth.
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
const jwt = require('jsonwebtoken');

const Admin = require('../src/models/Admin');
const Supplier = require('../src/models/Supplier');
const SupplierProduct = require('../src/models/SupplierProduct');

const SUFFIX = Date.now();
let app, admin, token, supplier, p1, p2;
const base = '/api/admin-products';

function authed(req) { return req.set('Authorization', `Bearer ${token}`); }

async function catalog() {
  const res = await authed(request(app).get(`${base}/supplier-products`));
  return res;
}

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({ name: 'Fav Admin', email: `fav_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  supplier = await Supplier.create({ name: `Fav Sup ${SUFFIX}`, email: `favsup_${SUFFIX}@test.com`, password: 'password123', isExclusive: true, isActive: true });
  p1 = await SupplierProduct.create(supplier.id, { name: `Fav P1 ${SUFFIX}`, type: 'print', costPrice: 10, clientPrice: 20, sortOrder: 0, isActive: true });
  p2 = await SupplierProduct.create(supplier.id, { name: `Fav P2 ${SUFFIX}`, type: 'print', costPrice: 10, clientPrice: 20, sortOrder: 1, isActive: true });
}, 30000);

afterAll(async () => {
  if (admin?.id) await pool.query('DELETE FROM admin_supplier_favorites WHERE admin_id = $1', [admin.id]);
  if (supplier?.id) {
    await pool.query('DELETE FROM supplier_products WHERE supplier_id = $1', [supplier.id]);
    await pool.query('DELETE FROM suppliers WHERE id = $1', [supplier.id]);
  }
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('Admin product favorites', () => {
  test('catalog requires auth → 401', async () => {
    const res = await request(app).get(`${base}/supplier-products`);
    expect(res.status).toBe(401);
  });

  test('products start un-favorited', async () => {
    const res = await catalog();
    expect(res.status).toBe(200);
    const mine = res.body.filter((p) => p.id === p1.id || p.id === p2.id);
    expect(mine).toHaveLength(2);
    expect(mine.every((p) => p.isFavorite === false)).toBe(true);
  });

  test('POST favorite flips isFavorite and floats the product to the top', async () => {
    const fav = await authed(request(app).post(`${base}/favorites/${p2.id}`));
    expect(fav.status).toBe(200);
    expect(fav.body.isFavorite).toBe(true);

    const res = await catalog();
    const ids = res.body.map((p) => p.id);
    const favRow = res.body.find((p) => p.id === p2.id);
    expect(favRow.isFavorite).toBe(true);
    // p2 (favorited) sorts before p1 (not favorited)
    expect(ids.indexOf(p2.id)).toBeLessThan(ids.indexOf(p1.id));
  });

  test('DELETE favorite clears isFavorite', async () => {
    const res = await authed(request(app).delete(`${base}/favorites/${p2.id}`));
    expect(res.status).toBe(200);
    expect(res.body.isFavorite).toBe(false);

    const after = await catalog();
    expect(after.body.find((p) => p.id === p2.id).isFavorite).toBe(false);
  });
});
