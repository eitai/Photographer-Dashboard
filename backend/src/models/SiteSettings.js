const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
  adminId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', unique: true, sparse: true },
  featuredImageIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'GalleryImage' }],
  bio:               { type: String, default: '' },
  heroImagePath:     { type: String, default: '' },
  profileImagePath:  { type: String, default: '' },
  phone:             { type: String, default: '' },
  instagramHandle:   { type: String, default: '' },
  facebookUrl:       { type: String, default: '' },
  heroSubtitle:      { type: String, default: '' },
  contactEmail:      { type: String, default: '' },
  theme:             { type: String, default: 'bw' },
});

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
