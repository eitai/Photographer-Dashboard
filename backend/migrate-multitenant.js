/**
 * Migration: assign existing content to the first admin and set a username.
 * Run once: node migrate-multitenant.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');

const Admin = require('./src/models/Admin');
const Client = require('./src/models/Client');
const Gallery = require('./src/models/Gallery');
const BlogPost = require('./src/models/BlogPost');
const SiteSettings = require('./src/models/SiteSettings');
const ContactSubmission = require('./src/models/ContactSubmission');

async function migrate() {
  await connectDB();

  // Pick the first non-superadmin admin (or just the first admin)
  const admin = await Admin.findOne({ role: { $ne: 'superadmin' } }) || await Admin.findOne();
  if (!admin) {
    console.log('No admin found. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`Migrating to admin: ${admin.name} (${admin.email}) [${admin._id}]`);

  // Set a username if not set
  if (!admin.username) {
    const base = admin.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    admin.username = base || 'photographer';
    await Admin.updateOne({ _id: admin._id }, { username: admin.username, studioName: admin.studioName || admin.name });
    console.log(`Set username: ${admin.username}`);
  } else {
    console.log(`Username already set: ${admin.username}`);
  }

  const adminId = admin._id;

  // Update all content without adminId
  const [c, g, b, s, cs] = await Promise.all([
    Client.updateMany({ adminId: { $exists: false } }, { $set: { adminId } }),
    Gallery.updateMany({ adminId: { $exists: false } }, { $set: { adminId } }),
    BlogPost.updateMany({ adminId: { $exists: false } }, { $set: { adminId } }),
    SiteSettings.updateMany({ adminId: { $exists: false } }, { $set: { adminId } }),
    ContactSubmission.updateMany({ adminId: { $exists: false } }, { $set: { adminId } }),
  ]);

  console.log(`Clients updated: ${c.modifiedCount}`);
  console.log(`Galleries updated: ${g.modifiedCount}`);
  console.log(`Blog posts updated: ${b.modifiedCount}`);
  console.log(`Site settings updated: ${s.modifiedCount}`);
  console.log(`Contact submissions updated: ${cs.modifiedCount}`);
  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
