/**
 * Face recognition worker handler.
 *
 * Pulls gallery image batches off the face.recognition queue, delegates to
 * faceService.processGalleryBatch, and records failures back to the DB so
 * the admin dashboard can surface them.
 */

'use strict';

const pool   = require('../db');
const logger = require('../utils/logger');
const { processGalleryBatch } = require('../services/faceService');

async function faceRecognitionHandler(job) {
  const { galleryId, adminId, imageIds } = job.data || {};
  if (!galleryId || !adminId || !Array.isArray(imageIds)) {
    logger.warn(`[worker:face] job ${job.id} missing required fields; ack`);
    return;
  }

  logger.info(`[worker:face] starting recognition for gallery ${galleryId} — ${imageIds.length} images`);

  try {
    const matched = await processGalleryBatch(galleryId, adminId, imageIds);
    logger.info(`[worker:face] gallery ${galleryId} done — ${matched} faces matched`);
  } catch (err) {
    logger.error(`[worker:face] gallery ${galleryId} failed: ${err.message}`);
    await pool.query(
      `UPDATE face_recognition_jobs
       SET status = 'failed', error_message = $1, finished_at = NOW()
       WHERE gallery_id = $2`,
      [err.message.slice(0, 500), galleryId]
    ).catch(() => {});
    throw err; // let pg-boss retry
  }
}

module.exports = { faceRecognitionHandler };
