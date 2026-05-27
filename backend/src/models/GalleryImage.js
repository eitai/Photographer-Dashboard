const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM gallery_images WHERE id = $1', [id]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function find(filter = {}, sortOpts = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.galleryId) { conditions.push(`gallery_id = $${i++}`); vals.push(filter.galleryId); }
  if (filter._id && filter._id.$in) {
    conditions.push(`id = ANY($${i++}::uuid[])`);
    vals.push(filter._id.$in);
  }
  if (filter.folderId) {
    conditions.push(`folder_ids @> ARRAY[$${i++}::uuid]`);
    vals.push(filter.folderId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM gallery_images ${where} ORDER BY sort_order ASC, created_at ASC`,
    vals
  );
  return rows.map(rowToCamel);
}

async function findPaginated(filter, sort, skip, limit) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.galleryId) { conditions.push(`gallery_id = $${i++}`); vals.push(filter.galleryId); }
  if (filter.folderId) {
    conditions.push(`folder_ids @> ARRAY[$${i++}::uuid]`);
    vals.push(filter.folderId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM gallery_images ${where} ORDER BY sort_order ASC, created_at ASC LIMIT $${i++} OFFSET $${i++}`,
      [...vals, limit, skip]
    ),
    pool.query(`SELECT COUNT(*)::int AS count FROM gallery_images ${where}`, vals),
  ]);

  return {
    images: dataRes.rows.map(rowToCamel),
    total: countRes.rows[0].count,
  };
}

async function countDocuments(filter = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.galleryId) { conditions.push(`gallery_id = $${i++}`); vals.push(filter.galleryId); }
  if (filter._id && filter._id.$in) {
    conditions.push(`id = ANY($${i++}::uuid[])`);
    vals.push(filter._id.$in);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM gallery_images ${where}`,
    vals
  );
  return rows[0].count;
}

async function insertMany(docs) {
  if (!docs.length) return [];
  const results = [];
  for (const doc of docs) {
    const folderIds = Array.isArray(doc.folderIds) && doc.folderIds.length ? doc.folderIds : [];
    const { rows } = await pool.query(
      `INSERT INTO gallery_images
         (gallery_id, filename, original_name, path, thumbnail_path, preview_path, before_path, sort_order, size, folder_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid[]) RETURNING *`,
      [
        doc.galleryId,
        doc.filename,
        doc.originalName || null,
        doc.path,
        doc.thumbnailPath || null,
        doc.previewPath || null,
        doc.beforePath || null,
        doc.sortOrder || 0,
        doc.size || 0,
        folderIds,
      ]
    );
    results.push(rowToCamel(rows[0]));
  }
  return results;
}

async function updateFolderIds(imageId, folderIds) {
  const { rows } = await pool.query(
    'UPDATE gallery_images SET folder_ids = $1::uuid[], updated_at = NOW() WHERE id = $2 RETURNING *',
    [folderIds, imageId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function save(image) {
  const { rows } = await pool.query(
    `UPDATE gallery_images
     SET before_path = $1, thumbnail_path = $2, preview_path = $3, sort_order = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [
      image.beforePath   || null,
      image.thumbnailPath || null,
      image.previewPath  || null,
      image.sortOrder    || 0,
      image.id,
    ]
  );
  const updated = rowToCamel(rows[0]);
  Object.assign(image, updated);
  return image;
}

async function findByIdAndDelete(id) {
  await pool.query('DELETE FROM gallery_images WHERE id = $1', [id]);
}

module.exports = {
  findById,
  find,
  findPaginated,
  countDocuments,
  insertMany,
  updateFolderIds,
  save,
  findByIdAndDelete,
};
