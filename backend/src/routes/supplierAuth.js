const express = require('express');
const jwt = require('jsonwebtoken');
const Supplier = require('../models/Supplier');
const { supplierProtect } = require('../middleware/supplierAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

/** Determine whether the response cookie should be Secure.
 *  Mirrors the same logic used in auth.js for admin login. */
function isSecure(req) {
  return (
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production'
  );
}

// POST /api/supplier/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Basic type validation — reject anything non-string to prevent injection
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const supplier = await Supplier.findByEmail(email.trim());
    if (!supplier) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!supplier.isActive) {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    const match = await Supplier.comparePassword(supplier, password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: supplier.id },
      process.env.SUPPLIER_JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('supplier_token', token, {
      httpOnly: true,
      secure: isSecure(req),
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Remove password before responding (findByEmail returns it for bcrypt comparison)
    delete supplier.password;

    res.json({ supplier });
  })
);

// POST /api/supplier/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('supplier_token', {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'lax',
  });
  res.json({ message: 'Logged out' });
});

// GET /api/supplier/auth/me
router.get(
  '/me',
  supplierProtect,
  asyncHandler(async (req, res) => {
    res.json({ supplier: req.supplier });
  })
);

module.exports = router;
