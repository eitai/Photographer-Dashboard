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

    // Attach linked StoreOrder status/tracking so the customer page can show
    // production/shipping state on previously submitted orders
    const storeOrderIds = orders.map((o) => o.storeOrderId).filter(Boolean);
    if (storeOrderIds.length > 0) {
      const pool = require('../db');
      const { rows } = await pool.query(
        'SELECT id, status, tracking_number, tracking_carrier FROM store_orders WHERE id = ANY($1::uuid[])',
        [storeOrderIds]
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const o of orders) {
        const so = o.storeOrderId ? byId.get(o.storeOrderId) : null;
        if (so) {
          o.supplierStatus = so.status;
          o.trackingNumber = so.tracking_number;
          o.trackingCarrier = so.tracking_carrier;
        }
      }
    }

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

    // Attach the linked StoreOrder status so the customer page can show production/shipping updates
    if (populated && populated.storeOrderId) {
      const pool = require('../db');
      const { rows } = await pool.query(
        'SELECT status, tracking_number, tracking_carrier FROM store_orders WHERE id = $1',
        [populated.storeOrderId]
      );
      if (rows[0]) {
        populated.supplierStatus = rows[0].status;
        populated.trackingNumber = rows[0].tracking_number;
        populated.trackingCarrier = rows[0].tracking_carrier;
      }
    }

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

// POST /api/product-orders/:id/send-to-supplier
router.post('/:id/send-to-supplier', protect, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });

    const { photographerNote } = req.body;

    // 1. Find the product order
    const order = await ProductOrder.findById(req.params.id);
    if (!order || order.adminId !== req.admin.id)
      return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'submitted')
      return res.status(400).json({ message: 'Order must be submitted before sending to supplier' });
    if (order.storeOrderId)
      return res.status(400).json({ message: 'Already sent to supplier' });

    // 2. Find exclusive supplier
    const pool = require('../db');
    const supplierRes = await pool.query(
      'SELECT * FROM suppliers WHERE is_active = true ORDER BY is_exclusive DESC, created_at ASC LIMIT 1'
    );
    const supplier = supplierRes.rows[0];
    if (!supplier) return res.status(400).json({ message: 'No active supplier found' });

    // 3. Find a matching supplier product (by type: album|print)
    const typeMap = { album: 'album', print: 'print' };
    const mappedType = typeMap[order.type] || 'other';
    const productRes = await pool.query(
      `SELECT * FROM supplier_products
       WHERE supplier_id = $1 AND is_active = true
       ORDER BY CASE WHEN type = $2 THEN 0 ELSE 1 END, sort_order ASC
       LIMIT 1`,
      [supplier.id, mappedType]
    );
    const supplierProduct = productRes.rows[0];
    if (!supplierProduct) {
      // Without a supplier product there is no order item, so the supplier
      // would receive an order with no photos — fail loudly instead.
      return res.status(409).json({
        message: 'The supplier has no products configured yet — cannot send this order',
      });
    }

    // 4. Get gallery id (use first allowed gallery)
    const rawGalleries = order.allowedGalleryIds || [];
    // allowedGalleryIds may be strings or populated objects
    const galleryId = typeof rawGalleries[0] === 'string'
      ? rawGalleries[0]
      : rawGalleries[0]?.id || rawGalleries[0]?._id || null;
    if (!galleryId)
      return res.status(400).json({ message: 'No gallery associated with this order' });

    // 5. Extract selected image IDs (handle both {imageId} and {_id} shapes)
    const selectedImageIds = (order.selectedPhotoIds || [])
      .map((p) => p.imageId || p._id || p.id)
      .filter(Boolean);

    // 5b. Fetch client address
    const clientRes = await pool.query(
      'SELECT name, email, phone, address_street, address_apartment, address_city, address_zip, address_country FROM clients WHERE id = $1',
      [order.clientId]
    );
    const client = clientRes.rows[0];
    const shippingAddress = client && (client.address_street || client.address_city) ? {
      name:      client.name,
      phone:     client.phone,
      street:    client.address_street,
      apartment: client.address_apartment,
      city:      client.address_city,
      zip:       client.address_zip,
      country:   client.address_country || 'ישראל',
    } : null;

    // Build photographer note
    const note = photographerNote
      ? `${order.name} (${order.type}) — ${selectedImageIds.length} photos selected\n${photographerNote}`
      : `${order.name} (${order.type}) — ${selectedImageIds.length} photos selected`;

    // 6. Create StoreOrder + optional item in a transaction
    const txClient = await pool.connect();
    let newOrder;
    try {
      await txClient.query('BEGIN');

      const { rows: [inserted] } = await txClient.query(
        `INSERT INTO store_orders
           (admin_id, client_id, gallery_id, supplier_id, flow, status,
            photographer_note, total_amount, currency, shipping_address, sent_to_supplier_at, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, 'photographer', 'sent_to_supplier',
            $5, $6, 'ILS', $7::jsonb, NOW(), NOW(), NOW())
         RETURNING *`,
        [
          req.admin.id,
          order.clientId,
          galleryId,
          supplier.id,
          note,
          supplierProduct.cost_price,
          shippingAddress ? JSON.stringify(shippingAddress) : null,
        ]
      );
      newOrder = inserted;

      // Always create the item so the supplier sees the product and the
      // client's selected photos (selectedImageIds may legitimately be empty
      // for digital/no-photo products)
      await txClient.query(
        `INSERT INTO store_order_items
           (order_id, product_id, quantity, unit_cost_price, unit_client_price, selected_image_ids, created_at)
         VALUES
           ($1, $2, 1, $3, $4, $5::uuid[], NOW())`,
        [
          newOrder.id,
          supplierProduct.id,
          supplierProduct.cost_price,
          supplierProduct.client_price,
          selectedImageIds,
        ]
      );

      // 7. Link the product order back to the store order
      await txClient.query(
        'UPDATE product_orders SET store_order_id = $1, updated_at = NOW() WHERE id = $2',
        [newOrder.id, order.id]
      );

      await txClient.query('COMMIT');
    } catch (txErr) {
      await txClient.query('ROLLBACK');
      console.error('[send-to-supplier] transaction error:', txErr.message, txErr.detail || '');
      throw txErr;
    } finally {
      txClient.release();
    }

    // 8. Notify supplier via email (fire-and-forget)
    try {
      const { sendOrderToSupplier: sendSupplierEmail } = require('../services/emailService');
      const emailOrder = {
        id: newOrder.id,
        client: { name: '', email: '' },
        items: [{ product: { name: supplierProduct.name, type: supplierProduct.type }, quantity: 1, selectedImageIds }],
        photographerNote: newOrder.photographer_note,
      };
      sendSupplierEmail({ supplier, order: emailOrder }).catch(() => {});
    } catch { /* email is optional */ }

    res.json({ ok: true, storeOrderId: newOrder.id, hasAddress: !!shippingAddress });
  } catch (err) {
    console.error('[send-to-supplier]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
