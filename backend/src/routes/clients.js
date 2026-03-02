const express = require('express');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/clients
router.get('/', async (req, res) => {
  const clients = await Client.find().sort({ createdAt: -1 });
  res.json(clients);
});

// POST /api/clients
router.post('/', async (req, res) => {
  const client = await Client.create(req.body);
  res.status(201).json(client);
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ message: 'Client not found' });
  res.json(client);
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!client) return res.status(404).json({ message: 'Client not found' });
  res.json(client);
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  await Client.findByIdAndDelete(req.params.id);
  res.json({ message: 'Client deleted' });
});

module.exports = router;
