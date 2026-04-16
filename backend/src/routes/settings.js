const express = require('express');
const fs = require('fs');
const SiteSettings = require('../models/SiteSettings');
const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');
const { protect } = require('../middleware/auth');
const { uploadImage: upload, validateImageMagicBytes } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const replaceUploadedFile = require('../utils/replaceUploadedFile');
const s3 = require('../config/s3');

const UPLOADS_DIR = require('path').join(__dirname, '../../uploads');

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
    heroOverlayOpacity: settings?.heroOverlayOpacity || 'medium',
    heroCtaPrimaryLabel: settings?.heroCtaPrimaryLabel || '',
    heroCtaSecondaryLabel: settings?.heroCtaSecondaryLabel || '',
    aboutSectionTitle: settings?.aboutSectionTitle || '',
    tiktokUrl: settings?.tiktokUrl || '',
    videoUrl: settings?.videoUrl || '',
    videoSectionHeading: settings?.videoSectionHeading || '',
    videoSectionSubheading: settings?.videoSectionSubheading || '',
    videoSectionEnabled: settings?.videoSectionEnabled || false,
    ctaBannerHeading: settings?.ctaBannerHeading || '',
    ctaBannerSubtext: settings?.ctaBannerSubtext || '',
    ctaBannerButtonLabel: settings?.ctaBannerButtonLabel || '',
    ctaBannerEnabled: settings?.ctaBannerEnabled || false,
    servicesEnabled: settings?.servicesEnabled || false,
    services: settings?.services || [],
    testimonialsEnabled: settings?.testimonialsEnabled || false,
    testimonials: settings?.testimonials || [],
    packagesEnabled: settings?.packagesEnabled || false,
    packages: settings?.packages || [],
    packagesDisclaimer: settings?.packagesDisclaimer || '',
    instagramFeedEnabled: settings?.instagramFeedEnabled || false,
    instagramFeedImages: settings?.instagramFeedImages || [],
    autoSendGalleryEmail: settings?.autoSendGalleryEmail ?? true,
    autoSendGallerySms: settings?.autoSendGallerySms ?? false,
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
  const {
    bio, phone, instagramHandle, facebookUrl, heroSubtitle, contactEmail, theme,
    heroOverlayOpacity, heroCtaPrimaryLabel, heroCtaSecondaryLabel, aboutSectionTitle, tiktokUrl,
  } = req.body;
  const data = {};
  if (bio !== undefined) data.bio = bio;
  if (phone !== undefined) data.phone = phone;
  if (instagramHandle !== undefined) data.instagramHandle = instagramHandle;
  if (facebookUrl !== undefined) data.facebookUrl = facebookUrl;
  if (heroSubtitle !== undefined) data.heroSubtitle = heroSubtitle;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (theme !== undefined) data.theme = theme;
  if (heroOverlayOpacity !== undefined) data.heroOverlayOpacity = heroOverlayOpacity;
  if (heroCtaPrimaryLabel !== undefined) data.heroCtaPrimaryLabel = heroCtaPrimaryLabel;
  if (heroCtaSecondaryLabel !== undefined) data.heroCtaSecondaryLabel = heroCtaSecondaryLabel;
  if (aboutSectionTitle !== undefined) data.aboutSectionTitle = aboutSectionTitle;
  if (tiktokUrl !== undefined) data.tiktokUrl = tiktokUrl;

  const settings = await SiteSettings.upsert(req.admin.id, data);
  res.json({
    bio: settings.bio,
    phone: settings.phone,
    instagramHandle: settings.instagramHandle,
    facebookUrl: settings.facebookUrl,
    heroSubtitle: settings.heroSubtitle,
    contactEmail: settings.contactEmail,
    theme: settings.theme,
    heroOverlayOpacity: settings.heroOverlayOpacity,
    heroCtaPrimaryLabel: settings.heroCtaPrimaryLabel,
    heroCtaSecondaryLabel: settings.heroCtaSecondaryLabel,
    aboutSectionTitle: settings.aboutSectionTitle,
    tiktokUrl: settings.tiktokUrl,
  });
}));

// PUT /api/settings/services  — ADMIN
router.put('/services', protect, asyncHandler(async (req, res) => {
  const { enabled, items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ message: 'items must be an array' });
  }
  if (items.length > 8) {
    return res.status(400).json({ message: 'Maximum 8 service items allowed' });
  }

  const settings = await SiteSettings.upsert(req.admin.id, {
    servicesEnabled: !!enabled,
    services: items,
  });
  res.json({
    servicesEnabled: settings.servicesEnabled,
    services: settings.services,
  });
}));

// PUT /api/settings/testimonials  — ADMIN
router.put('/testimonials', protect, asyncHandler(async (req, res) => {
  const { enabled, items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ message: 'items must be an array' });
  }
  if (items.length > 12) {
    return res.status(400).json({ message: 'Maximum 12 testimonial items allowed' });
  }

  const settings = await SiteSettings.upsert(req.admin.id, {
    testimonialsEnabled: !!enabled,
    testimonials: items,
  });
  res.json({
    testimonialsEnabled: settings.testimonialsEnabled,
    testimonials: settings.testimonials,
  });
}));

// PUT /api/settings/packages  — ADMIN
router.put('/packages', protect, asyncHandler(async (req, res) => {
  const { enabled, items, disclaimer } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ message: 'items must be an array' });
  }
  if (items.length > 4) {
    return res.status(400).json({ message: 'Maximum 4 package items allowed' });
  }

  const settings = await SiteSettings.upsert(req.admin.id, {
    packagesEnabled: !!enabled,
    packages: items,
    packagesDisclaimer: disclaimer !== undefined ? String(disclaimer) : '',
  });
  res.json({
    packagesEnabled: settings.packagesEnabled,
    packages: settings.packages,
    packagesDisclaimer: settings.packagesDisclaimer,
  });
}));

// PUT /api/settings/video  — ADMIN
router.put('/video', protect, asyncHandler(async (req, res) => {
  const { enabled, url, heading, subheading } = req.body;

  if (url) {
    const isValidVideoUrl =
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/.test(url);
    if (!isValidVideoUrl) {
      return res.status(400).json({ message: 'url must be a YouTube or Vimeo URL' });
    }
  }

  const settings = await SiteSettings.upsert(req.admin.id, {
    videoSectionEnabled: !!enabled,
    videoUrl: url !== undefined ? String(url) : '',
    videoSectionHeading: heading !== undefined ? String(heading) : '',
    videoSectionSubheading: subheading !== undefined ? String(subheading) : '',
  });
  res.json({
    videoSectionEnabled: settings.videoSectionEnabled,
    videoUrl: settings.videoUrl,
    videoSectionHeading: settings.videoSectionHeading,
    videoSectionSubheading: settings.videoSectionSubheading,
  });
}));

// PUT /api/settings/cta-banner  — ADMIN
router.put('/cta-banner', protect, asyncHandler(async (req, res) => {
  const { enabled, heading, subtext, buttonLabel } = req.body;

  const settings = await SiteSettings.upsert(req.admin.id, {
    ctaBannerEnabled: !!enabled,
    ctaBannerHeading: heading !== undefined ? String(heading) : '',
    ctaBannerSubtext: subtext !== undefined ? String(subtext) : '',
    ctaBannerButtonLabel: buttonLabel !== undefined ? String(buttonLabel) : '',
  });
  res.json({
    ctaBannerEnabled: settings.ctaBannerEnabled,
    ctaBannerHeading: settings.ctaBannerHeading,
    ctaBannerSubtext: settings.ctaBannerSubtext,
    ctaBannerButtonLabel: settings.ctaBannerButtonLabel,
  });
}));

// PUT /api/settings/instagram-feed  — ADMIN (toggle enabled + reorder)
router.put('/instagram-feed', protect, asyncHandler(async (req, res) => {
  const { enabled, images } = req.body;
  const data = { instagramFeedEnabled: !!enabled };
  if (Array.isArray(images)) {
    if (images.length > 9) return res.status(400).json({ message: 'Maximum 9 Instagram feed images allowed' });
    data.instagramFeedImages = images.filter((p) => typeof p === 'string');
  }
  const settings = await SiteSettings.upsert(req.admin.id, data);
  res.json({
    instagramFeedEnabled: settings.instagramFeedEnabled,
    instagramFeedImages: settings.instagramFeedImages || [],
  });
}));

// POST /api/settings/instagram-feed-image  — ADMIN (upload one image, append to array)
router.post('/instagram-feed-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });

  const existing = await SiteSettings.findOne({ adminId: req.admin.id });
  const current = existing?.instagramFeedImages || [];
  if (current.length >= 9) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: 'Maximum 9 Instagram feed images allowed' });
  }

  const newPath = await s3.processUpload(req.file, req.admin.id);
  const updated = [...current, newPath];
  const settings = await SiteSettings.upsert(req.admin.id, { instagramFeedImages: updated });
  res.json({ instagramFeedImages: settings.instagramFeedImages || [] });
}));

// DELETE /api/settings/instagram-feed-image/:index  — ADMIN (remove one image by index)
router.delete('/instagram-feed-image/:index', protect, asyncHandler(async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0) return res.status(400).json({ message: 'Invalid index' });

  const existing = await SiteSettings.findOne({ adminId: req.admin.id });
  const current = existing?.instagramFeedImages || [];
  if (idx >= current.length) return res.status(404).json({ message: 'Image not found' });

  const removedPath = current[idx];
  const updated = current.filter((_, i) => i !== idx);
  await SiteSettings.upsert(req.admin.id, { instagramFeedImages: updated });

  // Delete the file from S3 or local disk
  await s3.deleteUpload(removedPath, UPLOADS_DIR);

  res.json({ instagramFeedImages: updated });
}));

// PUT /api/settings/notifications  — ADMIN
router.put('/notifications', protect, asyncHandler(async (req, res) => {
  const { autoSendGalleryEmail, autoSendGallerySms } = req.body;
  const data = {};
  if (autoSendGalleryEmail !== undefined) data.autoSendGalleryEmail = autoSendGalleryEmail !== false;
  if (autoSendGallerySms !== undefined) data.autoSendGallerySms = !!autoSendGallerySms;
  const settings = await SiteSettings.upsert(req.admin.id, data);
  res.json({
    autoSendGalleryEmail: settings.autoSendGalleryEmail ?? true,
    autoSendGallerySms: settings.autoSendGallerySms ?? false,
  });
}));

// POST /api/settings/hero-image  — ADMIN
router.post('/hero-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });
  const heroImagePath = await replaceUploadedFile(req.admin.id, 'heroImagePath', await s3.processUpload(req.file, req.admin.id), { SiteSettings, fs });
  res.json({ heroImagePath });
}));

// POST /api/settings/profile-image  — ADMIN
router.post('/profile-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });
  const profileImagePath = await replaceUploadedFile(req.admin.id, 'profileImagePath', await s3.processUpload(req.file), { SiteSettings, fs });
  res.json({ profileImagePath });
}));

module.exports = router;
