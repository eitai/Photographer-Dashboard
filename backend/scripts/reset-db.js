/**
 * reset-db.js  —  Clears all data except the Admin collection.
 * Also deletes all files inside uploads/ (keeps the folder itself).
 * Run once: node scripts/reset-db.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/koral-photography';
const UPLOADS_DIR = path.join(__dirname, '../uploads');

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  for (const col of collections) {
    if (col.name === 'admins') {
      console.log(`  SKIPPED: ${col.name}`);
      continue;
    }
    await db.collection(col.name).deleteMany({});
    console.log(`  CLEARED: ${col.name}`);
  }

  // Delete all files in uploads/
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    let deleted = 0;
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }
    console.log(`  DELETED: ${deleted} file(s) from uploads/`);
  } else {
    console.log('  uploads/ directory not found, skipping.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
