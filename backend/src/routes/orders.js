const express = require('express');
const pool = require('../db');
const StoreOrder = require('../models/StoreOrder');
const Client = require('../models/Client');
const Admin = require('../models/Admin');
const Gallery = require('../models/Gallery');
const { protect } = require('../middleware/auth');
const checkQuota = require('../middleware/checkQuota');
const { uploadImage, validateImageMagicBytes } = require('../middleware/upload');
const { ingestGalleryImages } = require('../utils/ingestGalleryImages');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const { rowToCamel } = require('../db/utils');
const logger = require('../utils/logger');
const { sendOrderStatusEmail } = require('../services/emailService');
const { sendOrderStatusSms } = require('../services/smsService');

const router = express.Router();

/**
 * Fire-and-forget supplier notification (webhook + email) after an order
 * was sent to the supplier. Shared by send-to-supplier and direct orders.
 */
function notifySupplierOrderSent(order, admin) {
  // Per-order confirmation to the photographer (every order they place).
  // Not a tax document — the real receipt is the monthly charge.
  ;(async () => {
    try {
      const invoiceService = require('../services/invoiceService');
      await invoiceService.sendOrderConfirmation({ admin, order });
    } catch (e) {
      logger.warn(`[orders] order-confirmation failed for ${order.id}: ${e.message}`);
    }
  })();

  if (!order.supplier) return;
  ;(async () => {
    try {
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

      if (supplierRow?.email) {
        const { sendOrderToSupplier } = require('../services/emailService');
        await sendOrderToSupplier({
          supplierEmail:   supplierRow.email,
          supplierName:    supplierRow.name,
          studioName:      admin.studioName || admin.name,
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

    // Shape must match the frontend OrderSelectionData contract:
    // { order, galleryImages } with camelCase image fields
    return res.json({ order, galleryImages: galleryImages.map(rowToCamel) });
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

    // I10: clientNote passed into transaction via submitSelection
    const order = await StoreOrder.submitSelection(token, { items, shippingAddress, clientNote });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
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

/**
 * Gate for photographer-initiated ordering (Flow 1 create + Flow 3 direct).
 * Returns a reason string to 403 with, or null when the photographer may order.
 *   no_permission — superadmin disabled supplier ordering for this photographer
 *   blocked       — delinquent (unpaid/failed invoice)
 *   no_card       — no card on file (required before ordering)
 */
async function orderingBlockReason(adminId) {
  const Admin = require('../models/Admin');
  const a = await Admin.findById(adminId);
  if (!a) return 'no_permission';
  if (a.canOrderSupplier === false) return 'no_permission';
  if (a.billingBlocked === true) return 'blocked';
  if (!a.payplusCardToken) return 'no_card';
  return null;
}

// GET /api/orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { clientId, galleryId, status, flow, from, to, page, limit } = req.query;

    // UUID-validate optional filter params
    if (clientId && !UUID_RE.test(clientId)) {
      return res.status(400).json({ message: 'Invalid clientId format' });
    }
    if (galleryId && !UUID_RE.test(galleryId)) {
      return res.status(400).json({ message: 'Invalid galleryId format' });
    }
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ message: 'from/to must be YYYY-MM-DD' });
    }

    const result = await StoreOrder.findAll({
      adminId: req.admin.id,
      clientId:  clientId  || undefined,
      galleryId: galleryId || undefined,
      status:    status    || undefined,
      flow:      flow      || undefined,
      from:      from      || undefined,
      to:        to        || undefined,
      page:      page      ? parseInt(page)  : 1,
      limit:     limit     ? parseInt(limit) : 30,
    });

    return res.json(result);
  })
);

// GET /api/orders/report — full export (all matching rows + summary) for a date range.
// Declared before any '/:id' matcher so 'report' is never parsed as an order id.
router.get(
  '/report',
  asyncHandler(async (req, res) => {
    const { status, flow, from, to } = req.query;
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ message: 'from/to must be YYYY-MM-DD' });
    }
    const result = await StoreOrder.report({
      adminId: req.admin.id,
      status: status || undefined,
      flow: flow || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    return res.json(result);
  })
);

// POST /api/orders
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const blockReason = await orderingBlockReason(req.admin.id);
    if (blockReason) return res.status(403).json({ message: 'Ordering not allowed', reason: blockReason });

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

// ─── Flow 3: photographer direct ordering ─────────────────────────────────────
// NOTE: declared before the /:id matchers so 'direct' is never parsed as an id.

// POST /api/orders/direct/uploads — ad-hoc images for a direct order.
// Files land in the admin's hidden system gallery so the entire existing
// image pipeline (thumbnails, S3, supplier download) keeps working.
router.post(
  '/direct/uploads',
  checkQuota,
  uploadImage.array('images', 200),
  validateImageMagicBytes,
  asyncHandler(async (req, res) => {
    const blockReason = await orderingBlockReason(req.admin.id);
    if (blockReason) return res.status(403).json({ message: 'Ordering not allowed', reason: blockReason });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    const systemGallery = await Gallery.ensureSystemGallery(req.admin.id);
    const images = await ingestGalleryImages(req.files, {
      galleryId: systemGallery.id,
      adminId: req.admin.id,
    });

    return res.status(201).json({ galleryId: systemGallery.id, images });
  })
);

// POST /api/orders/direct — create + immediately send a photographer order
router.post(
  '/direct',
  asyncHandler(async (req, res) => {
    const blockReason = await orderingBlockReason(req.admin.id);
    if (blockReason) return res.status(403).json({ message: 'Ordering not allowed', reason: blockReason });

    const { items, shippingAddress, photographerNote } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items must be a non-empty array' });
    }
    if (
      !shippingAddress || typeof shippingAddress !== 'object' ||
      !shippingAddress.name || !shippingAddress.street || !shippingAddress.city
    ) {
      return res.status(400).json({ message: 'shippingAddress must include name, street, and city' });
    }
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item.productId || !UUID_RE.test(item.productId)) {
        return res.status(400).json({ message: `items[${idx}].productId is not a valid UUID` });
      }
      if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 1)) {
        return res.status(400).json({ message: `items[${idx}].quantity must be a positive integer` });
      }
      if (item.selectedImageIds !== undefined) {
        if (!Array.isArray(item.selectedImageIds) || item.selectedImageIds.some((id) => !UUID_RE.test(id))) {
          return res.status(400).json({ message: `items[${idx}].selectedImageIds must be an array of UUIDs` });
        }
      }
    }

    const created = await StoreOrder.createDirect({
      adminId: req.admin.id,
      items,
      shippingAddress,
      photographerNote: photographerNote || null,
    });

    // Dispatch to the supplier right away — direct orders skip approval
    const order = await StoreOrder.sendToSupplier(created.id, req.admin.id);
    notifySupplierOrderSent(order || created, req.admin);

    return res.status(201).json(order || created);
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

    notifySupplierOrderSent(order, req.admin);

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

// POST /api/orders/:id/notify-client
router.post('/:id/notify-client', protect, async (req, res) => {
  try {
    const order = await StoreOrder.findById(req.params.id, { adminId: req.admin.id });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const notifiableStatuses = ['in_production', 'ready_to_ship', 'shipped', 'delivered'];
    if (!notifiableStatuses.includes(order.status)) {
      return res.status(400).json({ message: 'Cannot notify for current order status' });
    }

    const admin = await Admin.findById(req.admin.id);

    if (order.client?.email) {
      sendOrderStatusEmail({
        clientName:      order.client.name,
        clientEmail:     order.client.email,
        studioName:      admin.studioName || admin.name,
        orderId:         order.id,
        status:          order.status,
        trackingNumber:  order.trackingNumber,
        trackingCarrier: order.trackingCarrier,
      }).catch(() => {});
    }

    if (order.client?.phone) {
      sendOrderStatusSms({
        phone:      order.client.phone,
        clientName: order.client.name,
        studioName: admin.studioName || admin.name,
        status:     order.status,
      }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[notify-client]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
