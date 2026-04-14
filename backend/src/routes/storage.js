const express = require('express');
const pool = require('../db');
const asyncHandler = require('../middleware/asyncHandler');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/storage/me — authenticated admin, returns own storage stats
router.get('/me', protect, asyncHandler(async (req, res) => {
  // Superadmins have unlimited storage — skip quota column entirely
  const isSuperadmin = req.admin.role === 'superadmin';

  const usageQuery = `
    SELECT
      COALESCE(SUM(gi.size), 0)::bigint
      + COALESCE((
          SELECT SUM((v->>'size')::bigint)
          FROM galleries g2, jsonb_array_elements(g2.videos) v
          WHERE g2.admin_id = $1 AND (v->>'size') IS NOT NULL
        ), 0)::bigint AS used
    FROM admins a
    LEFT JOIN galleries g  ON g.admin_id = a.id
    LEFT JOIN gallery_images gi ON gi.gallery_id = g.id
    WHERE a.id = $1`;

  const quotaQuery = `
    SELECT
      COALESCE(SUM(gi.size), 0)::bigint
      + COALESCE((
          SELECT SUM((v->>'size')::bigint)
          FROM galleries g2, jsonb_array_elements(g2.videos) v
          WHERE g2.admin_id = $1 AND (v->>'size') IS NOT NULL
        ), 0)::bigint AS used,
      a.storage_quota_bytes AS quota
    FROM admins a
    LEFT JOIN galleries g  ON g.admin_id = a.id
    LEFT JOIN gallery_images gi ON gi.gallery_id = g.id
    WHERE a.id = $1
    GROUP BY a.storage_quota_bytes`;

  const { rows } = await pool.query(isSuperadmin ? usageQuery : quotaQuery, [req.admin.id]);

  const used  = Number(rows[0]?.used ?? 0);
  // null quota (superadmin or unlimited admin) = no limit
  const quota = isSuperadmin ? null : (rows[0]?.quota != null ? Number(rows[0].quota) : null);

  res.json({
    adminId:     req.admin.id,
    usedBytes:   used,
    quotaBytes:  quota,
    usedGB:      parseFloat((used  / 1024 ** 3).toFixed(2)),
    quotaGB:     quota !== null ? parseFloat((quota / 1024 ** 3).toFixed(2)) : null,
    percentUsed: quota !== null && quota > 0 ? parseFloat(((used / quota) * 100).toFixed(1)) : 0,
    unlimited:   isSuperadmin,
  });
}));

module.exports = router;
