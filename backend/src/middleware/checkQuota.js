const pool = require('../db');
const s3 = require('../config/s3');

const checkQuota = async (req, res, next) => {
  // Superadmins have unlimited storage
  if (req.admin?.role === 'superadmin') return next();

  try {
    // Fetch quota from DB
    const { rows } = await pool.query(
      'SELECT storage_quota_bytes AS quota FROM admins WHERE id = $1',
      [req.admin.id]
    );

    const quota = rows[0]?.quota != null ? Number(rows[0].quota) : null;

    // null quota = unlimited
    if (quota === null) return next();

    // Use the same storage calculation as /api/storage/me so what the user
    // sees in the UI always matches what the quota gate enforces.
    let used;
    if (s3.isEnabled()) {
      used = await s3.listAdminStorageBytes(req.admin.id);
    } else {
      const { rows: usageRows } = await pool.query(
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
         WHERE a.id = $1`,
        [req.admin.id]
      );
      used = Number(usageRows[0]?.used ?? 0);
    }

    if (used >= quota) {
      return res.status(413).json({
        code: 'QUOTA_EXCEEDED',
        message: `Storage quota of ${(quota / 1024 ** 3).toFixed(1)} GB exceeded`,
        used,
        quota,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = checkQuota;
