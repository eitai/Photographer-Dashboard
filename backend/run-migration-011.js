/**
 * One-shot migration: adds store_order_id to product_orders so the old
 * ProductOrder system can reference a StoreOrder after "Send to Supplier".
 *
 * Run once from the backend directory:
 *   node run-migration-011.js
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
    path.join(__dirname, 'src/db/migrations/011_product_order_store_link.sql'),
    'utf8'
  );
  await pool.query(sql);
  console.log('Migration 011 applied successfully.');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
