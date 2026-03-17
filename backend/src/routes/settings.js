const express = require('express');
const SiteSettings = require('../models/SiteSettings');
const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');
const { protect } = require('../middleware/auth');
const { uploadImage: upload, validateImageMagicBytes } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/settings  — ADMIN
router.get('/', protect, asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ adminId: req.admin.id }, { populate: true });
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
}));

// PUT /api/settings/featured  — ADMIN
router.put('/featured', protect, asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.imageIds) ? req.body.imageIds : [];

  if (ids.length > 0) {
    // Verify every referenced image belongs to a gallery owned by this admin
    const adminGalleries = await Gallery.find({ adminId: req.admin.id });
    const adminGalleryIds = new Set(adminGalleries.map((g) => g.id));
    const images = await GalleryImage.find({ _id: { $in: ids } });
    const allOwned =
      images.length === ids.length &&
      images.every((img) => adminGalleryIds.has(img.galleryId));
    if (!allOwned) {
      return res.status(403).json({ message: 'One or more images do not belong to your galleries' });
    }
  }

  const settings = await SiteSettings.upsert(req.admin.id, { featuredImageIds: ids }, { populate: true });
  // After upsert with populate, featuredImageIds is the populated array
  res.json({ featuredImages: settings.featuredImageIds });
}));

// PUT /api/settings/landing  — ADMIN
router.put('/landing', protect, asyncHandler(async (req, res) => {
  const { bio, phone, instagramHandle, facebookUrl, heroSubtitle, contactEmail, theme } = req.body;
  const data = {};
  if (bio !== undefined) data.bio = bio;
  if (phone !== undefined) data.phone = phone;
  if (instagramHandle !== undefined) data.instagramHandle = instagramHandle;
  if (facebookUrl !== undefined) data.facebookUrl = facebookUrl;
  if (heroSubtitle !== undefined) data.heroSubtitle = heroSubtitle;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (theme !== undefined) data.theme = theme;

  const settings = await SiteSettings.upsert(req.admin.id, data);
  res.json({
    bio: settings.bio,
    phone: settings.phone,
    instagramHandle: settings.instagramHandle,
    facebookUrl: settings.facebookUrl,
    heroSubtitle: settings.heroSubtitle,
    contactEmail: settings.contactEmail,
    theme: settings.theme,
  });
}));

// POST /api/settings/hero-image  — ADMIN
router.post('/hero-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });
  const heroImagePath = `/uploads/${req.file.filename}`;
  await SiteSettings.upsert(req.admin.id, { heroImagePath });
  res.json({ heroImagePath });
}));

// POST /api/settings/profile-image  — ADMIN
router.post('/profile-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });
  const profileImagePath = `/uploads/${req.file.filename}`;
  await SiteSettings.upsert(req.admin.id, { profileImagePath });
  res.json({ profileImagePath });
}));

module.exports = router;
