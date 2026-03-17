const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO contact_submissions (admin_id, name, phone, email, session_type, message)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      data.adminId || null,
      data.name,
      data.phone || null,
      data.email || null,
      data.sessionType || null,
      data.message || null,
    ]
  );
  return rowToCamel(rows[0]);
}

async function find(filter = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM contact_submissions ${where} ORDER BY created_at DESC`,
    vals
  );
  return rows.map(rowToCamel);
}

async function findOneAndDelete(filter) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;

  const { rows } = await pool.query(
    'DELETE FROM contact_submissions WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

module.exports = { create, find, findOneAndDelete };
