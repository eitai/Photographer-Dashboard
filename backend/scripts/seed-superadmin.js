/**
 * Creates the first superadmin.
 * Usage: node scripts/seed-superadmin.js
 * Requires DATABASE_URL to be set in backend/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in backend/.env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });

async function seed() {
  const client = await pool.connect();
  try {
    // Apply schema first (idempotent)
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    // Check if superadmin already exists
    const { rows } = await client.query(
      "SELECT id FROM admins WHERE email = $1 LIMIT 1",
      ['eitaimeir@gmail.com']
    );
    if (rows.length > 0) {
      console.log('Superadmin already exists:', rows[0].id);
      return;
    }

    const hash = await bcrypt.hash('123123', 12);
    const { rows: created } = await client.query(
      `INSERT INTO admins (name, email, password, role, username)
       VALUES ($1, $2, $3, 'superadmin', $4) RETURNING id, email, role`,
      ['Eitai Meir', 'eitaimeir@gmail.com', hash, 'eitai']
    );
    console.log('Superadmin created successfully:');
    console.log('  ID:    ', created[0].id);
    console.log('  Email: ', created[0].email);
    console.log('  Role:  ', created[0].role);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
