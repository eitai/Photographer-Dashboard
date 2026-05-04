const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function findByGalleryId(galleryId) {
  const { rows } = await pool.query(
    'SELECT * FROM gallery_folders WHERE gallery_id = $1 ORDER BY sort_order ASC, created_at ASC',
    [galleryId]
  );
  return rows.map(rowToCamel);
}

async function create(data) {
  const { galleryId, name, sortOrder = 0 } = data;
  const { rows } = await pool.query(
    'INSERT INTO gallery_folders (gallery_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
    [galleryId, name, sortOrder]
  );
  return rowToCamel(rows[0]);
}

async function findByIdAndUpdate(id, adminId, data) {
  const sets = [];
  const vals = [];
  let i = 1;

  if (data.name !== undefined) { sets.push(`name = $${i++}`); vals.push(data.name); }
  if (data.sortOrder !== undefined) { sets.push(`sort_order = $${i++}`); vals.push(data.sortOrder); }
  if (!sets.length) return null;

  sets.push(`updated_at = NOW()`);
  vals.push(id, adminId);

  const { rows } = await pool.query(
    `UPDATE gallery_folders
     SET ${sets.join(', ')}
     WHERE id = $${i++}
       AND gallery_id IN (SELECT id FROM galleries WHERE admin_id = $${i++})
     RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findByIdAndDelete(id, adminId) {
  const { rows } = await pool.query(
    `DELETE FROM gallery_folders
     WHERE id = $1
       AND gallery_id IN (SELECT id FROM galleries WHERE admin_id = $2)
     RETURNING id`,
    [id, adminId]
  );
  return rows[0] ? rows[0].id : null;
}

module.exports = { findByGalleryId, create, findByIdAndUpdate, findByIdAndDelete };
