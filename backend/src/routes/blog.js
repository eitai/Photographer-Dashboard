const express = require('express');
const BlogPost = require('../models/BlogPost');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/blog  — ADMIN only (all posts for this admin)
router.get('/', protect, async (req, res) => {
  const posts = await BlogPost.find({ adminId: req.admin._id })
    .select('-content')
    .sort({ publishedAt: -1, createdAt: -1 });
  res.json(posts);
});

// GET /api/blog/:id  — ADMIN
router.get('/:id', protect, async (req, res) => {
  const post = await BlogPost.findOne({ _id: req.params.id, adminId: req.admin._id });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

// POST /api/blog  — ADMIN
router.post('/', protect, upload.single('featuredImage'), async (req, res) => {
  const data = { ...req.body, adminId: req.admin._id };
  if (req.file) data.featuredImagePath = `/uploads/${req.file.filename}`;
  const post = await BlogPost.create(data);
  res.status(201).json(post);
});

// PUT /api/blog/:id  — ADMIN
router.put('/:id', protect, upload.single('featuredImage'), async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.featuredImagePath = `/uploads/${req.file.filename}`;
  const post = await BlogPost.findOneAndUpdate({ _id: req.params.id, adminId: req.admin._id }, data, { new: true, runValidators: true });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
});

// DELETE /api/blog/:id  — ADMIN
router.delete('/:id', protect, async (req, res) => {
  await BlogPost.findOneAndDelete({ _id: req.params.id, adminId: req.admin._id });
  res.json({ message: 'Post deleted' });
});

module.exports = router;
