const express = require('express');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/clients
router.get('/', async (req, res) => {
  const clients = await Client.find({ adminId: req.admin._id }).sort({ createdAt: -1 });
  res.json(clients);
});

// POST /api/clients
router.post('/', async (req, res) => {
  const client = await Client.create({ ...req.body, adminId: req.admin._id });
  res.status(201).json(client);
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, adminId: req.admin._id });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch {
    res.status(400).json({ message: 'Invalid client ID' });
  }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const client = await Client.findOneAndUpdate({ _id: req.params.id, adminId: req.admin._id }, req.body, { new: true, runValidators: true });
  if (!client) return res.status(404).json({ message: 'Client not found' });
  res.json(client);
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  await Client.findOneAndDelete({ _id: req.params.id, adminId: req.admin._id });
  res.json({ message: 'Client deleted' });
});

module.exports = router;
