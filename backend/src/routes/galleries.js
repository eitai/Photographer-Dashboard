const express = require('express');
const path = require('path');
const fs = require('fs');
const Gallery = require('../models/Gallery');
const Client = require('../models/Client');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendGalleryLink } = require('../services/emailService');
const { withTransaction } = require('../utils/transaction');
const { uploadVideo } = require('../middleware/upload');

const router = express.Router();

const UUID_RE = /^[0-9a-f-]{36}$/i;

// GET /api/galleries/token/:token  — PUBLIC (client gallery access)
router.get('/token/:token', asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ token: req.params.token, isActive: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found or inactive' });
  if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date())
    return res.status(410).json({ message: 'Gallery has expired' });

  if (gallery.status === 'gallery_sent') {
    await withTransaction(async (client) => {
      gallery.status = 'viewed';
      await Gallery.save(gallery, client);
      if (gallery.clientId) {
        await Client.findOneAndUpdate(
          { _id: gallery.clientId, status: 'gallery_sent' },
          { status: 'viewed' },
          {}
        );
      }
    });
  }
  res.json(gallery);
}));

// GET /api/galleries
router.get('/', protect, asyncHandler(async (req, res) => {
  const filter = { adminId: req.admin.id };
  if (req.query.clientId) filter.clientId = req.query.clientId;
  const galleries = await Gallery.find(filter, { populate: true });
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
    adminId: req.admin.id,
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
        await Gallery.save(gallery);
      }
    }
  }

  res.status(201).json({ ...gallery, emailSent });
}));

// POST /api/galleries/:id/delivery
router.post('/:id/delivery', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const original = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id }, { populate: true });
  if (!original) return res.status(404).json({ message: 'Gallery not found' });

  let delivery;
  await withTransaction(async (client) => {
    const clientIdValue = original.clientId?.id || original.clientId || null;
    const galleryData = {
      adminId: req.admin.id,
      clientId: clientIdValue,
      clientName: original.clientName,
      name: req.body.name || `${original.name} — Edited`,
      headerMessage: req.body.headerMessage || '',
      isActive: true,
      isDelivery: true,
      deliveryOf: original.id,
      status: 'delivered',
    };

    delivery = await Gallery.create(galleryData, client);

    if (clientIdValue) {
      await Client.findOneAndUpdate(
        { _id: clientIdValue },
        { status: 'delivered' },
        {}
      );
    }
  });

  res.status(201).json(delivery);
}));

// POST /api/galleries/:id/resend-email
router.post('/:id/resend-email', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id }, { populate: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const clientObj = gallery.clientId;
  const clientEmail = typeof clientObj === 'object' ? clientObj.email : null;
  const clientName = typeof clientObj === 'object' ? clientObj.name : null;

  if (!clientEmail) return res.status(400).json({ message: 'Client has no email address' });

  const galleryUrl = `${process.env.FRONTEND_URL}/gallery/${gallery.token}`;
  const sent = await sendGalleryLink({
    clientName,
    clientEmail,
    galleryName: gallery.name,
    galleryUrl,
    headerMessage: gallery.headerMessage,
  });

  if (!sent) return res.status(503).json({ message: 'SMTP not configured' });
  gallery.lastEmailSentAt = new Date();
  await Gallery.save(gallery);
  res.json({ message: 'Email sent', lastEmailSentAt: gallery.lastEmailSentAt });
}));

// GET /api/galleries/:id
router.get('/:id', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id }, { populate: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json(gallery);
}));

// PUT /api/galleries/:id
router.put('/:id', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  // Whitelist updatable fields — never allow overwriting adminId, token, or internal flags
  const { name, clientName, headerMessage, isActive, expiresAt, status, maxSelections } = req.body;
  const gallery = await Gallery.findOneAndUpdate(
    { _id: req.params.id, adminId: req.admin.id },
    { name, clientName, headerMessage, isActive, expiresAt, status, maxSelections }
  );
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json(gallery);
}));

// DELETE /api/galleries/:id
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const gallery = await Gallery.findOneAndDelete({ _id: req.params.id, adminId: req.admin.id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json({ message: 'Gallery deleted' });
}));

// POST /api/galleries/:id/video  — upload one or more videos
router.post('/:id/video', protect, uploadVideo.array('videos', 20), asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (!req.files?.length) return res.status(400).json({ message: 'No video files provided' });

  const currentVideos = Array.isArray(gallery.videos) ? gallery.videos : [];
  for (const file of req.files) {
    currentVideos.push({
      path: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
    });
  }
  gallery.videos = currentVideos;
  await Gallery.save(gallery);
  res.json(gallery);
}));

// DELETE /api/galleries/:id/video/:filename  — remove a specific video
router.delete('/:id/video/:filename', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const currentVideos = Array.isArray(gallery.videos) ? gallery.videos : [];
  const idx = currentVideos.findIndex((v) => v.filename === req.params.filename);
  if (idx === -1) return res.status(404).json({ message: 'Video not found' });

  const filePath = path.join(__dirname, '../../uploads', req.params.filename);
  fs.unlink(filePath, () => {}); // non-fatal

  currentVideos.splice(idx, 1);
  gallery.videos = currentVideos;
  await Gallery.save(gallery);
  res.json({ message: 'Video deleted' });
}));

module.exports = router;
