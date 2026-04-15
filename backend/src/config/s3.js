/**
 * S3-compatible storage client (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO).
 *
 * All env vars are read at call time (not module load time) so dotenv timing
 * is never an issue — the values are always current when a function runs.
 */
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs   = require('fs');
const path = require('path');

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

let _client = null;

function _getClient() {
  // Reset client if config may have changed (first call after dotenv load)
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

function getPublicUrl(key) {
  return `${cfg().publicUrl}/${key}`;
}

function urlToKey(storedPath) {
  const { publicUrl } = cfg();
  if (!storedPath || !publicUrl) return null;
  if (storedPath.startsWith(publicUrl + '/')) return storedPath.slice(publicUrl.length + 1);
  return null;
}

async function uploadFile(localPath, key, contentType = 'application/octet-stream') {
  const upload = new Upload({
    client: _getClient(),
    params: { Bucket: cfg().bucket, Key: key, Body: fs.createReadStream(localPath), ContentType: contentType },
  });
  await upload.done();
  return getPublicUrl(key);
}

async function uploadBuffer(buffer, key, contentType = 'image/jpeg') {
  const upload = new Upload({
    client: _getClient(),
    params: { Bucket: cfg().bucket, Key: key, Body: buffer, ContentType: contentType },
  });
  await upload.done();
  return getPublicUrl(key);
}

async function deleteFile(key) {
  try {
    await _getClient().send(new DeleteObjectCommand({ Bucket: cfg().bucket, Key: key }));
  } catch { /* best-effort */ }
}

/**
 * Upload a multer file to S3 and delete the local temp file.
 * If S3 is not configured → saves to local disk (dev mode).
 * If S3 is configured but fails → deletes the temp file and throws (no local fallback).
 */
async function processUpload(file) {
  if (!isEnabled()) return `/uploads/${file.filename}`;
  const key = `uploads/${file.filename}`;
  try {
    const url = await uploadFile(file.path, key, file.mimetype);
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    return url;
  } catch (err) {
    // Clean up temp file — don't leave it on disk
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Upload a Sharp thumbnail buffer to S3 (or write to disk if S3 not configured).
 * If S3 is configured but fails → throws (no local fallback).
 */
async function processThumbnail(buffer, thumbFilename, thumbDir) {
  if (!isEnabled()) {
    fs.writeFileSync(path.join(thumbDir, thumbFilename), buffer);
    return `/uploads/thumbnails/${thumbFilename}`;
  }
  return await uploadBuffer(buffer, `uploads/thumbnails/${thumbFilename}`, 'image/jpeg');
}

/**
 * Delete a stored file from S3 (full URL) or local disk (relative path).
 */
async function deleteUpload(storedPath, uploadsDir) {
  if (!storedPath) return;
  if (storedPath.startsWith('http')) {
    const key = urlToKey(storedPath);
    if (key) await deleteFile(key);
  } else {
    try {
      const localPath = path.join(uploadsDir, path.basename(storedPath));
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch { /* ignore */ }
  }
}

// Print S3 status once at first call — deferred so dotenv has run by then
let _logged = false;
function logStatus() {
  if (_logged) return;
  _logged = true;
  const logger = require('../utils/logger');
  const c = cfg();
  if (isEnabled()) {
    logger.info(`[S3] enabled — bucket: ${c.bucket}, region: ${c.region}, endpoint: ${c.endpoint || 'default AWS'}`);
  } else {
    const missing = ['S3_BUCKET','S3_PUBLIC_URL','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY']
      .filter(k => !process.env[k]);
    logger.warn(`[S3] disabled — missing env vars: ${missing.join(', ')}`);
  }
}

// Wrap exported functions to log status on first use
const _orig = { processUpload, processThumbnail, deleteUpload };
module.exports = {
  isEnabled,
  getPublicUrl,
  urlToKey,
  uploadFile,
  uploadBuffer,
  deleteFile,
  deleteUpload: (...a) => { logStatus(); return _orig.deleteUpload(...a); },
  processUpload: (...a) => { logStatus(); return _orig.processUpload(...a); },
  processThumbnail: (...a) => { logStatus(); return _orig.processThumbnail(...a); },
};
