const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const validatePassword = require('../utils/validatePassword');
const formatAdmin = require('../utils/formatAdmin');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// secure=true whenever the request arrives over HTTPS (x-forwarded-proto set by proxy/CDN)
// or when NODE_ENV is explicitly production — whichever is true first.
const isSecure = (req) =>
  process.env.NODE_ENV === 'production' ||
  req?.headers?.['x-forwarded-proto'] === 'https';

const cookieOptions = (req) => ({
  httpOnly: true,
  secure: isSecure(req),
  sameSite: isSecure(req) ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// POST /api/auth/login
// Accepts { email, password } or { username, password } — identifier checked against both fields
router.post('/login', asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  if (!identifier || !password)
    return res.status(400).json({ message: 'Credentials required' });

  // Reject non-string values — prevents injection via { "$gt": "" } objects
  if (typeof identifier !== 'string' || typeof password !== 'string')
    return res.status(400).json({ message: 'Credentials must be strings' });

  const admin = await Admin.findOne({ $or: [{ email: identifier }, { username: identifier }] });
  if (!admin || !(await Admin.comparePassword(admin, password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken(admin.id);
  res.cookie('koral_token', token, cookieOptions(req));
  res.json({ admin: formatAdmin(admin) });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('koral_token', cookieOptions(req));
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ admin: req.admin });
});

// PUT /api/auth/password
router.put('/password', protect, asyncHandler(async (req, res) => {
  const { current, next } = req.body;
  const pwErr = validatePassword(next);
  if (pwErr) return res.status(400).json({ message: pwErr });

  // Re-fetch to get password hash
  const admin = await Admin.findById(req.admin.id);
  if (!(await Admin.comparePassword(admin, current)))
    return res.status(400).json({ message: 'Current password is incorrect' });

  await Admin.updatePassword(req.admin.id, next);
  res.json({ message: 'Password updated' });
}));

// POST /api/auth/push-token
router.post('/push-token', protect, asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'token is required and must be a string' });
  }
  await Admin.findByIdAndUpdate(req.admin.id, { pushToken: token });
  res.json({ message: 'Push token saved' });
}));

// PATCH /api/auth/profile
router.patch('/profile', protect, asyncHandler(async (req, res) => {
  const { name, studioName, username } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (studioName !== undefined) update.studioName = studioName;
  if (username !== undefined) update.username = username.toLowerCase().trim();

  if (update.username) {
    // Check for conflict with another admin
    const conflict = await Admin.findOne({ username: update.username });
    if (conflict && conflict.id !== req.admin.id)
      return res.status(409).json({ message: 'Username already taken' });
  }

  const updated = await Admin.findByIdAndUpdate(req.admin.id, update);
  res.json({ admin: formatAdmin(updated) });
}));

// POST /api/auth/seed  — creates first superadmin (only when no admins exist)
router.post('/seed', asyncHandler(async (req, res) => {
  const { name, email, username, password } = req.body;
  const count = await Admin.countDocuments();
  if (count > 0)
    return res.status(400).json({ message: 'Admins already exist. Use superadmin panel to add more.' });
  const admin = await Admin.create({ name, email, username, password, role: 'superadmin' });
  res.status(201).json({ message: 'Superadmin created', id: admin.id });
}));

module.exports = router;
