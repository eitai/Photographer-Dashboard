const express = require('express');
const pool = require('../db');
const asyncHandler = require('../middleware/asyncHandler');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/storage/me — authenticated admin, returns own storage stats
router.get('/me', protect, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
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
     GROUP BY a.storage_quota_bytes`,
    [req.admin.id]
  );
  const used  = Number(rows[0]?.used  ?? 0);
  const quota = Number(rows[0]?.quota ?? 10 * 1024 ** 3);
  res.json({
    adminId:     req.admin.id,
    usedBytes:   used,
    quotaBytes:  quota,
    usedGB:      parseFloat((used  / 1024 ** 3).toFixed(2)),
    quotaGB:     parseFloat((quota / 1024 ** 3).toFixed(2)),
    percentUsed: quota > 0 ? parseFloat(((used / quota) * 100).toFixed(1)) : 0,
  });
}));

module.exports = router;
