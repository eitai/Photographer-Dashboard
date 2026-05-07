/**
 * Worker process entry point.
 *
 * Run with `npm run workers`. This is a SEPARATE process from the API:
 *   - API process: handles HTTP requests, enqueues jobs.
 *   - Worker process: pulls jobs off pg-boss and runs handlers.
 * They share code via src/queue/index.js but are deployed independently. To
 * scale throughput, run more worker processes — they all coordinate through
 * Postgres advisory locks (handled by pg-boss).
 *
 * Idempotency contract:
 *   All handlers MUST be idempotent. Key off `data.assetId` and check
 *   `assets.status` / `assets.format` BEFORE doing work. pg-boss may deliver
 *   the same job more than once on retry, on worker crash, or if the same
 *   asset is enqueued twice (the singletonKey reduces but does not eliminate
 *   this). Re-running a completed handler must be a no-op.
 *
 * ── Concurrency budget ──────────────────────────────────────────────────────
 * WORKER_CONCURRENCY (default 2) applies PER QUEUE, so a single worker
 * process can have up to N jobs in flight per queue concurrently. The three
 * queues have similar (image-sized, CPU-bound) cost profiles:
 *
 *   compression.transcode — cjxl --lossless_jpeg=1 (CPU-bound, RAM ~ image size)
 *   compression.verify    — djxl decode of browser-uploaded PNG sidecar
 *                           (CPU-bound, RAM ~ image size)
 *   compression.cleanup   — S3 DELETE + occasional djxl re-verify (light)
 *
 * The pipeline is lossless-only: JPEG goes through cjxl --lossless_jpeg=1
 * server-side, PNG is encoded to JXL by the browser and verified server-side,
 * everything else is stored as-is.
 */

// Set the OS process title so `ps` and systemd unit logs make it obvious
// which process is the worker vs the API.
process.title = 'photo-worker';

require('dotenv').config();
require('../utils/loadSystemdCredentials').loadSystemdCredentials();

const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Writable } = require('node:stream');

const sharp = require('sharp');

const pool = require('../db');
const { validateEnv } = require('../config/validateEnv');
const logger = require('../utils/logger');
const { getQueue, stopQueue, JOB_NAMES } = require('../queue');
const { processGalleryBatch } = require('../services/faceService');
const {
  getReadStream,
  copyObject,
  deleteObject,
  putObjectFromBuffer,
} = require('../services/storage');

// Vendored binaries live at /usr/local/bin/photo-* in production. The env
// vars let dev machines override (or shim them with fake binaries in tests).
// Ops bootstrap installs both; if either is missing the boot self-test below
// fails and the worker refuses to start — no fallbacks.
const PHOTO_DJXL_BIN = process.env.PHOTO_DJXL_BIN || 'photo-djxl';
const PHOTO_CJXL_BIN = process.env.PHOTO_CJXL_BIN || 'photo-cjxl';

// Fail fast on missing env — same posture as server.js.
const { ok, missing } = validateEnv();
if (!ok) {
  // eslint-disable-next-line no-console
  console.error(`[worker] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

// Per-handler concurrency. teamSize = how many jobs this process will pull at
// once for a given queue. teamConcurrency = 1 means each pulled job runs
// serially within its slot — keeps memory predictable for cjxl/djxl jobs
// where each can be CPU-heavy on multi-megapixel images.
//
// IMPORTANT: pg-boss 9.x splits options between consumer-side (boss.work) and
// producer-side (boss.send). Only consumer/polling options belong here:
// teamSize, teamConcurrency, newJobCheckInterval, batchSize. Job-behavior
// options like expireInSeconds, retryLimit, retryDelay, retryBackoff MUST be
// passed to boss.send() — they are silently ignored by boss.work().
//
// Per-queue expireInSeconds (set at boss.send() time, not here):
//   compression.transcode: 1800s (30m) — cjxl --lossless_jpeg of an image
//   compression.verify:     600s (10m) — djxl roundtrip + SHA-256
//   compression.cleanup:    300s (5m)  — DELETE pending-deletion S3 keys
// If you change the producer's expireInSeconds, also adjust systemd
// TimeoutStopSec to be > expireInSeconds + 30s so SIGKILL doesn't truncate
// in-flight jobs during graceful shutdown.
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10);

const HANDLER_OPTS = {
  teamSize:        Number.isFinite(WORKER_CONCURRENCY) && WORKER_CONCURRENCY > 0 ? WORKER_CONCURRENCY : 2,
  teamConcurrency: 1,
};

// ── Handlers (stubs in Slice 2) ──────────────────────────────────────────────
//
// Idempotency contract: each handler MUST verify current asset state BEFORE
// doing work and ack-skip if the job is already satisfied. pg-boss may deliver
// the same logical job more than once (retries, worker crashes, racing
// enqueues that slipped past the singletonKey window), so handlers must be
// safe to re-run. Slice 3 will copy this skeleton; keeping the guards here
// prevents the bug from spreading.

/**
 * Spawn an encoder/transformer that reads stdin and writes stdout, pipe an
 * S3 object into its stdin, and collect its stdout into a Buffer while
 * SHA-256 hashing on the fly. Returns the Buffer + computed SHA + bytes.
 *
 * Same robustness shape as verifyJxlAgainstSha:
 *   - All stdio 'error' handlers attached BEFORE we start piping.
 *   - spawnError racing against the pipelines so ENOENT surfaces immediately.
 *   - exitPromise so we wait for the actual exit code before declaring
 *     success — pipelines settling does not imply the child exited 0.
 *   - try/finally with SIGKILL of any non-exited child.
 *
 * Throws on any failure (S3 read, encoder crash, OOM, non-zero exit). Caller
 * decides whether to retry or terminal-fail the asset.
 */
async function encodeFromS3ToBuffer(srcKey, bin, args, { logTag }) {
  const srcStream = await getReadStream(srcKey);
  srcStream.on('error', (e) => logger.debug(`[${logTag}] srcStream error (handled): ${e.message}`));

  const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });

  child.stdin.on('error',  (e) => logger.debug(`[${logTag}] stdin error (handled): ${e.message}`));
  child.stdout.on('error', (e) => logger.debug(`[${logTag}] stdout error (handled): ${e.message}`));
  child.stderr.on('error', (e) => logger.debug(`[${logTag}] stderr error (handled): ${e.message}`));

  const stderrChunks = [];
  child.stderr.on('data', (c) => stderrChunks.push(c));

  const spawnError = new Promise((_, reject) => child.on('error', reject));
  const exitPromise = new Promise((resolve) =>
    child.on('exit', (code, signal) => resolve({ code, signal }))
  );

  const hasher = crypto.createHash('sha256');
  const stdoutChunks = [];
  let stdoutBytes = 0;
  const collector = new Writable({
    write(chunk, _enc, cb) {
      hasher.update(chunk);
      stdoutChunks.push(chunk);
      stdoutBytes += chunk.length;
      cb();
    },
  });

  try {
    const stdinPipe  = pipeline(srcStream, child.stdin);
    const stdoutPipe = pipeline(child.stdout, collector);

    await Promise.race([
      Promise.allSettled([stdinPipe, stdoutPipe]).then(() => 'pipes-done'),
      spawnError,
    ]);

    const { code, signal } = await exitPromise;
    if (code !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      throw new Error(
        `${path.basename(bin)} exit ${code}${signal ? ' signal=' + signal : ''}: ${stderr.slice(0, 500)}`
      );
    }

    const [a, b] = await Promise.allSettled([stdinPipe, stdoutPipe]);
    if (a.status === 'rejected') throw a.reason;
    if (b.status === 'rejected') throw b.reason;

    if (stdoutBytes === 0) {
      throw new Error(`${path.basename(bin)} produced 0 bytes — silent failure`);
    }

    return {
      buffer: Buffer.concat(stdoutChunks, stdoutBytes),
      sha256: hasher.digest('hex'),
      bytes:  stdoutBytes,
    };
  } finally {
    if (child.exitCode === null && !child.killed) {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
}

/**
 * Reverse-pipe a JXL Buffer through `djxl -j -` (reconstruct original JPEG
 * bytes) or plain `djxl - -` (decode to PNG) and SHA-256 the result so we
 * can confirm bit-exactness against the recorded original_sha256.
 *
 * Used by the JPEG bit-exact path to prove the cjxl output round-trips back
 * to the byte-identical original before we delete the original from Wasabi.
 */
async function verifyJxlBufferAgainstSha(jxlBuffer, expectedSha, djxlArgs, { logTag }) {
  const child = spawn(PHOTO_DJXL_BIN, djxlArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

  child.stdin.on('error',  (e) => logger.debug(`[${logTag}] djxl.stdin error (handled): ${e.message}`));
  child.stdout.on('error', (e) => logger.debug(`[${logTag}] djxl.stdout error (handled): ${e.message}`));
  child.stderr.on('error', (e) => logger.debug(`[${logTag}] djxl.stderr error (handled): ${e.message}`));

  const stderrChunks = [];
  child.stderr.on('data', (c) => stderrChunks.push(c));

  const spawnError = new Promise((_, reject) => child.on('error', reject));
  const exitPromise = new Promise((resolve) =>
    child.on('exit', (code, signal) => resolve({ code, signal }))
  );

  const hasher = crypto.createHash('sha256');
  const hashSink = new Writable({
    write(chunk, _enc, cb) { hasher.update(chunk); cb(); },
  });

  try {
    // Buffer→stdin: write+end, no pipeline needed (no upstream stream object).
    // Wrap in a promise so write errors propagate and the spawnError race works.
    const stdinPromise = new Promise((resolve, reject) => {
      child.stdin.write(jxlBuffer, (err) => {
        if (err) return reject(err);
        child.stdin.end((err2) => err2 ? reject(err2) : resolve());
      });
    });
    const stdoutPipe = pipeline(child.stdout, hashSink);

    await Promise.race([
      Promise.allSettled([stdinPromise, stdoutPipe]).then(() => 'pipes-done'),
      spawnError,
    ]);

    const { code, signal } = await exitPromise;
    if (code !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      throw new Error(
        `djxl exit ${code}${signal ? ' signal=' + signal : ''}: ${stderr.slice(0, 500)}`
      );
    }

    const [a, b] = await Promise.allSettled([stdinPromise, stdoutPipe]);
    if (a.status === 'rejected') throw a.reason;
    if (b.status === 'rejected') throw b.reason;

    const computedSha = hasher.digest('hex');
    return { match: computedSha === expectedSha, computedSha };
  } finally {
    if (child.exitCode === null && !child.killed) {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
}

/**
 * compression.transcode — server-side encode of a JPEG original to JXL.
 *
 * JPEG-only: cjxl --lossless_jpeg=1 encodes the JPEG bitstream itself (not a
 * re-decode), so djxl -j reconstructs the byte-identical original. Verified
 * by hashing the djxl output and comparing to original_sha256.
 *
 * PNG is handled exclusively by the browser via the /jxl/* sidecar flow.
 * Anything else is stored as-is and never enters this handler.
 *
 * On bit-exact verify success: copy original to pending-deletion/, delete
 * original key, set status='compressed', format='jxl', schedule cleanup +7d.
 *
 * Idempotency: skip if already compressed / failed / verify_failed, or if
 * the row was hand-flipped by an admin since enqueue.
 */
async function compressionTranscodeHandler(job) {
  const { assetId } = job.data || {};
  if (!assetId) {
    logger.warn(`[worker:transcode] job ${job.id} missing assetId; ack`);
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, owner_id, gallery_id, mime_type, status, format,
            original_key, original_sha256, original_bytes, filename
       FROM assets WHERE id = $1`,
    [assetId]
  );
  if (!rows[0]) {
    logger.warn(`[worker:transcode] asset ${assetId} not found; ack`);
    return;
  }
  const asset = rows[0];

  // Idempotency gates — re-running a completed transcode must be a no-op.
  if (asset.format === 'jxl' || asset.status === 'compressed') {
    logger.info(`[worker:transcode] asset ${assetId} already transcoded; skip`);
    return;
  }
  if (asset.status === 'failed' || asset.status === 'verify_failed') {
    logger.info(`[worker:transcode] asset ${assetId} status=${asset.status}; skip`);
    return;
  }
  if (asset.status !== 'uploaded') {
    // 'uploading' / 'verifying' — not our turn. The CAS in /complete or
    // /jxl/complete owns those transitions.
    logger.info(`[worker:transcode] asset ${assetId} status=${asset.status}; skip`);
    return;
  }
  // 'original' is the steady state; 'processing' means a previous run set the
  // gate but didn't finish (worker SIGKILL / OOM). Both are recoverable —
  // retry from scratch. Anything else (jxl/processing-with-jxl-key) is a
  // logic bug, log and skip.
  if (asset.format !== 'original' && asset.format !== 'processing') {
    logger.info(`[worker:transcode] asset ${assetId} format=${asset.format}; skip`);
    return;
  }

  const mime = (asset.mime_type || '').toLowerCase();

  // PNG is handled exclusively by the browser (Slice 3 sidecar). If a PNG ever
  // reaches this handler, that means the browser path failed — we deliberately
  // do NOT fall back to server-side cjxl. Caller should investigate.
  if (mime === 'image/png') {
    logger.warn(
      `[worker:transcode] asset ${assetId} mime=image/png reached server-side ` +
      `transcode handler — browser /jxl/* sidecar should have handled this. No fallback; ack-skip.`
    );
    return;
  }

  if (mime !== 'image/jpeg' && mime !== 'image/jpg') {
    logger.warn(`[worker:transcode] asset ${assetId} mime=${mime} not transcodable; skip`);
    return;
  }

  // --lossless_jpeg=1 keeps the JPEG bitstream; -e 4 = effort level 4 (good
  // ratio without burning a minute of CPU per megapixel).
  // -j on djxl reconstructs the original JPEG bytes for bit-exact verification.
  const cjxlArgs       = ['--lossless_jpeg=1', '-e', '4', '-', '-'];
  const djxlVerifyArgs = ['-j', '-', '-'];

  // Soft state-gate: only proceed if we can flip the row to 'processing'.
  // Use the `format` column rather than `status` so we don't have to widen
  // the status CHECK constraint just to mark "in-flight". The IN clause
  // accepts both 'original' (first attempt) and 'processing' (retry after a
  // mid-flight worker crash that left the gate set). A second concurrent
  // handler doesn't gain anything from re-entering 'processing' → still no
  // double-encode because pg-boss singletonKey on the producer side keeps
  // duplicates within a 30-min window from being delivered concurrently.
  const gate = await pool.query(
    `UPDATE assets
        SET format = 'processing',
            updated_at = NOW()
      WHERE id = $1 AND status = 'uploaded'
        AND format IN ('original','processing')
      RETURNING id`,
    [assetId]
  );
  if (gate.rowCount === 0) {
    logger.info(`[worker:transcode] asset ${assetId} no longer eligible (raced); skip`);
    return;
  }

  logger.info(
    `[worker:transcode] starting cjxl for asset ${assetId} mime=${mime} ` +
    `original_bytes=${asset.original_bytes}`
  );

  // 1. Encode original → JXL (in memory)
  let encoded;
  try {
    encoded = await encodeFromS3ToBuffer(
      asset.original_key, PHOTO_CJXL_BIN, cjxlArgs, { logTag: 'transcode' }
    );
  } catch (err) {
    // Roll the gate back so retry can pick this up.
    await pool.query(
      `UPDATE assets SET format = 'original', updated_at = NOW() WHERE id = $1`,
      [assetId]
    );
    logger.error(`[worker:transcode] cjxl failed for asset ${assetId}: ${err.message}`);
    throw err; // pg-boss retry
  }

  // 2. Verify by reverse-piping back through djxl and comparing SHA.
  let verify;
  try {
    verify = await verifyJxlBufferAgainstSha(
      encoded.buffer, asset.original_sha256, djxlVerifyArgs, { logTag: 'transcode' }
    );
  } catch (err) {
    await pool.query(
      `UPDATE assets SET format = 'original', updated_at = NOW() WHERE id = $1`,
      [assetId]
    );
    logger.error(`[worker:transcode] djxl verify failed for asset ${assetId}: ${err.message}`);
    throw err;
  }

  if (!verify.match) {
    // Bit-exact failure. This is a logical fault, not a transient one — the
    // cjxl output decodes to different bytes than what the photographer
    // uploaded. Park in verify_failed and DO NOT delete the original.
    await pool.query(
      `UPDATE assets
          SET status = 'verify_failed',
              format = 'original',
              updated_at = NOW()
        WHERE id = $1`,
      [assetId]
    );
    logger.error(
      `[worker:transcode] HASH MISMATCH for asset ${assetId}: ` +
      `expected ${asset.original_sha256}, got ${verify.computedSha}`
    );
    return; // DO NOT throw — pg-boss retry would re-fail identically.
  }

  // 3. Upload the JXL Buffer to Wasabi.
  const jxlKey = `originals/${asset.owner_id}/${assetId}/${asset.filename}.jxl`;
  try {
    await putObjectFromBuffer(jxlKey, encoded.buffer, 'image/jxl', {
      'asset-id': assetId,
      'owner-id': asset.owner_id,
      'sha256':   encoded.sha256,
      'transcode': 'cjxl-lossless-jpeg',
    });
  } catch (err) {
    await pool.query(
      `UPDATE assets SET format = 'original', updated_at = NOW() WHERE id = $1`,
      [assetId]
    );
    logger.error(`[worker:transcode] putObjectFromBuffer failed for asset ${assetId}: ${err.message}`);
    throw err;
  }

  // 4. Stash original under pending-deletion/ and delete the live key.
  const pendingKey = 'pending-deletion/' + asset.original_key;
  try {
    await copyObject(asset.original_key, pendingKey);
    await deleteObject(asset.original_key);
  } catch (err) {
    // We've already uploaded the JXL — don't roll the gate back, just retry
    // the storage move. copyObject + deleteObject are idempotent on Wasabi.
    logger.error(`[worker:transcode] storage move failed for asset ${assetId}: ${err.message}`);
    throw err;
  }

  // 5. Bookkeeping: flip the row to its terminal compressed state.
  await pool.query(
    `UPDATE assets
        SET status = 'compressed',
            format = 'jxl',
            jxl_key = $2,
            jxl_bytes = $3,
            jxl_sha256 = $4,
            pending_deletion_key = $5,
            deletion_scheduled_at = NOW() + INTERVAL '7 days',
            verified_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [assetId, jxlKey, encoded.bytes, encoded.sha256, pendingKey]
  );

  // 6. Schedule the +7d cleanup.
  try {
    const boss = await getQueue();
    await boss.send(
      JOB_NAMES.COMPRESSION_CLEANUP,
      { assetId },
      {
        startAfter:       7 * 86400,
        singletonKey:     `cleanup:${assetId}`,
        singletonSeconds: 8 * 86400,
        retryLimit:       3,
        retryDelay:       300,
        retryBackoff:     true,
        expireInSeconds:  300,
      }
    );
  } catch (err) {
    logger.error(`[worker:transcode] failed to enqueue cleanup for asset ${assetId}: ${err.message}`);
  }

  logger.info(
    `[worker:transcode] asset ${assetId} compressed — ` +
    `jxl_bytes=${encoded.bytes} (${Math.round(100 * encoded.bytes / asset.original_bytes)}% of original), ` +
    `original moved to ${pendingKey}`
  );
}

/**
 * Stream a JXL object from S3 through `photo-djxl` (decoder), hash the decoded
 * raw output with SHA-256, and compare to expectedSha. Resolves to
 * `{ match, computedSha }` on a clean decode; throws on transient failures
 * (S3 error, decoder crash, OOM) so the caller can let pg-boss retry.
 *
 * The "did the decoder accept the file at all" signal is folded into a thrown
 * Error — a non-zero exit code is treated as a transient/retriable problem
 * rather than a logical mismatch, because a corrupt JXL is operationally the
 * same as "S3 served us garbage" and an admin should look at it. Slice 4 may
 * grow finer-grained classification.
 */
async function verifyJxlAgainstSha(jxlKey, expectedSha, opts = {}) {
  // mime-aware: JPEG bit-exact assets need `djxl -j` to reconstruct the
  // original JPEG bytes (so the SHA matches `original_sha256`, which is the
  // SHA of the JPEG bitstream). Raster (e.g. PNG sidecar) decodes to raw bytes.
  // Both the initial verify pass AND the +7d cleanup re-verify must use the
  // SAME flags — otherwise the cleanup re-verify hash never matches and the
  // 7-day timer becomes a kill timer for every JPEG archive.
  const djxlArgs = opts.jpegMode ? ['-j', '-', '-'] : ['-', '-'];

  const jxlStream = await getReadStream(jxlKey);
  // No-op error handler prevents an unhandled-'error' crash if the S3 stream
  // emits after our pipeline has already settled (H5).
  jxlStream.on('error', (e) => logger.debug(`[verify] jxlStream error (handled): ${e.message}`));

  const djxl = spawn(PHOTO_DJXL_BIN, djxlArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

  // Attach all stdio error handlers BEFORE we start piping anything (C1).
  // Idle handlers prevent post-settle 'error' events from crashing the worker
  // process — the pipelines below already surface real failures via their
  // own promise rejection.
  djxl.stdin.on('error',  (e) => logger.debug(`[verify] djxl.stdin error (handled): ${e.message}`));
  djxl.stdout.on('error', (e) => logger.debug(`[verify] djxl.stdout error (handled): ${e.message}`));
  djxl.stderr.on('error', (e) => logger.debug(`[verify] djxl.stderr error (handled): ${e.message}`));

  const stderrChunks = [];
  djxl.stderr.on('data', (c) => stderrChunks.push(c));

  // Spawn-error promise (C2): never resolves on success; rejects on
  // ENOENT/EACCES so a missing binary surfaces cleanly instead of as a
  // confusing "write after end" once the pipelines have started.
  const spawnError = new Promise((_, reject) => djxl.on('error', reject));
  // Exit promise: resolves with {code, signal} when djxl actually exits.
  const exitPromise = new Promise((resolve) =>
    djxl.on('exit', (code, signal) => resolve({ code, signal }))
  );

  const hasher = crypto.createHash('sha256');
  const hashSink = new Writable({
    write(chunk, _enc, cb) { hasher.update(chunk); cb(); },
  });

  try {
    const stdinPipe  = pipeline(jxlStream, djxl.stdin);
    const stdoutPipe = pipeline(djxl.stdout, hashSink);

    // Race spawn errors against pipeline progress. If spawn fails (ENOENT),
    // the race rejects immediately with that error before we waste time on
    // the pipelines. On success, the allSettled branch wins.
    await Promise.race([
      Promise.allSettled([stdinPipe, stdoutPipe]).then(() => 'pipes-done'),
      spawnError,
    ]);

    // Wait for djxl to actually exit before declaring success/failure.
    const { code, signal } = await exitPromise;
    if (code !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      throw new Error(
        `djxl exit ${code}${signal ? ' signal=' + signal : ''}: ${stderr.slice(0, 500)}`
      );
    }

    // Now confirm both pipelines settled successfully — surface either's
    // rejection rather than swallowing it via allSettled.
    const [a, b] = await Promise.allSettled([stdinPipe, stdoutPipe]);
    if (a.status === 'rejected') throw a.reason;
    if (b.status === 'rejected') throw b.reason;

    const computedSha = hasher.digest('hex');
    return { match: computedSha === expectedSha, computedSha };
  } finally {
    // Guarantee no zombie djxl process on any error path (C1). The
    // exitCode === null guard avoids signalling an already-exited process.
    if (djxl.exitCode === null && !djxl.killed) {
      try { djxl.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
}

async function compressionVerifyHandler(job) {
  const { assetId } = job.data || {};
  if (!assetId) {
    logger.warn(`[worker:verify] job ${job.id} missing assetId; ack`);
    return;
  }

  // Idempotency: pull all the columns we need up front so each branch can
  // decide without re-querying.
  const { rows } = await pool.query(
    `SELECT status, format, original_key, original_sha256, jxl_key, mime_type
       FROM assets WHERE id = $1`,
    [assetId]
  );
  if (!rows[0]) {
    logger.warn(`[worker:verify] asset ${assetId} not found; ack`);
    return;
  }
  const asset = rows[0];

  if (asset.status === 'compressed') {
    logger.info(`[worker:verify] asset ${assetId} already compressed; skip`);
    return;
  }
  if (asset.status === 'verify_failed') {
    // Logical failure — re-running would re-fail. Operator must intervene.
    logger.info(`[worker:verify] asset ${assetId} in verify_failed; skip`);
    return;
  }
  if (asset.status === 'failed') {
    logger.info(`[worker:verify] asset ${assetId} marked failed; skip`);
    return;
  }
  if (!asset.jxl_key || !asset.original_sha256 || !asset.original_key) {
    logger.error(
      `[worker:verify] asset ${assetId} missing required fields ` +
      `(jxl_key=${!!asset.jxl_key}, original_sha256=${!!asset.original_sha256}, ` +
      `original_key=${!!asset.original_key}); ack without retry`
    );
    return;
  }

  // Soft state-gate: only proceed if /jxl/complete left us in 'verifying'. If
  // some other process raced ahead (e.g. an admin-ordered cleanup pulled the
  // row to a terminal state), the rowCount will be 0 and we ack-skip.
  const gate = await pool.query(
    `UPDATE assets
        SET updated_at = NOW()
      WHERE id = $1 AND status = 'verifying'
      RETURNING id`,
    [assetId]
  );
  if (gate.rowCount === 0) {
    logger.info(
      `[worker:verify] asset ${assetId} no longer in 'verifying' state; skip`
    );
    return;
  }

  logger.info(`[worker:verify] starting decode for asset ${assetId} jxl_key=${asset.jxl_key}`);

  // For JPEG bit-exact archives, djxl needs `-j` to reconstruct the original
  // JPEG bytes — the same flag the transcode pass used. Raster (PNG sidecar)
  // decodes without `-j`.
  const isJpeg = (asset.mime_type || '').toLowerCase() === 'image/jpeg';

  let result;
  try {
    result = await verifyJxlAgainstSha(asset.jxl_key, asset.original_sha256, { jpegMode: isJpeg });
  } catch (err) {
    // Transient: S3 read failure, decoder crash, OOM. Don't move to
    // verify_failed (that would prevent retries). Re-throw so pg-boss retries.
    logger.error(
      `[worker:verify] transient failure for asset ${assetId}: ${err.message}`
    );
    throw err;
  }

  if (!result.match) {
    await pool.query(
      `UPDATE assets
          SET status = 'verify_failed',
              updated_at = NOW()
        WHERE id = $1`,
      [assetId]
    );
    // Don't throw — the asset is in a deterministic failed state. Throwing
    // would trigger pg-boss retry which would re-fail the same way.
    logger.error(
      `[worker:verify] HASH MISMATCH for asset ${assetId}: ` +
      `expected ${asset.original_sha256}, got ${result.computedSha}`
    );
    return;
  }

  // Match: stash the original under pending-deletion/<key> so a 7-day window
  // exists to recover from any post-verify discovery of corruption, then flip
  // the asset to 'compressed'.
  const pendingKey = 'pending-deletion/' + asset.original_key;
  try {
    await copyObject(asset.original_key, pendingKey);
    await deleteObject(asset.original_key);
  } catch (err) {
    // Storage layer failure between verify success and bookkeeping — don't
    // move the row, let pg-boss retry. Worst case the same copy/delete runs
    // again; copyObject+deleteObject are idempotent on Wasabi.
    logger.error(
      `[worker:verify] storage move failed for asset ${assetId}: ${err.message}`
    );
    throw err;
  }

  await pool.query(
    `UPDATE assets
        SET status = 'compressed',
            format = 'jxl',
            pending_deletion_key = $2,
            deletion_scheduled_at = NOW() + INTERVAL '7 days',
            verified_at = NOW(),
            updated_at = NOW()
      WHERE id = $1 AND status = 'verifying'`,
    [assetId, pendingKey]
  );

  // Schedule the +7d cleanup. singletonKey + singletonSeconds give us a wide
  // enough window that retries of this verify job can't double-schedule.
  try {
    const boss = await getQueue();
    await boss.send(
      JOB_NAMES.COMPRESSION_CLEANUP,
      { assetId },
      {
        startAfter:       7 * 86400,
        singletonKey:     `cleanup:${assetId}`,
        singletonSeconds: 8 * 86400,
        retryLimit:       3,
        retryDelay:       300,
        retryBackoff:     true,
        expireInSeconds:  300,
      }
    );
  } catch (err) {
    // Non-fatal. The asset is already 'compressed'; a Slice-4 sweeper can
    // re-enqueue any asset whose deletion_scheduled_at is past and which
    // still has pending_deletion_key set.
    logger.error(
      `[worker:verify] failed to enqueue cleanup for asset ${assetId}: ${err.message}`
    );
  }

  logger.info(
    `[worker:verify] asset ${assetId} verified — original moved to ${pendingKey}, cleanup scheduled +7d`
  );
}

// CRITICAL: cleanup re-verify MUST use the same djxl flags as the initial
// verify pass. For JPEG-bit-exact assets that means djxl -j (jpegMode: true)
// to reconstruct JPEG bytes. Without this, every JPEG archive gets marked
// verify_failed exactly 7 days after compression.
async function compressionCleanupHandler(job) {
  const { assetId } = job.data || {};
  if (!assetId) {
    logger.warn(`[worker:cleanup] job ${job.id} missing assetId; ack`);
    return;
  }

  const { rows } = await pool.query(
    `SELECT status, format, jxl_key, original_sha256, mime_type,
            pending_deletion_key, deletion_scheduled_at
       FROM assets WHERE id = $1`,
    [assetId]
  );
  if (!rows[0]) {
    logger.warn(`[worker:cleanup] asset ${assetId} not found; ack`);
    return;
  }
  const asset = rows[0];

  // Already cleaned (or never had a pending key) — idempotent skip.
  if (!asset.pending_deletion_key) {
    logger.info(`[worker:cleanup] asset ${assetId} has no pending-deletion key; skip`);
    return;
  }
  // pg-boss may wake us early on retry / restart. Guard the schedule.
  if (asset.deletion_scheduled_at && new Date(asset.deletion_scheduled_at) > new Date()) {
    logger.info(
      `[worker:cleanup] asset ${assetId} not yet due ` +
      `(scheduled_at=${asset.deletion_scheduled_at}); skip`
    );
    return;
  }
  if (asset.status === 'failed' || asset.status === 'verify_failed') {
    logger.info(`[worker:cleanup] asset ${assetId} status=${asset.status}; skip cleanup`);
    return;
  }

  // Lossless-only path: every cleanup-eligible asset has format='jxl' (the
  // browser-uploaded PNG sidecar OR the server-side JPEG bit-exact pass) so
  // the JXL is byte-reversible to the stashed pending_deletion_key. Cheap
  // insurance: re-decode the JXL one more time and re-compare against
  // original_sha256 before deleting the safety copy. If it diverges, park
  // the asset in verify_failed and KEEP the pending_deletion_key so an
  // operator can manually recover.
  if (asset.jxl_key && asset.original_sha256) {
    const isJpeg = (asset.mime_type || '').toLowerCase() === 'image/jpeg';
    let recheck;
    try {
      recheck = await verifyJxlAgainstSha(asset.jxl_key, asset.original_sha256, { jpegMode: isJpeg });
    } catch (err) {
      logger.error(
        `[worker:cleanup] transient re-verify failure for asset ${assetId}: ${err.message}`
      );
      throw err;
    }
    if (!recheck.match) {
      await pool.query(
        `UPDATE assets
            SET status = 'verify_failed',
                updated_at = NOW()
          WHERE id = $1`,
        [assetId]
      );
      logger.error(
        `[worker:cleanup] CRITICAL re-verify mismatch for asset ${assetId}: ` +
        `expected ${asset.original_sha256}, got ${recheck.computedSha}. ` +
        `Original preserved at ${asset.pending_deletion_key}; admin must investigate.`
      );
      return;
    }
  } else {
    // Defensive: a row scheduled for cleanup should always have these fields.
    // Log loudly but proceed — refusing to clean up forever is worse than a
    // best-effort delete here.
    logger.warn(
      `[worker:cleanup] asset ${assetId} missing jxl_key/original_sha256; ` +
      `skipping re-verify but proceeding with delete.`
    );
  }

  // Common tail: delete the pending-deletion safety copy and clear the row.
  try {
    await deleteObject(asset.pending_deletion_key);
  } catch (err) {
    logger.error(
      `[worker:cleanup] deleteObject failed for asset ${assetId} key=${asset.pending_deletion_key}: ${err.message}`
    );
    throw err; // let pg-boss retry
  }

  await pool.query(
    `UPDATE assets
        SET pending_deletion_key = NULL,
            deletion_scheduled_at = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [assetId]
  );

  logger.info(
    `[worker:cleanup] asset ${assetId} cleaned — deleted ${asset.pending_deletion_key}`
  );
}

// ── Face recognition handler ─────────────────────────────────────────────────

async function faceRecognitionHandler(job) {
  const { galleryId, adminId, imageIds } = job.data || {};
  if (!galleryId || !adminId || !Array.isArray(imageIds)) {
    logger.warn(`[worker:face] job ${job.id} missing required fields; ack`);
    return;
  }

  logger.info(`[worker:face] starting recognition for gallery ${galleryId} — ${imageIds.length} images`);

  try {
    const matched = await processGalleryBatch(galleryId, adminId, imageIds);
    logger.info(`[worker:face] gallery ${galleryId} done — ${matched} faces matched`);
  } catch (err) {
    logger.error(`[worker:face] gallery ${galleryId} failed: ${err.message}`);
    await pool.query(
      `UPDATE face_recognition_jobs
       SET status = 'failed', error_message = $1, finished_at = NOW()
       WHERE gallery_id = $2`,
      [err.message.slice(0, 500), galleryId]
    ).catch(() => {});
    throw err; // let pg-boss retry
  }
}

// ── Vendored binary version assertions ───────────────────────────────────────
//
// The pipeline uses two vendored binaries: cjxl (JPEG → JXL bit-exact
// encoder) and djxl (JXL decoder, used for both verify and the bit-exact
// JPEG round-trip via `-j`). Both are probed at boot and the cjxl/djxl JPEG
// round-trip is exercised on a tiny synthetic JPEG (selfTestCjxlJpeg) — if
// either binary is missing or the round-trip is not bit-identical the worker
// refuses to start. There are no fallbacks.

function probeVersion(bin, args, label, expectedPrefixEnvKey) {
  let versionOutput;
  try {
    versionOutput = execFileSync(bin, args, {
      encoding: 'utf8',
      timeout:  5000,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn(
        `[worker] ${label} binary not found at '${bin}'. ` +
        `Affected handlers will fail until the binary is on PATH or the env var is set.`
      );
    } else {
      logger.warn(`[worker] ${label} ${args.join(' ')} failed (${err.code || 'unknown'}): ${err.message}`);
    }
    return;
  }

  const trimmed = (versionOutput || '').trim();
  const firstLine = trimmed.split('\n')[0];
  logger.info(`[worker] ${label} version probe: ${firstLine}`);

  if (expectedPrefixEnvKey) {
    const expected = process.env[expectedPrefixEnvKey];
    if (expected && !trimmed.startsWith(expected)) {
      logger.warn(
        `[worker] ${label} version mismatch: expected prefix '${expected}', got '${firstLine}'`
      );
    }
  }
}

function assertDjxlVersion() {
  probeVersion(PHOTO_DJXL_BIN, ['--version'], 'djxl', 'EXPECTED_DJXL_VERSION_PREFIX');
}

function assertCjxlVersion() {
  probeVersion(PHOTO_CJXL_BIN, ['--version'], 'cjxl', 'EXPECTED_CJXL_VERSION_PREFIX');
}

/**
 * Boot self-test: prove that the deployed cjxl --lossless_jpeg=1 paired with
 * djxl -j actually produces a byte-identical round-trip on a known JPEG.
 *
 * Generates a 1×1 white JPEG via `sharp` (already in the dependency tree),
 * pipes it through cjxl → djxl -j, hashes the recovered bytes, and compares
 * them to the input hash. If the round-trip is not bit-identical, throws —
 * caller (main) translates that into process.exit(1) so the worker refuses
 * to start. No fallbacks: a worker that can't prove bit-exactness must not
 * touch live photographer data.
 *
 * Spawn shape mirrors verifyJxlBufferAgainstSha: idle stdio error handlers
 * attached before piping, a spawnError race so ENOENT surfaces clean, and a
 * try/finally that SIGKILLs any child still alive on the error path.
 */
async function selfTestCjxlJpeg() {
  // 1×1 white JPEG generated at runtime — saves embedding hex literals and
  // any divergence between the embedded bytes and an actual sharp JPEG would
  // mask a real round-trip failure.
  const tinyJpeg = await sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).jpeg().toBuffer();
  const expectedSha = crypto.createHash('sha256').update(tinyJpeg).digest('hex');

  const cjxl = spawn(PHOTO_CJXL_BIN, ['--lossless_jpeg=1', '-e', '4', '-', '-'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const djxl = spawn(PHOTO_DJXL_BIN, ['-j', '-', '-'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Idle error handlers prevent post-settle 'error' from crashing the process.
  cjxl.stdin.on('error',  (e) => logger.debug(`[selftest] cjxl.stdin error (handled): ${e.message}`));
  cjxl.stdout.on('error', (e) => logger.debug(`[selftest] cjxl.stdout error (handled): ${e.message}`));
  cjxl.stderr.on('error', (e) => logger.debug(`[selftest] cjxl.stderr error (handled): ${e.message}`));
  djxl.stdin.on('error',  (e) => logger.debug(`[selftest] djxl.stdin error (handled): ${e.message}`));
  djxl.stdout.on('error', (e) => logger.debug(`[selftest] djxl.stdout error (handled): ${e.message}`));
  djxl.stderr.on('error', (e) => logger.debug(`[selftest] djxl.stderr error (handled): ${e.message}`));

  const cjxlStderr = [];
  const djxlStderr = [];
  cjxl.stderr.on('data', (c) => cjxlStderr.push(c));
  djxl.stderr.on('data', (c) => djxlStderr.push(c));

  const cjxlSpawnError = new Promise((_, reject) => cjxl.on('error', reject));
  const djxlSpawnError = new Promise((_, reject) => djxl.on('error', reject));
  const cjxlExit = new Promise((resolve) => cjxl.on('exit', (code, signal) => resolve({ code, signal })));
  const djxlExit = new Promise((resolve) => djxl.on('exit', (code, signal) => resolve({ code, signal })));

  const hasher = crypto.createHash('sha256');
  const hashSink = new Writable({
    write(chunk, _enc, cb) { hasher.update(chunk); cb(); },
  });

  try {
    // Feed the tiny JPEG into cjxl stdin, then close. Wrapped so write errors
    // surface and the spawn-error race works cleanly.
    const stdinPromise = new Promise((resolve, reject) => {
      cjxl.stdin.write(tinyJpeg, (err) => {
        if (err) return reject(err);
        cjxl.stdin.end((err2) => err2 ? reject(err2) : resolve());
      });
    });
    const cjxlToDjxl = pipeline(cjxl.stdout, djxl.stdin);
    const djxlToHash = pipeline(djxl.stdout, hashSink);

    await Promise.race([
      Promise.allSettled([stdinPromise, cjxlToDjxl, djxlToHash]).then(() => 'pipes-done'),
      cjxlSpawnError,
      djxlSpawnError,
    ]);

    const [{ code: cjxlCode, signal: cjxlSig }, { code: djxlCode, signal: djxlSig }] =
      await Promise.all([cjxlExit, djxlExit]);
    if (cjxlCode !== 0) {
      throw new Error(
        `cjxl exit ${cjxlCode}${cjxlSig ? ' signal=' + cjxlSig : ''}: ` +
        Buffer.concat(cjxlStderr).toString('utf8').slice(0, 500)
      );
    }
    if (djxlCode !== 0) {
      throw new Error(
        `djxl exit ${djxlCode}${djxlSig ? ' signal=' + djxlSig : ''}: ` +
        Buffer.concat(djxlStderr).toString('utf8').slice(0, 500)
      );
    }

    const settled = await Promise.allSettled([stdinPromise, cjxlToDjxl, djxlToHash]);
    for (const s of settled) {
      if (s.status === 'rejected') throw s.reason;
    }

    const recoveredSha = hasher.digest('hex');
    if (recoveredSha !== expectedSha) {
      throw new Error(
        `cjxl/djxl JPEG self-test failed: expected ${expectedSha}, got ${recoveredSha}`
      );
    }
    logger.info('[worker] cjxl/djxl JPEG round-trip self-test passed');
  } finally {
    if (cjxl.exitCode === null && !cjxl.killed) {
      try { cjxl.kill('SIGKILL'); } catch { /* ignore */ }
    }
    if (djxl.exitCode === null && !djxl.killed) {
      try { djxl.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  assertDjxlVersion();
  assertCjxlVersion();

  // Prove the deployed encoder/decoder pair is bit-exact before we touch any
  // live photographer data. No fallbacks: if this fails, refuse to start.
  try {
    await selfTestCjxlJpeg();
  } catch (err) {
    logger.error('[worker] cjxl/djxl JPEG self-test FAILED — refusing to start', err);
    process.exit(1);
  }

  const boss = await getQueue();

  await boss.work(JOB_NAMES.COMPRESSION_TRANSCODE, HANDLER_OPTS, compressionTranscodeHandler);
  await boss.work(JOB_NAMES.COMPRESSION_VERIFY,    HANDLER_OPTS, compressionVerifyHandler);
  await boss.work(JOB_NAMES.COMPRESSION_CLEANUP,   HANDLER_OPTS, compressionCleanupHandler);
  // teamSize: 1 — TF.js models use ~150-200 MB; limit concurrency to one job at a time
  await boss.work(JOB_NAMES.FACE_RECOGNITION, { teamSize: 1, teamConcurrency: 1 }, faceRecognitionHandler);

  logger.info(
    `[worker] ready — concurrency=${HANDLER_OPTS.teamSize} ` +
    `queues=[${JOB_NAMES.COMPRESSION_TRANSCODE}, ${JOB_NAMES.COMPRESSION_VERIFY}, ` +
    `${JOB_NAMES.COMPRESSION_CLEANUP}, ${JOB_NAMES.FACE_RECOGNITION}]`
  );
  // Process stays alive on the queue's polling loop. Do not return.
}

// ── Signal handling ──────────────────────────────────────────────────────────

async function shutdown(signal) {
  logger.info(`[worker] received ${signal}, draining…`);
  try {
    await stopQueue();
    logger.info('[worker] drained, exiting');
    process.exit(0);
  } catch (e) {
    logger.error('[worker] forced exit', e);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[worker] unhandled rejection', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('[worker] uncaught exception', err);
  // Let systemd / orchestrator restart us.
  process.exit(1);
});

main().catch((err) => {
  logger.error(`[worker] fatal startup error: ${err.message}`, err);
  process.exit(1);
});
