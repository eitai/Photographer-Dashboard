require('dotenv').config();

// ── Startup validation ────────────────────────────────────────────────────────
const { validateEnv } = require('./src/config/validateEnv');
const { ok, missing } = validateEnv();
if (!ok) {
  console.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
  console.error('[startup] Copy .env.example to .env and fill in all values.');
  process.exit(1);
}

const { connectDB, pool } = require('./src/config/db');
const logger = require('./src/utils/logger');
const app = require('./src/app');

async function start() {
  await connectDB();

  // ── Auto-migrations (run before accepting requests) ───────────────────────
  try {
    await pool.query(`
      ALTER TABLE admins
        ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 10737418240
    `);
    await pool.query(`
      ALTER TABLE admins
        ALTER COLUMN storage_quota_bytes DROP NOT NULL
    `);
    logger.info('[migrate] storage_quota_bytes column ensured');
  } catch (err) {
    logger.warn('[migrate] storage_quota_bytes migration skipped:', err.message);
  }

  try {
    const migrationSql = require('fs').readFileSync(
      require('path').join(__dirname, 'src/db/migrate_landing_sections.sql'),
      'utf8'
    );
    await pool.query(migrationSql);
    logger.info('[migrate] landing sections columns ensured');
  } catch (err) {
    logger.warn('[migrate] landing sections migration skipped:', err.message);
  }

  try {
    await pool.query(`
      ALTER TABLE site_settings
        ADD COLUMN IF NOT EXISTS logo_image_path TEXT NOT NULL DEFAULT ''
    `);
    logger.info('[migrate] logo_image_path column ensured');
  } catch (err) {
    logger.warn('[migrate] logo_image_path migration skipped:', err.message);
  }

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    logger.info(`Koral API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  server.setTimeout(30000);

  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      logger.info('HTTP server closed');
      await pool.end();
      logger.info('Database disconnected');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
}

// ── Process handlers ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
