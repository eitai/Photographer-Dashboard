const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function _populateGalleries(order) {
  if (!order || !order.allowedGalleryIds || !order.allowedGalleryIds.length) return order;
  const { rows } = await pool.query(
    'SELECT id, name, is_delivery FROM galleries WHERE id = ANY($1::uuid[])',
    [order.allowedGalleryIds]
  );
  order.allowedGalleryIds = rows.map(rowToCamel);
  return order;
}

async function findById(id, { populate } = {}) {
  const { rows } = await pool.query('SELECT * FROM product_orders WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const order = rowToCamel(rows[0]);
  if (populate) return _populateGalleries(order);
  return order;
}

async function find(filter = {}, { populate } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }
  if (filter.clientId) { conditions.push(`client_id = $${i++}`); vals.push(filter.clientId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM product_orders ${where} ORDER BY created_at DESC`,
    vals
  );
  const orders = rows.map(rowToCamel);
  if (!populate) return orders;
  return Promise.all(orders.map(_populateGalleries));
}

async function create(data) {
  const crypto = require('crypto');
  const token = crypto.randomBytes(16).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO product_orders (admin_id, client_id, name, type, max_photos, allowed_gallery_ids, selected_photo_ids, status, token, link_enabled)
     VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7::jsonb, $8, $9, $10) RETURNING *`,
    [
      data.adminId,
      data.clientId,
      data.name,
      data.type,
      data.maxPhotos || 1,
      data.allowedGalleryIds || [],
      JSON.stringify(data.selectedPhotoIds || []),
      data.status || 'pending',
      token,
      false,
    ]
  );
  return rowToCamel(rows[0]);
}

async function save(order) {
  const { rows } = await pool.query(
    `UPDATE product_orders
     SET selected_photo_ids = $1::jsonb, status = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [JSON.stringify(order.selectedPhotoIds || []), order.status, order.id]
  );
  const updated = rowToCamel(rows[0]);
  Object.assign(order, updated);
  return order;
}

async function updateAllowedGalleries(id, allowedGalleryIds) {
  const { rows } = await pool.query(
    `UPDATE product_orders SET allowed_gallery_ids = $1::uuid[], updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [allowedGalleryIds, id]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function markDelivered(id) {
  const { rows } = await pool.query(
    `UPDATE product_orders SET status = 'delivered', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function setLinkEnabled(id, enabled) {
  const { rows } = await pool.query(
    `UPDATE product_orders SET link_enabled = $1 WHERE id = $2 RETURNING *`,
    [enabled, id]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findByToken(token) {
  const { rows } = await pool.query(
    `SELECT * FROM product_orders WHERE token = $1 LIMIT 1`,
    [token]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findOneAndDelete(filter) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;
  const { rows } = await pool.query(
    'DELETE FROM product_orders WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

module.exports = {
  findById,
  find,
  create,
  save,
  updateAllowedGalleries,
  markDelivered,
  setLinkEnabled,
  findByToken,
  findOneAndDelete,
};
