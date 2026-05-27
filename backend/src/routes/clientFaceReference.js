const express = require('express');
const { protect } = require('../middleware/auth');
const { uploadImage: upload } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const pool = require('../db');
const { rowToCamel } = require('../db/utils');
const Client = require('../models/Client');
const faceService = require('../services/faceService');
const s3 = require('../config/s3');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const router = express.Router();

// GET /api/clients/:id/face-reference
router.get('/:id/face-reference', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const client = await Client.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!client) return res.status(404).json({ message: 'Client not found' });

  const ref = await faceService.getClientReference(req.params.id, req.admin.id);
  if (!ref) return res.json({ hasReference: false });

  res.json({
    hasReference: true,
    imagePath: ref.imagePath,
    modelVersion: ref.modelVersion,
    updatedAt: ref.updatedAt,
  });
}));

// POST /api/clients/:id/face-reference
router.post('/:id/face-reference', protect, upload.single('reference'), asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const client = await Client.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!client) return res.status(404).json({ message: 'Client not found' });

  if (!req.file) return res.status(400).json({ message: 'No reference image uploaded' });

  const imageBuffer = fs.readFileSync(req.file.path);
  // Clean up temp file
  fs.unlink(req.file.path, () => {});

  let ref;
  try {
    ref = await faceService.enrollClientReference(req.params.id, req.admin.id, imageBuffer);
  } catch (err) {
    if (err.code === 'NO_FACE')
      return res.status(422).json({ message: 'No face detected in the reference photo. Please use a clear portrait.' });
    throw err;
  }

  res.status(201).json({
    referenceId: ref.id,
    clientId: ref.clientId,
    imagePath: ref.imagePath,
    modelVersion: ref.modelVersion,
    updatedAt: ref.updatedAt,
  });
}));

// DELETE /api/clients/:id/face-reference
router.delete('/:id/face-reference', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const client = await Client.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!client) return res.status(404).json({ message: 'Client not found' });

  const deleted = await faceService.deleteClientReference(req.params.id, req.admin.id);
  if (!deleted) return res.status(404).json({ message: 'No reference photo found' });

  // Delete the reference image from S3 or local disk
  if (deleted.imagePath) {
    await s3.deleteUpload(deleted.imagePath, UPLOADS_DIR);
  }

  res.json({ message: 'Reference photo removed' });
}));

// GET /api/clients/:id/tagged-images?page=1&limit=50
router.get('/:id/tagged-images', protect, asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const client = await Client.findOne({ _id: req.params.id, adminId: req.admin.id });
  if (!client) return res.status(404).json({ message: 'Client not found' });

  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const page  = Math.max(parseInt(req.query.page)  || 1,  1);
  const offset = (page - 1) * limit;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT gi.id, gi.gallery_id, gi.filename, gi.original_name, gi.thumbnail_path,
              gi.preview_path, gi.path, gi.sort_order,
              t.confidence, t.confirmed_by_admin, t.bounding_box,
              g.name AS gallery_name
         FROM gallery_image_face_tags t
         JOIN gallery_images gi ON gi.id = t.gallery_image_id
         JOIN galleries g ON g.id = gi.gallery_id
        WHERE t.client_id = $1 AND t.admin_id = $2 AND t.status = 'matched'
        ORDER BY t.confidence DESC, gi.created_at DESC
        LIMIT $3 OFFSET $4`,
      [req.params.id, req.admin.id, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
         FROM gallery_image_face_tags t
        WHERE t.client_id = $1 AND t.admin_id = $2 AND t.status = 'matched'`,
      [req.params.id, req.admin.id]
    ),
  ]);

  const images = dataRes.rows.map((row) => ({
    ...rowToCamel(row),
    galleryName: row.gallery_name,
  }));
  const total = countRes.rows[0].count;

  res.json({ images, total, page, totalPages: Math.ceil(total / limit) });
}));

module.exports = router;
