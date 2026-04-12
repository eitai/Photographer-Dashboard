const express = require('express');
const fs = require('fs');
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
  const { name, email, password, role, username, studioName } = req.body;
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

module.exports = router;
