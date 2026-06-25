const jwt = require('jsonwebtoken');
const Supplier = require('../models/Supplier');

/**
 * Mirrors the admin `protect` middleware in auth.js.
 * Reads the `supplier_token` httpOnly cookie, verifies it against
 * SUPPLIER_JWT_SECRET, then attaches the supplier (without password)
 * to req.supplier.
 */
const supplierProtect = async (req, res, next) => {
  const token = req.cookies?.supplier_token || null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.SUPPLIER_JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }

  try {
    const supplier = await Supplier.findById(decoded.id);
    if (!supplier) return res.status(401).json({ message: 'Supplier not found' });
    if (!supplier.isActive) return res.status(401).json({ message: 'Account is inactive' });
    // password is already scrubbed by Supplier.findById
    req.supplier = supplier;
    next();
  } catch {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { supplierProtect };
