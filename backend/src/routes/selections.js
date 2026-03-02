const express = require('express');
const GallerySubmission = require('../models/GallerySubmission');
const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/galleries/:galleryId/submit  — PUBLIC (client submits final selection)
router.post('/submit', async (req, res) => {
  const { galleryId } = req.params;
  const { sessionId, selectedImageIds, clientMessage } = req.body;

  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  if (selectedImageIds.length > gallery.maxSelections) {
    return res.status(400).json({ message: `You can only select up to ${gallery.maxSelections} photos.` });
  }

  const submission = await GallerySubmission.findOneAndUpdate(
    { galleryId, sessionId },
    { $set: { selectedImageIds, clientMessage, submittedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  gallery.status = 'selection_submitted';
  await gallery.save();

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
