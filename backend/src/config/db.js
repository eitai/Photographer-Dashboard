const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
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
