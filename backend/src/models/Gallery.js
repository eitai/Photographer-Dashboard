const mongoose = require('mongoose');
const crypto = require('crypto');

const gallerySchema = new mongoose.Schema({
  adminId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  clientId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  name:          { type: String, required: true },
  clientName:    { type: String },
  token:         { type: String, unique: true },
  headerMessage: { type: String },
  isActive:      { type: Boolean, default: true },
  expiresAt:     { type: Date },
  status: {
    type: String,
    enum: ['gallery_sent', 'viewed', 'selection_submitted', 'in_editing', 'delivered'],
    default: 'gallery_sent',
  },
  maxSelections:   { type: Number, default: 10 },
  isDelivery:      { type: Boolean, default: false },
  deliveryOf:      { type: mongoose.Schema.Types.ObjectId, ref: 'Gallery', default: null },
  lastEmailSentAt: { type: Date, default: null },
  videos: [{
    path:         { type: String, required: true },
    filename:     { type: String, required: true },
    originalName: { type: String, default: '' },
  }],
}, { timestamps: true });

gallerySchema.index({ adminId: 1 });
gallerySchema.index({ clientId: 1 });
gallerySchema.index({ adminId: 1, status: 1 });

gallerySchema.pre('save', function (next) {
  if (!this.token) this.token = crypto.randomBytes(24).toString('hex');
  next();
});

module.exports = mongoose.model('Gallery', gallerySchema);
