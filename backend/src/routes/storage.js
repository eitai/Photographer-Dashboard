const express = require('express');
const pool = require('../db');
const asyncHandler = require('../middleware/asyncHandler');
const { protect } = require('../middleware/auth');
const s3 = require('../config/s3');

const router = express.Router();

// GET /api/storage/me — authenticated admin, returns own storage stats
router.get('/me', protect, asyncHandler(async (req, res) => {
  const isSuperadmin = req.admin.role === 'superadmin';

  let used;

  if (s3.isEnabled()) {
    // S3 is the source of truth — list all objects under admins/<adminId>/
    // This counts gallery images, thumbnails, videos, blog images, hero/profile images — everything.
    try {
      used = await s3.listAdminStorageBytes(req.admin.id);
    } catch (s3Err) {
      const logger = require('../utils/logger');
      logger.error('[storage/me] S3 listAdminStorageBytes failed:', s3Err.message);
      return res.status(503).json({ error: 'Storage service temporarily unavailable', detail: s3Err.message });
    }
  } else {
    // Fallback: sum sizes from DB (gallery images + video sizes only)
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
    const { rows } = await pool.query(usageQuery, [req.admin.id]);
    used = Number(rows[0]?.used ?? 0);
  }

  let quota = null;

  if (!isSuperadmin) {
    const { rows } = await pool.query(
      'SELECT storage_quota_bytes AS quota FROM admins WHERE id = $1',
      [req.admin.id]
    );
    quota = rows[0]?.quota != null ? Number(rows[0].quota) : null;
  }

  res.json({
    adminId:     req.admin.id,
    usedBytes:   used,
    quotaBytes:  quota,
    usedGB:      parseFloat((used / 1024 ** 3).toFixed(2)),
    quotaGB:     quota !== null ? parseFloat((quota / 1024 ** 3).toFixed(2)) : null,
    percentUsed: quota !== null && quota > 0 ? parseFloat(((used / quota) * 100).toFixed(1)) : 0,
    unlimited:   isSuperadmin,
  });
}));

// GET /api/storage/s3-ping — quick S3 connectivity check for debugging
router.get('/s3-ping', protect, asyncHandler(async (req, res) => {
  if (!s3.isEnabled()) {
    return res.json({ enabled: false });
  }
  const c = s3.cfg();
  const result = { enabled: true, bucket: c.bucket, region: c.region, endpoint: c.endpoint || 'aws default' };
  try {
    const { HeadBucketCommand } = require('@aws-sdk/client-s3');
    await s3.getS3Client().send(new HeadBucketCommand({ Bucket: c.bucket }));
    result.status = 'ok';
  } catch (err) {
    result.status = 'error';
    result.error = err.message;
    result.code = err.name;
    result.httpStatus = err.$metadata?.httpStatusCode;
  }
  res.json(result);
}));

module.exports = router;
