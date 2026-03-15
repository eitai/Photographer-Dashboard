const express = require('express');
const ContactSubmission = require('../models/ContactSubmission');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// POST /api/contact  — PUBLIC
router.post('/', asyncHandler(async (req, res) => {
  // Whitelist fields — never allow caller to set adminId
  const { name, phone, email, sessionType, message } = req.body;
  const submission = await ContactSubmission.create({ name, phone, email, sessionType, message });
  res.status(201).json({ message: 'Message received', id: submission._id });
}));

// GET /api/contact  — ADMIN
router.get('/', protect, asyncHandler(async (req, res) => {
  const submissions = await ContactSubmission.find({ adminId: req.admin._id }).sort({ createdAt: -1 });
  res.json(submissions);
}));

// DELETE /api/contact/:id  — ADMIN
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const submission = await ContactSubmission.findOneAndDelete({
    _id: req.params.id,
    adminId: req.admin._id,
  });
  if (!submission) return res.status(404).json({ message: 'Submission not found' });
  res.json({ message: 'Submission deleted' });
}));

module.exports = router;
