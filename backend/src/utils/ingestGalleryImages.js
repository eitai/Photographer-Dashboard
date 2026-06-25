const path = require('path');
const fs = require('fs');
const pLimit = require('p-limit');
const sharp = require('sharp');
const GalleryImage = require('../models/GalleryImage');
const s3 = require('../config/s3');
const logger = require('./logger');

const THUMB_DIR   = path.join(__dirname, '../../uploads/thumbnails');
const PREVIEW_DIR = path.join(__dirname, '../../uploads/previews');
if (!fs.existsSync(THUMB_DIR))   fs.mkdirSync(THUMB_DIR,   { recursive: true });
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

/**
 * Shared multer→sharp→S3(or disk) ingest pipeline for gallery images.
 * Used by the gallery batch upload route and direct-order ad-hoc uploads.
 *
 * @param {Express.Multer.File[]} files
 * @param {object} opts
 * @param {string} opts.galleryId          target gallery
 * @param {string} opts.adminId            owner (S3 key prefix)
 * @param {Record<string, object>} [opts.selectedImageMap]  delivery-gallery before-image matching
 * @param {string|null} [opts.folderId]
 * @returns {Promise<object[]>} created gallery_images rows (camelCase)
 */
async function ingestGalleryImages(files, { galleryId, adminId, selectedImageMap = {}, folderId = null }) {
  const limit = pLimit(5);
  const imageDocs = await Promise.all(
    files.map((file, i) => limit(async () => {
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

      async function storePreview() {
        if (s3.isEnabled()) {
          try {
            return await s3.uploadBuffer(
              previewBuffer,
              `admins/${adminId}/previews/${previewFilename}`,
              'image/webp'
            );
          } catch (err) {
            logger.error('[ingestGalleryImages] storePreview S3 failed, preview will be null:', err.message);
            return null;
          }
        }
        fs.writeFileSync(path.join(PREVIEW_DIR, previewFilename), previewBuffer);
        return `/uploads/previews/${previewFilename}`;
      }

      const [imagePath, thumbnailPath, previewPath] = await Promise.all([
        s3.processUpload(file, adminId),
        s3.processThumbnail(thumbBuffer, thumbFilename, THUMB_DIR, adminId),
        storePreview(),
      ]);
      const nameWithoutExt = path.parse(file.originalname).name;
      const matchedOriginal = selectedImageMap[nameWithoutExt];

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

  return GalleryImage.insertMany(imageDocs);
}

module.exports = { ingestGalleryImages };
