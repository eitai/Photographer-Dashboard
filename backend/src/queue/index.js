/**
 * pg-boss queue singleton.
 *
 * One pg-boss instance per process. Both the API process (which enqueues jobs)
 * and the worker process (which consumes them) call getQueue() to obtain it.
 *
 * Storage: pg-boss owns the `pgboss` schema in the same Postgres DB the rest of
 * the app uses (DATABASE_URL). On first call to .start(), pg-boss creates the
 * schema and required tables idempotently — no separate migration step.
 *
 * Lazy init: nothing connects on require(). The first await getQueue() call is
 * where the connection happens — keeps unit tests and CLI tools that import
 * sibling modules from accidentally booting the queue.
 */
const PgBoss = require('pg-boss');
const logger = require('../utils/logger');

// Frozen so a misspelled string in a route blows up at require-time, not at
// runtime when a job vanishes into the wrong queue.
//
// The pipeline is now lossless-only: compression.transcode handles the JPEG
// bit-exact JXL pass, compression.verify handles the browser-uploaded JXL
// PNG sidecar verify, compression.cleanup handles the +7d pending-deletion
// purge. There is no lossy/archive queue — the previous mozjpeg/H.265 paths
// were removed.
const JOB_NAMES = Object.freeze({
  COMPRESSION_TRANSCODE: 'compression.transcode',
  COMPRESSION_VERIFY:    'compression.verify',
  COMPRESSION_CLEANUP:   'compression.cleanup',
});

// Same sslmode rewrite as src/config/db.js — pg-connection-string maps
// sslmode=require to verify-full, which fails against self-signed CNPG certs.
function normalizeDbUrl(raw) {
  return (raw || '')
    .replace('sslmode=require', 'sslmode=no-verify')
    .replace('sslmode=verify-full', 'sslmode=no-verify')
    .replace('sslmode=verify-ca', 'sslmode=no-verify');
}

let bossInstance = null;
let startPromise = null;

/**
 * Returns the singleton pg-boss instance. Starts it on first call.
 * Concurrent callers share a single in-flight start() promise.
 *
 * Note: pg-boss has no public `started` property, so we don't try to track one
 * here. Liveness probes (e.g. routes/queue.js health endpoint) must verify
 * with a real query against the pgboss schema rather than trusting a flag.
 */
async function getQueue() {
  if (bossInstance) return bossInstance;
  if (startPromise) return startPromise;

  const connectionString = normalizeDbUrl(process.env.DATABASE_URL);
  if (!connectionString) {
    throw new Error('[queue] DATABASE_URL is required to start pg-boss');
  }

  const boss = new PgBoss({
    connectionString,
    // Default schema; explicit so an ops audit can see exactly where the queue
    // tables live. Migrations from pg-boss target this schema.
    schema: 'pgboss',
    // Move completed jobs to the archive table after 1 day to keep the active
    // job table small. Failed jobs stay in the active table for inspection.
    archiveCompletedAfterSeconds: 86400,
    // Hard-delete archived jobs after a week — keeps Postgres bloat in check.
    deleteAfterDays: 7,
    // Periodic state snapshot used by getQueueSize() and the monitor events.
    monitorStateIntervalSeconds: 30,
    // SSL pass-through — same posture as the app pool.
    ssl: connectionString.includes('sslmode=no-verify') ? { rejectUnauthorized: false } : false,
  });

  // pg-boss reconnects on its own; just log so we know it happened.
  boss.on('error', (err) => {
    logger.error(`[queue] pg-boss error: ${err.message}`, err);
  });

  startPromise = boss.start()
    .then(() => {
      bossInstance = boss;
      logger.info('[queue] pg-boss started (schema=pgboss)');
      return bossInstance;
    })
    .catch((err) => {
      startPromise = null;
      logger.error(`[queue] pg-boss failed to start: ${err.message}`, err);
      throw err;
    });

  return startPromise;
}

/**
 * Graceful shutdown. Drains in-flight handlers up to the timeout, then closes
 * the underlying pool. Safe to call multiple times.
 */
async function stopQueue() {
  if (!bossInstance) return;
  try {
    await bossInstance.stop({ graceful: true, close: true, timeout: 120000 });
  } finally {
    bossInstance = null;
    startPromise = null;
  }
}

module.exports = { getQueue, stopQueue, JOB_NAMES };
