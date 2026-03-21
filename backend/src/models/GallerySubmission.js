const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function _populateSelectedImages(submission) {
  if (!submission || !submission.selectedImageIds || !submission.selectedImageIds.length) {
    return submission;
  }
  const { rows } = await pool.query(
    'SELECT * FROM gallery_images WHERE id = ANY($1::uuid[])',
    [submission.selectedImageIds]
  );
  submission.selectedImageIds = rows.map(rowToCamel);
  return submission;
}

async function findOne(filter) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.galleryId) { conditions.push(`gallery_id = $${i++}`); vals.push(filter.galleryId); }
  if (filter.sessionId) { conditions.push(`session_id = $${i++}`); vals.push(filter.sessionId); }
  if (filter._id || filter.id) { conditions.push(`id = $${i++}`); vals.push(filter._id || filter.id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM gallery_submissions ${where} LIMIT 1`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function find(filter = {}, { populate } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.galleryId) { conditions.push(`gallery_id = $${i++}`); vals.push(filter.galleryId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM gallery_submissions ${where} ORDER BY submitted_at DESC`,
    vals
  );
  const submissions = rows.map(rowToCamel);
  if (!populate) return submissions;
  return Promise.all(submissions.map(_populateSelectedImages));
}

async function findOneAndUpdate(filter, update, opts = {}, pgClient = null) {
  const galleryId = filter.galleryId;
  const sessionId = filter.sessionId;

  const { $set: data } = update;
  // selectedImageIds from the request are UUID strings
  const selectedImageIds = data.selectedImageIds || [];
  const imageComments = data.imageComments || {};
  const heroImageId = data.heroImageId || null;
  const clientMessage = data.clientMessage || null;
  const submittedAt = data.submittedAt || new Date();

  const db = pgClient || pool;

  if (opts.upsert) {
    const { rows } = await db.query(
      `INSERT INTO gallery_submissions
         (gallery_id, session_id, selected_image_ids, client_message, image_comments, hero_image_id, submitted_at)
       VALUES ($1, $2, $3::uuid[], $4, $5::jsonb, $6, $7)
       ON CONFLICT (gallery_id, session_id)
       DO UPDATE SET
         selected_image_ids = $3::uuid[],
         client_message = $4,
         image_comments = $5::jsonb,
         hero_image_id = $6,
         submitted_at = $7
       RETURNING *`,
      [
        galleryId,
        sessionId,
        selectedImageIds,
        clientMessage,
        JSON.stringify(imageComments),
        heroImageId,
        submittedAt,
      ]
    );
    return rows[0] ? rowToCamel(rows[0]) : null;
  }

  // Non-upsert update
  const id = filter._id || filter.id;
  const { rows } = await db.query(
    `UPDATE gallery_submissions
     SET selected_image_ids = $1::uuid[], client_message = $2, image_comments = $3::jsonb,
         hero_image_id = $4, submitted_at = $5
     WHERE id = $6 AND gallery_id = $7
     RETURNING *`,
    [selectedImageIds, clientMessage, JSON.stringify(imageComments), heroImageId, submittedAt, id, galleryId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

// Remove one image UUID from selectedImageIds array and return updated submission (with images populated)
async function pullSelectedImage(submissionId, galleryId, imageId) {
  const { rows } = await pool.query(
    `UPDATE gallery_submissions
     SET selected_image_ids = array_remove(selected_image_ids, $1::uuid)
     WHERE id = $2 AND gallery_id = $3
     RETURNING *`,
    [imageId, submissionId, galleryId]
  );
  if (!rows[0]) return null;
  const submission = rowToCamel(rows[0]);
  return _populateSelectedImages(submission);
}

async function findOneAndDelete(filter) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter._id || filter.id) { conditions.push(`id = $${i++}`); vals.push(filter._id || filter.id); }
  if (filter.galleryId) { conditions.push(`gallery_id = $${i++}`); vals.push(filter.galleryId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `DELETE FROM gallery_submissions ${where} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

module.exports = {
  findOne,
  find,
  findOneAndUpdate,
  pullSelectedImage,
  findOneAndDelete,
};
