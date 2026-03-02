const express = require('express');
const ContactSubmission = require('../models/ContactSubmission');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/contact  — PUBLIC
router.post('/', async (req, res) => {
  const submission = await ContactSubmission.create(req.body);
  res.status(201).json({ message: 'Message received', id: submission._id });
});

// GET /api/contact  — ADMIN
router.get('/', protect, async (req, res) => {
  const submissions = await ContactSubmission.find().sort({ createdAt: -1 });
  res.json(submissions);
});

module.exports = router;
