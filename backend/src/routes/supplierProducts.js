const express = require('express');
const fs = require('fs');
const path = require('path');
const SupplierProduct = require('../models/SupplierProduct');
const { supplierProtect } = require('../middleware/supplierAuth');
const { uploadImage, validateImageMagicBytes } = require('../middleware/upload');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const s3 = require('../config/s3');

const router = express.Router();
router.use(supplierProtect);

// ── Ownership helper ──────────────────────────────────────────────────────────
async function requireOwnership(req, res) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    res.status(400).json({ message: 'Invalid product ID' });
    return null;
  }
  const product = await SupplierProduct.findById(id);
  if (!product) {
    res.status(404).json({ message: 'Product not found' });
    return null;
  }
  if (product.supplierId !== req.supplier.id) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }
  return product;
}

// IMPORTANT: /reorder must be declared before /:id so Express does not
// shadow the literal path with the dynamic segment.

// PUT /supplier/products/reorder
router.put(
  '/reorder',
  asyncHandler(async (req, res) => {
    const items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items must be a non-empty array of { id, sortOrder }' });
    }
    for (const item of items) {
      if (!item.id || !UUID_RE.test(item.id) || typeof item.sortOrder !== 'number') {
        return res.status(400).json({ message: 'Each item must have a valid UUID id and numeric sortOrder' });
      }
    }
    await SupplierProduct.reorder(items);
    res.json({ message: 'Order updated' });
  })
);

// GET /supplier/products
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const products = await SupplierProduct.findBySupplierId(req.supplier.id, {
      includeInactive: true,
    });
    res.json(products);
  })
);

// POST /supplier/products
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, type, costPrice } = req.body;
    if (!name || !type || costPrice === undefined) {
      return res.status(400).json({ message: 'name, type and costPrice are required' });
    }
    const VALID_TYPES = ['print', 'canvas', 'album', 'digital', 'other'];
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (isNaN(parseFloat(costPrice)) || parseFloat(costPrice) < 0) {
      return res.status(400).json({ message: 'costPrice must be a non-negative number' });
    }
    const product = await SupplierProduct.create(req.supplier.id, req.body);
    res.status(201).json(product);
  })
);

// GET /supplier/products/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await requireOwnership(req, res);
    if (!product) return;
    res.json(product);
  })
);

// PUT /supplier/products/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await requireOwnership(req, res);
    if (!product) return;
    const updated = await SupplierProduct.update(req.params.id, req.body);
    res.json(updated);
  })
);

// DELETE /supplier/products/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await requireOwnership(req, res);
    if (!product) return;
    try {
      await SupplierProduct.delete(req.params.id);
      res.json({ message: 'Product deleted' });
    } catch (err) {
      if (err.message === 'Cannot delete product with active orders') {
        return res.status(409).json({ message: err.message });
      }
      throw err;
    }
  })
);

// POST /supplier/products/:id/image
router.post(
  '/:id/image',
  uploadImage.single('image'),
  validateImageMagicBytes,
  asyncHandler(async (req, res) => {
    const product = await requireOwnership(req, res);
    if (!product) return;

    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    let imagePath;
    if (s3.isEnabled()) {
      const key = `suppliers/${req.supplier.id}/${req.file.filename}`;
      await s3.uploadFile(req.file.path, key, req.file.mimetype);
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
      imagePath = key;
    } else {
      imagePath = `/uploads/${req.file.filename}`;
    }

    const updated = await SupplierProduct.update(req.params.id, {
      imagePreviewPath: imagePath,
    });
    res.json({ imagePreviewPath: updated.imagePreviewPath });
  })
);

module.exports = router;
