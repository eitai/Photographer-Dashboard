const pool = require('../db');
const bcrypt = require('bcryptjs');
const { rowToCamel } = require('../db/utils');
const { UUID_RE } = require('../utils/uuid');

/**
 * Strip the password field from a supplier object before returning it
 * to any caller. Mutates in place and returns the same object for convenience.
 */
function scrub(supplier) {
  if (supplier) delete supplier.password;
  return supplier;
}

// Whitelist of fields safe to return to a supplier about themselves. Excludes
// password, apiWebhookUrl, payplus*, createdBySuperadminId and any future columns.
const SUPPLIER_PUBLIC_FIELDS = ['id', 'name', 'email', 'phone', 'contactPerson', 'logoPath', 'isActive', 'isExclusive'];
function formatSupplier(supplier) {
  if (!supplier) return supplier;
  const out = {};
  for (const f of SUPPLIER_PUBLIC_FIELDS) {
    if (supplier[f] !== undefined) out[f] = supplier[f];
  }
  return out;
}

async function findById(id) {
  if (!id || !UUID_RE.test(id)) return null;
  const { rows } = await pool.query(
    'SELECT * FROM suppliers WHERE id = $1',
    [id]
  );
  return rows[0] ? scrub(rowToCamel(rows[0])) : null;
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM suppliers WHERE email = $1 LIMIT 1',
    [email]
  );
  // NOTE: do NOT scrub here — comparePassword needs the hash
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findAll({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : 'WHERE s.is_active = true';
  const { rows } = await pool.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM store_orders WHERE supplier_id = s.id)::int AS order_count
       FROM suppliers s
       ${where}
      ORDER BY s.name ASC`
  );
  return rows.map((r) => scrub(rowToCamel(r)));
}

async function create(data) {
  const hash = await bcrypt.hash(data.password, 12);
  const { rows } = await pool.query(
    `INSERT INTO suppliers
       (name, email, password, phone, contact_person, logo_path,
        is_active, is_exclusive, api_webhook_url, created_by_superadmin_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.email,
      hash,
      data.phone            || null,
      data.contactPerson    || null,
      data.logoPath         || null,
      data.isActive         !== undefined ? data.isActive         : true,
      data.isExclusive      !== undefined ? data.isExclusive      : false,
      data.apiWebhookUrl    || null,
      data.createdBySuperadminId || null,
    ]
  );
  return scrub(rowToCamel(rows[0]));
}

async function update(id, data) {
  const colMap = {
    name:           'name',
    email:          'email',
    phone:          'phone',
    contactPerson:  'contact_person',
    logoPath:       'logo_path',
    isActive:       'is_active',
    isExclusive:    'is_exclusive',
    apiWebhookUrl:  'api_webhook_url',
  };

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    if (!colMap[k]) continue;
    sets.push(`${colMap[k]} = $${i++}`);
    vals.push(v === undefined ? null : v);
  }

  if (!sets.length) return findById(id);

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const { rows } = await pool.query(
    `UPDATE suppliers SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? scrub(rowToCamel(rows[0])) : null;
}

async function deleteById(id) {
  await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
}

/**
 * Make exactly one supplier exclusive.
 * Runs in a transaction: first clears all, then sets the target.
 */
async function setExclusive(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE suppliers SET is_exclusive = false, updated_at = NOW()');
    const { rows } = await client.query(
      'UPDATE suppliers SET is_exclusive = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    await client.query('COMMIT');
    return rows[0] ? scrub(rowToCamel(rows[0])) : null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function comparePassword(supplier, plaintext) {
  return bcrypt.compare(plaintext, supplier.password);
}

async function countOrders(id) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM store_orders WHERE supplier_id = $1',
    [id]
  );
  return rows[0].count;
}

module.exports = {
  formatSupplier,
  findById,
  findByEmail,
  findAll,
  create,
  update,
  delete: deleteById,
  setExclusive,
  comparePassword,
  countOrders,
};
