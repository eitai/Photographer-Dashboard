const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXT = /\.(jpeg|jpg|png|gif|webp)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extOk = ALLOWED_EXT.test(path.extname(file.originalname));
  const mimeOk = ALLOWED_MIME.has(file.mimetype);
  if (extOk && mimeOk) cb(null, true);
  else cb(new Error('Only image files (jpeg, png, gif, webp) are allowed'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

module.exports = upload;
