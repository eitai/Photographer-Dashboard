const express = require('express');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');

const router = express.Router();
router.use(protect);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (email && !EMAIL_RE.test(email)) return 'Invalid email address';
  return null;
}

// GET /api/clients
router.get('/', asyncHandler(async (req, res) => {
  const clients = await Client.find({ adminId: req.admin.id });
  res.json(clients);
}));

// POST /api/clients
router.post('/', asyncHandler(async (req, res) => {
  const { name, phone, email, sessionType, notes, status, eventDate } = req.body;
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ message: emailErr });
  const client = await Client.create({
    name, phone, email, sessionType, notes, status, eventDate,
    adminId: req.admin.id,
  });
  res.status(201).json(client);
}));

// GET /api/clients/:id
router.get('/:id', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const client = await Client.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!client) return res.status(404).json({ message: 'Client not found' });
  res.json(client);
}));

// PUT /api/clients/:id
router.put('/:id', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const { name, phone, email, sessionType, notes, status, eventDate } = req.body;
  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ message: emailErr });
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, adminId: req.admin.id },
    { name, phone, email, sessionType, notes, status, eventDate }
  );
  if (!client) return res.status(404).json({ message: 'Client not found' });
  res.json(client);
}));

// DELETE /api/clients/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const client = await Client.findOneAndDelete({ _id: req.params.id, adminId: req.admin.id });
  if (!client) return res.status(404).json({ message: 'Client not found' });
  res.json({ message: 'Client deleted' });
}));

module.exports = router;
