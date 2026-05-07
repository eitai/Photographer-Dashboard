const express = require('express');
const { protect, optionalProtect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const pool = require('../db');
const { rowToCamel } = require('../db/utils');
const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');
const { getQueue, JOB_NAMES } = require('../queue');
const logger = require('../utils/logger');

const router = express.Router({ mergeParams: true });

// POST /api/galleries/:galleryId/face-recognition/run
router.post('/run', protect, asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  if (!UUID_RE.test(galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID' });

  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (gallery.adminId !== req.admin.id) return res.status(403).json({ message: 'Forbidden' });

  const images = await GalleryImage.find({ galleryId });
  const imageIds = images.map((img) => img.id);

  if (!imageIds.length)
    return res.status(400).json({ message: 'Gallery has no images' });

  // Upsert job row — reset if previous job exists
  const { rows } = await pool.query(
    `INSERT INTO face_recognition_jobs (gallery_id, admin_id, total_images, status)
     VALUES ($1, $2, $3, 'queued')
     ON CONFLICT (gallery_id) DO UPDATE
       SET status = 'queued', total_images = EXCLUDED.total_images,
           processed = 0, matched = 0, error_message = NULL,
           started_at = NULL, finished_at = NULL, created_at = NOW()
     RETURNING *`,
    [galleryId, req.admin.id, imageIds.length]
  );
  const job = rowToCamel(rows[0]);

  // Clear existing tags so re-run is clean
  await pool.query(
    `DELETE FROM gallery_image_face_tags WHERE gallery_image_id = ANY(
       SELECT id FROM gallery_images WHERE gallery_id = $1
     ) AND admin_id = $2`,
    [galleryId, req.admin.id]
  );

  try {
    const boss = await getQueue();
    await boss.send(
      JOB_NAMES.FACE_RECOGNITION,
      { galleryId, adminId: req.admin.id, imageIds },
      {
        singletonKey:    `face:${galleryId}`,
        retryLimit:      2,
        retryDelay:      60,
        expireInSeconds: 7200,
      }
    );
  } catch (err) {
    logger.warn('[faceRecognition] failed to enqueue job:', err.message);
  }

  res.json({ jobId: job.id, status: 'queued' });
}));

// GET /api/galleries/:galleryId/face-recognition/status
router.get('/status', protect, asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  if (!UUID_RE.test(galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID' });

  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (gallery.adminId !== req.admin.id) return res.status(403).json({ message: 'Forbidden' });

  const { rows } = await pool.query(
    `SELECT * FROM face_recognition_jobs WHERE gallery_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [galleryId]
  );

  if (!rows[0]) return res.status(404).json({ message: 'No face recognition job found' });

  res.json(rowToCamel(rows[0]));
}));

// GET /api/galleries/:galleryId/face-recognition/faces
// Dual auth: admin session OR ?token= query param (public client path).
// optionalProtect sets req.admin when a valid cookie/header is present without rejecting public requests.
router.get('/faces', optionalProtect, asyncHandler(async (req, res) => {
  const { galleryId } = req.params;
  if (!UUID_RE.test(galleryId))
    return res.status(400).json({ message: 'Invalid gallery ID' });

  let adminId;
  let isPublic = false;

  if (req.admin) {
    adminId = req.admin.id;
  } else {
    // Public path: validate gallery token supplied as ?token=
    const { token } = req.query;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const { rows: gRows } = await pool.query(
      'SELECT id, admin_id FROM galleries WHERE token = $1 AND id = $2',
      [token, galleryId]
    );
    if (!gRows[0]) return res.status(404).json({ message: 'Gallery not found' });
    adminId = gRows[0].admin_id;
    isPublic = true;
  }

  const { rows } = await pool.query(
    `SELECT
       CASE WHEN t.status = 'matched' THEN t.client_id::text
            ELSE t.cluster_id::text
       END                                                          AS group_key,
       t.status,
       t.client_id,
       c.name                                                       AS client_name,
       cfr.image_path                                               AS reference_photo_path,
       COUNT(DISTINCT t.gallery_image_id)::int                      AS photo_count,
       (ARRAY_AGG(t.bounding_box     ORDER BY t.confidence DESC))[1] AS rep_bounding_box,
       (ARRAY_AGG(gi.thumbnail_path  ORDER BY t.confidence DESC))[1] AS rep_thumbnail_path,
       (ARRAY_AGG(t.face_crop_path   ORDER BY t.confidence DESC))[1] AS rep_face_crop_path,
       ARRAY_AGG(DISTINCT t.gallery_image_id)                        AS image_ids
     FROM gallery_image_face_tags t
     JOIN gallery_images gi ON gi.id = t.gallery_image_id
     LEFT JOIN clients c ON c.id = t.client_id
     LEFT JOIN client_face_references cfr ON cfr.client_id = t.client_id
     WHERE gi.gallery_id = $1
       AND t.admin_id = $2
       AND (t.status = 'matched' OR t.cluster_id IS NOT NULL)
     GROUP BY
       CASE WHEN t.status = 'matched' THEN t.client_id::text ELSE t.cluster_id::text END,
       t.status, t.client_id, c.name, cfr.image_path
     ORDER BY photo_count DESC`,
    [galleryId, adminId]
  );

  const faces = rows.map(row => ({
    groupKey:           row.group_key,
    status:             row.status,
    clientId:           row.client_id || null,
    ...(isPublic ? {} : { clientName: row.client_name || null }),
    referencePhotoPath: row.reference_photo_path || null,
    repBoundingBox:     row.rep_bounding_box || null,
    repThumbnailPath:   row.rep_thumbnail_path || null,
    faceCropPath:       row.rep_face_crop_path || null,
    photoCount:         row.photo_count,
    imageIds:           row.image_ids || [],
  }));

  res.json(faces);
}));

// GET /api/galleries/:galleryId/images/:imageId/face-tags
router.get('/images/:imageId/face-tags', protect, asyncHandler(async (req, res) => {
  const { galleryId, imageId } = req.params;
  if (!UUID_RE.test(galleryId) || !UUID_RE.test(imageId))
    return res.status(400).json({ message: 'Invalid ID format' });

  const gallery = await Gallery.findById(galleryId);
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
  if (gallery.adminId !== req.admin.id) return res.status(403).json({ message: 'Forbidden' });

  const { rows } = await pool.query(
    `SELECT t.*, c.name AS client_name
     FROM gallery_image_face_tags t
     LEFT JOIN clients c ON c.id = t.client_id
     WHERE t.gallery_image_id = $1 AND t.admin_id = $2
     ORDER BY t.confidence DESC`,
    [imageId, req.admin.id]
  );
  res.json(rows.map((r) => ({ ...rowToCamel(r), clientName: r.client_name })));
}));

// PATCH /api/galleries/:galleryId/images/:imageId/face-tags/:tagId
router.patch('/images/:imageId/face-tags/:tagId', protect, asyncHandler(async (req, res) => {
  const { galleryId, imageId, tagId } = req.params;
  if (!UUID_RE.test(galleryId) || !UUID_RE.test(imageId) || !UUID_RE.test(tagId))
    return res.status(400).json({ message: 'Invalid ID format' });

  const { confirmed, clientId } = req.body;
  const sets = [];
  const vals = [];

  if (typeof confirmed === 'boolean') { sets.push(`confirmed_by_admin = $${vals.push(confirmed)}`); }
  if (clientId !== undefined) {
    if (clientId !== null && !UUID_RE.test(clientId))
      return res.status(400).json({ message: 'Invalid clientId' });
    sets.push(`client_id = $${vals.push(clientId)}`);
    sets.push(`status = $${vals.push(clientId ? 'matched' : 'unmatched')}`);
  }

  if (!sets.length) return res.status(400).json({ message: 'Nothing to update' });
  sets.push('updated_at = NOW()');

  const tagIdx   = vals.push(tagId);
  const adminIdx = vals.push(req.admin.id);
  const { rows } = await pool.query(
    `UPDATE gallery_image_face_tags SET ${sets.join(', ')}
     WHERE id = $${tagIdx} AND admin_id = $${adminIdx} RETURNING *`,
    vals
  );

  if (!rows[0]) return res.status(404).json({ message: 'Face tag not found' });
  res.json(rowToCamel(rows[0]));
}));

// DELETE /api/galleries/:galleryId/images/:imageId/face-tags/:tagId
router.delete('/images/:imageId/face-tags/:tagId', protect, asyncHandler(async (req, res) => {
  const { tagId } = req.params;
  if (!UUID_RE.test(tagId))
    return res.status(400).json({ message: 'Invalid ID format' });

  const { rows } = await pool.query(
    'DELETE FROM gallery_image_face_tags WHERE id = $1 AND admin_id = $2 RETURNING id',
    [tagId, req.admin.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Face tag not found' });
  res.json({ message: 'Tag removed' });
}));

module.exports = router;
