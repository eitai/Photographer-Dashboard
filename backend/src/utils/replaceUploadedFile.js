const path = require('path');

/**
 * Replaces an uploaded file stored on a SiteSettings record:
 *   1. Fetches the current settings row for `adminId`.
 *   2. If an existing file path is stored under `field`, deletes that file from disk.
 *   3. Upserts `{ [field]: newPath }` on the settings row.
 *
 * @param {string}   adminId  - The admin's ID (ownership anchor).
 * @param {string}   field    - The settings column name (e.g. 'heroImagePath').
 * @param {string}   newPath  - The new file path to persist (e.g. '/uploads/foo.jpg').
 * @param {object}   deps
 * @param {object}   deps.SiteSettings - The SiteSettings model.
 * @param {object}   deps.fs           - Node's `fs` module (injected for testability).
 * @returns {Promise<string>} The new path that was saved.
 */
async function replaceUploadedFile(adminId, field, newPath, { SiteSettings, fs }) {
  const existing = await SiteSettings.findOne({ adminId });
  if (existing?.[field]) {
    const oldFilename = path.basename(existing[field]);
    const oldFilePath = path.join(__dirname, '../../uploads', oldFilename);
    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
  }
  await SiteSettings.upsert(adminId, { [field]: newPath });
  return newPath;
}

module.exports = replaceUploadedFile;
