const express = require('express');
const ProductOrder = require('../models/ProductOrder');
const Gallery = require('../models/Gallery');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');

const router = express.Router();

// GET /api/product-orders/gallery/:token  — PUBLIC
router.get(
  '/gallery/:token',
  asyncHandler(async (req, res) => {
    const gallery = await Gallery.findOne({ token: req.params.token, isActive: true });
    if (!gallery) return res.status(404).json({ message: 'Gallery not found' });
    if (gallery.expiresAt && new Date(gallery.expiresAt) < new Date()) return res.status(410).json({ message: 'Gallery has expired' });

    const clientId = typeof gallery.clientId === 'object' ? gallery.clientId?.id : gallery.clientId;
    const orders = await ProductOrder.find({ adminId: gallery.adminId, ...(clientId ? { clientId } : {}) }, { populate: true });
    res.json(orders);
  }),
);

// PUT /api/product-orders/:id/selection  — PUBLIC (client submits picks)
router.put(
  '/:id/selection',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });

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
    const allowedIds = (order.allowedGalleryIds || []).map((id) => (typeof id === 'object' ? id.id || id.toString() : id.toString()));
    if (allowedIds.length > 0) {
      const allAllowed = selectedPhotoIds.every((p) => allowedIds.includes(p.galleryId?.toString()));
      if (!allAllowed) {
        return res.status(400).json({ message: 'One or more photos are not from an allowed gallery' });
      }
    }

    order.selectedPhotoIds = selectedPhotoIds;
    order.status = 'submitted';
    await ProductOrder.save(order);
    res.json(order);
  }),
);

// GET /api/product-orders/order/:orderToken  — PUBLIC (fetch single order by its own token)
router.get(
  '/order/:orderToken',
  asyncHandler(async (req, res) => {
    const order = await ProductOrder.findByToken(req.params.orderToken);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.linkEnabled) return res.status(403).json({ message: 'This link is not active' });
    const populated = await ProductOrder.findById(order.id, { populate: true });
    res.json(populated);
  }),
);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

// GET /api/product-orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { adminId: req.admin.id };
    if (req.query.clientId) filter.clientId = req.query.clientId;
    const orders = await ProductOrder.find(filter, { populate: true });
    res.json(orders);
  }),
);

// POST /api/product-orders
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { clientId, name, type, maxPhotos, allowedGalleryIds } = req.body;
    if (!clientId || !name || !type) {
      return res.status(400).json({ message: 'clientId, name, and type are required' });
    }

    // If no explicit allowedGalleryIds provided, default to all galleries for this client
    let resolvedGalleryIds = allowedGalleryIds && allowedGalleryIds.length > 0 ? allowedGalleryIds : [];
    if (!resolvedGalleryIds.length) {
      const clientGalleries = await Gallery.find({ adminId: req.admin.id, clientId });
      resolvedGalleryIds = clientGalleries.map((g) => g.id);
    }

    const resolvedMax = type === 'print' ? maxPhotos || 1 : maxPhotos || 10;
    const order = await ProductOrder.create({
      adminId: req.admin.id,
      clientId,
      name,
      type,
      maxPhotos: resolvedMax,
      allowedGalleryIds: resolvedGalleryIds,
    });

    const populated = await ProductOrder.findById(order.id, { populate: true });
    res.status(201).json(populated);
  }),
);

// POST /api/product-orders/send-links-email  — sends all enabled order links to the client
router.post(
  '/send-links-email',
  asyncHandler(async (req, res) => {
    const { clientId, clientName, clientEmail } = req.body;
    if (!clientId || !clientEmail) {
      return res.status(400).json({ message: 'clientId and clientEmail are required' });
    }

    const orders = await ProductOrder.find({ adminId: req.admin.id, clientId });
    const enabledOrders = orders.filter((o) => o.linkEnabled && o.token);

    if (enabledOrders.length === 0) {
      return res.status(400).json({ message: 'No enabled product order links to send' });
    }

    const frontendUrl = process.env.FRONTEND_URL;
    const links = enabledOrders.map((o) => ({
      name: o.name,
      type: o.type,
      url: `${frontendUrl}/products/order/${o.token}`,
    }));

    const { sendProductOrderLinks } = require('../services/emailService');
    await sendProductOrderLinks({
      clientName: clientName || 'Client',
      clientEmail,
      studioName: req.admin.studioName || req.admin.name,
      links,
    });

    res.json({ message: 'Email sent', count: links.length });
  }),
);

// PATCH /api/product-orders/:id/link  — toggle link_enabled
router.patch(
  '/:id/link',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'enabled must be a boolean' });
    const order = await ProductOrder.findById(req.params.id);
    if (!order || order.adminId !== req.admin.id) return res.status(404).json({ message: 'Order not found' });
    const updated = await ProductOrder.setLinkEnabled(req.params.id, enabled);
    res.json(updated);
  }),
);

// PATCH /api/product-orders/:id/deliver  — mark as delivered
router.patch(
  '/:id/deliver',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });
    const order = await ProductOrder.findById(req.params.id);
    if (!order || order.adminId !== req.admin.id) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'submitted') return res.status(409).json({ message: 'Only submitted orders can be marked as delivered' });
    const updated = await ProductOrder.markDelivered(req.params.id);
    res.json(updated);
  }),
);

// PATCH /api/product-orders/:id/galleries — update allowed gallery list
router.patch(
  '/:id/galleries',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });

    const { allowedGalleryIds } = req.body;
    if (!Array.isArray(allowedGalleryIds)) return res.status(400).json({ message: 'allowedGalleryIds must be an array' });

    const order = await ProductOrder.findById(req.params.id);
    if (!order || order.adminId !== req.admin.id) return res.status(404).json({ message: 'Order not found' });

    // Validate that every supplied ID belongs to this admin+client
    if (allowedGalleryIds.length > 0) {
      const clientGalleries = await Gallery.find({ adminId: req.admin.id, clientId: order.clientId });
      const validIds = new Set(clientGalleries.map((g) => g.id));
      const invalid = allowedGalleryIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) return res.status(422).json({ message: 'One or more gallery IDs are invalid', invalid });
    }

    await ProductOrder.updateAllowedGalleries(req.params.id, allowedGalleryIds);
    const populated = await ProductOrder.findById(req.params.id, { populate: true });
    res.json(populated);
  }),
);

// DELETE /api/product-orders/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });
    const order = await ProductOrder.findOneAndDelete({ _id: req.params.id, adminId: req.admin.id });
    if (!order) return res.status(404).json({ message: 'Product order not found' });
    res.json({ message: 'Deleted' });
  }),
);

module.exports = router;
