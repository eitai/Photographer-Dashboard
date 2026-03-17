const express = require('express');
const GallerySubmission = require('../models/GallerySubmission');
const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { withTransaction } = require('../utils/transaction');

const router = express.Router({ mergeParams: true });

const UUID_RE = /^[0-9a-f-]{36}$/i;

// POST /api/galleries/:galleryId/submit  — PUBLIC (client submits final selection)
router.post('/submit', asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  if (!UUID_RE.test(galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID format' });

  const { sessionId, selectedImageIds, clientMessage, imageComments, heroImageId } = req.body;

  if (!Array.isArray(selectedImageIds)) {
    return res.status(400).json({ message: 'selectedImageIds must be an array' });
  }

  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  if (selectedImageIds.length > gallery.maxSelections) {
    return res.status(400).json({ message: `You can only select up to ${gallery.maxSelections} photos.` });
  }

  // Validate every submitted image actually belongs to this gallery
  if (selectedImageIds.length > 0) {
    const validCount = await GalleryImage.countDocuments({
      galleryId,
      _id: { $in: selectedImageIds },
    });
    if (validCount !== selectedImageIds.length) {
      return res.status(400).json({ message: 'One or more selected images are invalid.' });
    }
  }

  let submission;
  await withTransaction(async (client) => {
    submission = await GallerySubmission.findOneAndUpdate(
      { galleryId, sessionId },
      {
        $set: {
          selectedImageIds,
          clientMessage,
          imageComments: imageComments || {},
          heroImageId: heroImageId || null,
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    gallery.status = 'selection_submitted';
    await Gallery.save(gallery, client);

    if (gallery.clientId) {
      await Client.findOneAndUpdate(
        { _id: gallery.clientId, status: { $in: ['gallery_sent', 'viewed'] } },
        { status: 'selection_submitted' },
        {}
      );
    }
  });

  // Fire-and-forget push notification — must never block the client response
  try {
    const admin = await Admin.findById(gallery.adminId);
    if (admin?.pushToken) {
      let clientName = 'A client';
      if (gallery.clientId) {
        const clientDoc = await Client.findById(gallery.clientId);
        if (clientDoc) clientName = clientDoc.name;
      }
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: admin.pushToken,
          title: 'New Selection Submitted',
          body: `${clientName} has submitted their photo selection`,
          data: { galleryId: gallery.id },
          sound: 'default',
          priority: 'high',
        }),
      });
    }
  } catch (pushErr) {
    logger.warn(`Push notification failed for gallery ${galleryId}: ${pushErr.message}`);
  }

  res.json(submission);
}));

// GET /api/galleries/:galleryId/submissions  — ADMIN
router.get('/submissions', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID format' });
  const gallery = await Gallery.findOne({ _id: req.params.galleryId, adminId: req.admin.id });
  if (!gallery) return res.status(403).json({ message: 'Forbidden' });
  const submissions = await GallerySubmission.find({ galleryId: req.params.galleryId }, { populate: true });
  res.json(submissions);
}));

// DELETE /api/galleries/:galleryId/submissions/:submissionId  — ADMIN
router.delete('/submissions/:submissionId', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.galleryId) || !UUID_RE.test(req.params.submissionId))
    return res.status(400).json({ message: 'Invalid ID format' });
  // Verify the gallery belongs to this admin before deleting its submission
  const gallery = await Gallery.findOne({ _id: req.params.galleryId, adminId: req.admin.id });
  if (!gallery) return res.status(403).json({ message: 'Forbidden' });
  await GallerySubmission.findOneAndDelete({
    _id: req.params.submissionId,
    galleryId: req.params.galleryId,
  });
  res.json({ message: 'Submission deleted' });
}));

// DELETE /api/galleries/:galleryId/submissions/:submissionId/images/:imageId  — ADMIN
router.delete('/submissions/:submissionId/images/:imageId', protect, asyncHandler(async (req, res) => {
  if (
    !UUID_RE.test(req.params.galleryId) ||
    !UUID_RE.test(req.params.submissionId) ||
    !UUID_RE.test(req.params.imageId)
  ) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  const gallery = await Gallery.findOne({ _id: req.params.galleryId, adminId: req.admin.id });
  if (!gallery) return res.status(403).json({ message: 'Forbidden' });
  const submission = await GallerySubmission.pullSelectedImage(
    req.params.submissionId,
    req.params.galleryId,
    req.params.imageId
  );
  if (!submission) return res.status(404).json({ message: 'Submission not found' });
  res.json(submission);
}));

module.exports = router;
