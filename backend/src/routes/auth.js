const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const validatePassword = require('../utils/validatePassword');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const formatAdmin = (a) => ({ id: a._id, name: a.name, email: a.email, role: a.role, username: a.username || null, studioName: a.studioName || null });

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /api/auth/login
// Accepts { email, password } or { username, password } — identifier checked against both fields
router.post('/login', asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  if (!identifier || !password)
    return res.status(400).json({ message: 'Credentials required' });

  // Reject non-string values — prevents NoSQL injection via { "$gt": "" } objects
  if (typeof identifier !== 'string' || typeof password !== 'string')
    return res.status(400).json({ message: 'Credentials must be strings' });

  const admin = await Admin.findOne({ $or: [{ email: identifier }, { username: identifier }] });
  if (!admin || !(await admin.comparePassword(password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken(admin._id);
  res.cookie('koral_token', token, COOKIE_OPTIONS);
  res.json({ admin: formatAdmin(admin) });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('koral_token', COOKIE_OPTIONS);
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
  const admin = await Admin.findById(req.admin._id);
  if (!(await admin.comparePassword(current)))
    return res.status(400).json({ message: 'Current password is incorrect' });
  admin.password = next;
  await admin.save();
  res.json({ message: 'Password updated' });
}));

// POST /api/auth/push-token
router.post('/push-token', protect, asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'token is required and must be a string' });
  }
  await Admin.findByIdAndUpdate(req.admin._id, { pushToken: token });
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
    const conflict = await Admin.findOne({ username: update.username, _id: { $ne: req.admin._id } });
    if (conflict) return res.status(409).json({ message: 'Username already taken' });
  }

  const updated = await Admin.findByIdAndUpdate(req.admin._id, update, { new: true, runValidators: true }).select('-password');
  res.json({ admin: formatAdmin(updated) });
}));

// POST /api/auth/seed  — creates first superadmin (only when no admins exist)
router.post('/seed', asyncHandler(async (req, res) => {
  const { name, email, username, password } = req.body;
  const count = await Admin.countDocuments();
  if (count > 0) return res.status(400).json({ message: 'Admins already exist. Use superadmin panel to add more.' });
  const admin = await Admin.create({ name, email, username, password, role: 'superadmin' });
  res.status(201).json({ message: 'Superadmin created', id: admin._id });
}));

module.exports = router;
