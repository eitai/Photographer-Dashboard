/**
 * Direct browser → Wasabi multipart upload plumbing.
 *
 * Flow:
 *   1. Client hashes file (sha256) and POSTs metadata to /init.
 *      Server creates an `assets` row (status='uploading'), opens a multipart
 *      upload on Wasabi, and returns presigned PUT URLs for every part.
 *   2. Client PUTs each chunk directly to Wasabi using those URLs and collects
 *      the ETag from each response.
 *   3. Client POSTs the etag list to /complete; server finalizes the multipart
 *      upload and flips the asset to status='uploaded'.
 *   4. /abort cancels an in-progress upload and removes the row.
 *   5. /:assetId/download-url returns a short-lived presigned GET URL.
 *
 * The API never streams file bytes — only metadata.
 */
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');

const pool = require('../db');
const { protect } = require('../middleware/auth');
const checkQuota = require('../middleware/checkQuota');
const asyncHandler = require('../middleware/asyncHandler');
const { rowToCamel } = require('../db/utils');
const logger = require('../utils/logger');
const { getQueue, JOB_NAMES } = require('../queue');
const {
  createMultipartUpload,
  getPresignedUploadPartUrls,
  completeMultipartUpload,
  abortMultipartUpload,
  getPresignedGetUrl,
  getReadStream,
} = require('../services/storage');

const router = express.Router();

// Vendored decoder lives at /usr/local/bin/photo-djxl in production; env var lets
// dev machines override. Same convention as src/workers/index.js — keep them in
// sync so an ops-level binary swap covers both processes.
const PHOTO_DJXL_BIN = process.env.PHOTO_DJXL_BIN || 'photo-djxl';

// Per-owner concurrency cap on djxl-streaming downloads. In-memory; resets on
// process restart, which is fine — long-lived stuck streams don't survive
// restarts either. Slice 5 may move this to Redis/pg-boss for cross-process.
const MAX_DJXL_PER_OWNER = 4;
const activeDjxlByOwner = new Map(); // ownerId → count

function acquireDjxlSlot(ownerId) {
  const cur = activeDjxlByOwner.get(ownerId) || 0;
  if (cur >= MAX_DJXL_PER_OWNER) return false;
  activeDjxlByOwner.set(ownerId, cur + 1);
  return true;
}

function releaseDjxlSlot(ownerId) {
  const cur = activeDjxlByOwner.get(ownerId) || 0;
  if (cur <= 1) activeDjxlByOwner.delete(ownerId);
  else activeDjxlByOwner.set(ownerId, cur - 1);
}

// ── Constants ────────────────────────────────────────────────────────────────
// 95 MB per part — under Cloudflare's 100 MB body limit (belt & suspenders for
// the day this traffic transits an orange-cloud proxy). S3 minimum part size
// is 5 MB except the last, so this is well within bounds.
const CHUNK_SIZE = 95 * 1024 * 1024;

// 10 GB hard ceiling per asset
const MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitize a user-provided filename for use in an S3 key.
 * Strips path separators, control chars, and parent-dir refs.
 * Always returns at least "file" so a key segment is never empty.
 */
function sanitizeFilename(raw) {
  if (typeof raw !== 'string') return 'file';
  // Strip any path components — only keep the basename
  let base = path.basename(raw);
  // Remove anything that isn't a safe ASCII char. Keep alphanum, dot, dash, underscore.
  base = base.replace(/[^A-Za-z0-9._-]/g, '_');
  // Collapse repeated underscores from the previous step
  base = base.replace(/_{2,}/g, '_');
  // Strip leading dots so we never produce a dotfile or '..'
  base = base.replace(/^\.+/, '');
  // Strip leading hyphens too — the worker shells out to cjxl/djxl with the
  // filename, and a leading '-' would be parsed as a CLI flag.
  base = base.replace(/^[-.]+/, '');
  // Cap length so the S3 key stays well under 1024 bytes
  if (base.length > 200) {
    const ext = path.extname(base).slice(0, 16);
    base = base.slice(0, 200 - ext.length) + ext;
  }
  return base || 'file';
}

/** Validate /init body. Returns {valid:true, value} or {valid:false, error}. */
function validateInitBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body required' };
  }
  const { filename, size, mimeType, sha256, galleryId } = body;

  if (typeof filename !== 'string' || !filename.trim()) {
    return { valid: false, error: 'filename must be a non-empty string' };
  }
  if (filename.length > 512) {
    return { valid: false, error: 'filename too long (max 512 chars)' };
  }

  if (!Number.isInteger(size) || size <= 0) {
    return { valid: false, error: 'size must be a positive integer (bytes)' };
  }
  if (size > MAX_FILE_BYTES) {
    return { valid: false, error: `size exceeds maximum of ${MAX_FILE_BYTES} bytes` };
  }

  if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `mimeType must be one of: ${[...ALLOWED_MIME_TYPES].join(', ')}` };
  }

  if (typeof sha256 !== 'string' || !SHA256_RE.test(sha256)) {
    return { valid: false, error: 'sha256 must be a 64-character hex string' };
  }

  if (galleryId !== undefined && galleryId !== null) {
    if (typeof galleryId !== 'string' || !UUID_RE.test(galleryId)) {
      return { valid: false, error: 'galleryId must be a UUID' };
    }
  }

  return {
    valid: true,
    value: {
      filename: filename.trim(),
      size,
      mimeType,
      sha256: sha256.toLowerCase(),
      galleryId: galleryId || null,
    },
  };
}

/** Validate /complete body. */
function validateCompleteBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body required' };
  }
  const { assetId, uploadId, parts } = body;
  if (typeof assetId !== 'string' || !UUID_RE.test(assetId)) {
    return { valid: false, error: 'assetId must be a UUID' };
  }
  if (typeof uploadId !== 'string' || !uploadId) {
    return { valid: false, error: 'uploadId is required' };
  }
  if (!Array.isArray(parts) || !parts.length) {
    return { valid: false, error: 'parts must be a non-empty array' };
  }
  if (parts.length > 10000) {
    return { valid: false, error: 'too many parts (max 10000)' };
  }
  for (const p of parts) {
    if (!p || typeof p !== 'object') {
      return { valid: false, error: 'each part must be an object' };
    }
    if (!Number.isInteger(p.partNumber) || p.partNumber < 1 || p.partNumber > 10000) {
      return { valid: false, error: 'partNumber must be integer in [1, 10000]' };
    }
    if (typeof p.etag !== 'string' || !p.etag) {
      return { valid: false, error: 'each part requires an etag string' };
    }
  }
  return { valid: true, value: { assetId, uploadId, parts } };
}

/** Validate /abort body. */
function validateAbortBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body required' };
  }
  const { assetId, uploadId } = body;
  if (typeof assetId !== 'string' || !UUID_RE.test(assetId)) {
    return { valid: false, error: 'assetId must be a UUID' };
  }
  if (typeof uploadId !== 'string' || !uploadId) {
    return { valid: false, error: 'uploadId is required' };
  }
  return { valid: true, value: { assetId, uploadId } };
}

/** Load asset by id and verify ownership. Returns row (camelCase) or null. */
async function loadOwnedAsset(assetId, ownerId) {
  const { rows } = await pool.query('SELECT * FROM assets WHERE id = $1', [assetId]);
  if (!rows[0]) return { asset: null, status: 404 };
  const asset = rowToCamel(rows[0]);
  if (asset.ownerId !== ownerId) return { asset: null, status: 403 };
  return { asset, status: 200 };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/uploads/init
//
// `checkQuota` runs after `protect` so we already know req.admin.id. It only
// rejects when current usage already meets/exceeds the per-admin quota; it
// doesn't add the incoming size, so we layer a second more accurate check
// below that includes the in-flight upload size + bytes already committed to
// the new `assets` table (which the legacy middleware doesn't know about).
router.post('/init', protect, checkQuota, asyncHandler(async (req, res) => {
  const v = validateInitBody(req.body);
  if (!v.valid) return res.status(400).json({ error: v.error });
  const { filename, size, mimeType, sha256, galleryId } = v.value;

  // If a galleryId is supplied, verify the admin owns it. Skipped if absent
  // (assets can exist before being attached to a gallery).
  if (galleryId) {
    const { rows } = await pool.query(
      'SELECT id FROM galleries WHERE id = $1 AND admin_id = $2',
      [galleryId, req.admin.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gallery not found' });
  }

  // Size-aware quota pre-check — superadmin is unlimited (matches checkQuota).
  // Sums legacy gallery_images bytes + gallery video bytes + assets bytes
  // already on Wasabi, then refuses the upload if (used + size) would exceed
  // the admin's storage_quota_bytes. The simpler middleware above only
  // catches the case where the user is *already* over quota; this catches
  // the case where a single new upload would push them over.
  if (req.admin.role !== 'superadmin') {
    const { rows: qRows } = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(gi.size)::bigint FROM gallery_images gi
                    JOIN galleries g ON g.id = gi.gallery_id
                   WHERE g.admin_id = $1), 0)
         + COALESCE((SELECT SUM((v->>'size')::bigint)
                       FROM galleries g2, jsonb_array_elements(g2.videos) v
                      WHERE g2.admin_id = $1 AND (v->>'size') IS NOT NULL), 0)
         + COALESCE((SELECT SUM(original_bytes)::bigint
                       FROM assets WHERE owner_id = $1), 0)
         AS used,
         a.storage_quota_bytes AS quota
       FROM admins a WHERE a.id = $1`,
      [req.admin.id]
    );
    const used  = Number(qRows[0]?.used  ?? 0);
    const quota = qRows[0]?.quota != null ? Number(qRows[0].quota) : null;
    if (quota !== null && used + size > quota) {
      return res.status(413).json({
        code: 'QUOTA_EXCEEDED',
        message: `Storage quota of ${(quota / 1024 ** 3).toFixed(1)} GB exceeded`,
        used,
        quota,
        attempted: size,
      });
    }
  }

  const assetId = crypto.randomUUID();
  const sanitized = sanitizeFilename(filename);
  // Folder convention aligned with the legacy multer path used by
  // /api/galleries/:id/images: admins/<adminId>/<...>. The <assetId> segment
  // keeps the JXL sidecar lined up next to the original (see /jxl/init below)
  // and prevents collisions between different uploads of the same filename —
  // listAdminStorageBytes still picks these up because it prefix-matches on
  // `admins/<adminId>/`.
  const key = `admins/${req.admin.id}/${assetId}/${sanitized}`;
  const partCount = Math.max(1, Math.ceil(size / CHUNK_SIZE));

  let uploadId;
  try {
    const result = await createMultipartUpload(key, mimeType, {
      'asset-id': assetId,
      'owner-id': req.admin.id,
      'sha256': sha256,
    });
    uploadId = result.uploadId;
  } catch (err) {
    logger.error(`[uploads] createMultipartUpload failed: ${err.message}`, err);
    return res.status(500).json({ error: 'Failed to initiate upload' });
  }

  let parts;
  try {
    parts = await getPresignedUploadPartUrls(key, uploadId, partCount);
  } catch (err) {
    logger.error(`[uploads] getPresignedUploadPartUrls failed: ${err.message}`, err);
    // Best-effort cleanup of the dangling multipart upload
    abortMultipartUpload(key, uploadId).catch(() => {});
    return res.status(500).json({ error: 'Failed to presign upload parts' });
  }

  try {
    await pool.query(
      `INSERT INTO assets
         (id, owner_id, gallery_id, filename, mime_type, original_key,
          original_sha256, original_bytes, format, status, upload_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'original', 'uploading', $9)`,
      [assetId, req.admin.id, galleryId, sanitized, mimeType, key, sha256, size, uploadId]
    );
  } catch (err) {
    logger.error(`[uploads] INSERT assets failed: ${err.message}`, err);
    abortMultipartUpload(key, uploadId).catch(() => {});
    if (err.code === '23505') {
      // unique_violation on original_key — astronomically unlikely with a UUID
      return res.status(409).json({ error: 'Asset with this key already exists' });
    }
    return res.status(500).json({ error: 'Failed to record asset' });
  }

  // partSize is load-bearing for the frontend: the browser uses it to slice the
  // file into part-aligned chunks. S3 multipart's "uniform parts except last"
  // rule means every part is exactly CHUNK_SIZE bytes except the final part.
  // Always return it explicitly so the client never has to infer.
  res.status(201).json({ assetId, uploadId, key, partSize: CHUNK_SIZE, parts });
}));

// POST /api/uploads/complete
router.post('/complete', protect, asyncHandler(async (req, res) => {
  const v = validateCompleteBody(req.body);
  if (!v.valid) return res.status(400).json({ error: v.error });
  const { assetId, uploadId, parts } = v.value;

  // Pre-flight ownership/uploadId check so we return 404/403/400 before the CAS.
  // The CAS itself is the actual atomicity barrier — this just shapes the
  // error response for the common cases.
  const { asset, status } = await loadOwnedAsset(assetId, req.admin.id);
  if (status === 404) return res.status(404).json({ error: 'Asset not found' });
  if (status === 403) return res.status(403).json({ error: 'Forbidden' });

  if (asset.uploadId && asset.uploadId !== uploadId) {
    return res.status(400).json({ error: 'uploadId does not match asset' });
  }

  // Compare-and-swap: only one concurrent /complete can flip 'uploading' →
  // 'uploaded'. The loser sees rowCount === 0 and falls through to the
  // idempotency / conflict branches below.
  const cas = await pool.query(
    `UPDATE assets
        SET status = 'uploaded',
            upload_id = NULL,
            updated_at = NOW()
      WHERE id = $1
        AND owner_id = $2
        AND status = 'uploading'
      RETURNING *`,
    [assetId, req.admin.id]
  );

  if (cas.rowCount === 1) {
    // We won the CAS — we are the sole caller responsible for finalizing on S3.
    try {
      await completeMultipartUpload(asset.originalKey, uploadId, parts);
    } catch (err) {
      logger.error(`[uploads] completeMultipartUpload failed: ${err.message}`, err);
      // Roll status back so a retry can win the CAS again.
      await pool.query(
        `UPDATE assets
            SET status = 'uploading',
                upload_id = $3,
                updated_at = NOW()
          WHERE id = $1 AND owner_id = $2`,
        [assetId, req.admin.id, uploadId]
      );
      return res.status(500).json({ error: 'Failed to complete upload on storage' });
    }
    // ── Enqueue compression job (lossless-only pipeline) ──────────────────────
    //
    // Decision matrix:
    //   image/jpeg  → ALWAYS compression.transcode. cjxl --lossless_jpeg=1 is
    //                 fully reversible to byte-identical original via djxl -j.
    //   image/png   → handled by browser via /jxl/* endpoints (no server-side
    //                 fallback — if the browser path fails the asset stays on
    //                 the original bytes and the operator must investigate).
    //   anything else (MP4, RAW, PSD, …) → stored as-is, no compression.
    //
    // expireInSeconds is per-queue (set here, NOT in HANDLER_OPTS — pg-boss
    // 9.x ignores job-behavior options on boss.work).
    const mime = (asset.mimeType || '').toLowerCase();
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      try {
        const boss = await getQueue();
        await boss.send(
          JOB_NAMES.COMPRESSION_TRANSCODE,
          { assetId, ownerId: req.admin.id },
          {
            singletonKey:     `transcode:${assetId}`,
            singletonSeconds: 1800,
            retryLimit:       3,
            retryDelay:       30,
            retryBackoff:     true,
            expireInSeconds:  1800,
          }
        );
      } catch (err) {
        // Non-fatal: the asset is safely on Wasabi and a Slice-4 sweeper can
        // re-enqueue. Keep the upload completion path response-side fast.
        logger.error('[uploads] failed to enqueue transcode job', {
          assetId,
          error: err.message,
        });
      }
    }
    // PNG handled by browser via /jxl/* endpoints. Other types: no compression.
    // TODO(slice-4): sweeper job to re-enqueue assets stuck at status='uploaded'
    //   AND format='original' AND jxl_key IS NULL AND created_at < NOW() - INTERVAL '15 minutes'
    //   so a browser that crashed before /jxl/complete can be recovered.
    return res.json({ asset: rowToCamel(cas.rows[0]) });
  }

  // CAS lost — re-read to decide whether this is an idempotent success, a
  // status conflict, or a not-found / wrong-owner case.
  const { rows: currentRows } = await pool.query(
    'SELECT * FROM assets WHERE id = $1 AND owner_id = $2',
    [assetId, req.admin.id]
  );
  if (!currentRows[0]) {
    // Don't leak existence — same response as if the asset never existed.
    return res.status(404).json({ error: 'Asset not found' });
  }
  const current = rowToCamel(currentRows[0]);
  if (current.status === 'uploaded') {
    // Idempotent: a concurrent /complete already won. Return the same shape.
    return res.json({ asset: current });
  }
  return res.status(409).json({ error: `Asset is in status '${current.status}', not 'uploading'` });
}));

// POST /api/uploads/abort
router.post('/abort', protect, asyncHandler(async (req, res) => {
  const v = validateAbortBody(req.body);
  if (!v.valid) return res.status(400).json({ error: v.error });
  const { assetId, uploadId } = v.value;

  const { asset, status } = await loadOwnedAsset(assetId, req.admin.id);
  if (status === 404) return res.status(404).json({ error: 'Asset not found' });
  if (status === 403) return res.status(403).json({ error: 'Forbidden' });

  if (asset.uploadId !== uploadId) {
    return res.status(400).json({ error: 'uploadId does not match asset' });
  }

  try {
    await abortMultipartUpload(asset.originalKey, uploadId);
  } catch (err) {
    // Only swallow "already gone" — for any transient/IAM/network error we
    // must NOT delete the row, or we'll permanently lose the uploadId and
    // orphan the multipart upload (Wasabi bills for pending parts).
    if (err.name === 'NoSuchUpload' || err.$metadata?.httpStatusCode === 404) {
      logger.warn(`[uploads] abortMultipartUpload non-fatal (already gone): ${err.message}`);
    } else {
      logger.error(`[uploads] abortMultipartUpload failed: ${err.message}`, err);
      return res.status(500).json({ error: 'Failed to abort upload, please retry' });
    }
  }

  await pool.query('DELETE FROM assets WHERE id = $1 AND owner_id = $2', [assetId, req.admin.id]);
  res.json({ ok: true });
}));

// ── JXL sidecar upload (Slice 3B) ────────────────────────────────────────────
//
// The browser encodes a JXL alongside its original PNG/JPEG and uploads it via
// these three endpoints. On /jxl/complete we flip the asset to 'verifying' and
// enqueue compression.verify, which streams the JXL through djxl, hashes the
// decoded output, and compares with original_sha256.
//
// Why a separate flow (not /init + /complete reused)? The original is the
// source of truth and must be uploaded first; the JXL is a derivative that
// only makes sense once the asset row exists in status='uploaded'. Reusing
// /init would require a "is this an original or a sidecar?" branch in every
// validator — cleaner to have two cohesive flows.

/** Validate /jxl/init body — body has neither assetId nor uploadId; those
 *  come from the route param and the createMultipartUpload result. */
function validateJxlInitBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body required' };
  }
  const { jxlSize, jxlSha256 } = body;
  if (!Number.isInteger(jxlSize) || jxlSize <= 0) {
    return { valid: false, error: 'jxlSize must be a positive integer (bytes)' };
  }
  if (jxlSize > MAX_FILE_BYTES) {
    return { valid: false, error: `jxlSize exceeds maximum of ${MAX_FILE_BYTES} bytes` };
  }
  if (typeof jxlSha256 !== 'string' || !SHA256_RE.test(jxlSha256)) {
    return { valid: false, error: 'jxlSha256 must be a 64-character hex string' };
  }
  return { valid: true, value: { jxlSize, jxlSha256: jxlSha256.toLowerCase() } };
}

/** Validate /jxl/complete body — assetId comes from the route param. */
function validateJxlCompleteBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body required' };
  }
  const { uploadId, parts } = body;
  if (typeof uploadId !== 'string' || !uploadId) {
    return { valid: false, error: 'uploadId is required' };
  }
  if (!Array.isArray(parts) || !parts.length) {
    return { valid: false, error: 'parts must be a non-empty array' };
  }
  if (parts.length > 10000) {
    return { valid: false, error: 'too many parts (max 10000)' };
  }
  for (const p of parts) {
    if (!p || typeof p !== 'object') {
      return { valid: false, error: 'each part must be an object' };
    }
    if (!Number.isInteger(p.partNumber) || p.partNumber < 1 || p.partNumber > 10000) {
      return { valid: false, error: 'partNumber must be integer in [1, 10000]' };
    }
    if (typeof p.etag !== 'string' || !p.etag) {
      return { valid: false, error: 'each part requires an etag string' };
    }
  }
  return { valid: true, value: { uploadId, parts } };
}

/** Validate /jxl/abort body. */
function validateJxlAbortBody(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body required' };
  }
  const { uploadId } = body;
  if (typeof uploadId !== 'string' || !uploadId) {
    return { valid: false, error: 'uploadId is required' };
  }
  return { valid: true, value: { uploadId } };
}

// POST /api/uploads/:assetId/jxl/init
router.post('/:assetId/jxl/init', protect, asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  if (!UUID_RE.test(assetId)) {
    return res.status(400).json({ error: 'assetId must be a UUID' });
  }
  const v = validateJxlInitBody(req.body);
  if (!v.valid) return res.status(400).json({ error: v.error });
  const { jxlSize, jxlSha256 } = v.value;

  const { asset, status } = await loadOwnedAsset(assetId, req.admin.id);
  if (status === 404) return res.status(404).json({ error: 'Asset not found' });
  if (status === 403) return res.status(403).json({ error: 'Forbidden' });

  // The sidecar is only valid against an original that's fully uploaded and
  // hasn't already started compression. Verifying/compressed/failed all reject.
  if (asset.status !== 'uploaded') {
    return res.status(409).json({ error: `Asset is in status '${asset.status}', expected 'uploaded'` });
  }
  if (asset.format !== 'original') {
    return res.status(409).json({ error: `Asset format is '${asset.format}', expected 'original'` });
  }

  // JXL sidecar sits next to the original under admins/<adminId>/<assetId>/.
  // Same blast radius for ACL/lifecycle rules, easy to grep when debugging,
  // and listAdminStorageBytes counts it against the admin's quota along with
  // every other file in the prefix.
  const jxlKey = `admins/${req.admin.id}/${assetId}/${asset.filename}.jxl`;
  const partCount = Math.max(1, Math.ceil(jxlSize / CHUNK_SIZE));

  let uploadId;
  try {
    const result = await createMultipartUpload(jxlKey, 'image/jxl', {
      'asset-id': assetId,
      'owner-id': req.admin.id,
      'sha256':   jxlSha256,
      'sidecar':  'jxl',
    });
    uploadId = result.uploadId;
  } catch (err) {
    logger.error(`[uploads:jxl] createMultipartUpload failed: ${err.message}`, err);
    return res.status(500).json({ error: 'Failed to initiate JXL sidecar upload' });
  }

  let parts;
  try {
    parts = await getPresignedUploadPartUrls(jxlKey, uploadId, partCount);
  } catch (err) {
    logger.error(`[uploads:jxl] getPresignedUploadPartUrls failed: ${err.message}`, err);
    abortMultipartUpload(jxlKey, uploadId).catch(() => {});
    return res.status(500).json({ error: 'Failed to presign JXL upload parts' });
  }

  // Owner-scoped UPDATE — never trust the route param alone.
  // CAS predicate also requires `jxl_upload_id IS NULL` (H2): two concurrent
  // /jxl/init calls would otherwise both create distinct multipart uploads and
  // the loser would overwrite jxl_upload_id, orphaning the first multipart on
  // Wasabi (Wasabi bills for pending parts indefinitely). The loser aborts
  // its own freshly-created multipart and returns 409.
  try {
    const upd = await pool.query(
      `UPDATE assets
          SET jxl_key = $1,
              jxl_bytes = $2,
              jxl_sha256 = $3,
              jxl_upload_id = $4,
              updated_at = NOW()
        WHERE id = $5
          AND owner_id = $6
          AND status = 'uploaded'
          AND format = 'original'
          AND jxl_upload_id IS NULL`,
      [jxlKey, jxlSize, jxlSha256, uploadId, assetId, req.admin.id]
    );
    if (upd.rowCount === 0) {
      // Lost a race with /jxl/abort or another /jxl/init — abort the multipart
      // we just created so we don't leave an orphan on Wasabi.
      try {
        await abortMultipartUpload(jxlKey, uploadId);
      } catch (e) {
        logger.warn('[uploads:jxl/init] failed to abort orphaned multipart', e);
      }
      return res.status(409).json({
        error: 'A previous JXL upload is in progress. Call /jxl/abort first or wait for it to complete.',
      });
    }
  } catch (err) {
    logger.error(`[uploads:jxl] UPDATE assets jxl_* failed: ${err.message}`, err);
    abortMultipartUpload(jxlKey, uploadId).catch(() => {});
    return res.status(500).json({ error: 'Failed to record JXL sidecar' });
  }

  res.status(201).json({ uploadId, key: jxlKey, partSize: CHUNK_SIZE, parts });
}));

// POST /api/uploads/:assetId/jxl/complete
router.post('/:assetId/jxl/complete', protect, asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  if (!UUID_RE.test(assetId)) {
    return res.status(400).json({ error: 'assetId must be a UUID' });
  }
  const v = validateJxlCompleteBody(req.body);
  if (!v.valid) return res.status(400).json({ error: v.error });
  const { uploadId, parts } = v.value;

  const { asset, status } = await loadOwnedAsset(assetId, req.admin.id);
  if (status === 404) return res.status(404).json({ error: 'Asset not found' });
  if (status === 403) return res.status(403).json({ error: 'Forbidden' });

  if (!asset.jxlUploadId || asset.jxlUploadId !== uploadId) {
    return res.status(400).json({ error: 'uploadId does not match asset' });
  }

  // CAS: only one /jxl/complete may flip 'uploaded' → 'verifying'. Loser
  // re-reads and either returns idempotent success or a status conflict.
  const cas = await pool.query(
    `UPDATE assets
        SET status = 'verifying',
            jxl_upload_id = NULL,
            updated_at = NOW()
      WHERE id = $1
        AND owner_id = $2
        AND status = 'uploaded'
        AND format = 'original'
        AND jxl_upload_id = $3
      RETURNING *`,
    [assetId, req.admin.id, uploadId]
  );

  if (cas.rowCount === 1) {
    const winner = rowToCamel(cas.rows[0]);
    try {
      await completeMultipartUpload(winner.jxlKey, uploadId, parts);
    } catch (err) {
      logger.error(`[uploads:jxl] completeMultipartUpload failed: ${err.message}`, err);
      // Roll status back so the client (or a sweeper) can retry.
      await pool.query(
        `UPDATE assets
            SET status = 'uploaded',
                jxl_upload_id = $3,
                updated_at = NOW()
          WHERE id = $1 AND owner_id = $2`,
        [assetId, req.admin.id, uploadId]
      );
      return res.status(500).json({ error: 'Failed to complete JXL upload on storage' });
    }

    // Enqueue verify. Same swallow-on-failure posture as the original /complete:
    // the JXL bytes are safely on Wasabi; a Slice-4 sweeper can re-enqueue any
    // asset stuck at status='verifying' beyond the expected SLA.
    try {
      const boss = await getQueue();
      await boss.send(
        JOB_NAMES.COMPRESSION_VERIFY,
        { assetId, ownerId: req.admin.id },
        {
          singletonKey:     `verify:${assetId}`,
          singletonSeconds: 1800,
          retryLimit:       3,
          retryDelay:       30,
          retryBackoff:     true,
          expireInSeconds:  1800,
        }
      );
    } catch (err) {
      logger.error('[uploads:jxl] failed to enqueue verify job', {
        assetId,
        ownerId: req.admin.id,
        error:   err.message,
      });
    }

    return res.json({ ok: true, status: 'verifying' });
  }

  // CAS lost — figure out which idempotent / conflict branch we're in.
  const { rows: currentRows } = await pool.query(
    'SELECT * FROM assets WHERE id = $1 AND owner_id = $2',
    [assetId, req.admin.id]
  );
  if (!currentRows[0]) {
    return res.status(404).json({ error: 'Asset not found' });
  }
  const current = rowToCamel(currentRows[0]);
  if (current.status === 'verifying' || current.status === 'compressed') {
    // Either a concurrent /jxl/complete won, or verify already finished.
    // Both are idempotent successes from the client's perspective.
    return res.json({ ok: true, status: current.status });
  }
  return res.status(409).json({
    error: `Asset is in status '${current.status}', not 'uploaded'`,
  });
}));

// POST /api/uploads/:assetId/jxl/abort
router.post('/:assetId/jxl/abort', protect, asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  if (!UUID_RE.test(assetId)) {
    return res.status(400).json({ error: 'assetId must be a UUID' });
  }
  const v = validateJxlAbortBody(req.body);
  if (!v.valid) return res.status(400).json({ error: v.error });
  const { uploadId } = v.value;

  const { asset, status } = await loadOwnedAsset(assetId, req.admin.id);
  if (status === 404) return res.status(404).json({ error: 'Asset not found' });
  if (status === 403) return res.status(403).json({ error: 'Forbidden' });

  if (!asset.jxlUploadId || asset.jxlUploadId !== uploadId) {
    return res.status(400).json({ error: 'uploadId does not match asset' });
  }
  if (!asset.jxlKey) {
    return res.status(400).json({ error: 'no JXL sidecar in progress for this asset' });
  }

  try {
    await abortMultipartUpload(asset.jxlKey, uploadId);
  } catch (err) {
    if (err.name === 'NoSuchUpload' || err.$metadata?.httpStatusCode === 404) {
      logger.warn(`[uploads:jxl] abortMultipartUpload non-fatal (already gone): ${err.message}`);
    } else {
      logger.error(`[uploads:jxl] abortMultipartUpload failed: ${err.message}`, err);
      return res.status(500).json({ error: 'Failed to abort JXL upload, please retry' });
    }
  }

  // Clear sidecar fields. Status STAYS 'uploaded' — the original is still good
  // and another sidecar attempt can start fresh from /jxl/init.
  await pool.query(
    `UPDATE assets
        SET jxl_key = NULL,
            jxl_bytes = NULL,
            jxl_sha256 = NULL,
            jxl_upload_id = NULL,
            updated_at = NOW()
      WHERE id = $1 AND owner_id = $2`,
    [assetId, req.admin.id]
  );

  res.json({ ok: true });
}));

// GET /api/uploads/:assetId/download-url
router.get('/:assetId/download-url', protect, asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  if (!UUID_RE.test(assetId)) {
    return res.status(400).json({ error: 'assetId must be a UUID' });
  }

  const { asset, status } = await loadOwnedAsset(assetId, req.admin.id);
  if (status === 404) return res.status(404).json({ error: 'Asset not found' });
  if (status === 403) return res.status(403).json({ error: 'Forbidden' });

  if (asset.status === 'uploading') {
    return res.status(409).json({ error: 'Asset upload is not complete' });
  }

  // Slice 4 will set format='jxl' once compression succeeds; until then we
  // always serve the original. Hook below picks jxl_key when present.
  const key = (asset.format === 'jxl' && asset.jxlKey) ? asset.jxlKey : asset.originalKey;

  try {
    const { url, expiresAt } = await getPresignedGetUrl(key, 3600);
    res.json({ url, expiresAt });
  } catch (err) {
    logger.error(`[uploads] getPresignedGetUrl failed: ${err.message}`, err);
    return res.status(500).json({ error: 'Failed to generate download URL' });
  }
}));

// GET /api/uploads/:assetId/download
//
// Transparent original-quality download. Three flows depending on storage state:
//   1. format='original'                         → 302 to presigned URL of original_key
//   2. format='jxl' AND pending_deletion_key set → 302 to presigned URL of pending_deletion_key
//                                                  (within 7-day grace, original still on disk)
//   3. format='jxl' AND no pending_deletion_key  → spawn djxl, stream S3 → djxl.stdin,
//                                                  djxl.stdout → HTTP response (chunked)
//
// The /download-url endpoint above remains as the back-compat path: callers that
// explicitly want the raw stored bytes (incl. .jxl) can keep using it.
//
// Note on Cloudflare's 100 MB proxy limit (free tier): if this endpoint is
// fronted by Cloudflare in proxy mode, decompressed PNG outputs > 100 MB will
// be truncated. Production deploy guidance is to point downloads at a
// grey-cloud DNS-only subdomain (download.photographers.example) that
// resolves directly to the backend, bypassing the proxy. See ops/README.md.
router.get('/:assetId/download', protect, asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  if (!UUID_RE.test(assetId)) {
    return res.status(400).json({ error: 'assetId must be a UUID' });
  }

  const { asset, status } = await loadOwnedAsset(assetId, req.admin.id);
  if (status === 404) return res.status(404).json({ error: 'Asset not found' });
  if (status === 403) return res.status(403).json({ error: 'Forbidden' });

  // Reject states where the asset can't be served:
  //   - 'uploading'      : original isn't fully on Wasabi yet
  //   - 'failed'         : something went wrong upstream; nothing to serve
  //   - 'verify_failed'  : JXL hash mismatch — the JXL is suspect, original may
  //                        still exist at pending_deletion_key but we don't
  //                        want to silently return either path. Operator must
  //                        intervene before the asset is downloadable again.
  if (asset.status === 'uploading' || asset.status === 'failed' || asset.status === 'verify_failed') {
    return res.status(409).json({ error: `Asset is in status '${asset.status}', not downloadable` });
  }

  // Decision tree for which key to serve:
  //   format='original' OR (format='jxl' AND pending_deletion_key set)
  //     → presigned redirect to whichever key holds the original bytes
  //   format='jxl' AND pending_deletion_key NULL
  //     → must transcode JXL → PNG on the fly
  // RFC 5987 dual-encoding: a plain ASCII fallback for legacy clients plus a
  // percent-encoded UTF-8 `filename*` for modern ones. Required because Node's
  // header validator rejects raw non-ASCII (Hebrew/Arabic/CJK) bytes with
  // ERR_INVALID_CHAR — the previous regex only stripped control chars + quote
  // chars and let UTF-8 leak through, 500-ing on Hebrew filenames.
  const rawName = (asset.filename || 'download').slice(0, 200);
  const stripped = rawName.replace(/[\r\n"\\]/g, '');
  const ascii = stripped.replace(/[^\x20-\x7e]/g, '_') || 'download';
  const utf8 = encodeURIComponent(stripped);
  const dispositionHeader = `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;

  // Flow 1 + Flow 2: original bytes still exist somewhere on Wasabi → just redirect.
  if (asset.format !== 'jxl' || asset.pendingDeletionKey) {
    const sourceKey = (asset.format === 'jxl' && asset.pendingDeletionKey)
      ? asset.pendingDeletionKey
      : asset.originalKey;
    if (!sourceKey) {
      logger.error(`[download] asset ${assetId} has no source key (format=${asset.format})`);
      return res.status(500).json({ error: 'Asset has no downloadable source' });
    }
    try {
      const { url } = await getPresignedGetUrl(sourceKey, 3600);
      // 302 with browser-friendly attachment hint. Wasabi will serve the original
      // bytes directly; we don't proxy them through Node.
      res.setHeader('X-Asset-Format', asset.format === 'jxl' ? 'pending-deletion-original' : 'original');
      return res.redirect(302, url);
    } catch (err) {
      logger.error(`[download] getPresignedGetUrl failed for asset ${assetId}: ${err.message}`, err);
      return res.status(500).json({ error: 'Failed to generate download URL' });
    }
  }

  // Flow 3: JXL-only. Stream djxl decode in real time.
  // Slice 3 only produces PNG-format originals through the JXL path, so we always
  // emit image/png here. When Slice-N adds JPEG → JXL → JPEG round-tripping,
  // branch on asset.mimeType.
  if (!asset.jxlKey) {
    logger.error(`[download] asset ${assetId} format=jxl but no jxl_key`);
    return res.status(500).json({ error: 'Asset has no JXL source' });
  }

  // Cap concurrent djxl spawns per owner. Without this, a "download all"
  // action from a single account can fan out to N parallel decoders and DoS
  // the host. Released on res 'close' below — covers both normal completion
  // (res emits 'close' after end()) and client disconnect.
  if (!acquireDjxlSlot(req.admin.id)) {
    return res.status(429).json({ error: 'Too many concurrent downloads, retry shortly' });
  }
  res.once('close', () => releaseDjxlSlot(req.admin.id));

  let jxlStream;
  try {
    jxlStream = await getReadStream(asset.jxlKey);
  } catch (err) {
    logger.error(`[download] getReadStream failed for asset ${assetId}: ${err.message}`, err);
    return res.status(500).json({ error: 'Failed to open source stream' });
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', dispositionHeader);
  // We don't know the decompressed size up front, so use chunked transfer encoding
  // (don't set Content-Length). Express/Node will set Transfer-Encoding: chunked
  // implicitly when no Content-Length is set, but we set it explicitly for clarity.
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Asset-Format', 'jxl-decoded');
  // Don't allow intermediate caches to store decoded output — privacy + the byte
  // stream is gated by `protect` and per-asset ACL.
  res.setHeader('Cache-Control', 'private, no-store');

  const djxl = spawn(PHOTO_DJXL_BIN, ['-', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });

  // Idle error handlers — same pattern as the verify worker. These prevent an
  // unhandled-'error' crash if any stdio stream emits after pipelines settle,
  // while the pipeline promises below still surface real failures.
  jxlStream.on('error',   (e) => logger.warn(`[download] jxlStream error: ${e.message}`));
  djxl.stdin.on('error',  (e) => logger.debug(`[download] djxl.stdin error (handled): ${e.message}`));
  djxl.stdout.on('error', (e) => logger.debug(`[download] djxl.stdout error (handled): ${e.message}`));
  djxl.stderr.on('error', () => {});

  const stderrChunks = [];
  djxl.stderr.on('data', (c) => stderrChunks.push(c));

  // Spawn-error promise: rejects on ENOENT/EACCES so a missing binary surfaces
  // cleanly instead of as a confusing "write after end".
  const spawnError = new Promise((_, reject) => djxl.on('error', reject));

  // Handle client disconnect: if response closes before djxl exits, kill the
  // decoder so we don't leak a process. SIGKILL because djxl on stdin EPIPE
  // typically exits cleanly anyway, but we want a hard guarantee on rare hangs.
  res.on('close', () => {
    if (djxl.exitCode === null && !djxl.killed) {
      logger.debug(`[download] client disconnected for asset ${assetId}, killing djxl`);
      try { djxl.kill('SIGKILL'); } catch { /* ignore */ }
    }
  });

  // Track bytes piped to the response so we can detect the silent-failure case
  // where djxl exits 0 but produced no output (rare, but it produces a
  // "successful" empty PNG to the client which is worse than a clean 5xx).
  let bytesPiped = 0;
  djxl.stdout.on('data', (chunk) => { bytesPiped += chunk.length; });

  // Log non-zero exit. Headers may have already been flushed by the time djxl
  // dies (we started piping stdout shortly after spawn), so we can't change
  // status — we can only end the response so the client sees a truncated body
  // and the connection close. The X-Asset-Format trailer / log line is the
  // operator signal here.
  djxl.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      const stderr = Buffer.concat(stderrChunks).toString('utf8').slice(0, 500);
      logger.error(
        `[download] djxl exit ${code} signal=${signal} for asset ${assetId}: ${stderr}`
      );
      if (!res.writableEnded) {
        try { res.end(); } catch { /* ignore */ }
      }
      return;
    }
    // code === 0: success path. Detect the 0-byte silent-failure case.
    if (code === 0 && bytesPiped === 0) {
      logger.error(
        `[download] djxl produced 0 bytes for asset ${assetId} owner=${req.admin.id} — likely a silent failure`
      );
      // Headers were sent the moment we started piping; can't change status.
      if (!res.writableEnded) {
        try { res.end(); } catch { /* ignore */ }
      }
    }
  });

  // Defer the stdout→res pipe by one tick. Synchronous spawn errors (ENOENT,
  // EACCES) fire on `djxl` via 'error' before the next microtask completes; if
  // we pipe immediately, stdout is already closed by the time we attach and
  // the response would end with a 200 + 0 bytes. setImmediate lets the
  // spawnError reject below catch it cleanly.
  await new Promise((r) => setImmediate(r));

  // Use { end: false } so a stdout EOF doesn't auto-end the response — we
  // want to gate the final res.end() on the djxl exit code (so 0-byte
  // successes can be flagged) and on stdout 'end' itself.
  djxl.stdout.pipe(res, { end: false });
  djxl.stdout.on('end', () => {
    if (!res.writableEnded) res.end();
  });

  // Pipe S3 → djxl.stdin via pipeline (handles backpressure + propagates errors).
  // Race against spawnError so an ENOENT on the binary surfaces immediately.
  try {
    await Promise.race([
      pipeline(jxlStream, djxl.stdin),
      spawnError,
    ]);
  } catch (err) {
    logger.warn(`[download] stdin pipe error for asset ${assetId}: ${err.message}`);
    if (djxl.exitCode === null && !djxl.killed) {
      try { djxl.kill('SIGKILL'); } catch { /* ignore */ }
    }
    if (!res.headersSent) {
      // Spawn failed before we wrote any bytes; we can still emit a clean error.
      return res.status(500).json({ error: 'Decoder unavailable' });
    }
    // Headers already flushed (Express sent them on first write). All we can do
    // is end the response — the client sees a truncated body. Operator surface
    // is the [download] log line above.
    if (!res.writableEnded) {
      try { res.end(); } catch { /* ignore */ }
    }
  }
}));

module.exports = router;
