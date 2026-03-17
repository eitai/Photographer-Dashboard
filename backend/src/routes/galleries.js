const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Gallery = require('../models/Gallery');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendGalleryLink } = require('../services/emailService');
const { withTransaction } = require('../utils/transaction');
const { uploadVideo } = require('../middleware/upload');

const router = express.Router();

// GET /api/galleries/token/:token  — PUBLIC (client gallery access)
router.get('/token/:token', asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ token: req.params.token, isActive: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found or inactive' });
  if (gallery.expiresAt && gallery.expiresAt < new Date())
    return res.status(410).json({ message: 'Gallery has expired' });

  if (gallery.status === 'gallery_sent') {
    await withTransaction(async (session) => {
      gallery.status = 'viewed';
      await gallery.save(session ? { session } : {});
      if (gallery.clientId) {
        await Client.findOneAndUpdate(
          { _id: gallery.clientId, status: 'gallery_sent' },
          { status: 'viewed' },
          session ? { session } : {}
        );
      }
    });
  }
  res.json(gallery);
}));

// GET /api/galleries
router.get('/', protect, asyncHandler(async (req, res) => {
  const filter = { adminId: req.admin._id };
  if (req.query.clientId) filter.clientId = req.query.clientId;
  const galleries = await Gallery.find(filter)
    .populate('clientId', 'name email')
    .sort({ createdAt: -1 })
    .limit(500);
  res.json(galleries);
}));

// POST /api/galleries
router.post('/', protect, asyncHandler(async (req, res) => {
  // Accept legacy `title` field as alias for `name`
  const {
    name: rawName, title,
    clientId, clientName, headerMessage,
    isActive, expiresAt, status, maxSelections,
  } = req.body;
  const name = rawName || title;

  const gallery = await Gallery.create({
    name, clientId, clientName, headerMessage,
    isActive, expiresAt, status, maxSelections,
    adminId: req.admin._id,
  });

  let emailSent = false;
  if (clientId) {
    const client = await Client.findById(clientId);
    if (client?.email) {
      const galleryUrl = `${process.env.FRONTEND_URL}/gallery/${gallery.token}`;
      emailSent = await sendGalleryLink({
        clientName: client.name,
        clientEmail: client.email,
        galleryName: gallery.name,
        galleryUrl,
        headerMessage: gallery.headerMessage,
      });
      if (emailSent) {
        gallery.lastEmailSentAt = new Date();
        await gallery.save();
      }
    }
  }

  res.status(201).json({ ...gallery.toObject(), emailSent });
}));

// POST /api/galleries/:id/delivery
router.post('/:id/delivery', protect, asyncHandler(async (req, res) => {
  const original = await Gallery.findOne({ _id: req.params.id, adminId: req.admin._id }).populate('clientId');
  if (!original) return res.status(404).json({ message: 'Gallery not found' });

  let delivery;
  await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    const galleryData = {
      adminId: req.admin._id,
      clientId: original.clientId,
      clientName: original.clientName,
      name: req.body.name || `${original.name} — Edited`,
      headerMessage: req.body.headerMessage || '',
      isActive: true,
      isDelivery: true,
      deliveryOf: original._id,
      status: 'delivered',
    };

    // Array form of create() works with and without a session
    [delivery] = await Gallery.create([galleryData], opts);

    if (original.clientId?._id) {
      await Client.findByIdAndUpdate(original.clientId._id, { status: 'delivered' }, opts);
    }
  });

  res.status(201).json(delivery);
}));

// POST /api/galleries/:id/resend-email
router.post('/:id/resend-email', protect, asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin._id }).populate('clientId');
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
  gallery.lastEmailSentAt = new Date();
  await gallery.save();
  res.json({ message: 'Email sent', lastEmailSentAt: gallery.lastEmailSentAt });
}));

// GET /api/galleries/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin._id }).populate('clientId');
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json(gallery);
}));

// PUT /api/galleries/:id
router.put('/:id', protect, asyncHandler(async (req, res) => {
  // Whitelist updatable fields — never allow overwriting adminId, token, or internal flags
  const { name, clientName, headerMessage, isActive, expiresAt, status, maxSelections } = req.body;
  const gallery = await Gallery.findOneAndUpdate(
    { _id: req.params.id, adminId: req.admin._id },
    { name, clientName, headerMessage, isActive, expiresAt, status, maxSelections },
    { new: true, runValidators: true }
  );
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json(gallery);
}));

// DELETE /api/galleries/:id
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOneAndDelete({ _id: req.params.id, adminId: req.admin._id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json({ message: 'Gallery deleted' });
}));

// POST /api/galleries/:id/video  — upload one or more videos
router.post('/:id/video', protect, uploadVideo.array('videos', 20), asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin._id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (!req.files?.length) return res.status(400).json({ message: 'No video files provided' });

  for (const file of req.files) {
    gallery.videos.push({
      path: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
    });
  }
  await gallery.save();
  res.json(gallery);
}));

// DELETE /api/galleries/:id/video/:filename  — remove a specific video
router.delete('/:id/video/:filename', protect, asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin._id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const idx = gallery.videos.findIndex((v) => v.filename === req.params.filename);
  if (idx === -1) return res.status(404).json({ message: 'Video not found' });

  const filePath = path.join(__dirname, '../../uploads', req.params.filename);
  fs.unlink(filePath, () => {}); // non-fatal

  gallery.videos.splice(idx, 1);
  await gallery.save();
  res.json({ message: 'Video deleted' });
}));

module.exports = router;
