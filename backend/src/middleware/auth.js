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
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin) return res.status(401).json({ message: 'Admin not found' });
    // Omit password before attaching to request
    delete admin.password;
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
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

module.exports = { protect, superprotect };
