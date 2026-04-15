/**
 * S3-compatible storage client (Cloudflare R2, AWS S3, DigitalOcean Spaces, MinIO).
 *
 * When S3_BUCKET + S3_PUBLIC_URL + credentials are set, all uploads go to S3
 * and local temp files are deleted after upload.
 *
 * When not configured (dev / CI), the module falls back to local disk storage
 * so existing behaviour is preserved without any code changes in callers.
 */
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs   = require('fs');
const path = require('path');

const S3_ENDPOINT   = (process.env.S3_ENDPOINT   || '').trim();
const S3_REGION     = (process.env.S3_REGION     || 'auto').trim();
const S3_BUCKET     = (process.env.S3_BUCKET     || '').trim();
// S3_PUBLIC_URL = the public-facing base URL for serving files
// e.g. "https://pub-xxxx.r2.dev" or "https://files.yourdomain.com"
const S3_PUBLIC_URL = (process.env.S3_PUBLIC_URL  || '').trim().replace(/\/$/, '');

let _client = null;

function _getClient() {
  if (_client) return _client;
  const opts = {
    region: S3_REGION,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  };
  if (S3_ENDPOINT) opts.endpoint = S3_ENDPOINT;
  _client = new S3Client(opts);
  return _client;
}

/** Returns true when all required S3 env vars are present. */
function isEnabled() {
  return Boolean(
    S3_BUCKET &&
    S3_PUBLIC_URL &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

/** Build the public URL for an S3 key. */
function getPublicUrl(key) {
  return `${S3_PUBLIC_URL}/${key}`;
}

/**
 * Given a stored path (either a full S3 URL or a legacy local "/uploads/..." path),
 * extract the S3 key so it can be deleted. Returns null for local paths.
 */
function urlToKey(storedPath) {
  if (!storedPath || !S3_PUBLIC_URL) return null;
  if (storedPath.startsWith(S3_PUBLIC_URL + '/')) {
    return storedPath.slice(S3_PUBLIC_URL.length + 1);
  }
  return null;
}

/** Upload a local file stream to S3. Returns the public URL. */
async function uploadFile(localPath, key, contentType = 'application/octet-stream') {
  const upload = new Upload({
    client: _getClient(),
    params: {
      Bucket:      S3_BUCKET,
      Key:         key,
      Body:        fs.createReadStream(localPath),
      ContentType: contentType,
    },
  });
  await upload.done();
  return getPublicUrl(key);
}

/** Upload an in-memory Buffer to S3. Returns the public URL. */
async function uploadBuffer(buffer, key, contentType = 'image/jpeg') {
  const upload = new Upload({
    client: _getClient(),
    params: {
      Bucket:      S3_BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    },
  });
  await upload.done();
  return getPublicUrl(key);
}

/** Delete an object from S3 by key. Errors are swallowed (best-effort). */
async function deleteFile(key) {
  try {
    await _getClient().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch {
    // Non-fatal — object may already be gone
  }
}

/**
 * Process a single Multer file:
 *   - S3 enabled  → upload to "uploads/<filename>", delete local temp, return S3 URL
 *   - S3 disabled → leave on disk, return "/uploads/<filename>" (legacy behaviour)
 */
async function processUpload(file) {
  if (!isEnabled()) return `/uploads/${file.filename}`;
  const key = `uploads/${file.filename}`;
  const url = await uploadFile(file.path, key, file.mimetype);
  try { fs.unlinkSync(file.path); } catch { /* ignore */ }
  return url;
}

/**
 * Process a Sharp-generated thumbnail buffer:
 *   - S3 enabled  → upload buffer to "uploads/thumbnails/<thumbFilename>", return S3 URL
 *   - S3 disabled → write buffer to thumbDir on disk, return "/uploads/thumbnails/<thumbFilename>"
 *
 * @param {Buffer} buffer
 * @param {string} thumbFilename   e.g. "thumb_abc123.jpg"
 * @param {string} thumbDir        absolute path to the local thumbnails directory (used only in fallback)
 */
async function processThumbnail(buffer, thumbFilename, thumbDir) {
  if (!isEnabled()) {
    const diskPath = path.join(thumbDir, thumbFilename);
    fs.writeFileSync(diskPath, buffer);
    return `/uploads/thumbnails/${thumbFilename}`;
  }
  const key = `uploads/thumbnails/${thumbFilename}`;
  return await uploadBuffer(buffer, key, 'image/jpeg');
}

/**
 * Delete a previously stored file, regardless of whether it lives in S3 or on local disk.
 *
 * @param {string} storedPath  Value as saved in the DB: S3 URL or "/uploads/..." relative path
 * @param {string} uploadsDir  Absolute path to the local uploads directory (for legacy deletes)
 */
async function deleteUpload(storedPath, uploadsDir) {
  if (!storedPath) return;
  if (storedPath.startsWith('http')) {
    const key = urlToKey(storedPath);
    if (key) await deleteFile(key);
  } else {
    // Legacy local file
    const localPath = path.join(uploadsDir, path.basename(storedPath));
    try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch { /* ignore */ }
  }
}

module.exports = {
  isEnabled,
  getPublicUrl,
  urlToKey,
  uploadFile,
  uploadBuffer,
  deleteFile,
  processUpload,
  processThumbnail,
  deleteUpload,
};
