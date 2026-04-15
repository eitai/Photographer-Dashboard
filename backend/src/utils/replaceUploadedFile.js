const path = require('path');
const s3   = require('../config/s3');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Replaces an uploaded file stored on a SiteSettings record:
 *   1. Fetches the current settings row for `adminId`.
 *   2. If an existing file path is stored under `field`, deletes that file
 *      from S3 (if it's an S3 URL) or from local disk (legacy path).
 *   3. Upserts `{ [field]: newPath }` on the settings row.
 *
 * @param {string}   adminId  - The admin's ID (ownership anchor).
 * @param {string}   field    - The settings column name (e.g. 'heroImagePath').
 * @param {string}   newPath  - The new file path/URL to persist.
 * @param {object}   deps
 * @param {object}   deps.SiteSettings - The SiteSettings model.
 * @param {object}   deps.fs           - Node's `fs` module (kept for API compat, unused).
 * @returns {Promise<string>} The new path that was saved.
 */
async function replaceUploadedFile(adminId, field, newPath, { SiteSettings }) {
  const existing = await SiteSettings.findOne({ adminId });
  if (existing?.[field]) {
    await s3.deleteUpload(existing[field], UPLOADS_DIR);
  }
  await SiteSettings.upsert(adminId, { [field]: newPath });
  return newPath;
}

module.exports = replaceUploadedFile;
