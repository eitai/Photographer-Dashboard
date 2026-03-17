const express = require('express');
const BlogPost = require('../models/BlogPost');
const { uploadImage: upload, validateImageMagicBytes } = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/blog  — ADMIN
router.get('/', protect, asyncHandler(async (req, res) => {
  const posts = await BlogPost.find({ adminId: req.admin._id })
    .select('-content')
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(200);
  res.json(posts);
}));

// GET /api/blog/:id  — ADMIN
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ _id: req.params.id, adminId: req.admin._id });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
}));

// POST /api/blog  — ADMIN
router.post('/', protect, upload.single('featuredImage'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  const { title, content, seoTitle, seoDescription, category, published, publishedAt } = req.body;
  const data = { title, content, seoTitle, seoDescription, category, published, publishedAt, adminId: req.admin._id };
  if (req.file) data.featuredImagePath = `/uploads/${req.file.filename}`;
  const post = await BlogPost.create(data);
  res.status(201).json(post);
}));

// PUT /api/blog/:id  — ADMIN
router.put('/:id', protect, upload.single('featuredImage'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  const { title, content, seoTitle, seoDescription, category, published, publishedAt } = req.body;
  const data = { title, content, seoTitle, seoDescription, category, published, publishedAt };
  if (req.file) data.featuredImagePath = `/uploads/${req.file.filename}`;
  const post = await BlogPost.findOneAndUpdate(
    { _id: req.params.id, adminId: req.admin._id },
    data,
    { new: true, runValidators: true }
  );
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json(post);
}));

// DELETE /api/blog/:id  — ADMIN
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const post = await BlogPost.findOneAndDelete({ _id: req.params.id, adminId: req.admin._id });
  if (!post) return res.status(404).json({ message: 'Post not found' });
  res.json({ message: 'Post deleted' });
}));

module.exports = router;
