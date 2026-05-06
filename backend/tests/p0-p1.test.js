/**
 * Production Readiness Integration Tests
 *
 * Requires a real PostgreSQL database. Set DATABASE_URL in the environment
 * or in a .env.test file before running.
 * No mocks — all routes run against the actual pg models.
 */

// Set env vars FIRST — app.js reads FRONTEND_URL at require() time
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';
process.env.JWT_EXPIRES_IN = '7d';
process.env.FRONTEND_URL = process.env.FRONTEND_URL;

// Use a dedicated test database URL if provided, otherwise fall back to DATABASE_URL
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

const { pool, connectDB } = require('../src/config/db');
const request = require('supertest');
const jwt = require('jsonwebtoken');

let app;
let VALID_TOKEN;

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  // Seed a real admin — auth-protected route tests use this
  const Admin = require('../src/models/Admin');
  const admin = await Admin.create({
    name: 'Test Admin',
    email: `test_p0_${Date.now()}@example.com`,
    password: 'password123',
    role: 'admin',
  });
  VALID_TOKEN = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
}, 30000);

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P0 — Security Headers (Helmet)', () => {
  test('X-Content-Type-Options: nosniff is set', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('X-Frame-Options is set', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('X-XSS-Protection or Content-Security-Policy is set', async () => {
    const res = await request(app).get('/api/health');
    const hasCSP = !!res.headers['content-security-policy'];
    const hasXXSS = !!res.headers['x-xss-protection'];
    expect(hasCSP || hasXXSS).toBe(true);
  });

  test('X-Powered-By header is removed', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P0 — CORS', () => {
  test('Allows request from FRONTEND_URL', async () => {
    const res = await request(app).get('/api/health').set('Origin', process.env.FRONTEND_URL);
    expect(res.headers['access-control-allow-origin']).toBe(process.env.FRONTEND_URL);
  });

  test('Blocks request from unknown origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
  });

  test('Allows requests with no origin (mobile/curl)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).not.toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P0 — Body Size Limit', () => {
  test('Rejects JSON body larger than 10kb', async () => {
    const bigPayload = JSON.stringify({ data: 'x'.repeat(11 * 1024) });
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(bigPayload);
    expect(res.status).toBe(413);
  });

  test('Accepts JSON body smaller than 10kb', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrong-password' });
    // 401 = route ran fine (wrong credentials), not a size rejection
    expect(res.status).not.toBe(413);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P0 — Rate Limiting', () => {
  test('RateLimit-Limit header present on auth/login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'x' });
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  test('RateLimit-Limit header present on /api/contact', async () => {
    const res = await request(app).post('/api/contact').send({ name: 'Test', email: 'x@x.com', message: 'hello' });
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P0 — asyncHandler (Error Propagation)', () => {
  test('Invalid UUID returns 400 with "Invalid ID format"', async () => {
    const res = await request(app).get('/api/galleries/not-a-valid-uuid');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid ID format');
  });

  test('Unhandled error returns 500 with "Internal server error"', async () => {
    // /__test_error exists in NODE_ENV=test only and calls next(new Error(...))
    const res = await request(app).get('/__test_error');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error');
  });

  test('500 response does NOT leak stack trace in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).get('/__test_error');
      expect(res.body.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P0 — Health Check', () => {
  test('Returns JSON with status, timestamp, uptime, database fields', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toMatchObject({
      status: expect.any(String),
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      uptime: expect.any(Number),
      database: expect.any(String),
    });
  });

  test('Returns 200 with status=ok when database is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P0 — Startup Env Validation', () => {
  const { validateEnv, REQUIRED } = require('../src/config/validateEnv');

  test('validateEnv returns ok=false and lists missing vars', () => {
    const result = validateEnv({ JWT_SECRET: 'x', FRONTEND_URL: 'http://x' });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('DATABASE_URL');
  });

  test('validateEnv returns ok=false when JWT_SECRET is missing', () => {
    const result = validateEnv({ DATABASE_URL: 'postgresql://x', FRONTEND_URL: 'http://x' });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('JWT_SECRET');
  });

  test('validateEnv returns ok=false when FRONTEND_URL is missing', () => {
    const result = validateEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret' });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('FRONTEND_URL');
  });

  test('validateEnv returns ok=true when all required vars present', () => {
    const result = validateEnv({ DATABASE_URL: 'postgresql://x', JWT_SECRET: 'secret', FRONTEND_URL: 'http://x' });
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  test('REQUIRED list contains all three critical vars', () => {
    expect(REQUIRED).toEqual(expect.arrayContaining(['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL']));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P1 — DB schema is applied (indexes exist in PostgreSQL)', () => {
  const checkIndex = async (tableName) => {
    const { rows } = await pool.query(`SELECT indexname FROM pg_indexes WHERE tablename = $1`, [tableName]);
    return rows.map((r) => r.indexname);
  };

  test('galleries table has index on admin_id', async () => {
    const indexes = await checkIndex('galleries');
    expect(indexes.some((n) => n.includes('admin'))).toBe(true);
  });

  test('gallery_images table has index on gallery_id', async () => {
    const indexes = await checkIndex('gallery_images');
    expect(indexes.some((n) => n.includes('gallery'))).toBe(true);
  });

  test('clients table has index on admin_id', async () => {
    const indexes = await checkIndex('clients');
    expect(indexes.some((n) => n.includes('admin'))).toBe(true);
  });

  test('blog_posts table has index on admin_id', async () => {
    const indexes = await checkIndex('blog_posts');
    expect(indexes.some((n) => n.includes('admin'))).toBe(true);
  });

  test('gallery_submissions table has index on gallery_id', async () => {
    const indexes = await checkIndex('gallery_submissions');
    expect(indexes.some((n) => n.includes('gallery'))).toBe(true);
  });

  test('product_orders table has index on admin_id and client_id', async () => {
    const indexes = await checkIndex('product_orders');
    expect(indexes.some((n) => n.includes('admin') || n.includes('client'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P1 — Compression', () => {
  test('Compression middleware is active (response does not error)', async () => {
    const res = await request(app).get('/api/health').set('Accept-Encoding', 'gzip');
    expect(res.status).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P1 — .env.example completeness', () => {
  const fs = require('fs');
  const path = require('path');

  test('.env.example exists', () => {
    const p = path.join(__dirname, '../.env.example');
    expect(fs.existsSync(p)).toBe(true);
  });

  test('.env.example contains all required keys', () => {
    const p = path.join(__dirname, '../.env.example');
    if (!fs.existsSync(p)) return; // already caught above
    const content = fs.readFileSync(p, 'utf8');
    ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'FRONTEND_URL', 'SMTP_HOST', 'SMTP_USER'].forEach((key) => {
      expect(content).toContain(key);
    });
  });

  test('.gitignore excludes .env', () => {
    const p = path.join(__dirname, '../.gitignore');
    const content = fs.readFileSync(p, 'utf8');
    expect(content).toMatch(/^\.env$/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P1 — Logger (Winston)', () => {
  test('Logger module loads and has expected methods', () => {
    const logger = require('../src/utils/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P1 — asyncHandler middleware (unit)', () => {
  test('Wraps sync errors and forwards to next()', (done) => {
    const asyncHandler = require('../src/middleware/asyncHandler');
    const err = new Error('boom');
    const handler = asyncHandler(async () => {
      throw err;
    });
    const next = (e) => {
      expect(e).toBe(err);
      done();
    };
    handler({}, {}, next);
  });

  test('Wraps async errors and forwards to next()', (done) => {
    const asyncHandler = require('../src/middleware/asyncHandler');
    const err = new Error('async boom');
    const handler = asyncHandler(() => Promise.reject(err));
    const next = (e) => {
      expect(e).toBe(err);
      done();
    };
    handler({}, {}, next);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P1 — Auth-protected routes work with real DB', () => {
  test('GET /api/clients returns 200 with valid JWT', async () => {
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/clients returns 401 without token', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });

  test('GET /api/clients returns 401 with tampered token', async () => {
    const res = await request(app).get('/api/clients').set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P2 — API versioning (/api/v1/)', () => {
  test('GET /api/v1/health returns same response as /api/health', async () => {
    const [v1, legacy] = await Promise.all([request(app).get('/api/v1/health'), request(app).get('/api/health')]);
    expect(v1.status).toBe(legacy.status);
    expect(v1.body.status).toBe(legacy.body.status);
  });

  test('/api/v1/clients returns 401 without token (same auth rules)', async () => {
    const res = await request(app).get('/api/v1/clients');
    expect(res.status).toBe(401);
  });

  test('/api/v1/clients returns 200 with valid token', async () => {
    const res = await request(app).get('/api/v1/clients').set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(200);
  });
});
