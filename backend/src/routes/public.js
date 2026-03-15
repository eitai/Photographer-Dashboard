const express = require('express');
const Admin = require('../models/Admin');
const BlogPost = require('../models/BlogPost');
const SiteSettings = require('../models/SiteSettings');
const ContactSubmission = require('../models/ContactSubmission');
const asyncHandler = require('../middleware/asyncHandler');

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
  const { _id, name, studioName, username } = req.photographerAdmin;
  res.json({ id: _id, name, studioName, username });
});

// GET /api/p/:id/settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ adminId: req.photographerAdmin._id }).populate('featuredImageIds');
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
  const posts = await BlogPost.find({ adminId: req.photographerAdmin._id, published: true })
    .select('-content')
    .sort({ publishedAt: -1, createdAt: -1 });
  res.json(posts);
}));

// GET /api/p/:id/blog/:slug
router.get('/blog/:slug', asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({
    adminId: req.photographerAdmin._id,
    slug: req.params.slug,
    published: true,
  });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
}));

// POST /api/p/:id/contact
router.post('/contact', asyncHandler(async (req, res) => {
  const { name, phone, email, sessionType, message } = req.body;
  const submission = await ContactSubmission.create({
    name, phone, email, sessionType, message,
    adminId: req.photographerAdmin._id,
  });
  res.status(201).json({ message: 'Message received', id: submission._id });
}));

module.exports = router;
