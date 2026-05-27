const pool = require('../db');
const { rowToCamel } = require('../db/utils');
const { UUID_RE } = require('../utils/uuid');

async function findBySupplierId(supplierId, { includeInactive = false } = {}) {
  const where = includeInactive
    ? 'WHERE supplier_id = $1'
    : 'WHERE supplier_id = $1 AND is_active = true';
  const { rows } = await pool.query(
    `SELECT * FROM supplier_products ${where} ORDER BY sort_order ASC`,
    [supplierId]
  );
  return rows.map(rowToCamel);
}

async function findById(id) {
  if (!id || !UUID_RE.test(id)) return null;
  const { rows } = await pool.query(
    'SELECT * FROM supplier_products WHERE id = $1',
    [id]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function create(supplierId, data) {
  const { rows } = await pool.query(
    `INSERT INTO supplier_products
       (supplier_id, name, type, description, sku, specs,
        cost_price, client_price, image_preview_path, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      supplierId,
      data.name,
      data.type,
      data.description       || null,
      data.sku               || null,
      data.specs             !== undefined ? JSON.stringify(data.specs) : '{}',
      data.costPrice,
      data.clientPrice       !== undefined ? data.clientPrice : null,
      data.imagePreviewPath  || null,
      data.isActive          !== undefined ? data.isActive    : true,
      data.sortOrder         !== undefined ? data.sortOrder   : 0,
    ]
  );
  return rowToCamel(rows[0]);
}

async function update(id, data) {
  const colMap = {
    name:             'name',
    type:             'type',
    description:      'description',
    sku:              'sku',
    specs:            'specs',
    costPrice:        'cost_price',
    clientPrice:      'client_price',
    imagePreviewPath: 'image_preview_path',
    isActive:         'is_active',
    sortOrder:        'sort_order',
  };

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    if (!colMap[k]) continue;
    const col = colMap[k];
    // Serialize JSONB field
    if (col === 'specs') {
      sets.push(`${col} = $${i++}`);
      vals.push(JSON.stringify(v));
    } else {
      sets.push(`${col} = $${i++}`);
      vals.push(v === undefined ? null : v);
    }
  }

  if (!sets.length) return findById(id);

  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const { rows } = await pool.query(
    `UPDATE supplier_products SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function deleteById(id) {
  // Refuse if any active order references this product
  const { rows } = await pool.query(
    `SELECT 1
       FROM store_order_items soi
       JOIN store_orders so ON so.id = soi.order_id
      WHERE soi.product_id = $1
        AND so.status NOT IN ('delivered', 'cancelled')
      LIMIT 1`,
    [id]
  );
  if (rows.length > 0) {
    const err = new Error('Cannot delete product with active orders');
    err.status = 409;
    throw err;
  }
  await pool.query('DELETE FROM supplier_products WHERE id = $1', [id]);
}

/**
 * Bulk-update sort_order for an array of { id, sortOrder } items.
 * Uses a single UPDATE ... CASE statement for efficiency.
 */
async function reorder(items) {
  if (!items || items.length === 0) return;

  // Build: CASE WHEN id = $1 THEN $2 WHEN id = $3 THEN $4 ... END
  const caseParts = [];
  const vals = [];
  let i = 1;

  for (const item of items) {
    caseParts.push(`WHEN id = $${i++} THEN $${i++}`);
    vals.push(item.id, item.sortOrder);
  }

  const inPlaceholders = items.map((_, idx) => `$${idx * 2 + 1}`).join(', ');

  await pool.query(
    `UPDATE supplier_products
        SET sort_order = CASE ${caseParts.join(' ')} END,
            updated_at = NOW()
      WHERE id IN (${inPlaceholders})`,
    vals
  );
}

module.exports = {
  findBySupplierId,
  findById,
  create,
  update,
  delete: deleteById,
  reorder,
};
