const express = require('express');
const ProductOrder = require('../models/ProductOrder');
const Gallery = require('../models/Gallery');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const UUID_RE = /^[0-9a-f-]{36}$/i;

// GET /api/product-orders/gallery/:token  — PUBLIC
router.get('/gallery/:token', asyncHandler(async (req, res) => {
  const gallery = await Gallery.findOne({ token: req.params.token, isActive: true });
  if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

  const clientId = typeof gallery.clientId === 'object' ? gallery.clientId?.id : gallery.clientId;
  const orders = await ProductOrder.find(
    { adminId: gallery.adminId, ...(clientId ? { clientId } : {}) },
    { populate: true }
  );
  res.json(orders);
}));

// PUT /api/product-orders/:id/selection  — PUBLIC (client submits picks)
router.put('/:id/selection', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });

  const { selectedPhotoIds } = req.body;
  if (!Array.isArray(selectedPhotoIds)) {
    return res.status(400).json({ message: 'selectedPhotoIds must be an array' });
  }

  const order = await ProductOrder.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Product order not found' });
  if (order.status === 'submitted') {
    return res.status(409).json({ message: 'Selection already submitted' });
  }
  if (selectedPhotoIds.length > order.maxPhotos) {
    return res.status(400).json({ message: `Maximum ${order.maxPhotos} photo(s) allowed` });
  }

  // Verify every submitted photo comes from an allowed gallery
  const allowedIds = (order.allowedGalleryIds || []).map((id) =>
    typeof id === 'object' ? id.id || id.toString() : id.toString()
  );
  const allAllowed = selectedPhotoIds.every((p) => allowedIds.includes(p.galleryId?.toString()));
  if (!allAllowed) {
    return res.status(400).json({ message: 'One or more photos are not from an allowed gallery' });
  }

  order.selectedPhotoIds = selectedPhotoIds;
  order.status = 'submitted';
  await ProductOrder.save(order);
  res.json(order);
}));

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

// GET /api/product-orders
router.get('/', asyncHandler(async (req, res) => {
  const filter = { adminId: req.admin.id };
  if (req.query.clientId) filter.clientId = req.query.clientId;
  const orders = await ProductOrder.find(filter, { populate: true });
  res.json(orders);
}));

// POST /api/product-orders
router.post('/', asyncHandler(async (req, res) => {
  const { clientId, name, type, maxPhotos, allowedGalleryIds } = req.body;
  if (!clientId || !name || !type) {
    return res.status(400).json({ message: 'clientId, name, and type are required' });
  }

  const resolvedMax = type === 'print' ? (maxPhotos || 1) : (maxPhotos || 10);
  const order = await ProductOrder.create({
    adminId: req.admin.id,
    clientId,
    name,
    type,
    maxPhotos: resolvedMax,
    allowedGalleryIds: allowedGalleryIds || [],
  });

  const populated = await ProductOrder.findById(order.id, { populate: true });
  res.status(201).json(populated);
}));

// DELETE /api/product-orders/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id))
    return res.status(400).json({ message: 'Invalid ID format' });
  const order = await ProductOrder.findOneAndDelete({ _id: req.params.id, adminId: req.admin.id });
  if (!order) return res.status(404).json({ message: 'Product order not found' });
  res.json({ message: 'Deleted' });
}));

module.exports = router;
