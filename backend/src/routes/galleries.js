const express = require('express');
const Gallery = require('../models/Gallery');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');
const { sendGalleryLink } = require('../services/emailService');

const router = express.Router();

// GET /api/galleries/token/:token  — PUBLIC (client gallery access)
router.get('/token/:token', async (req, res) => {
  const gallery = await Gallery.findOne({
    token: req.params.token,
    isActive: true,
  });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found or inactive' });
  if (gallery.expiresAt && gallery.expiresAt < new Date()) return res.status(410).json({ message: 'Gallery has expired' });

  // Mark as viewed on first access
  if (gallery.status === 'gallery_sent') {
    gallery.status = 'viewed';
    await gallery.save();
  }
  res.json(gallery);
});

// All routes below require auth
router.use(protect);

// GET /api/galleries
router.get('/', async (req, res) => {
  const galleries = await Gallery.find().populate('clientId', 'name email').sort({ createdAt: -1 });
  res.json(galleries);
});

// POST /api/galleries
router.post('/', async (req, res) => {
  const gallery = await Gallery.create(req.body);

  // Send gallery link email if client has an email address
  let emailSent = false;
  if (req.body.clientId) {
    const client = await Client.findById(req.body.clientId);
    if (client?.email) {
      const galleryUrl = `${process.env.FRONTEND_URL}/gallery/${gallery.token}`;
      emailSent = await sendGalleryLink({
        clientName: client.name,
        clientEmail: client.email,
        galleryName: gallery.name,
        galleryUrl,
        headerMessage: gallery.headerMessage,
      });
    }
  }

  res.status(201).json({ ...gallery.toObject(), emailSent });
});

// POST /api/galleries/:id/delivery  — Create a linked delivery gallery
router.post('/:id/delivery', async (req, res) => {
  const original = await Gallery.findById(req.params.id).populate('clientId');
  if (!original) return res.status(404).json({ message: 'Gallery not found' });

  const delivery = await Gallery.create({
    clientId: original.clientId,
    clientName: original.clientName,
    name: req.body.name || `${original.name} — Edited`,
    headerMessage: req.body.headerMessage || '',
    isActive: true,
    isDelivery: true,
    deliveryOf: original._id,
    status: 'delivered',
  });

  // Update client status to delivered
  if (original.clientId?._id) {
    await Client.findByIdAndUpdate(original.clientId._id, { status: 'delivered' });
  }

  res.status(201).json(delivery);
});

// POST /api/galleries/:id/resend-email
router.post('/:id/resend-email', async (req, res) => {
  const gallery = await Gallery.findById(req.params.id).populate('clientId');
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const client = gallery.clientId;
  if (!client?.email) return res.status(400).json({ message: 'Client has no email address' });

  const galleryUrl = `${process.env.FRONTEND_URL}/gallery/${gallery.token}`;
  const sent = await sendGalleryLink({
    clientName: client.name,
    clientEmail: client.email,
    galleryName: gallery.name,
    galleryUrl,
    headerMessage: gallery.headerMessage,
  });

  if (!sent) return res.status(503).json({ message: 'SMTP not configured' });
  res.json({ message: 'Email sent' });
});

// GET /api/galleries/:id
router.get('/:id', async (req, res) => {
  const gallery = await Gallery.findById(req.params.id).populate('clientId');
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json(gallery);
});

// PUT /api/galleries/:id
router.put('/:id', async (req, res) => {
  const gallery = await Gallery.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json(gallery);
});

// DELETE /api/galleries/:id
router.delete('/:id', async (req, res) => {
  await Gallery.findByIdAndDelete(req.params.id);
  res.json({ message: 'Gallery deleted' });
});

module.exports = router;
