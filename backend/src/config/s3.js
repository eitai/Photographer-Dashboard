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
const fs   = require('fs');
const path = require('path');

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
    if (c.endpoint) opts.endpoint = c.endpoint;
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
    logger.info(`[S3] enabled — bucket: ${c.bucket}, region: ${c.region}`);
  } else {
    const missing = ['S3_BUCKET', 'S3_PUBLIC_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
      .filter(k => !process.env[k]);
    logger.warn(`[S3] disabled — missing env vars: ${missing.join(', ')}`);
  }
}

// Wrap high-level exports to log status on first use
const _orig = { processUpload, processThumbnail, deleteUpload };
module.exports = {
  isEnabled,
  getPublicUrl,
  urlToKey,
  uploadFile,
  uploadBuffer,
  deleteFile,
  generatePresignedUrl,
  listAdminStorageBytes,
  processUpload:    (...a) => { _logStatus(); return _orig.processUpload(...a); },
  processThumbnail: (...a) => { _logStatus(); return _orig.processThumbnail(...a); },
  deleteUpload:     (...a) => { _logStatus(); return _orig.deleteUpload(...a); },
};
