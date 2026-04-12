const express = require('express');
const AdminProduct = require('../models/AdminProduct');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(protect);

// GET /api/admin-products — list current admin's product catalog
// Auto-seeds defaults the first time an admin has no products
router.get('/', asyncHandler(async (req, res) => {
  let products = await AdminProduct.find(req.admin.id);
  if (products.length === 0) {
    await AdminProduct.seedDefaults(req.admin.id);
    products = await AdminProduct.find(req.admin.id);
  }
  res.json(products);
}));

// POST /api/admin-products — add a product to the catalog
router.post('/', asyncHandler(async (req, res) => {
  const { name, type, maxPhotos } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
  if (!['album', 'print'].includes(type)) return res.status(400).json({ message: 'Type must be album or print' });
  const maxP = Number(maxPhotos);
  if (!maxP || maxP < 1 || maxP > 500) return res.status(400).json({ message: 'maxPhotos must be between 1 and 500' });

  const product = await AdminProduct.create({
    adminId: req.admin.id,
    name: name.trim(),
    type,
    maxPhotos: maxP,
  });
  res.status(201).json(product);
}));

// DELETE /api/admin-products/:id — remove a product from the catalog
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await AdminProduct.findByIdAndDelete(req.params.id, req.admin.id);
  if (!deleted) return res.status(404).json({ message: 'Product not found' });
  res.json({ message: 'Product deleted' });
}));

module.exports = router;
