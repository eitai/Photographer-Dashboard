const mongoose = require('mongoose');

const STATUS = ['gallery_sent', 'viewed', 'selection_submitted', 'in_editing', 'delivered'];
const SESSION_TYPES = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

const clientSchema = new mongoose.Schema({
  adminId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  name:        { type: String, required: true },
  phone:       { type: String },
  email:       { type: String, lowercase: true },
  sessionType: { type: String, enum: SESSION_TYPES },
  notes:       { type: String },
  status:      { type: String, enum: STATUS, default: 'gallery_sent' },
}, { timestamps: true });

clientSchema.index({ adminId: 1 });
clientSchema.index({ adminId: 1, status: 1 });

module.exports = mongoose.model('Client', clientSchema);
