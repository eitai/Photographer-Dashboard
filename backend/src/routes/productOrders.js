const express = require('express');
const ProductOrder = require('../models/ProductOrder');
const Gallery = require('../models/Gallery');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── Public routes (no auth) ──────────────────────────────────────────────────

// GET /api/product-orders/gallery/:token
// Returns all product orders whose allowedGalleryIds include any gallery
// accessible by this token. Used by the client gallery page.
router.get('/gallery/:token', async (req, res) => {
  try {
    const gallery = await Gallery.findOne({ token: req.params.token, isActive: true });
    if (!gallery) return res.status(404).json({ message: 'Gallery not found' });

    // Collect the IDs we should match: the gallery itself, plus any gallery
    // that shares the same clientId owned by the same admin (so the client can
    // see orders from all their galleries in one place). We keep it simple and
    // just query by clientId + adminId to get all orders for this client.
    const orders = await ProductOrder.find({
      adminId: gallery.adminId,
      clientId: gallery.clientId,
    })
      .populate('allowedGalleryIds', 'name isDelivery')
      .lean();

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/product-orders/:id/selection  — client submits their photo picks
router.put('/:id/selection', async (req, res) => {
  try {
    const { selectedPhotoIds } = req.body;
    if (!Array.isArray(selectedPhotoIds)) {
      return res.status(400).json({ message: 'selectedPhotoIds must be an array' });
    }

    const order = await ProductOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Product order not found' });
    if (order.status === 'submitted') {
      return res.status(409).json({ message: 'Selection already submitted' });
    }

    // Validate count
    if (selectedPhotoIds.length > order.maxPhotos) {
      return res.status(400).json({ message: `Maximum ${order.maxPhotos} photo(s) allowed` });
    }

    order.selectedPhotoIds = selectedPhotoIds;
    order.status = 'submitted';
    await order.save();

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Protected routes (admin auth required) ───────────────────────────────────

router.use(protect);

// GET /api/product-orders?clientId=:id
router.get('/', async (req, res) => {
  try {
    const filter = { adminId: req.admin._id };
    if (req.query.clientId) filter.clientId = req.query.clientId;
    const orders = await ProductOrder.find(filter)
      .populate('allowedGalleryIds', 'name isDelivery')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/product-orders
router.post('/', async (req, res) => {
  try {
    const { clientId, name, type, maxPhotos, allowedGalleryIds } = req.body;

    if (!clientId || !name || !type) {
      return res.status(400).json({ message: 'clientId, name, and type are required' });
    }

    // For print type, maxPhotos defaults to 1
    const resolvedMax = type === 'print' ? (maxPhotos || 1) : (maxPhotos || 10);

    const order = await ProductOrder.create({
      adminId: req.admin._id,
      clientId,
      name,
      type,
      maxPhotos: resolvedMax,
      allowedGalleryIds: allowedGalleryIds || [],
    });

    const populated = await order.populate('allowedGalleryIds', 'name isDelivery');
    res.status(201).json(populated);
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/product-orders/:id
router.delete('/:id', async (req, res) => {
  try {
    const order = await ProductOrder.findOneAndDelete({
      _id: req.params.id,
      adminId: req.admin._id,
    });
    if (!order) return res.status(404).json({ message: 'Product order not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
