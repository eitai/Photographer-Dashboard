const express = require('express');
const pool = require('../db');
const StoreOrder = require('../models/StoreOrder');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const logger = require('../utils/logger');

const router = express.Router();

// ─── Public routes (no auth required) ────────────────────────────────────────

// GET /api/orders/selection/:token
// Returns order detail + gallery images for the client selection UI.
router.get(
  '/selection/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;

    const order = await StoreOrder.findBySelectionToken(token);
    if (!order || order.status !== 'pending_selection') {
      return res.status(404).json({ message: 'Order not found or no longer accepting selections' });
    }

    // Fetch gallery images for the selection UI
    const { rows: galleryImages } = await pool.query(
      `SELECT id, filename, path, thumbnail_path, sort_order
         FROM gallery_images
        WHERE gallery_id = $1
        ORDER BY sort_order ASC`,
      [order.galleryId]
    );

    return res.json({ ...order, galleryImages });
  })
);

// POST /api/orders/selection/:token
// Client submits their image selections.
router.post(
  '/selection/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { items, shippingAddress, clientNote } = req.body;

    // Validate required fields
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'items must be an array' });
    }
    if (
      !shippingAddress ||
      !shippingAddress.name ||
      !shippingAddress.street ||
      !shippingAddress.city
    ) {
      return res.status(400).json({ message: 'shippingAddress with name, street, and city is required' });
    }

    const order = await StoreOrder.submitSelection(token, { items, shippingAddress });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update client_note if provided
    if (clientNote && typeof clientNote === 'string') {
      await pool.query(
        'UPDATE store_orders SET client_note = $1 WHERE id = $2',
        [clientNote, order.id]
      );
    }

    // Fire-and-forget: push notification to admin
    ;(async () => {
      try {
        const admin = await Admin.findById(order.adminId);
        if (admin?.pushToken) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              to:       admin.pushToken,
              title:    'Order Selection Submitted',
              body:     `Client submitted selection for order #${order.id.slice(0, 8)}`,
              data:     { orderId: order.id },
              sound:    'default',
              priority: 'high',
            }),
          });
        }
      } catch (pushErr) {
        logger.warn(`[orders] Push notification failed for order ${order.id}: ${pushErr.message}`);
      }
    })();

    // Fire-and-forget: email to admin
    ;(async () => {
      try {
        const { sendOrderSelectionLink } = require('../services/emailService');
        const admin = await Admin.findById(order.adminId);
        if (admin?.email) {
          await sendOrderSelectionLink({
            clientName:   order.client?.name || 'A client',
            clientEmail:  admin.email,
            studioName:   admin.studioName || admin.name,
            selectionUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`,
            orderItems:   (order.items || []).map((it) => ({
              productName: it.product?.name || it.productId,
              quantity:    it.quantity,
            })),
          });
        }
      } catch (emailErr) {
        logger.warn(`[orders] Admin notification email failed for order ${order.id}: ${emailErr.message}`);
      }
    })();

    return res.json({ message: 'Selection submitted', orderId: order.id });
  })
);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);

// GET /api/orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { clientId, galleryId, status, flow, page, limit } = req.query;

    // UUID-validate optional filter params
    if (clientId && !UUID_RE.test(clientId)) {
      return res.status(400).json({ message: 'Invalid clientId format' });
    }
    if (galleryId && !UUID_RE.test(galleryId)) {
      return res.status(400).json({ message: 'Invalid galleryId format' });
    }

    const result = await StoreOrder.findAll({
      adminId: req.admin.id,
      clientId:  clientId  || undefined,
      galleryId: galleryId || undefined,
      status:    status    || undefined,
      flow:      flow      || undefined,
      page:      page      ? parseInt(page)  : 1,
      limit:     limit     ? parseInt(limit) : 30,
    });

    return res.json(result);
  })
);

// POST /api/orders
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { clientId, galleryId, items, photographerNote } = req.body;

    // Required field validation
    if (!clientId || !galleryId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'clientId, galleryId, and at least one item are required' });
    }

    // UUID validation
    if (!UUID_RE.test(clientId)) {
      return res.status(400).json({ message: 'Invalid clientId format' });
    }
    if (!UUID_RE.test(galleryId)) {
      return res.status(400).json({ message: 'Invalid galleryId format' });
    }
    for (const item of items) {
      if (!item.productId || !UUID_RE.test(item.productId)) {
        return res.status(400).json({ message: 'Each item must have a valid productId' });
      }
    }

    // Verify client belongs to this admin
    const client = await Client.findOne({ id: clientId, adminId: req.admin.id });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const order = await StoreOrder.create({
      adminId:         req.admin.id,
      clientId,
      galleryId,
      items,
      photographerNote: photographerNote || null,
    });

    return res.status(201).json(order);
  })
);

// GET /api/orders/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.findById(req.params.id, { adminId: req.admin.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    return res.json(order);
  })
);

// PUT /api/orders/:id
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.updateDraft(req.params.id, req.admin.id, req.body);
    if (!order) return res.status(404).json({ message: 'Order not found or not in draft status' });

    return res.json(order);
  })
);

// DELETE /api/orders/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const result = await StoreOrder.deleteOrder(req.params.id, req.admin.id);
    if (!result) return res.status(404).json({ message: 'Order not found' });

    return res.json({ message: 'Order deleted' });
  })
);

// POST /api/orders/:id/send-to-client
router.post(
  '/:id/send-to-client',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.generateSelectionToken(req.params.id, req.admin.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found or not in draft status' });
    }

    const selectionUrl = `${process.env.FRONTEND_URL}/order-selection/${order.selectionToken}`;

    // Get client contact details
    const clientRecord = await Client.findOne({ id: order.clientId, adminId: req.admin.id });

    // Fire-and-forget SMS
    if (clientRecord?.phone) {
      ;(async () => {
        try {
          const { sendGallerySms } = require('../services/smsService');
          await sendGallerySms({
            clientName:  clientRecord.name,
            clientPhone: clientRecord.phone,
            galleryUrl:  selectionUrl,
          });
        } catch (smsErr) {
          logger.warn(`[orders] SMS failed for order ${order.id}: ${smsErr.message}`);
        }
      })();
    }

    // Fire-and-forget Email
    if (clientRecord?.email) {
      ;(async () => {
        try {
          const { sendOrderSelectionLink } = require('../services/emailService');
          await sendOrderSelectionLink({
            clientName:   clientRecord.name,
            clientEmail:  clientRecord.email,
            studioName:   req.admin.studioName || req.admin.name,
            selectionUrl,
            orderItems:   (order.items || []).map((it) => ({
              productName: it.product?.name || it.productId,
              quantity:    it.quantity,
            })),
          });
        } catch (emailErr) {
          logger.warn(`[orders] Client email failed for order ${order.id}: ${emailErr.message}`);
        }
      })();
    }

    return res.json(order);
  })
);

// POST /api/orders/:id/approve
router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.approve(req.params.id, req.admin.id);
    if (!order) {
      return res.status(409).json({ message: 'Order must be in selection_submitted status to approve' });
    }

    return res.json(order);
  })
);

// POST /api/orders/:id/send-to-supplier
router.post(
  '/:id/send-to-supplier',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.sendToSupplier(req.params.id, req.admin.id);
    if (!order) {
      return res.status(409).json({ message: 'Order must be in approved status to send to supplier' });
    }

    // Fire-and-forget: supplier webhook
    if (order.supplier) {
      ;(async () => {
        try {
          // Look up full supplier record for webhook URL
          const { rows } = await pool.query(
            'SELECT api_webhook_url, email, name FROM suppliers WHERE id = $1',
            [order.supplierId]
          );
          const supplierRow = rows[0];

          if (supplierRow?.api_webhook_url) {
            await fetch(supplierRow.api_webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'order.sent', orderId: order.id }),
            });
          }

          // Send email to supplier
          if (supplierRow?.email) {
            const { sendOrderToSupplier } = require('../services/emailService');
            await sendOrderToSupplier({
              supplierEmail:   supplierRow.email,
              supplierName:    supplierRow.name,
              studioName:      req.admin.studioName || req.admin.name,
              orderId:         order.id,
              orderItems:      (order.items || []).map((it) => ({
                productName: it.product?.name || it.productId,
                quantity:    it.quantity,
                specs:       it.product?.specs || null,
              })),
              shippingAddress: order.shippingAddress,
              notes:           order.photographerNote || order.supplierNote || null,
            });
          }
        } catch (supplierErr) {
          logger.warn(`[orders] Supplier notification failed for order ${order.id}: ${supplierErr.message}`);
        }
      })();
    }

    return res.json(order);
  })
);

// POST /api/orders/:id/cancel
router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.cancel(req.params.id, req.admin.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    return res.json({ message: 'Order cancelled' });
  })
);

module.exports = router;
