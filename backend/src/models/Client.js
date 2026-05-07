const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findOne(filter) {
  // Supports: { _id, adminId } or { id, adminId }
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;
  const { rows } = await pool.query(
    'SELECT * FROM clients WHERE id = $1 AND admin_id = $2 LIMIT 1',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function find(filter = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;
  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }
  if (filter.status) { conditions.push(`status = $${i++}`); vals.push(filter.status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM clients ${where} ORDER BY created_at DESC LIMIT 500`,
    vals
  );
  return rows.map(rowToCamel);
}

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO clients (admin_id, name, phone, email, session_type, notes, status, event_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.adminId,
      data.name,
      data.phone || null,
      data.email ? data.email.toLowerCase() : null,
      data.sessionType || null,
      data.notes || null,
      data.status || 'gallery_sent',
      data.eventDate || null,
    ]
  );
  return rowToCamel(rows[0]);
}

async function findOneAndUpdate(filter, update, opts = {}, pgClient = null) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;

  const sets = [];
  const vals = [];
  let i = 1;
  const colMap = {
    name: 'name',
    phone: 'phone',
    email: 'email',
    sessionType: 'session_type',
    notes: 'notes',
    status: 'status',
    eventDate: 'event_date',
    faceRecognitionEnabled: 'face_recognition_enabled',
  };

  const src = update.$set || update;
  for (const [k, v] of Object.entries(src)) {
    if (colMap[k]) {
      sets.push(`${colMap[k]} = $${i++}`);
      vals.push(v === undefined ? null : (k === 'email' && v ? v.toLowerCase() : v));
    }
  }

  if (!sets.length) return findOne({ _id: id, adminId });
  sets.push(`updated_at = NOW()`);

  // Build WHERE clause
  const whereParts = [`id = $${i++}`];
  vals.push(id);
  if (adminId) { whereParts.push(`admin_id = $${i++}`); vals.push(adminId); }
  if (filter.status) {
    if (Array.isArray(filter.status.$in)) {
      whereParts.push(`status = ANY($${i++}::text[])`);
      vals.push(filter.status.$in);
    } else {
      whereParts.push(`status = $${i++}`);
      vals.push(filter.status);
    }
  }

  const db = pgClient || pool;
  const { rows } = await db.query(
    `UPDATE clients SET ${sets.join(', ')} WHERE ${whereParts.join(' AND ')} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findOneAndDelete(filter) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;
  const { rows } = await pool.query(
    'DELETE FROM clients WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findByIdAndUpdate(id, update, opts = {}, pgClient = null) {
  return findOneAndUpdate({ _id: id }, update, opts, pgClient);
}

module.exports = {
  findById,
  findOne,
  find,
  create,
  findOneAndUpdate,
  findOneAndDelete,
  findByIdAndUpdate,
};
