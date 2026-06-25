/**
 * One-shot migration: adds google_id, google_email, sso_enabled, first_login
 * to the admins table so Google SSO works.
 *
 * Run once from the backend directory:
 *   node run-migration-010.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const _dbUrl = (process.env.DATABASE_URL || '')
  .replace('sslmode=require', 'sslmode=no-verify')
  .replace('sslmode=verify-full', 'sslmode=no-verify')
  .replace('sslmode=verify-ca', 'sslmode=no-verify');

const pool = new Pool({
  connectionString: _dbUrl,
  ssl: _dbUrl.includes('sslmode=no-verify') ? { rejectUnauthorized: false } : false,
});

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'src/db/migrations/010_sso_first_login.sql'),
    'utf8'
  );
  await pool.query(sql);
  console.log('Migration 010 applied successfully.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
