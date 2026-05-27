const pool = require('../db');
const Subscription = require('../models/Subscription');

const checkQuota = async (req, res, next) => {
  if (req.admin?.role === 'superadmin') return next();

  try {
    const sub = await Subscription.findByAdminId(req.admin.id);
    const quota = Subscription.resolveQuotaBytes(sub);

    // null quota = unlimited
    if (quota === null) return next();

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
      [req.admin.id]
    );

    const used = Number(rows[0]?.used ?? 0);

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
