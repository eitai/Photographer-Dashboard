const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const s3 = require('../config/s3');

const router = express.Router();

/**
 * GET /api/media/<s3-key>
 *
 * No authentication required — gallery images must be accessible to clients.
 * Generates a presigned S3 URL and redirects the browser to it.
 *
 * The key must start with "admins/" — this validates that only objects stored
 * under our per-admin prefix can be served (no path-traversal to other buckets).
 *
 * The presigned URL signing is a local HMAC operation (no S3 network call),
 * so this endpoint is fast enough to handle all image requests.
 */
router.get('/*', asyncHandler(async (req, res) => {
  if (!s3.isEnabled()) {
    return res.status(503).json({ message: 'Object storage not configured' });
  }

  const key = req.params[0];

  if (!key || !key.startsWith('admins/')) {
    return res.status(400).json({ message: 'Invalid media key' });
  }

  const signedUrl = await s3.generatePresignedUrl(key);

  // Allow browsers to cache the redirect for up to 1 hour.
  // The presigned URL itself is valid for 7 days, so a cached redirect
  // will keep working long after the cache entry expires.
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.redirect(302, signedUrl);
}));

module.exports = router;
