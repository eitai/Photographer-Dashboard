/**
 * Operator visibility into the pg-boss queue.
 *
 * GET /api/admin/queue/health
 *   Returns per-queue counts (queued, active, completed_24h, failed_24h, retry)
 *   plus a top-level boss state. Cheap enough to be polled by an uptime monitor.
 *
 * Implementation note: pg-boss exposes getQueueSize() but not a per-state
 * breakdown that includes the archive table. We use raw SQL against
 * `pgboss.job` (live) + `pgboss.archive` (completed/failed older than
 * archiveCompletedAfterSeconds) for a complete picture, scoped to a 24h window
 * for the *_24h fields. This sidesteps pg-boss API churn between minor versions.
 */
const express = require('express');

const pool = require('../db');
const { superprotect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { getQueue, JOB_NAMES } = require('../queue');

const router = express.Router();

const TRACKED_QUEUES = [
  JOB_NAMES.COMPRESSION_TRANSCODE,
  JOB_NAMES.COMPRESSION_VERIFY,
  JOB_NAMES.COMPRESSION_CLEANUP,
];

function emptyCounts() {
  return { queued: 0, active: 0, retry: 0, completed_24h: 0, failed_24h: 0 };
}

// GET /api/admin/queue/health
router.get('/health', superprotect, asyncHandler(async (req, res) => {
  // Initialize a baseline so every tracked queue is always represented in the
  // response — even if it has zero rows in pgboss.job.
  const queues = {};
  for (const name of TRACKED_QUEUES) queues[name] = emptyCounts();

  let bossStarted = false;
  let bossError = null;
  try {
    // Make sure the singleton has been bootstrapped at least once in this
    // process. The real liveness check is the SQL probe below — pg-boss has
    // no public `started` flag we can trust.
    await getQueue();
    try {
      await pool.query('SELECT 1 FROM pgboss.version LIMIT 1');
      bossStarted = true;
    } catch (probeErr) {
      if (probeErr.code === '42P01' /* undefined_table */) {
        // Schema not yet created — boss hasn't successfully started against
        // this database. Treat as not-started rather than error.
        bossStarted = false;
      } else {
        bossError = probeErr.message;
        logger.warn(`[queue/health] pgboss probe failed: ${probeErr.message}`);
      }
    }
  } catch (err) {
    // We can still return SQL counts even if pg-boss can't start in this
    // process (e.g. transient connection issue) — surface the error.
    bossError = err.message;
    logger.warn(`[queue/health] getQueue failed: ${err.message}`);
  }

  // Live (active + waiting + retry) counts from pgboss.job.
  // States in pg-boss 9.x: created, retry, active, completed, expired, cancelled, failed.
  try {
    const live = await pool.query(
      `SELECT name, state, COUNT(*)::int AS n
         FROM pgboss.job
        WHERE name = ANY($1::text[])
        GROUP BY name, state`,
      [TRACKED_QUEUES]
    );
    for (const row of live.rows) {
      const bucket = queues[row.name];
      if (!bucket) continue;
      switch (row.state) {
        case 'created':  bucket.queued = row.n; break;
        case 'retry':    bucket.retry  = row.n; break;
        case 'active':   bucket.active = row.n; break;
        case 'failed':   bucket.failed_24h += row.n; break;
        case 'completed':bucket.completed_24h += row.n; break;
        // expired / cancelled are not surfaced; failed handles user-visible bad state.
        default: break;
      }
    }
  } catch (err) {
    // Schema may not exist yet (worker has never started) — that's a 200 with
    // zeros, not a 500. Log and continue.
    if (err.code === '42P01' /* undefined_table */) {
      logger.info('[queue/health] pgboss.job not yet created — returning zeros');
    } else {
      logger.error(`[queue/health] live counts query failed: ${err.message}`, err);
    }
  }

  // Completed/failed in the last 24h from the archive table. pg-boss moves
  // rows here via archiveCompletedAfterSeconds; we union both for a stable
  // window regardless of archive timing.
  try {
    const archived = await pool.query(
      `SELECT name, state, COUNT(*)::int AS n
         FROM pgboss.archive
        WHERE name = ANY($1::text[])
          AND state IN ('completed', 'failed')
          AND completedon >= NOW() - INTERVAL '24 hours'
        GROUP BY name, state`,
      [TRACKED_QUEUES]
    );
    for (const row of archived.rows) {
      const bucket = queues[row.name];
      if (!bucket) continue;
      if (row.state === 'completed') bucket.completed_24h += row.n;
      if (row.state === 'failed')    bucket.failed_24h    += row.n;
    }
  } catch (err) {
    if (err.code === '42P01') {
      // archive not yet created — fine.
    } else {
      logger.error(`[queue/health] archive counts query failed: ${err.message}`, err);
    }
  }

  res.json({
    queues,
    boss: {
      started: bossStarted,
      state:   bossStarted ? 'running' : (bossError ? 'error' : 'stopped'),
      ...(bossError ? { error: bossError } : {}),
    },
  });
}));

module.exports = router;
