const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

const formatAdmin = (a) => ({ id: a._id, name: a.name, email: a.email, role: a.role, username: a.username || null, studioName: a.studioName || null });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password required' });

  const admin = await Admin.findOne({ email });
  if (!admin || !(await admin.comparePassword(password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken(admin._id);
  res.json({ token, admin: formatAdmin(admin) });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ admin: req.admin });
});

// PUT /api/auth/password
router.put('/password', protect, async (req, res) => {
  const { current, next } = req.body;
  const admin = await Admin.findById(req.admin._id);
  if (!(await admin.comparePassword(current)))
    return res.status(400).json({ message: 'Current password is incorrect' });
  admin.password = next;
  await admin.save();
  res.json({ message: 'Password updated' });
});

// POST /api/auth/push-token  — save Expo push token for the authenticated admin
router.post('/push-token', protect, async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'token is required and must be a string' });
  }

  await Admin.findByIdAndUpdate(req.admin._id, { pushToken: token });
  res.json({ message: 'Push token saved' });
});

// PATCH /api/auth/profile  — update own profile (name, studioName, username)
router.patch('/profile', protect, async (req, res) => {
  const { name, studioName, username } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (studioName !== undefined) update.studioName = studioName;
  if (username !== undefined) update.username = username.toLowerCase().trim();

  if (update.username) {
    const conflict = await Admin.findOne({ username: update.username, _id: { $ne: req.admin._id } });
    if (conflict) return res.status(409).json({ message: 'Username already taken' });
  }

  try {
    const updated = await Admin.findByIdAndUpdate(req.admin._id, update, { new: true, runValidators: true }).select('-password');
    res.json({ admin: formatAdmin(updated) });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    throw err;
  }
});

// POST /api/auth/seed  — creates first admin as superadmin (only works when no admins exist)
router.post('/seed', async (req, res) => {
  const { name, email, password } = req.body;
  const count = await Admin.countDocuments();
  if (count > 0) return res.status(400).json({ message: 'Admins already exist. Use superadmin panel to add more.' });
  const admin = await Admin.create({ name, email, password, role: 'superadmin' });
  res.status(201).json({ message: 'Superadmin created', id: admin._id });
});

module.exports = router;
