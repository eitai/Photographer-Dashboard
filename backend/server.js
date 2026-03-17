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

connectDB();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Koral API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

server.setTimeout(30000);

// ── Process handlers ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

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
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
