const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
  username:   { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  studioName: { type: String },
  // Expo push token — registered from the mobile app and used to send
  // selection-submitted notifications. Null when the device has no token
  // (permission denied or simulator).
  pushToken:  { type: String, default: null },
}, { timestamps: true });

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
