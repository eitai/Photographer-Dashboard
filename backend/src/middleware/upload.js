const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
  limits: { fileSize: 40 * 1024 * 1024 }, // 40 MB
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
});

// ── Magic bytes validation ────────────────────────────────────────────────────
// Checks the actual file content (first 12 bytes) rather than trusting the
// client-supplied Content-Type header, which can be trivially spoofed.
const isValidImageMagicBytes = (buf) => {
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // GIF: 47 49 46 38 (GIF8)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: RIFF????WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
};

const validateImageMagicBytes = async (req, res, next) => {
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];
  if (!files.length) return next();

  const cleanup = () => files.forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });

  try {
    for (const file of files) {
      const buf = Buffer.alloc(12);
      const fd = await fs.promises.open(file.path, 'r');
      try {
        await fd.read(buf, 0, 12, 0);
      } finally {
        await fd.close();
      }
      if (!isValidImageMagicBytes(buf)) {
        cleanup();
        return res.status(400).json({ message: 'Invalid image file: content does not match declared type.' });
      }
    }
    next();
  } catch (err) {
    cleanup();
    next(err);
  }
};

module.exports = { uploadImage, uploadVideo, validateImageMagicBytes };
