const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function findAll({ includeInactive = false } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM plans
     ${includeInactive ? '' : 'WHERE is_active = true'}
     ORDER BY sort_order ASC`
  );
  return rows.map(rowToCamel);
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM plans WHERE id = $1', [id]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findBySlug(slug) {
  const { rows } = await pool.query('SELECT * FROM plans WHERE slug = $1', [slug]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function update(id, data) {
  const colMap = {
    name:                 'name',
    description:          'description',
    storageBytes:         'storage_bytes',
    priceMonthlyIls:      'price_monthly_ils',
    priceAnnualIls:       'price_annual_ils',
    pricePerGbIls:        'price_per_gb_ils',
    customMinGb:          'custom_min_gb',
    customMaxGb:          'custom_max_gb',
    stripePriceIdMonthly: 'stripe_price_id_monthly',
    stripePriceIdAnnual:  'stripe_price_id_annual',
    isActive:             'is_active',
    sortOrder:            'sort_order',
  };

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    if (colMap[k] !== undefined) {
      sets.push(`${colMap[k]} = $${i++}`);
      vals.push(v === undefined ? null : v);
    }
  }
  if (!sets.length) return findById(id);

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const { rows } = await pool.query(
    `UPDATE plans SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

module.exports = { findAll, findById, findBySlug, update };
