/**
 * S3-compatible storage service for Wasabi.
 *
 * Provides multipart-upload plumbing so the browser can PUT bytes directly to
 * Wasabi via presigned URLs — the API never proxies file content.
 *
 * Adapted from compression-pipeline branch: rather than instantiate its own
 * S3Client, this module reuses the singleton from `../config/s3.js` so the
 * legacy multer-based path and the new direct-upload path share one client,
 * one credentials provider, one connection pool. Both code paths read the
 * same env vars (S3_BUCKET, S3_REGION, S3_ENDPOINT, AWS credentials) and
 * point at the same Wasabi/S3-compatible target — re-instantiating would only
 * duplicate state in memory.
 *
 * Required env vars are validated on require() so a misconfigured deploy
 * fails fast at boot rather than at first request.
 */
const {
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  UploadPartCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Readable } = require('node:stream');
const fs = require('node:fs');

const s3Config = require('../config/s3');

// ── Required env validation (fail fast on startup) ───────────────────────────
const REQUIRED_ENV = [
  'S3_BUCKET',
  'S3_REGION',
  'S3_ENDPOINT',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'S3_PUBLIC_URL',
];

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(
    `[storage] Missing required env vars: ${missing.join(', ')}. ` +
    `Copy backend/.env.example to backend/.env and fill in S3/Wasabi credentials.`
  );
}

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.S3_REGION;
const ENDPOINT = process.env.S3_ENDPOINT;

// Validate S3_ENDPOINT shape. A misconfigured/templated endpoint could point
// at localhost metadata services or arbitrary hosts; presigned URLs leak this
// to the browser.
{
  let url;
  try {
    url = new URL(ENDPOINT);
  } catch (err) {
    throw new Error(`[storage] S3_ENDPOINT is not a valid URL: ${ENDPOINT}`);
  }
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))
  ) {
    throw new Error(
      `[storage] S3_ENDPOINT must use HTTPS in production (got ${url.protocol}//${url.hostname})`
    );
  }
  if (process.env.NODE_ENV === 'production' && /^(\d+\.){3}\d+$/.test(url.hostname)) {
    throw new Error(
      `[storage] S3_ENDPOINT must use a hostname, not an IP literal, in production`
    );
  }
}

// ── S3 client (reused singleton from config/s3.js) ───────────────────────────
// Lazy-resolve through a getter so we never call _getClient() at module load
// time — keeps require-order independent.
function s3() {
  return s3Config.getS3Client();
}

// ── Multipart upload helpers ─────────────────────────────────────────────────

/**
 * Initiate a multipart upload.
 * @param {string} key       S3 object key
 * @param {string} contentType
 * @param {object} [metadata] String-only metadata pairs (S3 stores as x-amz-meta-*)
 * @returns {{uploadId: string}}
 */
async function createMultipartUpload(key, contentType, metadata = {}) {
  const cmd = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  });
  const out = await s3().send(cmd);
  return { uploadId: out.UploadId };
}

/**
 * Generate presigned URLs the browser uses to PUT each part.
 * @param {string} key
 * @param {string} uploadId
 * @param {number} partCount
 * @param {number} [expiresIn] seconds (default 3600)
 * @returns {Array<{partNumber:number, presignedUrl:string}>}
 */
async function getPresignedUploadPartUrls(key, uploadId, partCount, expiresIn = 3600) {
  if (!Number.isInteger(partCount) || partCount < 1 || partCount > 10000) {
    throw new Error(`Invalid partCount ${partCount} (S3 allows 1..10000)`);
  }
  // getSignedUrl is independent per part, so fan them out in parallel — a 5GB
  // upload (~54 parts) signs in one round-trip's worth of latency instead of 54.
  const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);
  return Promise.all(partNumbers.map(async (partNumber) => ({
    partNumber,
    presignedUrl: await getSignedUrl(
      s3(),
      new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn }
    ),
  })));
}

/**
 * Finalize a multipart upload with the etags returned from each part PUT.
 * @param {string} key
 * @param {string} uploadId
 * @param {Array<{partNumber:number, etag:string}>} parts
 * @returns {{location: string, etag: string}}
 */
async function completeMultipartUpload(key, uploadId, parts) {
  if (!Array.isArray(parts) || !parts.length) {
    throw new Error('parts array required');
  }
  // S3 requires parts sorted ascending by PartNumber.
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  const cmd = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sorted.map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
    },
  });
  const out = await s3().send(cmd);
  return { location: out.Location || `${process.env.S3_PUBLIC_URL}/${key}`, etag: out.ETag };
}

/**
 * Abort an in-progress multipart upload (releases any uploaded parts).
 */
async function abortMultipartUpload(key, uploadId) {
  await s3().send(new AbortMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
  }));
}

/**
 * Generate a short-lived presigned GET URL.
 * @returns {{url:string, expiresAt:string}} expiresAt is ISO-8601
 */
async function getPresignedGetUrl(key, expiresIn = 3600) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(s3(), cmd, { expiresIn });
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return { url, expiresAt };
}

/**
 * Open a Node Readable stream over an S3 object.
 *
 * The verify worker pipes this directly into `photo-djxl` stdin, so we want a
 * true streaming source — never buffer the body in memory. The AWS SDK v3
 * returns `response.Body` which on Node 18+ is already a Node Readable, but
 * older runtimes hand back a Web ReadableStream. We normalize via
 * Readable.fromWeb when needed so callers get a single stream type.
 *
 * @param {string} key
 * @returns {Promise<import('node:stream').Readable>}
 */
async function getReadStream(key) {
  const out = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = out.Body;
  if (!body) {
    throw new Error(`[storage] empty body for key=${key}`);
  }
  // Node Readable already exposes .pipe — accept and pass through.
  if (typeof body.pipe === 'function') {
    return body;
  }
  // Web ReadableStream → Node Readable adapter.
  if (typeof body.getReader === 'function' && typeof Readable.fromWeb === 'function') {
    return Readable.fromWeb(body);
  }
  throw new Error('[storage] unsupported S3 response body type');
}

/**
 * Server-side copy. Used to stash an original under pending-deletion/<key>
 * before deleting the live key, so verify failures still leave a recoverable
 * copy for the 7-day retention window.
 */
async function copyObject(srcKey, destKey) {
  // CopySource must be `<bucket>/<key>`. The AWS SDK v3 URL-encodes the value
  // internally for the x-amz-copy-source header, including special characters
  // like '*', "'", '(', ')', '!', '~' that a manual encodeURIComponent pass
  // would have to handle separately. Pass the literal string and let the SDK
  // do it (H3) — Wasabi accepts the same format as AWS S3.
  await s3().send(new CopyObjectCommand({
    Bucket: BUCKET,
    Key: destKey,
    CopySource: `${BUCKET}/${srcKey}`,
    MetadataDirective: 'COPY',
  }));
}

/**
 * Hard-delete a single object. Wasabi (like S3) returns success even when the
 * key doesn't exist, so this is naturally idempotent.
 */
async function deleteObject(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Server-side single-shot PUT of a Buffer. Used by the Slice-5 worker to upload
 * the encoder output (cjxl / mozjpeg) once it has been collected and SHA-256d.
 *
 * Single-shot is fine for image-class outputs — mozjpeg q85 of a 100 MB JPEG
 * comes out around 30 MB, and cjxl --lossless_jpeg of the same is ~80 MB.
 * Both fit comfortably in a single PutObject (S3 single-PUT limit is 5 GB).
 *
 * For video-class outputs (>100 MB), prefer putObjectFromFile, which uses the
 * existing multipart helpers so we never have to hold the whole encoded file
 * in worker memory.
 *
 * @param {string} key
 * @param {Buffer} buffer
 * @param {string} contentType
 * @param {object} [metadata] String-only Metadata pairs (S3 stores as x-amz-meta-*)
 */
async function putObjectFromBuffer(key, buffer, contentType, metadata = {}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('[storage] putObjectFromBuffer: buffer must be a Buffer');
  }
  await s3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ContentLength: buffer.length,
    Metadata: metadata,
  }));
}

/**
 * Server-side multipart upload from a local file on disk.
 *
 * The ffmpeg H.265 archive path writes its output to a tempfile (mp4 muxer
 * needs a seekable sink for the moov atom), so by the time we upload we have
 * a real file with a known size. Streaming each part keeps worker memory flat
 * regardless of input video duration.
 *
 * Idempotency: callers should pick a stable destKey so a retried job doesn't
 * fan out into multiple keys; on retry this function will re-upload the same
 * key, which Wasabi handles as last-write-wins.
 *
 * @param {string} key
 * @param {string} filePath  Absolute path on local disk
 * @param {string} contentType
 * @param {object} [metadata]
 * @returns {Promise<{bytes:number}>}
 */
async function putObjectFromFile(key, filePath, contentType, metadata = {}) {
  const stat = await fs.promises.stat(filePath);
  const totalBytes = stat.size;
  if (totalBytes === 0) {
    throw new Error(`[storage] putObjectFromFile: file is empty (${filePath})`);
  }

  // 95 MB parts — same as the browser-upload helper. S3 minimum is 5 MB except
  // the final part. 95 MB keeps every part safely under any 100 MB proxy
  // chunk-size limits we may encounter on Wasabi's path.
  const PART_SIZE = 95 * 1024 * 1024;
  const partCount = Math.max(1, Math.ceil(totalBytes / PART_SIZE));

  // Single-shot fast path — no need to spin up a multipart upload for a 30 MB
  // file. Avoids the 3-roundtrip overhead (Create + UploadPart + Complete).
  if (partCount === 1) {
    const body = fs.createReadStream(filePath);
    try {
      await s3().send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: totalBytes,
        Metadata: metadata,
      }));
    } finally {
      // createReadStream is auto-destroyed once the request reads to EOF, but
      // belt-and-braces in case the SDK aborted mid-stream.
      if (!body.destroyed) body.destroy();
    }
    return { bytes: totalBytes };
  }

  // Multi-part path. We open one fd for the whole upload and slice it part by
  // part; releases the fd in finally even if any UploadPart rejects.
  const create = await s3().send(new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  }));
  const uploadId = create.UploadId;
  const completedParts = [];

  try {
    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, totalBytes) - 1; // inclusive
      const length = end - start + 1;
      const partStream = fs.createReadStream(filePath, { start, end });
      try {
        const out = await s3().send(new UploadPartCommand({
          Bucket: BUCKET,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: partStream,
          ContentLength: length,
        }));
        completedParts.push({ ETag: out.ETag, PartNumber: partNumber });
      } finally {
        if (!partStream.destroyed) partStream.destroy();
      }
    }

    await s3().send(new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: completedParts },
    }));
    return { bytes: totalBytes };
  } catch (err) {
    // Best-effort abort so we don't leak parts on Wasabi (Wasabi bills for
    // pending multipart uploads indefinitely).
    s3().send(new AbortMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
    })).catch(() => { /* swallow — original error is more interesting */ });
    throw err;
  }
}

/**
 * HEAD an object — used by the worker as a cheap sanity check that the
 * upload landed and is non-empty before flipping the asset row. Returns
 * { bytes } or null if the object doesn't exist.
 */
async function headObject(key) {
  try {
    const out = await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { bytes: typeof out.ContentLength === 'number' ? out.ContentLength : null };
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

module.exports = {
  // Reuse the singleton instance from config/s3.js — accessible for tests /
  // diagnostics. Calling .send() through here goes to the same client the
  // legacy multer path uses.
  get s3Client() { return s3(); },
  createMultipartUpload,
  getPresignedUploadPartUrls,
  completeMultipartUpload,
  abortMultipartUpload,
  getPresignedGetUrl,
  getReadStream,
  copyObject,
  deleteObject,
  putObjectFromBuffer,
  putObjectFromFile,
  headObject,
  // Exported for tests / introspection
  BUCKET,
  REGION,
  ENDPOINT,
};
