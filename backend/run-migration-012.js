// One-off runner: applies migration 012 (admin_supplier_favorites)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'src/db/migrations/012_admin_supplier_favorites.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration 012 applied');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
