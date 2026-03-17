const express = require('express');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(protect);

const UUID_RE = /^[0-9a-f-]{36}$/i;

// GET /api/clients
router.get('/', asyncHandler(async (req, res) => {
  const clients = await Client.find({ adminId: req.admin.id });
  res.json(clients);
}));

// POST /api/clients
router.post('/', asyncHandler(async (req, res) => {
  const { name, phone, email, sessionType, notes, status } = req.body;
  const client = await Client.create({
    name, phone, email, sessionType, notes, status,
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
  const { name, phone, email, sessionType, notes, status } = req.body;
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, adminId: req.admin.id },
    { name, phone, email, sessionType, notes, status }
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
