const mongoose = require('mongoose');

const gallerySubmissionSchema = new mongoose.Schema({
  galleryId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', required: true },
  sessionId:        { type: String, required: true },
  selectedImageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GalleryImage' }],
  clientMessage:    { type: String },
  imageComments:    { type: Map, of: String, default: {} },
  heroImageId:      { type: mongoose.Schema.Types.ObjectId, ref: 'GalleryImage', default: null },
  submittedAt:      { type: Date, default: Date.now },
});

gallerySubmissionSchema.index({ galleryId: 1 });

module.exports = mongoose.model('GallerySubmission', gallerySubmissionSchema);
