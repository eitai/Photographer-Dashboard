const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const makeStorage = () => multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${ext}`);
  },
});

// ── Image upload ─────────────────────────────────────────────────────────────
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_IMAGE_EXT = /\.(jpeg|jpg|png|gif|webp)$/i;

const imageFilter = (req, file, cb) => {
  const extOk = ALLOWED_IMAGE_EXT.test(path.extname(file.originalname));
  const mimeOk = ALLOWED_IMAGE_MIME.has(file.mimetype);
  if (extOk && mimeOk) cb(null, true);
  else cb(new Error('Only image files (jpeg, png, gif, webp) are allowed'));
};

const uploadImage = multer({
  storage: makeStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ── Video upload ─────────────────────────────────────────────────────────────
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']);
const ALLOWED_VIDEO_EXT = /\.(mp4|mov|avi|webm)$/i;

const videoFilter = (req, file, cb) => {
  const extOk = ALLOWED_VIDEO_EXT.test(path.extname(file.originalname));
  const mimeOk = ALLOWED_VIDEO_MIME.has(file.mimetype);
  if (extOk && mimeOk) cb(null, true);
  else cb(new Error('Only video files (mp4, mov, avi, webm) are allowed'));
};

const uploadVideo = multer({
  storage: makeStorage(),
  fileFilter: videoFilter,
  limits: { fileSize: 2048 * 1024 * 1024 }, // 2 GB
});

module.exports = { uploadImage, uploadVideo };
