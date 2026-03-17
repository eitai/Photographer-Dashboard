const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// pg-connection-string treats sslmode=require as verify-full and overrides ssl options.
// Replace it with no-verify so the driver enables SSL without strict cert checking
// (CNPG uses self-signed certs in cluster).
const _dbUrl = (process.env.DATABASE_URL || '')
  .replace('sslmode=require', 'sslmode=no-verify')
  .replace('sslmode=verify-full', 'sslmode=no-verify')
  .replace('sslmode=verify-ca', 'sslmode=no-verify');

const pool = new Pool({
  connectionString: _dbUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: _dbUrl.includes('sslmode=no-verify') ? { rejectUnauthorized: false } : false,
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    logger.info('PostgreSQL connected');
    client.release();
    // Run schema migrations (idempotent — all statements use IF NOT EXISTS)
    const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
    await pool.query(sql);
    logger.info('Schema applied');
  } catch (err) {
    logger.error(`PostgreSQL connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };
