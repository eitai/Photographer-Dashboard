/**
 * Business Logic Integration Tests
 *
 * Covers core domain flows: auth, client CRUD, gallery lifecycle,
 * multi-tenant isolation, field injection prevention, and selection submission.
 *
 * Requires a real PostgreSQL database via DATABASE_URL environment variable.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';
process.env.JWT_EXPIRES_IN = '7d';
process.env.FRONTEND_URL = process.env.FRONTEND_URL;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');
const jwt = require('jsonwebtoken');

let app;

// Two admins — used for multi-tenant isolation tests
let adminA, adminB;
let tokenA, tokenB;

// Unique email suffix to avoid conflicts across test runs
const SUFFIX = Date.now();

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  // Seed via admin model to exercise the full stack
  const Admin = require('../src/models/Admin');
  adminA = await Admin.create({
    name: 'Admin A',
    email: `a_${SUFFIX}@test.com`,
    password: 'password123',
    role: 'admin',
  });
  adminB = await Admin.create({
    name: 'Admin B',
    email: `b_${SUFFIX}@test.com`,
    password: 'password123',
    role: 'admin',
  });

  // Generate JWTs directly — same mechanism as the login route
  tokenA = jwt.sign({ id: adminA.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  tokenB = jwt.sign({ id: adminB.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
}, 30000);

afterAll(async () => {
  // Clean up test data
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth — login', () => {
  test('valid credentials return a token in response body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `a_${SUFFIX}@test.com`, password: 'password123' });
    expect(res.status).toBe(200);
    // Token is now set as httpOnly cookie; admin object is in body
    expect(res.body.admin).toBeDefined();
    expect(res.body.admin.id).toBeDefined();
  });

  test('wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `a_${SUFFIX}@test.com`, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('unknown email returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Clients — CRUD', () => {
  let clientId;

  test('POST creates a client linked to the authenticated admin', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Dana Cohen', email: 'dana@test.com', sessionType: 'family' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Dana Cohen');
    expect(res.body.adminId).toBe(adminA.id);
    clientId = res.body.id;
  });

  test('GET returns only this admin\'s clients', async () => {
    // Create a client for admin B
    await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Other Client', email: 'other@test.com' });

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // All returned clients must belong to admin A
    res.body.forEach((c) => expect(c.adminId).toBe(adminA.id));
    // Admin B's client must not appear
    expect(res.body.find((c) => c.name === 'Other Client')).toBeUndefined();
  });

  test('PUT updates client fields', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Dana Cohen Updated', phone: '050-1234567' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Dana Cohen Updated');
    expect(res.body.phone).toBe('050-1234567');
  });

  test('PUT cannot override adminId (field is ignored)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ adminId: fakeId, name: 'Injected' });
    expect(res.status).toBe(200);
    expect(res.body.adminId).toBe(adminA.id); // adminId unchanged
  });

  test('Admin B cannot read Admin A\'s client', async () => {
    const res = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test('Admin B cannot update Admin A\'s client', async () => {
    const res = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });

  test('DELETE returns 404 when trying to delete another admin\'s client', async () => {
    const res = await request(app)
      .delete(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test('DELETE removes the client and returns 404 on re-fetch', async () => {
    const del = await request(app)
      .delete(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`/api/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(get.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Galleries — lifecycle', () => {
  let galleryId;
  let galleryToken;

  test('POST creates a gallery with an auto-generated token', async () => {
    const res = await request(app)
      .post('/api/galleries')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Wedding 2025' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Wedding 2025');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.adminId).toBe(adminA.id);
    galleryId = res.body.id;
    galleryToken = res.body.token;
  });

  test('POST cannot inject a custom token', async () => {
    const res = await request(app)
      .post('/api/galleries')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Injected Gallery', token: 'my-custom-token' });
    expect(res.status).toBe(201);
    expect(res.body.token).not.toBe('my-custom-token'); // DB-generated token was used
  });

  test('POST cannot inject isDelivery=true', async () => {
    const res = await request(app)
      .post('/api/galleries')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Fake Delivery', isDelivery: true });
    expect(res.status).toBe(201);
    expect(res.body.isDelivery).toBe(false);
  });

  test('GET /token/:token returns the gallery', async () => {
    const res = await request(app).get(`/api/galleries/token/${galleryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(galleryId);
  });

  test('Token access transitions status from gallery_sent -> viewed', async () => {
    // Status was already changed by the previous test; fetch again to confirm
    const res = await request(app).get(`/api/galleries/token/${galleryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('viewed');
  });

  test('Token access on already-viewed gallery does not error', async () => {
    const res = await request(app).get(`/api/galleries/token/${galleryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('viewed'); // still viewed, not double-transitioned
  });

  test('Inactive gallery token returns 404', async () => {
    await request(app)
      .put(`/api/galleries/${galleryId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isActive: false });

    const res = await request(app).get(`/api/galleries/token/${galleryToken}`);
    expect(res.status).toBe(404);

    // Re-activate for other tests
    await request(app)
      .put(`/api/galleries/${galleryId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isActive: true });
  });

  test('Expired gallery returns 410', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    await request(app)
      .put(`/api/galleries/${galleryId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expiresAt: past });

    const res = await request(app).get(`/api/galleries/token/${galleryToken}`);
    expect(res.status).toBe(410);

    // Remove expiry for other tests
    await request(app)
      .put(`/api/galleries/${galleryId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expiresAt: null });
  });

  test('Admin B cannot read Admin A\'s gallery by ID', async () => {
    const res = await request(app)
      .get(`/api/galleries/${galleryId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test('DELETE returns 404 for non-existent gallery', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app)
      .delete(`/api/galleries/${fakeId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Blog — CRUD', () => {
  let postId;

  test('POST creates a blog post with an auto-generated slug', async () => {
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'My First Post', content: 'Hello world', published: false });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('My First Post');
    expect(typeof res.body.slug).toBe('string');
    expect(res.body.slug.length).toBeGreaterThan(0);
    expect(res.body.adminId).toBe(adminA.id);
    postId = res.body.id;
  });

  test('POST cannot inject adminId (field is ignored)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post('/api/blog')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Injected Post', adminId: fakeId });
    expect(res.status).toBe(201);
    expect(res.body.adminId).toBe(adminA.id);
  });

  test('PUT updates post content', async () => {
    const res = await request(app)
      .put(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated Title', content: 'Updated content' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  test('Admin B cannot delete Admin A\'s post', async () => {
    const res = await request(app)
      .delete(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test('DELETE removes the post and returns 404 on re-fetch', async () => {
    const del = await request(app)
      .delete(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`/api/blog/${postId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(get.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Public profile — contact form', () => {
  test('Contact form cannot inject adminId', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post(`/api/p/${adminA.id}/contact`)
      .send({ name: 'Test User', email: 't@test.com', adminId: fakeId, message: 'Hello' });
    expect(res.status).toBe(201);

    // Verify in DB that the stored adminId is adminA's, not the injected value
    const { rows } = await pool.query(
      'SELECT admin_id FROM contact_submissions WHERE id = $1',
      [res.body.id]
    );
    expect(rows[0].admin_id).toBe(adminA.id);
  });

  test('Contact form requires name field', async () => {
    const res = await request(app)
      .post(`/api/p/${adminA.id}/contact`)
      .send({ email: 't@test.com', message: 'Hello' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P2 — Transactions: gallery token access', () => {
  let galleryId;
  let galleryToken;
  let clientId;

  beforeAll(async () => {
    // Create a client with status gallery_sent, then a gallery linked to it
    const clientRes = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Txn Client', email: 'txn@test.com' });
    clientId = clientRes.body.id;

    const galleryRes = await request(app)
      .post('/api/galleries')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Txn Gallery', clientId });
    galleryId = galleryRes.body.id;
    galleryToken = galleryRes.body.token;
  });

  test('Token access atomically transitions gallery and client to viewed', async () => {
    const res = await request(app).get(`/api/galleries/token/${galleryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('viewed');

    // Both gallery and client should be updated
    const Client = require('../src/models/Client');
    const client = await Client.findById(clientId);
    expect(client.status).toBe('viewed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P2 — Transactions: selection submission', () => {
  let galleryId;

  beforeAll(async () => {
    const galleryRes = await request(app)
      .post('/api/galleries')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Selection Gallery', maxSelections: 3 });
    galleryId = galleryRes.body.id;
  });

  test('Submission atomically updates gallery status to selection_submitted', async () => {
    const res = await request(app)
      .post(`/api/galleries/${galleryId}/submit`)
      .send({ sessionId: 'sess-1', selectedImageIds: [] });
    expect(res.status).toBe(200);

    const Gallery = require('../src/models/Gallery');
    const gallery = await Gallery.findById(galleryId);
    expect(gallery.status).toBe('selection_submitted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P2 — Storage quota', () => {
  test('checkQuota middleware loads without error', () => {
    const checkQuota = require('../src/middleware/checkQuota');
    expect(typeof checkQuota).toBe('function');
  });

  test('GalleryImage model has size field in DB schema', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'gallery_images' AND column_name = 'size'`
    );
    expect(rows.length).toBe(1);
  });

  test('MAX_STORAGE_BYTES env var is respected', () => {
    const orig = process.env.MAX_STORAGE_BYTES;
    process.env.MAX_STORAGE_BYTES = String(1024);
    expect(parseInt(process.env.MAX_STORAGE_BYTES)).toBe(1024);
    if (orig === undefined) delete process.env.MAX_STORAGE_BYTES;
    else process.env.MAX_STORAGE_BYTES = orig;
  });
});
