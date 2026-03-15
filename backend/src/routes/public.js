const express = require('express');
const Admin = require('../models/Admin');
const BlogPost = require('../models/BlogPost');
const SiteSettings = require('../models/SiteSettings');
const ContactSubmission = require('../models/ContactSubmission');

const router = express.Router({ mergeParams: true });

// Middleware: resolve admin from :id
router.use(async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Photographer not found' });
    req.photographerAdmin = admin;
    next();
  } catch {
    return res.status(404).json({ message: 'Photographer not found' });
  }
});

// GET /api/p/:username  — Photographer profile info
router.get('/', (req, res) => {
  const { _id, name, studioName, username } = req.photographerAdmin;
  res.json({ id: _id, name, studioName, username });
});

// GET /api/p/:username/settings  — Public photographer settings
router.get('/settings', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/p/:username/blog  — Published blog posts
router.get('/blog', async (req, res) => {
  const posts = await BlogPost.find({ adminId: req.photographerAdmin._id, published: true })
    .select('-content')
    .sort({ publishedAt: -1, createdAt: -1 });
  res.json(posts);
});

// GET /api/p/:username/blog/:slug  — Single post by slug
router.get('/blog/:slug', async (req, res) => {
  const post = await BlogPost.findOne({
    adminId: req.photographerAdmin._id,
    slug: req.params.slug,
    published: true,
  });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

// POST /api/p/:username/contact  — Submit contact form
router.post('/contact', async (req, res) => {
  const submission = await ContactSubmission.create({
    ...req.body,
    adminId: req.photographerAdmin._id,
  });
  res.status(201).json({ message: 'Message received', id: submission._id });
});

module.exports = router;
