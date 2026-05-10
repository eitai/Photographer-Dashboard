const express = require('express');
const { Readable } = require('stream');
const helmet = require('helmet');
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
 * ALL content is proxied through this server so the browser always receives
 * responses from OUR domain with controlled headers (CORP: cross-origin,
 * ACAO: *). Redirecting directly to S3 presigned URLs exposes the raw S3
 * domain to the browser, and some S3-compatible providers (R2, Wasabi, etc.)
 * return Cross-Origin-Resource-Policy: same-origin, which browsers enforce on
 * embedded <img>/<video> tags even though top-level navigation is unaffected —
 * causing images to appear broken while the direct URL "works fine".
 *
 * Videos carry Range request headers so seeking works in <video> tags.
 * Images are fetched without Range (whole object in one request).
 *
 * The key must start with "admins/" or "face-references/" — prevents path-traversal.
 */
router.get('/*', asyncHandler(async (req, res) => {
  if (!s3.isEnabled()) {
    return res.status(503).json({ message: 'Object storage not configured' });
  }

  const key = req.params[0];

  // admins/   — all current uploads (images, thumbnails, previews, face crops)
  // face-references/  — legacy face reference photos uploaded before the path
  //                     was changed to admins/<id>/face-references/
  const ALLOWED_PREFIXES = ['admins/', 'face-references/'];
  if (!key || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return res.status(400).json({ message: 'Invalid media key' });
  }

  // Controlled headers — browser always sees our domain, not the raw S3 URL.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const t0 = Date.now();
  logger.info(`[media] GET key="${key}" range="${req.headers.range || ''}" ip=${req.ip}`);

  let signedUrl;
  try {
    signedUrl = await s3.generatePresignedUrl(key);
    logger.info(`[media] presign ok key="${key}" dt=${Date.now() - t0}ms`);
  } catch (err) {
    logger.error(`[media] presign FAILED key="${key}" err=${err.message}`);
    return res.status(500).json({ message: 'Failed to generate media URL' });
  }

  // Forward Range header for video seeking; images don't need it.
  const upstreamHeaders = {};
  if (VIDEO_EXT.test(key) && req.headers.range) {
    upstreamHeaders['Range'] = req.headers.range;
  }

  // 20-second timeout — prevents stalled S3 connections from piling up and
  // blocking the event loop. Without this, a slow S3 response holds the
  // Node socket open for the full 30-second server timeout, causing a
  // cascade where concurrent requests queue up and the server appears hung.
  const abort = new AbortController();
  const abortTimer = setTimeout(() => {
    logger.warn(`[media] TIMEOUT key="${key}" after 20s`);
    abort.abort();
  }, 20_000);

  let upstream;
  try {
    upstream = await fetch(signedUrl, { headers: upstreamHeaders, signal: abort.signal });
  } catch (err) {
    clearTimeout(abortTimer);
    logger.error(`[media] fetch FAILED key="${key}" err=${err.message} dt=${Date.now() - t0}ms`);
    return res.status(504).json({ message: 'Media gateway timeout' });
  }
  clearTimeout(abortTimer);

  const dt = Date.now() - t0;
  if (!upstream.ok && upstream.status !== 206) {
    logger.error(`[media] S3 error key="${key}" status=${upstream.status} dt=${dt}ms`);
    return res.status(upstream.status).json({ message: 'Media unavailable' });
  }

  const ct = upstream.headers.get('content-type') || '?';
  const cl = upstream.headers.get('content-length') || '?';
  logger.info(`[media] S3 ok key="${key}" status=${upstream.status} type=${ct} size=${cl}B dt=${dt}ms`);

  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const val = upstream.headers.get(h);
    if (val) res.setHeader(h, val);
  }
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.status(upstream.status);

  if (!upstream.body) return res.end();

  const stream = Readable.fromWeb(upstream.body);
  stream.on('error', (err) => {
    logger.error(`[media] stream error key="${key}" err=${err.message}`);
    if (!res.headersSent) res.status(502).end(); else res.destroy();
  });
  stream.pipe(res);
}));

module.exports = router;
