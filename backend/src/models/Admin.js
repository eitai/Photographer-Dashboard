const pool = require('../db');
const bcrypt = require('bcryptjs');
const { rowToCamel } = require('../db/utils');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findById(id) {
  if (!id || !UUID_RE.test(id)) return null;
  const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findOne(filter) {
  // Supports: { email }, { username }, { $or: [{email}, {username}] }
  if (filter.$or) {
    const { rows } = await pool.query(
      'SELECT * FROM admins WHERE email = $1 OR username = $2 LIMIT 1',
      [filter.$or[0].email || null, filter.$or[1].username || null]
    );
    return rows[0] ? rowToCamel(rows[0]) : null;
  }
  const key = Object.keys(filter)[0];
  // Map camelCase filter keys to snake_case columns
  const colMap = {
    studioName: 'studio_name',
    pushToken: 'push_token',
    admin_id: 'admin_id',
  };
  const col = colMap[key] || key;
  const { rows } = await pool.query(
    `SELECT * FROM admins WHERE ${col} = $1 LIMIT 1`,
    [filter[key]]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function find() {
  const { rows } = await pool.query(
    `SELECT
       a.*,
       COALESCE(SUM(gi.size), 0)::bigint
       + COALESCE((
           SELECT SUM((v->>'size')::bigint)
           FROM galleries g2, jsonb_array_elements(g2.videos) v
           WHERE g2.admin_id = a.id AND (v->>'size') IS NOT NULL
         ), 0)::bigint AS storage_used_bytes
     FROM admins a
     LEFT JOIN galleries g  ON g.admin_id = a.id
     LEFT JOIN gallery_images gi ON gi.gallery_id = g.id
     GROUP BY a.id
     ORDER BY a.created_at ASC`
  );
  return rows.map((r) => {
    const a = rowToCamel(r);
    delete a.password;
    return a;
  });
}

async function countDocuments() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM admins');
  return rows[0].count;
}

async function create(data) {
  const hash = await bcrypt.hash(data.password, 12);
  // null quotaGB = unlimited; omitted quotaGB = default 10 GB
  const quotaBytes =
    data.quotaGB === null ? null :
    data.quotaGB !== undefined ? Math.round(parseFloat(data.quotaGB) * 1024 ** 3) :
    10 * 1024 ** 3;
  const { rows } = await pool.query(
    `INSERT INTO admins (name, email, password, role, username, studio_name, push_token, storage_quota_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.name,
      data.email,
      hash,
      data.role || 'admin',
      data.username || null,
      data.studioName || null,
      data.pushToken || null,
      quotaBytes,
    ]
  );
  return rowToCamel(rows[0]);
}

async function findByIdAndUpdate(id, update) {
  const sets = [];
  const vals = [];
  let i = 1;
  const colMap = {
    name: 'name',
    email: 'email',
    role: 'role',
    username: 'username',
    studioName: 'studio_name',
    pushToken: 'push_token',
  };
  const src = update.$set || update;
  for (const [k, v] of Object.entries(src)) {
    if (k === 'password') continue; // use updatePassword() instead
    if (colMap[k]) {
      sets.push(`${colMap[k]} = $${i++}`);
      vals.push(v === undefined ? null : v);
    }
  }
  if (!sets.length) return findById(id);
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE admins SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  if (!rows[0]) return null;
  const a = rowToCamel(rows[0]);
  delete a.password;
  return a;
}

async function findByIdAndDelete(id) {
  await pool.query('DELETE FROM admins WHERE id = $1', [id]);
}

async function comparePassword(admin, candidate) {
  return bcrypt.compare(candidate, admin.password);
}

async function updatePassword(id, newPassword) {
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE admins SET password = $1, updated_at = NOW() WHERE id = $2',
    [hash, id]
  );
}

module.exports = {
  findById,
  findOne,
  find,
  countDocuments,
  create,
  findByIdAndUpdate,
  findByIdAndDelete,
  comparePassword,
  updatePassword,
};
