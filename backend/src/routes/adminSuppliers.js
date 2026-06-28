const express = require('express');
const Supplier = require('../models/Supplier');
const { superprotect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');

const router = express.Router();
router.use(superprotect);

// GET /admin/suppliers
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const suppliers = await Supplier.findAll({ includeInactive: true });
    res.json(suppliers);
  })
);

// POST /admin/suppliers
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, contactPerson, logoPath, isActive, isExclusive, apiWebhookUrl } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    const existing = await Supplier.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    // Explicit field list — no `...req.body` spread, so the request can never set
    // unintended columns (e.g. override createdBySuperadminId or future fields).
    const supplier = await Supplier.create({
      name, email, password, phone, contactPerson, logoPath, isActive, isExclusive, apiWebhookUrl,
      createdBySuperadminId: req.admin.id,
    });
    res.status(201).json(supplier);
  })
);

// GET /admin/suppliers/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid supplier ID' });
    }
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  })
);

// PUT /admin/suppliers/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid supplier ID' });
    }
    const supplier = await Supplier.update(req.params.id, req.body);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  })
);

// DELETE /admin/suppliers/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid supplier ID' });
    }
    const count = await Supplier.countOrders(req.params.id);
    if (count > 0) {
      return res.status(409).json({
        message: `Cannot delete supplier with ${count} existing order(s)`,
      });
    }
    await Supplier.delete(req.params.id);
    res.json({ message: 'Supplier deleted' });
  })
);

// PATCH /admin/suppliers/:id/toggle-active
router.patch(
  '/:id/toggle-active',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid supplier ID' });
    }
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    const updated = await Supplier.update(req.params.id, { isActive: !supplier.isActive });
    res.json(updated);
  })
);

// PATCH /admin/suppliers/:id/set-exclusive
router.patch(
  '/:id/set-exclusive',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid supplier ID' });
    }
    const supplier = await Supplier.setExclusive(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  })
);

module.exports = router;
