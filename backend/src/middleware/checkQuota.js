const pool = require('../db');

// Default 10 GB per admin; override with MAX_STORAGE_BYTES env var
const MAX_BYTES = parseInt(process.env.MAX_STORAGE_BYTES || String(10 * 1024 * 1024 * 1024));

/**
 * Middleware — rejects upload requests when the admin has exceeded their
 * storage quota. Must be placed after `protect` so `req.admin` is populated.
 */
const checkQuota = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(gi.size), 0)::bigint AS total
       FROM gallery_images gi
       JOIN galleries g ON g.id = gi.gallery_id
       WHERE g.admin_id = $1`,
      [req.admin.id]
    );
    const usedBytes = Number(rows[0].total);
    if (usedBytes >= MAX_BYTES) {
      const limitGB = (MAX_BYTES / (1024 ** 3)).toFixed(0);
      return res.status(413).json({
        message: `Storage quota of ${limitGB} GB exceeded`,
        used: usedBytes,
        limit: MAX_BYTES,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = checkQuota;
