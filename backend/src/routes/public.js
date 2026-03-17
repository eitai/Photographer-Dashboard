const express = require('express');
const Admin = require('../models/Admin');
const BlogPost = require('../models/BlogPost');
const SiteSettings = require('../models/SiteSettings');
const ContactSubmission = require('../models/ContactSubmission');
const asyncHandler = require('../middleware/asyncHandler');
const validateContact = require('../utils/validateContact');

const router = express.Router({ mergeParams: true });

// Middleware: resolve admin from :id param
router.use(asyncHandler(async (req, res, next) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ message: 'Photographer not found' });
  req.photographerAdmin = admin;
  next();
}));

// GET /api/p/:id
router.get('/', (req, res) => {
  const { id, name, studioName, username } = req.photographerAdmin;
  res.json({ id, name, studioName, username });
});

// GET /api/p/:id/settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne(
    { adminId: req.photographerAdmin.id },
    { populate: true }
  );
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

// GET /api/p/:id/blog
router.get('/blog', asyncHandler(async (req, res) => {
  const posts = await BlogPost.find(
    { adminId: req.photographerAdmin.id, published: true },
    { selectContent: false }
  );
  res.json(posts);
}));

// GET /api/p/:id/blog/:slug
router.get('/blog/:slug', asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({
    adminId: req.photographerAdmin.id,
    slug: req.params.slug,
    published: true,
  });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
}));

// POST /api/p/:id/contact
router.post('/contact', asyncHandler(async (req, res) => {
  const { name, phone, email, sessionType, message } = req.body;
  const err = validateContact({ name, phone, email, sessionType, message });
  if (err) return res.status(400).json({ message: err });

  const submission = await ContactSubmission.create({
    name, phone, email, sessionType, message,
    adminId: req.photographerAdmin.id,
  });
  res.status(201).json({ message: 'Message received', id: submission.id });
}));

module.exports = router;
