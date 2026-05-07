const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  // Cookie takes priority; Authorization header is kept as fallback for the mobile app
  const token =
    req.cookies?.koral_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }

  try {
    const admin = await Admin.findById(decoded.id);
    if (!admin) return res.status(401).json({ message: 'Admin not found' });
    // Omit password before attaching to request
    delete admin.password;
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Sets req.admin if a valid token is present, but never rejects — used for
// endpoints that serve both authenticated admins and unauthenticated clients.
const optionalProtect = async (req, res, next) => {
  const token =
    req.cookies?.koral_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token) return next();

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next();
  }

  try {
    const admin = await Admin.findById(decoded.id);
    if (admin) {
      delete admin.password;
      req.admin = admin;
    }
  } catch {
    // DB error — treat as unauthenticated
  }
  next();
};

// Only superadmins pass through
const superprotect = async (req, res, next) => {
  await protect(req, res, () => {
    if (req.admin?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access required' });
    }
    next();
  });
};

module.exports = { protect, superprotect, optionalProtect };
