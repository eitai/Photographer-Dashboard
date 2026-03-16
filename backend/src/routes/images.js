const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const GalleryImage = require('../models/GalleryImage');
const Gallery = require('../models/Gallery');
const GallerySubmission = require('../models/GallerySubmission');
const { uploadImage: upload } = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const checkQuota = require('../middleware/checkQuota');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

const router = express.Router({ mergeParams: true });

const THUMB_DIR = path.join(__dirname, '../../uploads/thumbnails');
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });

// GET /api/galleries/:galleryId/images  — PUBLIC
// Optional: ?page=1&limit=50 for paginated response { images, total, page, totalPages }
// Without limit param: returns plain array (backwards compatible)
router.get('/', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const filter = { galleryId: req.params.galleryId };
  const sort = { sortOrder: 1, createdAt: 1 };

  if (limit > 0) {
    const [images, total] = await Promise.all([
      GalleryImage.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      GalleryImage.countDocuments(filter),
    ]);
    return res.json({ images, total, page, totalPages: Math.ceil(total / limit) });
  }

  const images = await GalleryImage.find(filter).sort(sort);
  res.json(images);
}));

// POST /api/galleries/:galleryId/images  — ADMIN
router.post('/', protect, checkQuota, upload.array('images', 1000), asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (gallery.adminId.toString() !== req.admin._id.toString())
    return res.status(403).json({ message: 'Forbidden' });

  // Build a map of originalImageId -> originalImage for delivery galleries
  let selectedImageMap = {};
  if (gallery.isDelivery && gallery.deliveryOf) {
    const submissions = await GallerySubmission.find({ galleryId: gallery.deliveryOf });
    const selectedIds = [...new Set(submissions.flatMap((s) => s.selectedImageIds.map((id) => id.toString())))];
    const originalImages = await GalleryImage.find({ _id: { $in: selectedIds } });
    selectedImageMap = Object.fromEntries(originalImages.map((img) => [img._id.toString(), img]));
  }

  const imageDocs = await Promise.all(
    req.files.map(async (file, i) => {
      const thumbFilename = `thumb_${path.parse(file.filename).name}.jpg`;
      let thumbnailPath;
      try {
        await sharp(file.path)
          .withMetadata(false)           // strip EXIF (GPS, camera info)
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 78 })
          .toFile(path.join(THUMB_DIR, thumbFilename));
        thumbnailPath = `/uploads/thumbnails/${thumbFilename}`;
      } catch (thumbErr) {
        logger.warn(`Thumbnail generation failed for ${file.filename}: ${thumbErr.message}`);
        // fall back to original — non-fatal
      }
      const nameWithoutExt = path.parse(file.originalname).name;
      const matchedOriginal = selectedImageMap[nameWithoutExt];

      return {
        galleryId,
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/${file.filename}`,
        thumbnailPath,
        beforePath: matchedOriginal ? matchedOriginal.path : undefined,
        sortOrder: i,
        size: file.size,
      };
    })
  );

  const created = await GalleryImage.insertMany(imageDocs);
  res.status(201).json(created);
}));

// PATCH /api/galleries/:galleryId/images/:imageId/before  — ADMIN
router.patch('/:imageId/before', protect, upload.single('before'), asyncHandler(async (req, res) => {
  const image = await GalleryImage.findById(req.params.imageId);
  if (!image) return res.status(404).json({ message: 'Image not found' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  // Delete old before file if exists
  if (image.beforePath) {
    const oldFilename = path.basename(image.beforePath);
    const oldFilePath = path.join(__dirname, '../../uploads', oldFilename);
    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
  }

  image.beforePath = `/uploads/${req.file.filename}`;
  await image.save();
  res.json(image);
}));

// DELETE /api/galleries/:galleryId/images/:imageId  — ADMIN
router.delete('/:imageId', protect, asyncHandler(async (req, res) => {
  const image = await GalleryImage.findById(req.params.imageId);
  if (!image) return res.status(404).json({ message: 'Image not found' });
  const gallery = await Gallery.findOne({ _id: image.galleryId, adminId: req.admin._id });
  if (!gallery) return res.status(403).json({ message: 'Forbidden' });

  const filePath = path.join(__dirname, '../../uploads', image.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (image.thumbnailPath) {
    const thumbPath = path.join(THUMB_DIR, path.basename(image.thumbnailPath));
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  await GalleryImage.findByIdAndDelete(req.params.imageId);
  res.json({ message: 'Image deleted' });
}));

module.exports = router;
