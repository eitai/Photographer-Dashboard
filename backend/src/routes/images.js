const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const GalleryImage = require('../models/GalleryImage');
const Gallery = require('../models/Gallery');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const THUMB_DIR = path.join(__dirname, '../../uploads/thumbnails');
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });

// GET /api/galleries/:galleryId/images  — PUBLIC
router.get('/', async (req, res) => {
  const images = await GalleryImage.find({ galleryId: req.params.galleryId }).sort({ sortOrder: 1, createdAt: 1 });
  res.json(images);
});

// POST /api/galleries/:galleryId/images  — ADMIN
router.post('/', protect, upload.array('images', 1000), async (req, res) => {
  const { galleryId } = req.params;
  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const imageDocs = await Promise.all(
    req.files.map(async (file, i) => {
      const thumbFilename = `thumb_${path.parse(file.filename).name}.jpg`;
      let thumbnailPath;
      try {
        await sharp(file.path)
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 78 })
          .toFile(path.join(THUMB_DIR, thumbFilename));
        thumbnailPath = `/uploads/thumbnails/${thumbFilename}`;
      } catch {
        // thumbnail generation failed — fall back to original
      }
      return {
        galleryId,
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/${file.filename}`,
        thumbnailPath,
        sortOrder: i,
      };
    })
  );

  const created = await GalleryImage.insertMany(imageDocs);
  res.status(201).json(created);
});

// DELETE /api/galleries/:galleryId/images/:imageId  — ADMIN
router.delete('/:imageId', protect, async (req, res) => {
  const image = await GalleryImage.findById(req.params.imageId);
  if (!image) return res.status(404).json({ message: 'Image not found' });

  const filePath = path.join(__dirname, '../../uploads', image.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (image.thumbnailPath) {
    const thumbPath = path.join(THUMB_DIR, path.basename(image.thumbnailPath));
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  await GalleryImage.findByIdAndDelete(req.params.imageId);
  res.json({ message: 'Image deleted' });
});

module.exports = router;
