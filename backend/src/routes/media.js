const express = require('express');
const helmet = require('helmet');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const asyncHandler = require('../middleware/asyncHandler');
const s3 = require('../config/s3');
const logger = require('../utils/logger');

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
 * Streams objects directly from S3 using the SDK's GetObjectCommand (same auth
 * as uploads) instead of presigned URLs + fetch. This avoids Wasabi's presigned
 * URL restrictions and uses the same credential path that uploads use.
 *
 * The key must start with "admins/" or "face-references/" — prevents path-traversal.
 */
router.get('/*', asyncHandler(async (req, res) => {
  if (!s3.isEnabled()) {
    return res.status(503).json({ message: 'Object storage not configured' });
  }

  const key = req.params[0];

  const ALLOWED_PREFIXES = ['admins/', 'face-references/'];
  if (!key || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return res.status(400).json({ message: 'Invalid media key' });
  }

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const t0 = Date.now();
  logger.info(`[media] GET key="${key}" range="${req.headers.range || ''}" ip=${req.ip}`);

  const params = {
    Bucket: s3.cfg().bucket,
    Key: key,
  };

  // Forward Range header for video seeking.
  if (VIDEO_EXT.test(key) && req.headers.range) {
    params.Range = req.headers.range;
  }

  let s3Response;
  try {
    s3Response = await s3.getS3Client().send(new GetObjectCommand(params));
  } catch (err) {
    const status = err.$metadata?.httpStatusCode || 500;
    logger.error(`[media] S3 error key="${key}" status=${status} err=${err.message} dt=${Date.now() - t0}ms`);
    if (status === 404 || err.name === 'NoSuchKey') {
      return res.status(404).json({ message: 'Media not found' });
    }
    return res.status(status === 416 ? 416 : 502).json({ message: 'Media unavailable' });
  }

  const dt = Date.now() - t0;
  const ct = s3Response.ContentType || 'application/octet-stream';
  const cl = s3Response.ContentLength;
  logger.info(`[media] S3 ok key="${key}" type=${ct} size=${cl}B dt=${dt}ms`);

  res.setHeader('Content-Type', ct);
  if (cl) res.setHeader('Content-Length', cl);
  if (s3Response.ContentRange) res.setHeader('Content-Range', s3Response.ContentRange);
  if (s3Response.AcceptRanges) res.setHeader('Accept-Ranges', s3Response.AcceptRanges);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const statusCode = params.Range ? 206 : 200;
  res.status(statusCode);

  if (!s3Response.Body) return res.end();

  s3Response.Body.transformToWebStream().then((webStream) => {
    const { Readable } = require('stream');
    const nodeStream = Readable.fromWeb(webStream);
    nodeStream.on('error', (err) => {
      logger.error(`[media] stream error key="${key}" err=${err.message}`);
      if (!res.headersSent) res.status(502).end(); else res.destroy();
    });
    nodeStream.pipe(res);
  }).catch((err) => {
    logger.error(`[media] body transform error key="${key}" err=${err.message}`);
    if (!res.headersSent) res.status(502).end();
  });
}));

module.exports = router;
