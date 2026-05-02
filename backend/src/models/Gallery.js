const pool = require('../db');
const { rowToCamel } = require('../db/utils');

function toRow(data) {
  // Map camelCase input to snake_case for insert/update
  const map = {
    adminId: 'admin_id',
    clientId: 'client_id',
    clientName: 'client_name',
    headerMessage: 'header_message',
    isActive: 'is_active',
    expiresAt: 'expires_at',
    maxSelections: 'max_selections',
    sessionType: 'session_type',
    isDelivery: 'is_delivery',
    deliveryOf: 'delivery_of',
    lastEmailSentAt: 'last_email_sent_at',
  };
  const row = {};
  for (const [k, v] of Object.entries(data)) {
    const col = map[k] || k;
    row[col] = v;
  }
  return row;
}

async function _populateClient(gallery) {
  if (!gallery || !gallery.clientId) return gallery;
  const { rows } = await pool.query(
    'SELECT id, name, email, phone FROM clients WHERE id = $1',
    [gallery.clientId]
  );
  if (rows[0]) {
    gallery.clientId = rowToCamel(rows[0]);
  }
  return gallery;
}

async function findById(id, { populate } = {}) {
  const { rows } = await pool.query('SELECT * FROM galleries WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const g = rowToCamel(rows[0]);
  if (populate) return _populateClient(g);
  return g;
}

async function findOne(filter, { populate } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.token !== undefined) { conditions.push(`token = $${i++}`); vals.push(filter.token); }
  if (filter.isActive !== undefined) { conditions.push(`is_active = $${i++}`); vals.push(filter.isActive); }
  if (filter._id || filter.id) { conditions.push(`id = $${i++}`); vals.push(filter._id || filter.id); }
  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }

  if (!conditions.length) return null;
  const { rows } = await pool.query(
    `SELECT * FROM galleries WHERE ${conditions.join(' AND ')} LIMIT 1`,
    vals
  );
  if (!rows[0]) return null;
  const g = rowToCamel(rows[0]);
  if (populate) return _populateClient(g);
  return g;
}

async function find(filter = {}, { populate } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }
  if (filter.clientId) { conditions.push(`client_id = $${i++}`); vals.push(filter.clientId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM galleries ${where} ORDER BY created_at DESC LIMIT 500`,
    vals
  );
  const galleries = rows.map(rowToCamel);
  if (!populate) return galleries;
  return Promise.all(galleries.map((g) => _populateClient(g)));
}

async function create(data, client = null) {
  const row = toRow(data);
  const cols = ['name', 'admin_id'];
  const placeholders = ['$1', '$2'];
  const vals = [row.name, row.admin_id || null];
  let i = 3;

  const optionals = [
    'client_id', 'client_name', 'header_message', 'is_active',
    'expires_at', 'status', 'max_selections', 'session_type', 'is_delivery',
    'delivery_of', 'last_email_sent_at', 'videos',
  ];

  for (const col of optionals) {
    if (row[col] !== undefined && row[col] !== null) {
      cols.push(col);
      if (col === 'videos') {
        placeholders.push(`$${i++}::jsonb`);
        vals.push(JSON.stringify(row[col]));
      } else {
        placeholders.push(`$${i++}`);
        vals.push(row[col]);
      }
    }
  }

  const query = client
    ? await client.query(
        `INSERT INTO galleries (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      )
    : await pool.query(
        `INSERT INTO galleries (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      );
  return rowToCamel(query.rows[0]);
}

async function findOneAndUpdate(filter, update, opts = {}) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;

  const sets = [];
  const vals = [];
  let i = 1;
  const colMap = {
    name: 'name',
    clientName: 'client_name',
    headerMessage: 'header_message',
    isActive: 'is_active',
    expiresAt: 'expires_at',
    status: 'status',
    maxSelections: 'max_selections',
    sessionType: 'session_type',
    isDelivery: 'is_delivery',
    deliveryOf: 'delivery_of',
    lastEmailSentAt: 'last_email_sent_at',
    videos: 'videos',
  };

  const src = update.$set || update;
  for (const [k, v] of Object.entries(src)) {
    if (colMap[k] && v !== undefined) {
      if (colMap[k] === 'videos') {
        sets.push(`videos = $${i++}::jsonb`);
        vals.push(JSON.stringify(v));
      } else {
        sets.push(`${colMap[k]} = $${i++}`);
        vals.push(v);
      }
    }
  }

  if (!sets.length) return findOne({ _id: id, adminId });
  sets.push(`updated_at = NOW()`);

  const whereParts = [];
  if (id) { whereParts.push(`id = $${i++}`); vals.push(id); }
  if (adminId) { whereParts.push(`admin_id = $${i++}`); vals.push(adminId); }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `UPDATE galleries SET ${sets.join(', ')} ${where} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function save(gallery, client = null) {
  // Persist a gallery object (used by route code that mutates fields then calls save())
  const colMap = {
    name: 'name',
    clientName: 'client_name',
    headerMessage: 'header_message',
    isActive: 'is_active',
    expiresAt: 'expires_at',
    status: 'status',
    maxSelections: 'max_selections',
    sessionType: 'session_type',
    isDelivery: 'is_delivery',
    deliveryOf: 'delivery_of',
    lastEmailSentAt: 'last_email_sent_at',
    videos: 'videos',
  };

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, col] of Object.entries(colMap)) {
    if (gallery[k] !== undefined) {
      if (col === 'videos') {
        sets.push(`videos = $${i++}::jsonb`);
        vals.push(JSON.stringify(gallery[k]));
      } else {
        sets.push(`${col} = $${i++}`);
        vals.push(gallery[k] === undefined ? null : gallery[k]);
      }
    }
  }
  sets.push(`updated_at = NOW()`);
  vals.push(gallery.id);

  const q = `UPDATE galleries SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`;
  const result = client ? await client.query(q, vals) : await pool.query(q, vals);
  const updated = rowToCamel(result.rows[0]);
  // Mutate in place so callers see updated values
  Object.assign(gallery, updated);
  return gallery;
}

async function findOneAndDelete(filter) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;
  const { rows } = await pool.query(
    'DELETE FROM galleries WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findByIdAndUpdate(id, update, opts = {}) {
  return findOneAndUpdate({ _id: id }, update, opts);
}

module.exports = {
  findById,
  findOne,
  find,
  create,
  save,
  findOneAndUpdate,
  findOneAndDelete,
  findByIdAndUpdate,
};
