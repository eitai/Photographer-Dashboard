const express = require('express');
const fs = require('fs');
const pool = require('../db');
const Admin = require('../models/Admin');
const AdminProduct = require('../models/AdminProduct');
const SiteSettings = require('../models/SiteSettings');
const { superprotect } = require('../middleware/auth');
const { uploadImage: upload, validateImageMagicBytes } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const validatePassword = require('../utils/validatePassword');
const formatAdmin = require('../utils/formatAdmin');
const replaceUploadedFile = require('../utils/replaceUploadedFile');

const router = express.Router();
router.use(superprotect);

// GET /api/admins
router.get('/', asyncHandler(async (req, res) => {
  const admins = await Admin.find();
  res.json(admins.map(formatAdmin));
}));

// POST /api/admins
router.post('/', asyncHandler(async (req, res) => {
  const { name, email, password, role, username, studioName, quotaGB } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ message: pwErr });

  const exists = await Admin.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already in use' });

  if (username) {
    const usernameTaken = await Admin.findOne({ username: username.toLowerCase() });
    if (usernameTaken) return res.status(400).json({ message: 'Username already taken' });
  }

  const admin = await Admin.create({
    name,
    email,
    password,
    role: role || 'admin',
    username: username || undefined,
    studioName: studioName || undefined,
    quotaGB: quotaGB || undefined,
  });

  // Seed default product catalog for the new admin
  await AdminProduct.seedDefaults(admin.id);

  res.status(201).json({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    username: admin.username || null,
    studioName: admin.studioName || null,
    createdAt: admin.createdAt,
  });
}));

// DELETE /api/admins/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.params.id === req.admin.id)
    return res.status(400).json({ message: 'Cannot delete your own account' });
  await Admin.findByIdAndDelete(req.params.id);
  res.json({ message: 'Admin deleted' });
}));

// GET /api/admins/:id/settings
router.get('/:id/settings', asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ adminId: req.params.id });
  res.json({
    bio: settings?.bio || '',
    heroImagePath: settings?.heroImagePath || '',
    profileImagePath: settings?.profileImagePath || '',
    phone: settings?.phone || '',
    instagramHandle: settings?.instagramHandle || '',
    facebookUrl: settings?.facebookUrl || '',
    heroSubtitle: settings?.heroSubtitle || '',
    contactEmail: settings?.contactEmail || '',
  });
}));

// PATCH /api/admins/:id
router.patch('/:id', asyncHandler(async (req, res) => {
  // Destructure only the fields this endpoint is allowed to update.
  // Password changes must go through PUT /api/auth/password — never handle them here
  // so there is no risk of a partial update leaving the DB in an inconsistent state
  // (profile updated but password not changed, or vice-versa).
  const { name, email, studioName, username } = req.body;

  if (username) {
    const conflict = await Admin.findOne({ username: username.toLowerCase() });
    if (conflict && conflict.id !== req.params.id)
      return res.status(400).json({ message: 'Username already taken' });
  }

  const update = {};
  if (name !== undefined) update.name = name;
  if (email !== undefined) update.email = email;
  if (studioName !== undefined) update.studioName = studioName || null;
  if (username !== undefined) update.username = username ? username.toLowerCase() : null;

  const updated = await Admin.findByIdAndUpdate(req.params.id, update);
  if (!updated) return res.status(404).json({ message: 'Admin not found' });

  // Apply the same field projection used in auth.js to avoid leaking
  // pushToken, createdAt, updatedAt, and any future internal columns.
  res.json(formatAdmin(updated));
}));

// PUT /api/admins/:id/landing
router.put('/:id/landing', asyncHandler(async (req, res) => {
  const { bio, heroSubtitle, phone, contactEmail, instagramHandle, facebookUrl } = req.body;

  const data = {};
  if (bio !== undefined) data.bio = bio;
  if (heroSubtitle !== undefined) data.heroSubtitle = heroSubtitle;
  if (phone !== undefined) data.phone = phone;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (instagramHandle !== undefined) data.instagramHandle = instagramHandle;
  if (facebookUrl !== undefined) data.facebookUrl = facebookUrl;

  const settings = await SiteSettings.upsert(req.params.id, data);
  res.json({ message: 'Landing page updated', settings });
}));

// POST /api/admins/:id/hero-image
router.post('/:id/hero-image', upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  const heroImagePath = await replaceUploadedFile(req.params.id, 'heroImagePath', `/uploads/${req.file.filename}`, { SiteSettings, fs });
  res.json({ heroImagePath });
}));

// POST /api/admins/:id/profile-image
router.post('/:id/profile-image', upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  const profileImagePath = await replaceUploadedFile(req.params.id, 'profileImagePath', `/uploads/${req.file.filename}`, { SiteSettings, fs });
  res.json({ profileImagePath });
}));

// GET /api/admins/:id/storage — superadmin only
router.get('/:id/storage', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(gi.size), 0)::bigint
       + COALESCE((
           SELECT SUM((v->>'size')::bigint)
           FROM galleries g2, jsonb_array_elements(g2.videos) v
           WHERE g2.admin_id = $1 AND (v->>'size') IS NOT NULL
         ), 0)::bigint AS used,
       a.storage_quota_bytes AS quota
     FROM admins a
     LEFT JOIN galleries g  ON g.admin_id = a.id
     LEFT JOIN gallery_images gi ON gi.gallery_id = g.id
     WHERE a.id = $1
     GROUP BY a.storage_quota_bytes`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Admin not found' });

  const used  = Number(rows[0].used);
  const quota = Number(rows[0].quota);
  res.json({
    adminId:     req.params.id,
    usedBytes:   used,
    quotaBytes:  quota,
    usedGB:      parseFloat((used  / 1024 ** 3).toFixed(2)),
    quotaGB:     parseFloat((quota / 1024 ** 3).toFixed(2)),
    percentUsed: quota > 0 ? parseFloat(((used / quota) * 100).toFixed(1)) : 0,
  });
}));

// PATCH /api/admins/:id/quota — superadmin only
// quotaGB: number = specific GB limit; 0 or null = unlimited
router.patch('/:id/quota', asyncHandler(async (req, res) => {
  const raw = req.body.quotaGB;
  const unlimited = raw === null || raw === 0 || raw === '0';
  const quotaGB = unlimited ? null : parseFloat(raw);
  if (!unlimited && (!isFinite(quotaGB) || quotaGB < 0.1 || quotaGB > 10000)) {
    return res.status(400).json({ message: 'quotaGB must be between 0.1 and 10000, or null for unlimited' });
  }
  const quotaBytes = unlimited ? null : Math.round(quotaGB * 1024 ** 3);
  const { rows } = await pool.query(
    `UPDATE admins SET storage_quota_bytes = $1, updated_at = NOW()
     WHERE id = $2 RETURNING id, storage_quota_bytes`,
    [quotaBytes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Admin not found' });
  res.json({
    adminId:    rows[0].id,
    quotaBytes: rows[0].storage_quota_bytes ? Number(rows[0].storage_quota_bytes) : null,
    quotaGB,
    unlimited,
  });
}));

module.exports = router;
