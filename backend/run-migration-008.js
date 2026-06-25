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
  const files = [
    '004_storage_quota.sql',
    '005_plans_subscriptions.sql',
    '005_preview_path.sql',
    '006_payplus.sql',
    '006_stats_promises_faq.sql',
    '007_assets.sql',
    '008_store_supplier.sql',
    '009_cancel_grace.sql',
    '010_sso_first_login.sql',
  ];
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, 'src/db/migrations', file), 'utf8');
    await pool.query(sql);
    console.log(`✓ ${file}`);
  }
  await pool.end();
}

run().catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
