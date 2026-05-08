const express = require('express');
const { Readable } = require('stream');
const helmet = require('helmet');
const asyncHandler = require('../middleware/asyncHandler');
const s3 = require('../config/s3');

const router = express.Router();

// Override Helmet's app-level "same-origin" CORP — media must load cross-origin
// (frontend at :8080 embeds images/videos served from API at :5000).
router.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

const VIDEO_EXT = /\.(mp4|mov|avi|webm)$/i;

/**
 * GET /api/media/<s3-key>
 *
 * No authentication required — gallery media must be accessible to clients.
 *
 * Images  → fast 302 redirect to a presigned URL (signing is local HMAC, no S3 call).
 * Videos  → content is proxied so the browser can send Range requests for seeking.
 *           Redirecting to a presigned URL breaks video streaming because each range
 *           request gets a new presigned URL (different signature timestamp), which
 *           confuses browsers trying to buffer/seek.
 *
 * The key must start with "admins/" — prevents path-traversal to other bucket paths.
 */
router.get('/*', asyncHandler(async (req, res) => {
  if (!s3.isEnabled()) {
    return res.status(503).json({ message: 'Object storage not configured' });
  }

  const key = req.params[0];

  if (!key || !key.startsWith('admins/')) {
    return res.status(400).json({ message: 'Invalid media key' });
  }

  // Allow cross-origin loads (frontend on :8080 loading from API on :5000)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const signedUrl = await s3.generatePresignedUrl(key);

  // Images → 302 redirect to the presigned URL.
  // The browser follows the redirect directly to S3 — no proxying overhead,
  // works with all Node.js versions, and scales without saturating the backend.
  if (!VIDEO_EXT.test(key)) {
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.redirect(302, signedUrl);
  }

  // Videos → proxy so the browser can send Range requests for seeking.
  // Redirecting breaks video streaming because each Range request arrives with
  // a different timestamp, producing a different presigned signature that S3 rejects.
  const upstreamHeaders = {};
  if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;

  const upstream = await fetch(signedUrl, { headers: upstreamHeaders });

  if (!upstream.ok) {
    return res.status(upstream.status).json({ message: 'Media unavailable' });
  }

  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const val = upstream.headers.get(h);
    if (val) res.setHeader(h, val);
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.status(upstream.status);

  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res);
}));

module.exports = router;
