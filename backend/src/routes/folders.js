const express = require('express');
const GalleryFolder = require('../models/GalleryFolder');
const Gallery = require('../models/Gallery');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');

const router = express.Router({ mergeParams: true });

// GET /api/galleries/:galleryId/folders  — PUBLIC (client viewer needs folder names)
router.get('/', asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  if (!UUID_RE.test(galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID format' });

  const folders = await GalleryFolder.findByGalleryId(galleryId);
  res.json(folders);
}));

// POST /api/galleries/:galleryId/folders  — ADMIN
router.post('/', protect, asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  if (!UUID_RE.test(galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID format' });

  const { name } = req.body;
  if (!name || !name.trim())
    return res.status(400).json({ message: 'Folder name is required' });

  const gallery = await Gallery.findOne({ _id: galleryId, adminId: req.admin.id });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const existing = await GalleryFolder.findByGalleryId(galleryId);
  const folder = await GalleryFolder.create({
    galleryId,
    name: name.trim(),
    sortOrder: existing.length,
  });
  res.status(201).json(folder);
}));

// PATCH /api/galleries/:galleryId/folders/:folderId  — ADMIN
router.patch('/:folderId', protect, asyncHandler(async (req, res) => {
  const { folderId } = req.params;
  if (!UUID_RE.test(folderId))
    return res.status(400).json({ message: 'Invalid folder ID format' });

  const { name, sortOrder } = req.body;
  if (name !== undefined && !name.trim())
    return res.status(400).json({ message: 'Folder name cannot be empty' });

  const folder = await GalleryFolder.findByIdAndUpdate(folderId, req.admin.id, {
    name: name !== undefined ? name.trim() : undefined,
    sortOrder,
  });
  if (!folder) return res.status(404).json({ message: 'Folder not found' });
  res.json(folder);
}));

// DELETE /api/galleries/:galleryId/folders/:folderId  — ADMIN
router.delete('/:folderId', protect, asyncHandler(async (req, res) => {
  const { folderId } = req.params;
  if (!UUID_RE.test(folderId))
    return res.status(400).json({ message: 'Invalid folder ID format' });

  const deleted = await GalleryFolder.findByIdAndDelete(folderId, req.admin.id);
  if (!deleted) return res.status(404).json({ message: 'Folder not found' });
  res.json({ message: 'Folder deleted' });
}));

module.exports = router;
