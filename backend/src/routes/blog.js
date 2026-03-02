const express = require('express');
const BlogPost = require('../models/BlogPost');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/blog  — PUBLIC (only published)
router.get('/', async (req, res) => {
  const { admin } = req.query;
  const filter = admin ? {} : { published: true };
  const posts = await BlogPost.find(filter)
    .select('-content')
    .sort({ publishedAt: -1, createdAt: -1 });
  res.json(posts);
});

// GET /api/blog/slug/:slug  — PUBLIC
router.get('/slug/:slug', async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, published: true });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

// GET /api/blog/:id  — ADMIN
router.get('/:id', protect, async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

// POST /api/blog  — ADMIN
router.post('/', protect, upload.single('featuredImage'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.featuredImagePath = `/uploads/${req.file.filename}`;
  const post = await BlogPost.create(data);
  res.status(201).json(post);
});

// PUT /api/blog/:id  — ADMIN
router.put('/:id', protect, upload.single('featuredImage'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.featuredImagePath = `/uploads/${req.file.filename}`;
  const post = await BlogPost.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

// DELETE /api/blog/:id  — ADMIN
router.delete('/:id', protect, async (req, res) => {
  await BlogPost.findByIdAndDelete(req.params.id);
  res.json({ message: 'Post deleted' });
});

module.exports = router;
