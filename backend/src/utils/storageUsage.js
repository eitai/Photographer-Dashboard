const pool = require('../db');

/**
 * Returns the total storage used in bytes for a given admin.
 * Sums gallery_images.size plus video sizes stored in the galleries.videos JSONB column.
 *
 * Single source of truth — used by checkQuota middleware, GET /plans/me,
 * GET /admins/:id/storage, and any future storage-reporting endpoints.
 *
 * @param {string} adminId
 * @returns {Promise<number>}
 */
async function getStorageUsedBytes(adminId) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(gi.size), 0)::bigint
       + COALESCE((
           SELECT SUM((v->>'size')::bigint)
           FROM galleries g2, jsonb_array_elements(g2.videos) v
           WHERE g2.admin_id = $1 AND (v->>'size') IS NOT NULL
         ), 0)::bigint AS used
     FROM admins a
     LEFT JOIN galleries g ON g.admin_id = a.id
     LEFT JOIN gallery_images gi ON gi.gallery_id = g.id
     WHERE a.id = $1
     GROUP BY a.id`,
    [adminId]
  );
  return Number(rows[0]?.used ?? 0);
}

module.exports = { getStorageUsedBytes };
