const mongoose = require('mongoose');

const gallerySubmissionSchema = new mongoose.Schema({
  galleryId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', required: true },
  sessionId:        { type: String, required: true },
  selectedImageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GalleryImage' }],
  clientMessage:    { type: String },
  submittedAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('GallerySubmission', gallerySubmissionSchema);
