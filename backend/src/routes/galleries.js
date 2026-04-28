const express = require('express');
const path = require('path');
const fs = require('fs');
const Gallery = require('../models/Gallery');
const GallerySubmission = require('../models/GallerySubmission');
const GalleryImage = require('../models/GalleryImage');
const Client = require('../models/Client');
const SiteSettings = require('../models/SiteSettings');
const { protect } = require('../middleware/auth');
const checkQuota = require('../middleware/checkQuota');
const asyncHandler = require('../middleware/asyncHandler');
const { sendGalleryLink } = require('../services/emailService');
const { sendGallerySms } = require('../services/smsService');
const { withTransaction } = require('../utils/transaction');
const { uploadVideo } = require('../middleware/upload');
const { UUID_RE } = require('../utils/uuid');
const s3 = require('../config/s3');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const router = express.Router();

// Valid status transitions for gallery pipeline
const VALID_TRANSITIONS = {
  draft:                ['gallery_sent'],
  gallery_sent:         ['viewed', 'in_editing', 'delivered'],
  viewed:               ['selection_submitted', 'in_editing', 'delivered'],
  selection_submitted:  ['in_editing', 'delivered'],
  in_editing:           ['delivered'],
  delivered:            [],
};

// GET /api/galleries/token/:token  — PUBLIC (client gallery access)
router.get('/token/:token', asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ token: req.params.token, isActive: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found or inactive' });
  if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date())
    return res.status(410).json({ message: 'Gallery has expired' });

  if (gallery.status === 'gallery_sent') {
    await withTransaction(async (txClient) => {
      gallery.status = 'viewed';
      await Gallery.save(gallery, txClient);
      if (gallery.clientId) {
        await Client.findOneAndUpdate(
          { _id: gallery.clientId, status: 'gallery_sent' },
          { status: 'viewed' },
          {},
          txClient
        );
      }
    });
  }

  // If admin reactivated (status is viewed but a submission exists), attach previous selection IDs
  if (gallery.status === 'viewed') {
    const submission = await GallerySubmission.findOne({ galleryId: gallery.id });
    if (submission) {
      gallery.previousSelectionIds = submission.selectedImageIds;
    }
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
  let smsSent = false;
  if (clientId) {
    const adminSettings = await SiteSettings.findOne({ adminId: req.admin.id });
    const autoEmail = adminSettings?.autoSendGalleryEmail ?? true;
    const autoSms = adminSettings?.autoSendGallerySms ?? false;
    const client = await Client.findById(clientId);
    const galleryUrl = `${process.env.FRONTEND_URL}/gallery/${gallery.token}`;
    const lang = req.admin.lang || 'he';

    if (autoEmail && client?.email) {
      try {
        emailSent = await sendGalleryLink({
          clientName: client.name,
          clientEmail: client.email,
          galleryName: gallery.name,
          galleryUrl,
          headerMessage: gallery.headerMessage,
          lang,
        });
      } catch (_) {
        emailSent = false;
      }
      if (emailSent) {
        gallery.lastEmailSentAt = new Date();
        await Gallery.save(gallery);
      }
    }

    if (autoSms && client?.phone) {
      try {
        smsSent = await sendGallerySms({
          clientName: client.name,
          clientPhone: client.phone,
          galleryUrl,
          lang,
        });
      } catch (_) {
        smsSent = false;
      }
    }
  }

  res.status(201).json({ ...gallery, emailSent, smsSent });
}));

// POST /api/galleries/:id/delivery
router.post('/:id/delivery', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const original = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id }, { populate: true });
  if (!original) return res.status(404).json({ message: 'Gallery not found' });

  let delivery;
  await withTransaction(async (txClient) => {
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

    delivery = await Gallery.create(galleryData, txClient);

    original.status = 'delivered';
    await Gallery.save(original, txClient);

    if (clientIdValue) {
      await Client.findOneAndUpdate(
        { _id: clientIdValue },
        { status: 'delivered' },
        {},
        txClient
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
  let sent = false;
  try {
    sent = await sendGalleryLink({
      clientName,
      clientEmail,
      galleryName: gallery.name,
      galleryUrl,
      headerMessage: gallery.headerMessage,
      lang: req.admin.lang || 'he',
    });
  } catch (_) {
    sent = false;
  }

  if (!sent) return res.status(503).json({ message: 'SMTP not configured or failed' });
  gallery.lastEmailSentAt = new Date();
  await Gallery.save(gallery);
  res.json({ message: 'Email sent', lastEmailSentAt: gallery.lastEmailSentAt });
}));

// POST /api/galleries/:id/send-sms
router.post('/:id/send-sms', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id }, { populate: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const clientObj = gallery.clientId;
  const clientPhone = typeof clientObj === 'object' ? clientObj.phone : null;
  const clientName = typeof clientObj === 'object' ? clientObj.name : null;

  if (!clientPhone) return res.status(400).json({ message: 'Client has no phone number' });

  const galleryUrl = `${process.env.FRONTEND_URL}/gallery/${gallery.token}`;
  try {
    await sendGallerySms({
      clientName,
      clientPhone,
      galleryUrl,
      lang: req.admin.lang || 'he',
    });
  } catch (err) {
    console.error('[sms route] Twilio error:', err.message, err.code);
    return res.status(503).json({ message: err.message || 'SMS failed', code: err.code });
  }

  res.json({ message: 'SMS sent' });
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

  // Validate status transition if status is being changed
  if (status) {
    const current = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id });
    if (!current) return res.status(404).json({ message: 'Gallery not found' });
    const allowed = VALID_TRANSITIONS[current.status] || [];
    if (current.status !== status && !allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition gallery from '${current.status}' to '${status}'`,
      });
    }
  }

  const gallery = await Gallery.findOneAndUpdate(
    { _id: req.params.id, adminId: req.admin.id },
    { name, clientName, headerMessage, isActive, expiresAt, status, maxSelections }
  );
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  res.json(gallery);
}));

// POST /api/galleries/:id/reactivate  — reset a submitted gallery back to 'viewed' and delete its submissions
router.post('/:id/reactivate', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  if (!['selection_submitted', 'in_editing', 'delivered'].includes(gallery.status))
    return res.status(400).json({ message: 'Gallery cannot be reactivated from its current status' });

  gallery.status = 'viewed';
  await Gallery.save(gallery);
  res.json(gallery);
}));

// DELETE /api/galleries/:id
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const gallery = await Gallery.findOneAndDelete({ _id: req.params.id, adminId: req.admin.id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  // Clean up image files from disk (DB rows cascade-delete via FK)
  const images = await GalleryImage.find({ galleryId: req.params.id });
  const THUMB_DIR = path.join(__dirname, '../../uploads/thumbnails');
  for (const img of images) {
    const filePath = path.join(__dirname, '../../uploads', img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (img.thumbnailPath) {
      const thumbPath = path.join(THUMB_DIR, path.basename(img.thumbnailPath));
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
    if (img.beforePath) {
      const beforePath = path.join(__dirname, '../../uploads', path.basename(img.beforePath));
      if (fs.existsSync(beforePath)) fs.unlinkSync(beforePath);
    }
  }

  // Clean up video files from disk
  if (Array.isArray(gallery.videos)) {
    for (const v of gallery.videos) {
      const filePath = path.join(__dirname, '../../uploads', path.basename(v.filename));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  res.json({ message: 'Gallery deleted' });
}));

// POST /api/galleries/:id/video  — upload one or more videos
router.post('/:id/video', protect, checkQuota, uploadVideo.array('videos', 20), asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const gallery = await Gallery.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (!req.files?.length) return res.status(400).json({ message: 'No video files provided' });

  const currentVideos = Array.isArray(gallery.videos) ? gallery.videos : [];
  for (const file of req.files) {
    const videoPath = await s3.processUpload(file, req.admin.id);
    currentVideos.push({
      path: videoPath,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
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

  // Delete from S3 or local disk (use stored path from video record)
  const video = currentVideos[idx];
  await s3.deleteUpload(video.path, UPLOADS_DIR);

  currentVideos.splice(idx, 1);
  gallery.videos = currentVideos;
  await Gallery.save(gallery);
  res.json({ message: 'Video deleted' });
}));

module.exports = router;
