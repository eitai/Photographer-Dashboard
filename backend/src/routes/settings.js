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
    logoImagePath: settings?.logoImagePath || '',
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
    ctaBannerImagePath: settings?.ctaBannerImagePath || '',
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
    contactSectionEnabled: settings?.contactSectionEnabled ?? true,
    contactSectionHeading: settings?.contactSectionHeading || '',
    contactSectionSubheading: settings?.contactSectionSubheading || '',
    heroTagline: settings?.heroTagline || '',
    statsEnabled: settings?.statsEnabled ?? true,
    stats: settings?.stats || [],
    promisesEnabled: settings?.promisesEnabled ?? true,
    promises: settings?.promises || [],
    faqEnabled: settings?.faqEnabled ?? true,
    faqItems: settings?.faqItems || [],
    finalCtaHeading: settings?.finalCtaHeading || '',
    finalCtaSubtext: settings?.finalCtaSubtext || '',
    finalCtaButtonLabel: settings?.finalCtaButtonLabel || '',
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
    heroTagline, finalCtaHeading, finalCtaSubtext, finalCtaButtonLabel,
  } = req.body;
  const data = {};
  if (bio !== undefined) data.bio = String(bio).slice(0, 800);
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
  if (heroTagline !== undefined) data.heroTagline = String(heroTagline).slice(0, 200);
  if (finalCtaHeading !== undefined) data.finalCtaHeading = String(finalCtaHeading).slice(0, 120);
  if (finalCtaSubtext !== undefined) data.finalCtaSubtext = String(finalCtaSubtext).slice(0, 300);
  if (finalCtaButtonLabel !== undefined) data.finalCtaButtonLabel = String(finalCtaButtonLabel).slice(0, 60);

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
    heroTagline: settings.heroTagline || '',
    finalCtaHeading: settings.finalCtaHeading || '',
    finalCtaSubtext: settings.finalCtaSubtext || '',
    finalCtaButtonLabel: settings.finalCtaButtonLabel || '',
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

// PUT /api/settings/stats  — ADMIN
router.put('/stats', protect, asyncHandler(async (req, res) => {
  const { enabled, items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ message: 'items must be an array' });
  if (items.length > 4) return res.status(400).json({ message: 'Maximum 4 stat items allowed' });

  const settings = await SiteSettings.upsert(req.admin.id, {
    statsEnabled: !!enabled,
    stats: items,
  });
  res.json({ statsEnabled: settings.statsEnabled, stats: settings.stats });
}));

// PUT /api/settings/promises  — ADMIN
router.put('/promises', protect, asyncHandler(async (req, res) => {
  const { enabled, items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ message: 'items must be an array' });
  if (items.length > 4) return res.status(400).json({ message: 'Maximum 4 promise items allowed' });

  const settings = await SiteSettings.upsert(req.admin.id, {
    promisesEnabled: !!enabled,
    promises: items,
  });
  res.json({ promisesEnabled: settings.promisesEnabled, promises: settings.promises });
}));

// PUT /api/settings/faq  — ADMIN
router.put('/faq', protect, asyncHandler(async (req, res) => {
  const { enabled, items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ message: 'items must be an array' });
  if (items.length > 10) return res.status(400).json({ message: 'Maximum 10 FAQ items allowed' });

  const settings = await SiteSettings.upsert(req.admin.id, {
    faqEnabled: !!enabled,
    faqItems: items,
  });
  res.json({ faqEnabled: settings.faqEnabled, faqItems: settings.faqItems });
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
    ctaBannerImagePath: settings.ctaBannerImagePath || '',
  });
}));

// PUT /api/settings/contact-section  — ADMIN
router.put('/contact-section', protect, asyncHandler(async (req, res) => {
  const { enabled, heading, subheading } = req.body;

  if (heading !== undefined && String(heading).length > 120) {
    return res.status(400).json({ message: 'heading must be 120 characters or fewer' });
  }
  if (subheading !== undefined && String(subheading).length > 300) {
    return res.status(400).json({ message: 'subheading must be 300 characters or fewer' });
  }

  const settings = await SiteSettings.upsert(req.admin.id, {
    contactSectionEnabled: enabled !== false,
    contactSectionHeading: heading !== undefined ? String(heading) : '',
    contactSectionSubheading: subheading !== undefined ? String(subheading) : '',
  });
  res.json({
    contactSectionEnabled: settings.contactSectionEnabled,
    contactSectionHeading: settings.contactSectionHeading,
    contactSectionSubheading: settings.contactSectionSubheading,
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

  const newPath = await s3.processUploadAsWebP(req.file, req.admin.id);
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
  const heroImagePath = await replaceUploadedFile(req.admin.id, 'heroImagePath', await s3.processUploadAsWebP(req.file, req.admin.id), { SiteSettings, fs });
  res.json({ heroImagePath });
}));

// POST /api/settings/profile-image  — ADMIN
router.post('/profile-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });
  const profileImagePath = await replaceUploadedFile(req.admin.id, 'profileImagePath', await s3.processUploadAsWebP(req.file, req.admin.id), { SiteSettings, fs });
  res.json({ profileImagePath });
}));

// POST /api/settings/logo-image  — ADMIN
router.post('/logo-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });
  const logoImagePath = await replaceUploadedFile(req.admin.id, 'logoImagePath', await s3.processUploadAsWebP(req.file, req.admin.id), { SiteSettings, fs });
  res.json({ logoImagePath });
}));

// DELETE /api/settings/logo-image  — ADMIN
router.delete('/logo-image', protect, asyncHandler(async (req, res) => {
  const existing = await SiteSettings.findOne({ adminId: req.admin.id });
  if (existing?.logoImagePath) {
    await s3.deleteUpload(existing.logoImagePath, UPLOADS_DIR);
  }
  await SiteSettings.upsert(req.admin.id, { logoImagePath: '' });
  res.json({ logoImagePath: '' });
}));

// POST /api/settings/cta-banner-image  — ADMIN
router.post('/cta-banner-image', protect, upload.single('image'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image provided' });
  const ctaBannerImagePath = await replaceUploadedFile(req.admin.id, 'ctaBannerImagePath', await s3.processUploadAsWebP(req.file, req.admin.id), { SiteSettings, fs });
  res.json({ ctaBannerImagePath });
}));

// DELETE /api/settings/cta-banner-image  — ADMIN
router.delete('/cta-banner-image', protect, asyncHandler(async (req, res) => {
  const existing = await SiteSettings.findOne({ adminId: req.admin.id });
  if (existing?.ctaBannerImagePath) {
    await s3.deleteUpload(existing.ctaBannerImagePath, UPLOADS_DIR);
  }
  await SiteSettings.upsert(req.admin.id, { ctaBannerImagePath: '' });
  res.json({ ctaBannerImagePath: '' });
}));

module.exports = router;
