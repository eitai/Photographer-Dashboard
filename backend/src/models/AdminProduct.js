const pool = require('../db');
const { rowToCamel } = require('../db/utils');

const DEFAULT_PRODUCTS = [
  { name: 'אלבום', type: 'album', maxPhotos: 30 },
  { name: 'הדפסת קנבס', type: 'print', maxPhotos: 1 },
];

async function find(adminId) {
  const { rows } = await pool.query(
    'SELECT * FROM admin_products WHERE admin_id = $1 ORDER BY created_at ASC',
    [adminId]
  );
  return rows.map(rowToCamel);
}

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO admin_products (admin_id, name, type, max_photos)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.adminId, data.name, data.type, data.maxPhotos]
  );
  return rowToCamel(rows[0]);
}

async function findByIdAndDelete(id, adminId) {
  const { rows } = await pool.query(
    'DELETE FROM admin_products WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function seedDefaults(adminId) {
  for (const p of DEFAULT_PRODUCTS) {
    await create({ adminId, ...p });
  }
}

module.exports = { find, create, findByIdAndDelete, seedDefaults };
