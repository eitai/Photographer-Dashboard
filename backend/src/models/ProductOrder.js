const mongoose = require('mongoose');

const selectedPhotoSchema = new mongoose.Schema({
  galleryId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', required: true },
  imageId:       { type: mongoose.Schema.Types.ObjectId, required: true },
  path:          { type: String, required: true },
  thumbnailPath: { type: String },
  filename:      { type: String, required: true },
}, { _id: false });

const productOrderSchema = new mongoose.Schema({
  adminId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  clientId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  name:              { type: String, required: true },
  type:              { type: String, enum: ['album', 'print'], required: true },
  maxPhotos:         { type: Number, default: 1 },
  allowedGalleryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Gallery' }],
  selectedPhotoIds:  { type: [selectedPhotoSchema], default: [] },
  status:            { type: String, enum: ['pending', 'submitted'], default: 'pending' },
}, { timestamps: true });

productOrderSchema.index({ adminId: 1, clientId: 1 });

module.exports = mongoose.model('ProductOrder', productOrderSchema);
