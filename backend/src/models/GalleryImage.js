const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
  galleryId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', required: true },
  filename:      { type: String, required: true },
  originalName:  { type: String },
  path:          { type: String, required: true },
  thumbnailPath: { type: String },
  sortOrder:     { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
