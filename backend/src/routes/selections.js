const express = require('express');
const GallerySubmission = require('../models/GallerySubmission');
const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/galleries/:galleryId/submit  — PUBLIC (client submits final selection)
router.post('/submit', async (req, res) => {
  const { galleryId } = req.params;
  const { sessionId, selectedImageIds, clientMessage, imageComments, heroImageId } = req.body;

  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  if (selectedImageIds.length > gallery.maxSelections) {
    return res.status(400).json({ message: `You can only select up to ${gallery.maxSelections} photos.` });
  }

  const submission = await GallerySubmission.findOneAndUpdate(
    { galleryId, sessionId },
    { $set: { selectedImageIds, clientMessage, imageComments: imageComments || {}, heroImageId: heroImageId || null, submittedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  gallery.status = 'selection_submitted';
  await gallery.save();

  // Sync client status
  if (gallery.clientId) {
    await Client.findOneAndUpdate(
      { _id: gallery.clientId, status: { $in: ['gallery_sent', 'viewed'] } },
      { status: 'selection_submitted' }
    );
  }

  // Send push notification to the gallery owner if they have a registered token.
  // We fire-and-forget — a push failure must never block the client submission response.
  try {
    const admin = await Admin.findById(gallery.adminId);
    if (admin && admin.pushToken) {
      // Resolve the client name for a friendlier notification body
      let clientName = 'A client';
      if (gallery.clientId) {
        const client = await Client.findById(gallery.clientId).select('name');
        if (client) clientName = client.name;
      }

      // Use the Expo Push API directly — no third-party SDK required on the server
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: admin.pushToken,
          title: 'New Selection Submitted',
          body: `${clientName} has submitted their photo selection`,
          data: { galleryId: gallery._id.toString() },
          sound: 'default',
          priority: 'high',
        }),
      });
    }
  } catch (pushErr) {
    // Log but never surface push errors to the client
    console.error('[selections] Push notification failed:', pushErr);
  }

  res.json(submission);
});

// GET /api/galleries/:galleryId/submissions  — ADMIN
router.get('/submissions', protect, async (req, res) => {
  const submissions = await GallerySubmission.find({ galleryId: req.params.galleryId })
    .populate('selectedImageIds')
    .sort({ submittedAt: -1 });
  res.json(submissions);
});

// DELETE /api/galleries/:galleryId/submissions/:submissionId  — ADMIN
router.delete('/submissions/:submissionId', protect, async (req, res) => {
  await GallerySubmission.findByIdAndDelete(req.params.submissionId);
  res.json({ message: 'Submission deleted' });
});

// DELETE /api/galleries/:galleryId/submissions/:submissionId/images/:imageId  — ADMIN
router.delete('/submissions/:submissionId/images/:imageId', protect, async (req, res) => {
  const submission = await GallerySubmission.findByIdAndUpdate(
    req.params.submissionId,
    { $pull: { selectedImageIds: req.params.imageId } },
    { new: true },
  ).populate('selectedImageIds');
  if (!submission) return res.status(404).json({ message: 'Submission not found' });
  res.json(submission);
});

module.exports = router;
