const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const Admin = require('../models/Admin');
const { getStorageUsedBytes } = require('../utils/storageUsage');
const AdminProduct = require('../models/AdminProduct');
const SiteSettings = require('../models/SiteSettings');
const Subscription = require('../models/Subscription');
const { superprotect } = require('../middleware/auth');
const { uploadImage: upload, validateImageMagicBytes } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const validatePassword = require('../utils/validatePassword');
const formatAdmin = require('../utils/formatAdmin');
const replaceUploadedFile = require('../utils/replaceUploadedFile');
const s3 = require('../config/s3');

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

  if (role !== undefined && !['admin', 'superadmin'].includes(role))
    return res.status(400).json({ message: 'role must be admin or superadmin' });

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ message: pwErr });

  const exists = await Admin.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already in use' });

  if (username) {
    const usernameTaken = await Admin.findOne({ username: username.toLowerCase() });
    if (usernameTaken) return res.status(400).json({ message: 'Username already taken' });
  }

  if (quotaGB !== undefined && quotaGB !== null && quotaGB !== 0) {
    const gb = parseFloat(quotaGB);
    if (!isFinite(gb) || gb < 0.1 || gb > 10000)
      return res.status(400).json({ message: 'quotaGB must be between 0.1 and 10000, or null for unlimited' });
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

  // Seed default product catalog and assign free plan
  await AdminProduct.seedDefaults(admin.id);
  await Subscription.assignFreePlan(admin.id);

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
  const { name, email, studioName, username, canOrderSupplier, clientsCanOrder } = req.body;

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
  if (canOrderSupplier !== undefined) update.canOrderSupplier = !!canOrderSupplier;
  if (clientsCanOrder !== undefined) update.clientsCanOrder = !!clientsCanOrder;

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
  const heroImagePath = await replaceUploadedFile(req.params.id, 'heroImagePath', await s3.processUpload(req.file, req.params.id), { SiteSettings, fs });
  res.json({ heroImagePath });
}));

// POST /api/admins/:id/profile-image
router.post('/:id/profile-image', upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  const profileImagePath = await replaceUploadedFile(req.params.id, 'profileImagePath', await s3.processUpload(req.file, req.params.id), { SiteSettings, fs });
  res.json({ profileImagePath });
}));

// GET /api/admins/:id/storage — superadmin only
router.get('/:id/storage', asyncHandler(async (req, res) => {
  // Resolve quota from the subscription system (plan-driven), not the legacy column
  const sub = await Subscription.findByAdminId(req.params.id);
  // No subscription row: admin pre-dates the migration and was not back-filled.
  // The back-fill in 005_plans_subscriptions.sql should prevent this in practice.
  if (!sub) return res.status(404).json({ message: 'No subscription found for this admin' });

  const quota = Subscription.resolveQuotaBytes(sub);
  const used = await getStorageUsedBytes(req.params.id);

  res.json({
    adminId:     req.params.id,
    usedBytes:   used,
    quotaBytes:  quota,
    usedGB:      parseFloat((used / 1024 ** 3).toFixed(2)),
    quotaGB:     quota ? parseFloat((quota / 1024 ** 3).toFixed(2)) : null,
    percentUsed: quota ? parseFloat(((used / quota) * 100).toFixed(1)) : 0,
    planSlug:    sub.planSlug,
    planName:    sub.planName,
  });
}));

// NOTE: PATCH /api/admins/:id/quota was removed — quota is now entirely driven by the
// subscription system. Use PATCH /api/plans/admin/subscriptions/:adminId instead.

// ── SSO helpers (mirrors auth.js) ────────────────────────────────────────────
const _frontendUrl = () => {
  const url = process.env.FRONTEND_URL;
  if (!url) return 'http://localhost:8080';
  return url.split(',')[0].trim().replace(/\/$/, '');
};

const _googleCallbackUrl = () => {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  const base = _frontendUrl();
  if (!base.includes('localhost')) return `${base}/api/auth/google/callback`;
  return 'http://localhost:5000/api/auth/google/callback';
};

const _encodeState = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });

// GET /api/admins/:id/sso-link — initiate Google OAuth link for a specific admin
router.get('/:id/sso-link', asyncHandler(async (req, res) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  if (!clientID) {
    return res.redirect(`${_frontendUrl()}/admin/users?sso=error&reason=not_configured`);
  }
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: _googleCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: _encodeState({ flow: 'link', adminId: req.params.id, returnTo: '/admin/users' }),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}));

// DELETE /api/admins/:id/sso-link — unlink Google from a specific admin
router.delete('/:id/sso-link', asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });
  await Admin.findByIdAndUpdate(req.params.id, { googleId: null, googleEmail: null, ssoEnabled: false });
  res.json({ message: 'Google account unlinked' });
}));

// PATCH /api/admins/:id/sso — toggle ssoEnabled for a specific admin
router.patch('/:id/sso', asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });
  if (!admin.googleId) {
    return res.status(400).json({ message: 'No Google account linked. Link a Google account first.' });
  }
  const updated = await Admin.findByIdAndUpdate(req.params.id, { ssoEnabled: !admin.ssoEnabled });
  res.json({ admin: formatAdmin(updated) });
}));

module.exports = router;
