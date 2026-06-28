/**
 * Payment Webhook Security Tests — PayPlus subscription/plans webhook.
 *
 * Locks in the hardening applied to POST /api/plans/webhook:
 *   - fail-closed when PAYPLUS_SECRET_KEY is missing
 *   - reject invalid signatures
 *   - reject amounts below the plan price (no ₪0 provisioning)
 *   - provision only on a valid signature + status '000' + correct amount
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
// S3 service validates these at module load — provide dummy values for the test process.
process.env.S3_BUCKET = process.env.S3_BUCKET || 'test-bucket';
process.env.S3_REGION = process.env.S3_REGION || 'auto';
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://example.invalid';
process.env.S3_PUBLIC_URL = process.env.S3_PUBLIC_URL || 'https://cdn.example.invalid';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test';

const PAYPLUS_SECRET = 'test_payplus_secret_key';
process.env.PAYPLUS_SECRET_KEY = PAYPLUS_SECRET;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

const crypto = require('crypto');
const request = require('supertest');
const { pool, connectDB } = require('../src/config/db');
const Admin = require('../src/models/Admin');
const Subscription = require('../src/models/Subscription');

let app;
let admin;
let planId;
const SUFFIX = Date.now();
const PRICE_MONTHLY = 100;

/** Build a webhook payload with a valid HMAC signature over more_info. */
function signedPayload(moreInfoObj, { statusCode = '000', amount = PRICE_MONTHLY, sign = true, badSig = false } = {}) {
  const more_info = JSON.stringify(moreInfoObj);
  const payload = {
    more_info,
    data: {
      status_code: statusCode,
      amount,
      transaction_uid: `tx_${SUFFIX}`,
      customer: { customer_uid: `cust_${SUFFIX}` },
      recurring_uid: `rec_${SUFFIX}`,
    },
  };
  if (sign) {
    const sig = crypto.createHmac('sha256', PAYPLUS_SECRET).update(more_info).digest('hex');
    payload.more_info_signature = badSig ? 'deadbeef' : sig;
  }
  return payload;
}

beforeAll(async () => {
  await connectDB();
  app = require('../src/app');

  admin = await Admin.create({
    name: 'Plan Admin',
    email: `plan_${SUFFIX}@test.com`,
    password: 'password123',
    role: 'admin',
  });

  const { rows } = await pool.query(
    `INSERT INTO plans (slug, name, storage_bytes, price_monthly_ils, price_annual_ils, is_active, sort_order)
     VALUES ($1, 'Test Pro', 10737418240, $2, $3, true, 99)
     RETURNING id`,
    [`test_pro_${SUFFIX}`, PRICE_MONTHLY, PRICE_MONTHLY * 10]
  );
  planId = rows[0].id;
}, 30000);

afterAll(async () => {
  await pool.query('DELETE FROM billing_events WHERE admin_id = $1', [admin.id]);
  await pool.query('DELETE FROM subscriptions WHERE admin_id = $1', [admin.id]);
  await pool.query('DELETE FROM plans WHERE id = $1', [planId]);
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('POST /api/plans/webhook — signature & amount hardening', () => {
  test('fails closed (400) when PAYPLUS_SECRET_KEY is not configured', async () => {
    const saved = process.env.PAYPLUS_SECRET_KEY;
    delete process.env.PAYPLUS_SECRET_KEY;
    try {
      const res = await request(app)
        .post('/api/plans/webhook')
        .send(signedPayload({ adminId: admin.id, planId, billingInterval: 'monthly' }));
      expect(res.status).toBe(400);
    } finally {
      process.env.PAYPLUS_SECRET_KEY = saved;
    }
  });

  test('rejects an invalid signature (400)', async () => {
    const res = await request(app)
      .post('/api/plans/webhook')
      .send(signedPayload({ adminId: admin.id, planId, billingInterval: 'monthly' }, { badSig: true }));
    expect(res.status).toBe(400);
  });

  test('rejects a missing signature (400)', async () => {
    const res = await request(app)
      .post('/api/plans/webhook')
      .send(signedPayload({ adminId: admin.id, planId, billingInterval: 'monthly' }, { sign: false }));
    expect(res.status).toBe(400);
  });

  test('skips non-000 transactions without provisioning', async () => {
    const res = await request(app)
      .post('/api/plans/webhook')
      .send(signedPayload({ adminId: admin.id, planId, billingInterval: 'monthly' }, { statusCode: '999' }));
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    const sub = await Subscription.findByAdminId(admin.id);
    expect(sub == null || sub.planId !== planId).toBe(true);
  });

  test('rejects an amount below the plan price (400, no ₪0 provisioning)', async () => {
    const res = await request(app)
      .post('/api/plans/webhook')
      .send(signedPayload({ adminId: admin.id, planId, billingInterval: 'monthly' }, { amount: 1 }));
    expect(res.status).toBe(400);
    const sub = await Subscription.findByAdminId(admin.id);
    expect(sub == null || sub.planId !== planId).toBe(true);
  });

  test('provisions on valid signature + status 000 + correct amount', async () => {
    const res = await request(app)
      .post('/api/plans/webhook')
      .send(signedPayload({ adminId: admin.id, planId, billingInterval: 'monthly' }, { amount: PRICE_MONTHLY }));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    const sub = await Subscription.findByAdminId(admin.id);
    expect(sub).toBeTruthy();
    expect(sub.planId).toBe(planId);
    expect(sub.status).toBe('active');
  });
});
