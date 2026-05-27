const express = require('express');
const pool = require('../db');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const asyncHandler = require('../middleware/asyncHandler');
const { protect, superprotect } = require('../middleware/auth');

const router = express.Router();

// GET /api/plans — public: active plans for pricing page
router.get('/', asyncHandler(async (req, res) => {
  const plans = await Plan.findAll({ includeInactive: false });
  res.json(plans);
}));

// ── Superadmin plan management ──────────────────────────────────────────────

// GET /api/plans/admin — all plans including inactive
router.get('/admin', superprotect, asyncHandler(async (req, res) => {
  const plans = await Plan.findAll({ includeInactive: true });
  res.json(plans);
}));

// PUT /api/plans/admin/:id — update plan definition
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

  const updated = await Plan.update(req.params.id, data);
  res.json(updated);
}));

// GET /api/plans/admin/subscriptions — all photographer subscriptions
router.get('/admin/subscriptions', superprotect, asyncHandler(async (req, res) => {
  const { status, planId, page = 1 } = req.query;
  const subs = await Subscription.findAll({ status, planId, page: Number(page) });
  res.json(subs);
}));

// PATCH /api/plans/admin/subscriptions/:adminId — manually override plan (no Stripe)
router.patch('/admin/subscriptions/:adminId', superprotect, asyncHandler(async (req, res) => {
  const { planId, billingInterval, customStorageGb } = req.body;
  if (!planId) return res.status(400).json({ message: 'planId is required' });

  const plan = await Plan.findById(planId);
  if (!plan) return res.status(404).json({ message: 'Plan not found' });

  if (plan.slug === 'custom' && !customStorageGb) {
    return res.status(400).json({ message: 'customStorageGb is required for custom plan' });
  }

  const sub = await Subscription.upsert(req.params.adminId, {
    planId,
    billingInterval: billingInterval || null,
    customStorageGb: plan.slug === 'custom' ? customStorageGb : null,
    status: 'active',
  });
  res.json(sub);
}));

// ── Photographer subscription info ──────────────────────────────────────────

// GET /api/plans/me — current plan + storage usage
router.get('/me', protect, asyncHandler(async (req, res) => {
  const sub = await Subscription.findByAdminId(req.admin.id);
  if (!sub) return res.status(404).json({ message: 'Subscription not found' });

  const quota = Subscription.resolveQuotaBytes(sub);

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(gi.size), 0)::bigint
       + COALESCE((
           SELECT SUM((v->>'size')::bigint)
           FROM galleries g2, jsonb_array_elements(g2.videos) v
           WHERE g2.admin_id = $1 AND (v->>'size') IS NOT NULL
         ), 0)::bigint AS used
     FROM admins a
     LEFT JOIN galleries g ON g.admin_id = a.id
     LEFT JOIN gallery_images gi ON gi.gallery_id = g.id
     WHERE a.id = $1
     GROUP BY a.id`,
    [req.admin.id]
  );

  const usedBytes = Number(rows[0]?.used ?? 0);

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

  const pricePerGb     = Number(plan.pricePerGbIls);
  const totalMonthly   = parseFloat((gb * pricePerGb).toFixed(2));
  const totalAnnual    = parseFloat((totalMonthly * 12 * 0.8).toFixed(2));
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

module.exports = router;
