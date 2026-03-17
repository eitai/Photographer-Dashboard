const express = require('express');
const ContactSubmission = require('../models/ContactSubmission');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const validateContact = require('../utils/validateContact');

const router = express.Router();

const UUID_RE = /^[0-9a-f-]{36}$/i;

// POST /api/contact  — PUBLIC
router.post('/', asyncHandler(async (req, res) => {
  const { name, phone, email, sessionType, message } = req.body;
  const err = validateContact({ name, phone, email, sessionType, message });
  if (err) return res.status(400).json({ message: err });

  const submission = await ContactSubmission.create({ name, phone, email, sessionType, message });
  res.status(201).json({ message: 'Message received', id: submission.id });
}));

// GET /api/contact  — ADMIN
router.get('/', protect, asyncHandler(async (req, res) => {
  const submissions = await ContactSubmission.find({ adminId: req.admin.id });
  res.json(submissions);
}));

// DELETE /api/contact/:id  — ADMIN
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const submission = await ContactSubmission.findOneAndDelete({
    _id: req.params.id,
    adminId: req.admin.id,
  });
  if (!submission) return res.status(404).json({ message: 'Submission not found' });
  res.json({ message: 'Submission deleted' });
}));

module.exports = router;
