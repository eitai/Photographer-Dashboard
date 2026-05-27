const express = require('express');
const pool = require('../db');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, superprotect } = require('../middleware/auth');
const { getStorageUsedBytes } = require('../utils/storageUsage');
const { UUID_RE } = require('../utils/uuid');
const payplus = require('../utils/payplus');
const { FREE_TIER_BYTES } = Subscription;
const ANNUAL_DISCOUNT = 0.8; // 20% discount when billed annually

const router = express.Router();

// GET /api/plans — public: active plans for pricing page
router.get('/', asyncHandler(async (req, res) => {
  const plans = await Plan.findAll({ includeInactive: false });
  res.json(plans);
}));

// ── Superadmin plan management ──────────────────────────────────────────────
// IMPORTANT: literal paths (/admin, /admin/subscriptions, /admin/subscriptions/:adminId)
// are defined BEFORE parameterized paths (/admin/:id) to prevent shadowing.

// GET /api/plans/admin — all plans including inactive
router.get('/admin', superprotect, asyncHandler(async (req, res) => {
  const plans = await Plan.findAll({ includeInactive: true });
  res.json(plans);
}));

// GET /api/plans/admin/subscriptions — all photographer subscriptions
router.get('/admin/subscriptions', superprotect, asyncHandler(async (req, res) => {
  const { status, planId, page = 1 } = req.query;
  if (planId && !UUID_RE.test(planId))
    return res.status(400).json({ message: 'Invalid planId format' });
  const subs = await Subscription.findAll({ status, planId, page: Number(page) });
  res.json(subs);
}));

// PATCH /api/plans/admin/subscriptions/:adminId — manually override plan (no Stripe)
router.patch('/admin/subscriptions/:adminId', superprotect, asyncHandler(async (req, res) => {
  const { planId, billingInterval, customStorageGb } = req.body;
  if (!planId) return res.status(400).json({ message: 'planId is required' });

  const plan = await Plan.findById(planId);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  if (plan.slug === 'custom' && (customStorageGb == null || customStorageGb <= 0)) {
    return res.status(400).json({ message: 'customStorageGb must be a positive number for the custom plan' });
  }

  const sub = await Subscription.upsert(req.params.adminId, {
    planId,
    billingInterval: billingInterval || null,
    customStorageGb: plan.slug === 'custom' ? customStorageGb : null,
    status: 'active',
  });
  res.json(sub);
}));

// PUT /api/plans/admin/:id — update plan definition (parameterized — must come after all literal /admin/* routes)
router.put('/admin/:id', superprotect, asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  const allowed = [
    'name', 'description',
    'storageBytes', 'priceMonthlyIls', 'priceAnnualIls',
    'pricePerGbIls', 'customMinGb', 'customMaxGb',
    'isActive', 'sortOrder',
  ];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }

  const NUMERIC_FIELDS = [
    'storageBytes', 'priceMonthlyIls', 'priceAnnualIls',
    'pricePerGbIls', 'customMinGb', 'customMaxGb', 'sortOrder',
  ];
  for (const field of NUMERIC_FIELDS) {
    if (data[field] !== undefined && typeof data[field] !== 'number')
      return res.status(400).json({ message: `${field} must be a number` });
  }
  if (data.isActive !== undefined && typeof data.isActive !== 'boolean')
    return res.status(400).json({ message: 'isActive must be a boolean' });

  const updated = await Plan.update(req.params.id, data);
  res.json(updated);
}));

// ── Photographer subscription info ──────────────────────────────────────────

// GET /api/plans/me — current plan + storage usage
router.get('/me', protect, asyncHandler(async (req, res) => {
  const sub = await Subscription.findByAdminId(req.admin.id);
  // If no subscription exists (e.g. migration not yet run), treat as a 10 GB free fallback —
  // consistent with how checkQuota handles a missing subscription row.
  if (!sub) {
    return res.json({
      plan: { id: null, slug: 'free', name: 'Free', storageBytes: FREE_TIER_BYTES,
              priceMonthlyIls: 0, priceAnnualIls: 0, pricePerGbIls: null,
              customMinGb: null, customMaxGb: null },
      subscription: { id: null, status: 'active', billingInterval: null,
                      customStorageGb: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
      storage: { usedBytes: 0, quotaBytes: FREE_TIER_BYTES,
                 usedGb: 0, quotaGb: parseFloat((FREE_TIER_BYTES / 1024 ** 3).toFixed(2)), percentUsed: 0 },
    });
  }

  const quota = Subscription.resolveQuotaBytes(sub);
  const usedBytes = await getStorageUsedBytes(req.admin.id);

  res.json({
    plan: {
      id:              sub.planId,
      slug:            sub.planSlug,
      name:            sub.planName,
      storageBytes:    quota,
      priceMonthlyIls: sub.priceMonthlyIls,
      priceAnnualIls:  sub.priceAnnualIls,
      pricePerGbIls:   sub.pricePerGbIls,
      customMinGb:     sub.customMinGb,
      customMaxGb:     sub.customMaxGb,
    },
    subscription: {
      id:                 sub.id,
      status:             sub.status,
      billingInterval:    sub.billingInterval,
      customStorageGb:    sub.customStorageGb,
      currentPeriodEnd:   sub.currentPeriodEnd,
      cancelAtPeriodEnd:  sub.cancelAtPeriodEnd,
    },
    storage: {
      usedBytes,
      quotaBytes:   quota,
      usedGb:       parseFloat((usedBytes / 1024 ** 3).toFixed(2)),
      quotaGb:      quota ? parseFloat((quota / 1024 ** 3).toFixed(2)) : null,
      percentUsed:  quota ? parseFloat(((usedBytes / quota) * 100).toFixed(1)) : 0,
    },
  });
}));

// GET /api/plans/custom-price — live price calculator (no auth)
router.get('/custom-price', asyncHandler(async (req, res) => {
  const gb = parseInt(req.query.gb, 10);
  const interval = req.query.billingInterval;

  if (!gb || gb < 1) return res.status(400).json({ message: 'gb must be a positive integer' });
  if (!['monthly', 'annual'].includes(interval))
    return res.status(400).json({ message: 'billingInterval must be monthly or annual' });

  const plan = await Plan.findBySlug('custom');
  if (!plan || !plan.pricePerGbIls)
    return res.status(503).json({ message: 'Custom plan pricing not configured' });

  const minGb = plan.customMinGb ?? 1;
  const maxGb = plan.customMaxGb ?? null;
  if (gb < minGb)
    return res.status(400).json({ message: `Minimum storage is ${minGb} GB` });
  if (maxGb !== null && gb > maxGb)
    return res.status(400).json({ message: `Maximum storage is ${maxGb} GB` });

  const pricePerGb     = Number(plan.pricePerGbIls);
  const totalMonthly   = parseFloat((gb * pricePerGb).toFixed(2));
  const totalAnnual    = parseFloat((totalMonthly * 12 * ANNUAL_DISCOUNT).toFixed(2));
  const annualDiscount = parseFloat((totalMonthly * 12 - totalAnnual).toFixed(2));

  res.json({
    gb,
    pricePerGb,
    totalMonthly,
    totalAnnual,
    annualDiscount,
    effectiveMonthlyIfAnnual: parseFloat((totalAnnual / 12).toFixed(2)),
  });
}));

// ── PayPlus subscription payment flow ──────────────────────────────────────

// POST /api/plans/checkout — create a PayPlus hosted payment page for the chosen plan
router.post('/checkout', protect, asyncHandler(async (req, res) => {
  const { planId, billingInterval, customStorageGb } = req.body;
  if (!planId) return res.status(400).json({ message: 'planId is required' });
  if (!['monthly', 'annual'].includes(billingInterval))
    return res.status(400).json({ message: 'billingInterval must be monthly or annual' });

  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive)
    return res.status(404).json({ message: 'Plan not found' });
  if (plan.slug === 'free')
    return res.status(400).json({ message: 'Free plan does not require payment' });

  let amount;
  if (plan.slug === 'custom') {
    if (!customStorageGb || customStorageGb < 1)
      return res.status(400).json({ message: 'customStorageGb is required for the custom plan' });
    const pricePerGb = Number(plan.pricePerGbIls);
    if (!pricePerGb)
      return res.status(503).json({ message: 'Custom plan pricing not configured' });
    const monthly = parseFloat((customStorageGb * pricePerGb).toFixed(2));
    amount = billingInterval === 'annual'
      ? parseFloat((monthly * 12 * ANNUAL_DISCOUNT).toFixed(2))
      : monthly;
  } else {
    amount = billingInterval === 'annual'
      ? Number(plan.priceAnnualIls)
      : Number(plan.priceMonthlyIls);
    if (!amount)
      return res.status(503).json({ message: 'Plan pricing not configured' });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const result = await payplus.generatePaymentLink({
    amount,
    adminId:        req.admin.id,
    planId,
    planName:       `${plan.name} (${billingInterval})`,
    billingInterval,
    customStorageGb: plan.slug === 'custom' ? customStorageGb : null,
    successUrl:  `${frontendUrl}/admin/billing?payment=success`,
    failureUrl:  `${frontendUrl}/admin/billing?payment=failed`,
    cancelUrl:   `${frontendUrl}/admin/billing`,
    callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/plans/webhook`,
  });

  const url = result?.data?.payment_page_link;
  if (!url) return res.status(502).json({ message: 'PayPlus did not return a payment URL' });

  res.json({ url });
}));

// POST /api/plans/webhook — PayPlus callback (no auth — called by PayPlus servers)
// Raw body is needed for signature verification; Express json() already parsed it here
// because the payment link includes the callback URL. Signature check is best-effort
// until PayPlus account access confirms the exact field/algorithm.
router.post('/webhook', asyncHandler(async (req, res) => {
  const payload = req.body;

  // Verify signature — skip in dev if PAYPLUS_SECRET_KEY not set
  if (process.env.PAYPLUS_SECRET_KEY && !payplus.verifyWebhookSignature(payload)) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  // Only process approved transactions
  const status = payload?.data?.status_code || payload?.status_code;
  if (status !== '000' && status !== 0) {
    return res.json({ received: true, skipped: true });
  }

  let moreInfo = {};
  try { moreInfo = JSON.parse(payload.more_info || '{}'); } catch (_) { /* ignore */ }

  const { adminId, planId, billingInterval, customStorageGb } = moreInfo;
  if (!adminId || !planId) return res.json({ received: true, skipped: true });

  const payplusCustomerUid  = payload?.data?.customer?.customer_uid || null;
  const payplusRecurringUid = payload?.data?.recurring_uid || null;
  const amount              = payload?.data?.amount || null;
  const transactionUid      = payload?.data?.transaction_uid || null;

  // Determine period boundaries (monthly or annual from now)
  const now   = new Date();
  const end   = new Date(now);
  if (billingInterval === 'annual') end.setFullYear(end.getFullYear() + 1);
  else                               end.setMonth(end.getMonth() + 1);

  await Subscription.upsert(adminId, {
    planId,
    status:              'active',
    billingInterval,
    customStorageGb:     customStorageGb || null,
    payplusCustomerUid,
    payplusRecurringUid,
    currentPeriodStart:  now.toISOString(),
    currentPeriodEnd:    end.toISOString(),
    cancelAtPeriodEnd:   false,
  });

  // Log billing event
  await pool.query(
    `INSERT INTO billing_events
       (admin_id, subscription_id, type, amount, currency, description)
     SELECT $1, s.id, 'payment_succeeded', $2, 'ILS', $3
     FROM subscriptions s WHERE s.admin_id = $1`,
    [adminId, amount, `Plan: ${planId} | ${billingInterval} | tx: ${transactionUid}`]
  );

  res.json({ received: true });
}));

// POST /api/plans/cancel — cancel at period end
router.post('/cancel', protect, asyncHandler(async (req, res) => {
  const sub = await Subscription.findByAdminId(req.admin.id);
  if (!sub) return res.status(404).json({ message: 'No active subscription' });
  if (!sub.payplusRecurringUid)
    return res.status(400).json({ message: 'No PayPlus recurring ID on file' });

  await payplus.setRecurringValid(sub.payplusRecurringUid, false);
  const updated = await Subscription.update(req.admin.id, { cancelAtPeriodEnd: true });
  res.json(updated);
}));

// POST /api/plans/reactivate — remove cancel_at_period_end
router.post('/reactivate', protect, asyncHandler(async (req, res) => {
  const sub = await Subscription.findByAdminId(req.admin.id);
  if (!sub) return res.status(404).json({ message: 'No active subscription' });
  if (!sub.payplusRecurringUid)
    return res.status(400).json({ message: 'No PayPlus recurring ID on file' });

  await payplus.setRecurringValid(sub.payplusRecurringUid, true);
  const updated = await Subscription.update(req.admin.id, { cancelAtPeriodEnd: false });
  res.json(updated);
}));

// GET /api/plans/invoices — billing history for the current admin
router.get('/invoices', protect, asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT id, type, amount, currency, description, created_at
     FROM billing_events
     WHERE admin_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.admin.id, limit, offset]
  );

  const { rows: [{ count }] } = await pool.query(
    'SELECT COUNT(*) FROM billing_events WHERE admin_id = $1',
    [req.admin.id]
  );

  res.json({ invoices: rows, total: Number(count), page, limit });
}));

module.exports = router;
