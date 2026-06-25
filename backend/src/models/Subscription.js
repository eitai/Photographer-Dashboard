const pool = require('../db');
const { rowToCamel } = require('../db/utils');

// Default quota applied when no subscription row exists (e.g. pre-migration admins).
// Must match the seed value set for the 'free' plan in 005_plans_subscriptions.sql.
const FREE_TIER_BYTES = 10 * 1024 ** 3; // 10 GB

async function findByAdminId(adminId) {
  const { rows } = await pool.query(
    `SELECT s.*, p.slug AS plan_slug, p.name AS plan_name,
            p.storage_bytes, p.price_monthly_ils, p.price_annual_ils,
            p.price_per_gb_ils, p.custom_min_gb, p.custom_max_gb
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.admin_id = $1`,
    [adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findAll({ status, planId, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (status) { conditions.push(`s.status = $${i++}`); vals.push(status); }
  if (planId) { conditions.push(`s.plan_id = $${i++}`); vals.push(planId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT s.*,
            p.slug AS plan_slug, p.name AS plan_name,
            p.storage_bytes, p.price_monthly_ils,
            a.name AS admin_name, a.email AS admin_email,
            COALESCE(SUM(gi.size), 0)::bigint
            + COALESCE((
                SELECT SUM((v->>'size')::bigint)
                FROM galleries g2, jsonb_array_elements(g2.videos) v
                WHERE g2.admin_id = a.id AND (v->>'size') IS NOT NULL
              ), 0)::bigint AS storage_used_bytes
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     JOIN admins a ON a.id = s.admin_id
     LEFT JOIN galleries g ON g.admin_id = a.id
     LEFT JOIN gallery_images gi ON gi.gallery_id = g.id
     ${where}
     GROUP BY s.id, p.id, a.id
     ORDER BY s.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...vals, limit, offset]
  );
  return rows.map(rowToCamel);
}

// Create or update subscription for an admin
async function upsert(adminId, data) {
  const { planId, status = 'active', billingInterval = null,
          customStorageGb = null, payplusCustomerUid = null,
          payplusRecurringUid = null, currentPeriodStart = null,
          currentPeriodEnd = null, cancelAtPeriodEnd = false } = data;

  const { rows } = await pool.query(
    `INSERT INTO subscriptions
       (admin_id, plan_id, status, billing_interval, custom_storage_gb,
        payplus_customer_uid, payplus_recurring_uid,
        current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (admin_id) DO UPDATE SET
       plan_id              = EXCLUDED.plan_id,
       status               = EXCLUDED.status,
       billing_interval     = EXCLUDED.billing_interval,
       custom_storage_gb    = EXCLUDED.custom_storage_gb,
       payplus_customer_uid = COALESCE(EXCLUDED.payplus_customer_uid, subscriptions.payplus_customer_uid),
       payplus_recurring_uid= COALESCE(EXCLUDED.payplus_recurring_uid, subscriptions.payplus_recurring_uid),
       current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
       current_period_end   = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at           = NOW()
     RETURNING *`,
    [adminId, planId, status, billingInterval, customStorageGb,
     payplusCustomerUid, payplusRecurringUid,
     currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function update(adminId, data) {
  const colMap = {
    planId:              'plan_id',
    status:              'status',
    billingInterval:     'billing_interval',
    customStorageGb:     'custom_storage_gb',
    payplusCustomerUid:  'payplus_customer_uid',
    payplusRecurringUid: 'payplus_recurring_uid',
    currentPeriodStart:  'current_period_start',
    currentPeriodEnd:    'current_period_end',
    cancelAtPeriodEnd:   'cancel_at_period_end',
  };

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    if (colMap[k] !== undefined) {
      sets.push(`${colMap[k]} = $${i++}`);
      vals.push(v);
    }
  }
  if (!sets.length) return findByAdminId(adminId);

  sets.push(`updated_at = NOW()`);
  vals.push(adminId);

  const { rows } = await pool.query(
    `UPDATE subscriptions SET ${sets.join(', ')}
     WHERE admin_id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

// Resolve effective storage quota in bytes (null = unlimited)
function resolveQuotaBytes(subscription) {
  if (!subscription) return FREE_TIER_BYTES; // fallback: 10 GB
  if (subscription.planSlug === 'custom') {
    // Explicit positive-value check: 0 or null both fall through to null (unlimited),
    // preventing a zero-GB custom plan from being mistaken for unlimited storage.
    return (subscription.customStorageGb != null && subscription.customStorageGb > 0)
      ? subscription.customStorageGb * 1024 ** 3
      : null;
  }
  return subscription.storageBytes ?? null; // null = unlimited
}

// Assign the free plan to a newly created admin.
// Safe to call multiple times — upsert is idempotent.
// Silently skips if the plans table has not yet been migrated.
async function assignFreePlan(adminId) {
  // Lazy require to avoid a circular dependency (Plan → pool, Subscription → pool).
  const Plan = require('./Plan');
  const free = await Plan.findBySlug('free');
  if (!free) return; // plans table not yet migrated
  return upsert(adminId, { planId: free.id, status: 'active' });
}

module.exports = { findByAdminId, findAll, upsert, update, resolveQuotaBytes, assignFreePlan, FREE_TIER_BYTES };
