const Gallery = require('../models/Gallery');
const GalleryImage = require('../models/GalleryImage');

// Default 10 GB per admin; override with MAX_STORAGE_BYTES env var
const MAX_BYTES = parseInt(process.env.MAX_STORAGE_BYTES || String(10 * 1024 * 1024 * 1024));

/**
 * Middleware — rejects upload requests when the admin has exceeded their
 * storage quota. Must be placed after `protect` so `req.admin` is populated.
 */
const checkQuota = async (req, res, next) => {
  try {
    const galleries = await Gallery.find({ adminId: req.admin._id }).select('_id');
    const galleryIds = galleries.map((g) => g._id);

    const [result] = await GalleryImage.aggregate([
      { $match: { galleryId: { $in: galleryIds } } },
      { $group: { _id: null, total: { $sum: '$size' } } },
    ]);

    const usedBytes = result?.total || 0;
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
