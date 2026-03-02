const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password required' });

  const admin = await Admin.findOne({ email });
  if (!admin || !(await admin.comparePassword(password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  const token = signToken(admin._id);
  res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email } });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ admin: req.admin });
});

// POST /api/auth/seed  — create first admin (disable in production)
router.post('/seed', async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await Admin.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Admin already exists' });
  const admin = await Admin.create({ name, email, password });
  res.status(201).json({ message: 'Admin created', id: admin._id });
});

module.exports = router;
