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

const { validateEnv } = require('../config/validateEnv');
const logger = require('../utils/logger');
const { getQueue, stopQueue, JOB_NAMES } = require('../queue');

const {
  compressionTranscodeHandler,
  compressionVerifyHandler,
  compressionCleanupHandler,
  assertDjxlVersion,
  assertCjxlVersion,
  selfTestCjxlJpeg,
} = require('./compression');

const { faceRecognitionHandler } = require('./faceRecognition');

const {
  billingMonthlyHandler,
  billingDailyHandler,
  storeDispatchSweepHandler,
} = require('./billing');

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

  // Monthly photographer billing — close the previous month's cycle, charge
  // saved cards. Cron is UTC; 06:00 on the 1st. Idempotent (UNIQUE per period).
  await boss.work(JOB_NAMES.BILLING_MONTHLY, { teamSize: 1, teamConcurrency: 1 }, billingMonthlyHandler);
  await boss.schedule(JOB_NAMES.BILLING_MONTHLY, '0 6 1 * *', {}, { tz: 'UTC' });

  // Daily billing recovery — retry unpaid invoices + backfill pending documents.
  // 06:30 UTC every day. Idempotent; never creates new invoices.
  await boss.work(JOB_NAMES.BILLING_DAILY, { teamSize: 1, teamConcurrency: 1 }, billingDailyHandler);
  await boss.schedule(JOB_NAMES.BILLING_DAILY, '30 6 * * *', {}, { tz: 'UTC' });

  // Store dispatch sweep — re-dispatch paid orders the webhook failed to send to
  // the exclusive supplier. Every 15 minutes. Idempotent.
  await boss.work(JOB_NAMES.STORE_DISPATCH_SWEEP, { teamSize: 1, teamConcurrency: 1 }, storeDispatchSweepHandler);
  await boss.schedule(JOB_NAMES.STORE_DISPATCH_SWEEP, '*/15 * * * *', {}, { tz: 'UTC' });

  logger.info(
    `[worker] ready — concurrency=${HANDLER_OPTS.teamSize} ` +
    `queues=[${JOB_NAMES.COMPRESSION_TRANSCODE}, ${JOB_NAMES.COMPRESSION_VERIFY}, ` +
    `${JOB_NAMES.COMPRESSION_CLEANUP}, ${JOB_NAMES.FACE_RECOGNITION}, ${JOB_NAMES.BILLING_MONTHLY}, ` +
    `${JOB_NAMES.BILLING_DAILY}, ${JOB_NAMES.STORE_DISPATCH_SWEEP}]`
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
