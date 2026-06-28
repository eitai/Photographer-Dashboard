const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const Supplier = require('../models/Supplier');
const { supplierProtect } = require('../middleware/supplierAuth');
const asyncHandler = require('../middleware/asyncHandler');
const validatePassword = require('../utils/validatePassword');

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

    // Whitelist the response — findByEmail returns the full row (incl. password,
    // apiWebhookUrl, payplus*, createdBySuperadminId) which must not leak.
    res.json({ supplier: Supplier.formatSupplier(supplier) });
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
    res.json({ supplier: Supplier.formatSupplier(req.supplier) });
  })
);

// PATCH /api/supplier/auth/me — update own profile (name, email, phone, contactPerson)
router.patch(
  '/me',
  supplierProtect,
  asyncHandler(async (req, res) => {
    const { name, email, phone, contactPerson } = req.body;

    // Reject non-string values to prevent type confusion
    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ message: 'name must be a string' });
    }
    if (email !== undefined && typeof email !== 'string') {
      return res.status(400).json({ message: 'email must be a string' });
    }
    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      return res.status(400).json({ message: 'phone must be a string or null' });
    }
    if (contactPerson !== undefined && contactPerson !== null && typeof contactPerson !== 'string') {
      return res.status(400).json({ message: 'contactPerson must be a string or null' });
    }

    const updates = {};
    if (name          !== undefined) updates.name          = name.trim();
    if (email         !== undefined) updates.email         = email.trim().toLowerCase();
    if (phone         !== undefined) updates.phone         = phone;
    if (contactPerson !== undefined) updates.contactPerson = contactPerson;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    // Guard: if changing email, make sure it is not already taken by another supplier
    if (updates.email && updates.email !== req.supplier.email) {
      const existing = await Supplier.findByEmail(updates.email);
      if (existing && existing.id !== req.supplier.id) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }

    const updated = await Supplier.update(req.supplier.id, updates);
    if (!updated) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    res.json({ supplier: Supplier.formatSupplier(updated) });
  })
);

// POST /api/supplier/auth/change-password — change own password
router.post(
  '/change-password',
  supplierProtect,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }

    // Same complexity policy as admin password changes (≥8 chars, letter + digit)
    const pwErr = validatePassword(newPassword);
    if (pwErr) {
      return res.status(400).json({ message: pwErr });
    }

    // Re-fetch with password hash for comparison (findById scrubs it)
    const supplierWithHash = await Supplier.findByEmail(req.supplier.email);
    if (!supplierWithHash) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const match = await Supplier.comparePassword(supplierWithHash, currentPassword);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE suppliers SET password = $1, updated_at = NOW() WHERE id = $2',
      [hash, req.supplier.id]
    );

    res.json({ message: 'Password updated successfully' });
  })
);

module.exports = router;
