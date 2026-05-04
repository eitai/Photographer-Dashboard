/**
 * S3-compatible storage client (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO).
 *
 * Folder structure inside the bucket:
 *   admins/<adminId>/<filename>              ← originals (images, videos, blog, settings)
 *   admins/<adminId>/thumbnails/<filename>   ← Sharp-generated thumbnails
 *
 * All env vars are read at call time (not module load time) so dotenv timing
 * is never an issue — the values are always current when a function runs.
 *
 * Behaviour:
 *   S3 configured + success  → file stored in S3, local temp deleted
 *   S3 configured + failure  → local temp deleted, error thrown (no disk fallback)
 *   S3 not configured (dev)  → local disk storage as before
 */
const { S3Client, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

// ── Config helper (reads env at call time) ────────────────────────────────────
function cfg() {
  return {
    endpoint:  (process.env.S3_ENDPOINT   || '').trim() || undefined,
    region:    (process.env.S3_REGION     || 'us-east-1').trim(),
    bucket:    (process.env.S3_BUCKET     || '').trim(),
    publicUrl: (process.env.S3_PUBLIC_URL || '').trim().replace(/\/$/, ''),
    keyId:     process.env.AWS_ACCESS_KEY_ID,
    secret:    process.env.AWS_SECRET_ACCESS_KEY,
  };
}

/** Returns true when all required S3 env vars are present. */
function isEnabled() {
  const c = cfg();
  return Boolean(c.bucket && c.publicUrl && c.keyId && c.secret);
}

// ── S3 client singleton ───────────────────────────────────────────────────────
let _client = null;

function _getClient() {
  if (!_client) {
    const c = cfg();
    const opts = {
      region: c.region,
      credentials: { accessKeyId: c.keyId, secretAccessKey: c.secret },
    };
    if (c.endpoint) {
      opts.endpoint = c.endpoint;
      // Path-style required for non-AWS S3-compatible providers (Wasabi, MinIO, etc.)
      opts.forcePathStyle = true;
    }
    _client = new S3Client(opts);
  }
  return _client;
}

// ── Key / URL helpers ─────────────────────────────────────────────────────────

/**
 * Build the S3 key for an original file.
 * With adminId:  admins/<adminId>/<filename>
 * Without:       uploads/<filename>  (legacy fallback)
 */
function originalKey(filename, adminId) {
  return adminId ? `admins/${adminId}/${filename}` : `uploads/${filename}`;
}

/**
 * Build the S3 key for a thumbnail file.
 * With adminId:  admins/<adminId>/thumbnails/<filename>
 * Without:       uploads/thumbnails/<filename>  (legacy fallback)
 */
function thumbnailKey(filename, adminId) {
  return adminId
    ? `admins/${adminId}/thumbnails/${filename}`
    : `uploads/thumbnails/${filename}`;
}

/**
 * Build the S3 key for a preview file (WebP, max 2000px).
 * With adminId:  admins/<adminId>/previews/<basename>.webp
 * Without:       uploads/previews/<basename>.webp  (legacy fallback)
 */
function previewKey(basename, adminId) {
  return adminId
    ? `admins/${adminId}/previews/${basename}.webp`
    : `uploads/previews/${basename}.webp`;
}

function getPublicUrl(key) {
  return `${cfg().publicUrl}/${key}`;
}

/**
 * Extract an S3 key from a full public URL.
 * Returns null for legacy local "/uploads/..." paths.
 */
function urlToKey(storedPath) {
  const { publicUrl } = cfg();
  if (!storedPath || !publicUrl) return null;
  if (storedPath.startsWith(publicUrl + '/')) return storedPath.slice(publicUrl.length + 1);
  return null;
}

// ── Low-level S3 operations ───────────────────────────────────────────────────

async function uploadFile(localPath, key, contentType = 'application/octet-stream') {
  const upload = new Upload({
    client: _getClient(),
    params: { Bucket: cfg().bucket, Key: key, Body: fs.createReadStream(localPath), ContentType: contentType },
  });
  await upload.done();
  return key; // callers store the key, not the full URL
}

async function uploadBuffer(buffer, key, contentType = 'image/jpeg') {
  const upload = new Upload({
    client: _getClient(),
    params: { Bucket: cfg().bucket, Key: key, Body: buffer, ContentType: contentType },
  });
  await upload.done();
  return key; // callers store the key, not the full URL
}

/**
 * Generate a presigned GET URL for an S3 key.
 * This is a local signing operation — no network call to S3.
 *
 * @param {string} key         S3 object key (e.g. "admins/<adminId>/filename.jpg")
 * @param {number} expiresIn   Seconds until the URL expires (default: 7 days)
 */
async function generatePresignedUrl(key, expiresIn = 604800) {
  const command = new GetObjectCommand({ Bucket: cfg().bucket, Key: key });
  return getSignedUrl(_getClient(), command, { expiresIn });
}

async function deleteFile(key) {
  try {
    await _getClient().send(new DeleteObjectCommand({ Bucket: cfg().bucket, Key: key }));
  } catch { /* best-effort */ }
}

// ── High-level helpers used by routes ─────────────────────────────────────────

/**
 * Upload a multer file to S3 and delete the local temp file.
 *   - S3 not configured → save to local disk (dev mode)
 *   - S3 configured + failure → delete temp file, throw error (no disk fallback)
 *
 * @param {object} file     Multer file object
 * @param {string} adminId  Admin's UUID — used as S3 folder prefix
 */
async function processUpload(file, adminId) {
  if (!isEnabled()) return `/uploads/${file.filename}`;
  const key = originalKey(file.filename, adminId);
  try {
    const url = await uploadFile(file.path, key, file.mimetype);
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    return url;
  } catch (err) {
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Upload a Sharp thumbnail buffer to S3 (or write to disk if S3 not configured).
 *
 * @param {Buffer} buffer
 * @param {string} thumbFilename  e.g. "thumb_abc123.jpg"
 * @param {string} thumbDir       Absolute path to local thumbnails dir (dev fallback only)
 * @param {string} adminId        Admin's UUID — used as S3 folder prefix
 */
async function processThumbnail(buffer, thumbFilename, thumbDir, adminId) {
  if (!isEnabled()) {
    fs.writeFileSync(path.join(thumbDir, thumbFilename), buffer);
    return `/uploads/thumbnails/${thumbFilename}`;
  }
  const key = thumbnailKey(thumbFilename, adminId);
  return await uploadBuffer(buffer, key, 'image/jpeg');
}

/**
 * Resize and compress a local image file to a WebP preview buffer.
 * - Longest side capped at 2000 px (never enlarged)
 * - WebP at 78% quality, metadata stripped
 *
 * @param {string} localPath  Absolute path to the source image file
 * @returns {Promise<Buffer>}
 */
async function generatePreview(localPath) {
  return sharp(localPath)
    .withMetadata(false)
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
}

/**
 * Convert a multer temp file to WebP and store it (S3 or local disk).
 * Used for settings images (hero, profile, logo, instagram feed) so they're
 * always lightweight on the landing page regardless of what the photographer uploads.
 *
 * - Max 1600 px on longest side (never enlarged)
 * - WebP at 82% quality, metadata stripped
 * - Stored as admins/<adminId>/<basename>.webp  (same folder as originals)
 *
 * @param {object} file    Multer file object
 * @param {string} adminId Admin UUID
 * @returns {Promise<string>} Stored S3 key or local path
 */
async function processUploadAsWebP(file, adminId) {
  const basename = path.parse(file.filename).name;
  const webpFilename = `${basename}.webp`;

  const buffer = await sharp(file.path)
    .withMetadata(false)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  try { fs.unlinkSync(file.path); } catch { /* ignore */ }

  if (!isEnabled()) {
    fs.writeFileSync(path.join(path.dirname(file.path), webpFilename), buffer);
    return `/uploads/${webpFilename}`;
  }

  const key = originalKey(webpFilename, adminId);
  return await uploadBuffer(buffer, key, 'image/webp');
}

/**
 * Generate a WebP preview and store it in S3 or on local disk.
 * - S3 configured  → uploads to admins/<adminId>/previews/<basename>.webp
 * - S3 not configured → writes to uploads/previews/<basename>.webp  (dev fallback)
 *
 * @param {string} localPath       Absolute path to the source image (multer temp file)
 * @param {string} previewBasename Filename without extension (e.g. "abc123")
 * @param {string} adminId         Admin UUID — used as S3 folder prefix
 * @returns {Promise<string>}      Stored key or local path (same format as path / thumbnail_path)
 */
async function uploadPreview(localPath, previewBasename, adminId) {
  const buffer = await generatePreview(localPath);
  const filename = `${previewBasename}.webp`;

  if (!isEnabled()) {
    const previewDir = path.join(path.dirname(path.dirname(localPath)), 'previews');
    if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
    fs.writeFileSync(path.join(previewDir, filename), buffer);
    return `/uploads/previews/${filename}`;
  }

  const key = previewKey(previewBasename, adminId);
  return await uploadBuffer(buffer, key, 'image/webp');
}

/**
 * Delete a stored file from S3 (full URL) or local disk (relative "/uploads/..." path).
 *
 * @param {string} storedPath  As saved in the DB
 * @param {string} uploadsDir  Absolute path to local uploads dir (legacy deletes)
 */
async function deleteUpload(storedPath, uploadsDir) {
  if (!storedPath) return;
  if (storedPath.startsWith('http')) {
    // Legacy format: full S3 URL — extract key
    const key = urlToKey(storedPath);
    if (key) await deleteFile(key);
  } else if (storedPath.startsWith('/')) {
    // Local disk path (dev fallback)
    try {
      const localPath = path.join(uploadsDir, path.basename(storedPath));
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch { /* ignore */ }
  } else {
    // New format: raw S3 key (e.g. "admins/<id>/filename.jpg")
    await deleteFile(storedPath);
  }
}

// ── Storage calculation ───────────────────────────────────────────────────────

/**
 * Sum the total size in bytes of all S3 objects under admins/<adminId>/.
 * Uses paginated ListObjectsV2 so it handles any number of objects.
 * Returns 0 if S3 is not configured.
 */
async function listAdminStorageBytes(adminId) {
  if (!isEnabled()) return 0;
  let totalBytes = 0;
  let continuationToken;
  do {
    const res = await _getClient().send(new ListObjectsV2Command({
      Bucket: cfg().bucket,
      Prefix: `admins/${adminId}/`,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents || []) totalBytes += obj.Size || 0;
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);
  return totalBytes;
}

// ── Startup status log (fires on first upload call) ──────────────────────────
let _logged = false;
function _logStatus() {
  if (_logged) return;
  _logged = true;
  const logger = require('../utils/logger');
  const c = cfg();
  if (isEnabled()) {
    const endpoint = c.endpoint || 'aws.amazon.com';
    logger.info(`[S3] enabled — endpoint: ${endpoint}, bucket: ${c.bucket}, region: ${c.region}`);
  } else {
    const missing = ['S3_BUCKET', 'S3_PUBLIC_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
      .filter(k => !process.env[k]);
    logger.warn(`[S3] disabled — missing env vars: ${missing.join(', ')}`);
  }
}

// Wrap high-level exports to log status on first use
const _orig = { processUpload, processUploadAsWebP, processThumbnail, uploadPreview, deleteUpload };
module.exports = {
  isEnabled,
  getPublicUrl,
  urlToKey,
  uploadFile,
  uploadBuffer,
  deleteFile,
  generatePresignedUrl,
  generatePreview,
  listAdminStorageBytes,
  // Exposed so services/storage.js (the multipart-direct upload pipeline) can
  // reuse the same S3Client instance instead of constructing its own — keeps a
  // single connection pool / credentials provider in memory.
  getS3Client: _getClient,
  cfg,
  processUpload:        (...a) => { _logStatus(); return _orig.processUpload(...a); },
  processUploadAsWebP:  (...a) => { _logStatus(); return _orig.processUploadAsWebP(...a); },
  processThumbnail:     (...a) => { _logStatus(); return _orig.processThumbnail(...a); },
  uploadPreview:        (...a) => { _logStatus(); return _orig.uploadPreview(...a); },
  deleteUpload:         (...a) => { _logStatus(); return _orig.deleteUpload(...a); },
};
