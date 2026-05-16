const express = require('express');
const path = require('path');
const fs = require('fs');
const pLimit = require('p-limit');
const sharp = require('sharp');
const GalleryImage = require('../models/GalleryImage');
const Gallery = require('../models/Gallery');
const GallerySubmission = require('../models/GallerySubmission');
const { uploadImage: upload, validateImageMagicBytes } = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const checkQuota = require('../middleware/checkQuota');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { UUID_RE } = require('../utils/uuid');
const s3 = require('../config/s3');
const { getQueue, JOB_NAMES } = require('../queue');
const pool = require('../db');

const router = express.Router({ mergeParams: true });

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const THUMB_DIR   = path.join(__dirname, '../../uploads/thumbnails');
const PREVIEW_DIR = path.join(__dirname, '../../uploads/previews');
if (!fs.existsSync(THUMB_DIR))   fs.mkdirSync(THUMB_DIR,   { recursive: true });
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

// GET /api/galleries/:galleryId/images  — PUBLIC
// Optional: ?page=1&limit=50 for paginated response { images, total, page, totalPages }
// Without limit param: returns plain array (backwards compatible)
router.get('/', asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit);
  const rawPage = parseInt(req.query.page);
  // Cap limit at 200 to prevent excessive result sets; require positive values
  const limit = rawLimit > 0 ? Math.min(rawLimit, 200) : NaN;
  const page = rawPage >= 1 ? rawPage : 1;
  const filter = { galleryId: req.params.galleryId };

  if (req.query.folderId && UUID_RE.test(req.query.folderId)) {
    filter.folderId = req.query.folderId;
  }

  if (!isNaN(limit)) {
    const { images, total } = await GalleryImage.findPaginated(filter, {}, (page - 1) * limit, limit);
    return res.json({ images, total, page, totalPages: Math.ceil(total / limit) });
  }

  const images = await GalleryImage.find(filter);
  res.json(images);
}));

// POST /api/galleries/:galleryId/images  — ADMIN
router.post('/', protect, checkQuota, upload.array('images', 5000), validateImageMagicBytes, asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  if (!UUID_RE.test(galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID format' });

  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (gallery.adminId !== req.admin.id)
    return res.status(403).json({ message: 'Forbidden' });

  // Build a map of originalImageId -> originalImage for delivery galleries
  let selectedImageMap = {};
  if (gallery.isDelivery && gallery.deliveryOf) {
    const submissions = await GallerySubmission.find({ galleryId: gallery.deliveryOf });
    const selectedIds = [
      ...new Set(submissions.flatMap((s) => (s.selectedImageIds || []).map((id) => id.toString()))),
    ];
    const originalImages = selectedIds.length
      ? await GalleryImage.find({ _id: { $in: selectedIds } })
      : [];
    selectedImageMap = Object.fromEntries(originalImages.map((img) => [path.parse(img.filename).name, img]));
  }

  const limit = pLimit(5);
  const imageDocs = await Promise.all(
    req.files.map((file, i) => limit(async () => {
      const thumbFilename = `thumb_${path.parse(file.filename).name}.jpg`;

      // Generate thumbnail and preview buffers from the local temp file before
      // processUpload deletes it. Both Sharp operations read the same source path.
      const [thumbBuffer, previewBuffer] = await Promise.all([
        sharp(file.path)
          .withMetadata(false)
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 78 })
          .toBuffer(),
        s3.generatePreview(file.path),
      ]);

      const previewBasename = path.parse(file.filename).name;
      const previewFilename = `${previewBasename}.webp`;

      // Store the preview buffer (S3 or local disk fallback).
      // Buffers are already in memory so processUpload can safely unlink the temp file.
      async function storePreview() {
        if (s3.isEnabled()) {
          return s3.uploadBuffer(
            previewBuffer,
            `admins/${req.admin.id}/previews/${previewFilename}`,
            'image/webp'
          );
        }
        fs.writeFileSync(path.join(PREVIEW_DIR, previewFilename), previewBuffer);
        return `/uploads/previews/${previewFilename}`;
      }

      // Upload original, thumbnail, and preview concurrently.
      const [imagePath, thumbnailPath, previewPath] = await Promise.all([
        s3.processUpload(file, req.admin.id),
        s3.processThumbnail(thumbBuffer, thumbFilename, THUMB_DIR, req.admin.id),
        storePreview(),
      ]);
      const nameWithoutExt = path.parse(file.originalname).name;
      const matchedOriginal = selectedImageMap[nameWithoutExt];

      const folderId = req.body.folderId && UUID_RE.test(req.body.folderId) ? req.body.folderId : null;
      return {
        galleryId,
        filename: file.filename,
        originalName: file.originalname,
        path: imagePath,
        thumbnailPath,
        previewPath,
        beforePath: matchedOriginal ? matchedOriginal.path : undefined,
        sortOrder: i,
        size: file.size,
        folderIds: folderId ? [folderId] : [],
      };
    }))
  );

  const created = await GalleryImage.insertMany(imageDocs);

  // Fire-and-forget: enqueue face recognition for ALL gallery images — never block the 201 response.
  // We fetch the full ID list so the worker processes previously uploaded images too,
  // and uses the idempotency guard in processImageForRecognition to skip already-tagged ones.
  pool.query(
    `SELECT id FROM gallery_images WHERE gallery_id = $1 ORDER BY sort_order ASC`,
    [galleryId]
  ).then(({ rows: allImgRows }) => {
    const allImageIds = allImgRows.map((r) => r.id);
    return pool.query(
      `INSERT INTO face_recognition_jobs (gallery_id, admin_id, total_images, status)
       VALUES ($1, $2, $3, 'queued')
       ON CONFLICT (gallery_id) DO UPDATE
         SET total_images   = EXCLUDED.total_images,
             -- Only reset progress when the previous run finished; keep counters intact
             -- if recognition is already queued/running so the UI isn't disrupted.
             status         = CASE WHEN face_recognition_jobs.status IN ('done','failed')
                                   THEN 'queued' ELSE face_recognition_jobs.status END,
             processed      = CASE WHEN face_recognition_jobs.status IN ('done','failed')
                                   THEN 0 ELSE face_recognition_jobs.processed END,
             matched        = CASE WHEN face_recognition_jobs.status IN ('done','failed')
                                   THEN 0 ELSE face_recognition_jobs.matched END,
             error_message  = CASE WHEN face_recognition_jobs.status IN ('done','failed')
                                   THEN NULL ELSE face_recognition_jobs.error_message END,
             started_at     = CASE WHEN face_recognition_jobs.status IN ('done','failed')
                                   THEN NULL ELSE face_recognition_jobs.started_at END,
             finished_at    = CASE WHEN face_recognition_jobs.status IN ('done','failed')
                                   THEN NULL ELSE face_recognition_jobs.finished_at END`,
      [galleryId, req.admin.id, allImageIds.length]
    ).then(() => getQueue()).then((boss) =>
      boss.send(
        JOB_NAMES.FACE_RECOGNITION,
        { galleryId, adminId: req.admin.id, imageIds: allImageIds },
        {
          singletonKey:    `face:${galleryId}`,
          retryLimit:      2,
          retryDelay:      60,
          expireInSeconds: 7200,
        }
      )
    );
  }).catch((err) => logger.warn('[images] face recognition enqueue failed:', err.message));

  res.status(201).json(created);
}));

// PATCH /api/galleries/:galleryId/images/:imageId/before  — ADMIN
router.patch('/:imageId/before', protect, checkQuota, upload.single('before'), validateImageMagicBytes, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.imageId))
    return res.status(400).json({ message: 'Invalid image ID format' });

  const image = await GalleryImage.findById(req.params.imageId);
  if (!image) return res.status(404).json({ message: 'Image not found' });
  const gallery = await Gallery.findOne({ _id: image.galleryId, adminId: req.admin.id });
  if (!gallery) return res.status(403).json({ message: 'Forbidden' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  // Delete old before file if exists (S3 or local)
  if (image.beforePath) {
    await s3.deleteUpload(image.beforePath, UPLOADS_DIR);
  }

  image.beforePath = await s3.processUpload(req.file, req.admin.id);
  await GalleryImage.save(image);
  res.json(image);
}));

// DELETE /api/galleries/:galleryId/images/:imageId  — ADMIN
router.delete('/:imageId', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.imageId))
    return res.status(400).json({ message: 'Invalid image ID format' });

  const image = await GalleryImage.findById(req.params.imageId);
  if (!image) return res.status(404).json({ message: 'Image not found' });
  const gallery = await Gallery.findOne({ _id: image.galleryId, adminId: req.admin.id });
  if (!gallery) return res.status(403).json({ message: 'Forbidden' });

  // Delete original + thumbnail + preview from S3 or local disk
  await Promise.all([
    image.path          ? s3.deleteUpload(image.path,          UPLOADS_DIR) : Promise.resolve(),
    image.thumbnailPath ? s3.deleteUpload(image.thumbnailPath, THUMB_DIR)   : Promise.resolve(),
    image.previewPath   ? s3.deleteUpload(image.previewPath,   PREVIEW_DIR) : Promise.resolve(),
    image.beforePath    ? s3.deleteUpload(image.beforePath,    UPLOADS_DIR) : Promise.resolve(),
  ]);

  await GalleryImage.findByIdAndDelete(req.params.imageId);

  // Fire-and-forget: clean up face tags and re-trigger recognition if it was previously run.
  // Never blocks the response.
  const deletedImageId = req.params.imageId;
  const galleryId = req.params.galleryId;
  const adminId = req.admin.id;
  ;(async () => {
    try {
      // Remove face tags for the deleted image
      await pool.query(
        `DELETE FROM gallery_image_face_tags WHERE gallery_image_id = $1`,
        [deletedImageId]
      );

      // Check if recognition has ever run for this gallery
      const { rows: jobRows } = await pool.query(
        `SELECT status FROM face_recognition_jobs WHERE gallery_id = $1`,
        [galleryId]
      );
      if (!jobRows[0]) return; // Recognition never ran — nothing to do

      // Remaining images after deletion (deleted image already removed from DB)
      const { rows: imgRows } = await pool.query(
        `SELECT id FROM gallery_images WHERE gallery_id = $1 ORDER BY sort_order ASC`,
        [galleryId]
      );
      const remainingImageIds = imgRows.map(r => r.id);

      // Clear ALL gallery face tags so the re-run starts with a clean slate
      // (required for correct cluster recomputation across the full gallery)
      await pool.query(
        `DELETE FROM gallery_image_face_tags
         WHERE gallery_image_id = ANY(SELECT id FROM gallery_images WHERE gallery_id = $1)`,
        [galleryId]
      );

      if (!remainingImageIds.length) {
        // No images left — mark as done with zeroed counters
        await pool.query(
          `UPDATE face_recognition_jobs
           SET status = 'done', total_images = 0, processed = 0, matched = 0, finished_at = NOW()
           WHERE gallery_id = $1`,
          [galleryId]
        );
        return;
      }

      // Atomically update the job row and determine which singletonKey to use.
      // Running/queued → 'cancelled' (active job must stop first, re-run uses face-rerun: key).
      // Done/failed/cancelled → 'queued' (no active job, re-run uses face: key directly).
      const { rows: updatedRows } = await pool.query(
        `UPDATE face_recognition_jobs
         SET status        = CASE WHEN status IN ('running','queued') THEN 'cancelled' ELSE 'queued' END,
             total_images  = $2,
             processed     = 0,
             matched       = 0,
             error_message = NULL,
             started_at    = NULL,
             finished_at   = NULL
         WHERE gallery_id = $1
         RETURNING status`,
        [galleryId, remainingImageIds.length]
      );

      const newStatus = updatedRows[0]?.status;
      const boss = await getQueue();

      if (newStatus === 'cancelled') {
        // Active job was just cancelled; schedule re-run with a different singletonKey
        // so pg-boss's dedup lock on the active job doesn't block the new enqueue.
        // startAfter:10 gives the running worker time to detect 'cancelled' and exit.
        await boss.send(
          JOB_NAMES.FACE_RECOGNITION,
          { galleryId, adminId, imageIds: remainingImageIds },
          { singletonKey: `face-rerun:${galleryId}`, startAfter: 10, retryLimit: 2, retryDelay: 60, expireInSeconds: 7200 }
        );
        logger.info(`[images] gallery ${galleryId}: active face job cancelled, re-run scheduled`);
      } else if (newStatus === 'queued') {
        // No active job — re-run immediately with the standard singletonKey
        await boss.send(
          JOB_NAMES.FACE_RECOGNITION,
          { galleryId, adminId, imageIds: remainingImageIds },
          { singletonKey: `face:${galleryId}`, retryLimit: 2, retryDelay: 60, expireInSeconds: 7200 }
        );
        logger.info(`[images] gallery ${galleryId}: face re-run enqueued after image delete`);
      }
    } catch (err) {
      logger.warn(`[images] face re-run after delete failed for gallery ${galleryId}: ${err.message}`);
    }
  })();

  res.json({ message: 'Image deleted' });
}));

module.exports = router;
