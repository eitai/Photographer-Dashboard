const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
  galleryId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', required: true },
  filename:      { type: String, required: true },
  originalName:  { type: String },
  path:          { type: String, required: true },
  thumbnailPath: { type: String },
  beforePath:    { type: String },
  sortOrder:     { type: Number, default: 0 },
  size:          { type: Number, default: 0 }, // bytes — used for per-admin storage quota
}, { timestamps: true });

galleryImageSchema.index({ galleryId: 1, sortOrder: 1 });

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
