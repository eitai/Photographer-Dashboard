const express = require('express');
const SiteSettings = require('../models/SiteSettings');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/settings  — ADMIN (own settings)
router.get('/', protect, async (req, res) => {
  try {
    const settings = await SiteSettings.findOne({ adminId: req.admin._id }).populate('featuredImageIds');
    const featuredImages = (settings?.featuredImageIds || []).filter(Boolean);
    res.json({
      featuredImages,
      bio: settings?.bio || '',
      heroImagePath: settings?.heroImagePath || '',
      profileImagePath: settings?.profileImagePath || '',
      phone: settings?.phone || '',
      instagramHandle: settings?.instagramHandle || '',
      facebookUrl: settings?.facebookUrl || '',
      heroSubtitle: settings?.heroSubtitle || '',
      contactEmail: settings?.contactEmail || '',
      theme: settings?.theme || 'bw',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings/featured  — ADMIN
router.put('/featured', protect, async (req, res) => {
  const { imageIds } = req.body;
  const settings = await SiteSettings.findOneAndUpdate(
    { adminId: req.admin._id },
    { featuredImageIds: imageIds || [], adminId: req.admin._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).populate('featuredImageIds');
  res.json({ featuredImages: settings.featuredImageIds });
});

// PUT /api/settings/landing  — ADMIN (bio, phone, instagram)
router.put('/landing', protect, async (req, res) => {
  try {
    const { bio, phone, instagramHandle, facebookUrl, heroSubtitle, contactEmail, theme } = req.body;
    const settings = await SiteSettings.findOneAndUpdate(
      { adminId: req.admin._id },
      { $set: { bio, phone, instagramHandle, facebookUrl, heroSubtitle, contactEmail, theme, adminId: req.admin._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ bio: settings.bio, phone: settings.phone, instagramHandle: settings.instagramHandle, facebookUrl: settings.facebookUrl, heroSubtitle: settings.heroSubtitle, contactEmail: settings.contactEmail, theme: settings.theme });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/settings/hero-image  — ADMIN (upload hero image)
router.post('/hero-image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' });
    const heroImagePath = `/uploads/${req.file.filename}`;
    await SiteSettings.findOneAndUpdate(
      { adminId: req.admin._id },
      { $set: { heroImagePath, adminId: req.admin._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ heroImagePath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/settings/profile-image  — ADMIN (upload profile photo)
router.post('/profile-image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' });
    const profileImagePath = `/uploads/${req.file.filename}`;
    await SiteSettings.findOneAndUpdate(
      { adminId: req.admin._id },
      { $set: { profileImagePath, adminId: req.admin._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ profileImagePath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
