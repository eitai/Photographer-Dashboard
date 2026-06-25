const express = require('express');
const pool = require('../db');
const StoreOrder = require('../models/StoreOrder');
const { supplierProtect } = require('../middleware/supplierAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const logger = require('../utils/logger');
const s3 = require('../config/s3');
const { sendOrderStatusEmail } = require('../services/emailService');
const { sendOrderStatusSms } = require('../services/smsService');

const router = express.Router();

// supplier_id is assigned at order creation, but suppliers may only see
// orders the photographer actually sent to them.
const SUPPLIER_VISIBLE_STATUSES = ['sent_to_supplier', 'in_production', 'ready_to_ship', 'shipped', 'delivered'];

const notifyPhotographer = async (adminId, orderId, status) => {
  try {
    const Admin = require('../models/Admin');
    const admin = await Admin.findById(adminId);
    if (!admin?.pushToken) return;
    const messages = {
      in_production: 'Order is now in production',
      ready_to_ship: 'Order is ready to ship',
      shipped:       'Order has been shipped!',
      delivered:     'Order has been delivered!',
    };
    await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        to:    admin.pushToken,
        title: 'Order Update',
        body:  messages[status] || 'Order status updated',
        data:  { orderId },
      }),
    });
  } catch (e) {
    // fire-and-forget, ignore errors
  }
};

router.use(supplierProtect);

// GET /api/supplier/orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, from, to, page, limit } = req.query;
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ message: 'from/to must be YYYY-MM-DD' });
    }

    const result = await StoreOrder.findAll({
      supplierId: req.supplier.id,
      status:     status || undefined,
      from:       from   || undefined,
      to:         to     || undefined,
      page:       page   ? parseInt(page)  : 1,
      limit:      limit  ? parseInt(limit) : 30,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  })
);

// GET /api/supplier/orders/report — full export (all matching rows + summary) for a date range.
// Declared before '/:id' so 'report' is never parsed as an order id.
router.get(
  '/report',
  asyncHandler(async (req, res) => {
    const { status, from, to } = req.query;
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ message: 'from/to must be YYYY-MM-DD' });
    }
    const result = await StoreOrder.reportForSupplier({
      supplierId: req.supplier.id,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  })
);

// GET /api/supplier/orders/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.findById(req.params.id);
    if (!order || order.supplierId !== req.supplier.id || !SUPPLIER_VISIBLE_STATUSES.includes(order.status)) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json(order);
  })
);

// PUT /api/supplier/orders/:id/status
router.put(
  '/:id/status',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const { status, trackingNumber, trackingCarrier, supplierNote } = req.body;

    const ALLOWED = ['in_production', 'ready_to_ship', 'shipped', 'delivered'];
    if (!status || !ALLOWED.includes(status)) {
      return res.status(400).json({
        message: `status must be one of: ${ALLOWED.join(', ')}`,
      });
    }

    const order = await StoreOrder.updateSupplierStatus(req.params.id, req.supplier.id, {
      status,
      trackingNumber:  trackingNumber  || undefined,
      trackingCarrier: trackingCarrier || undefined,
      supplierNote:    supplierNote    || undefined,
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or does not belong to this supplier' });
    }

    // Fire-and-forget: push to photographer
    notifyPhotographer(order.adminId, order.id, status).catch(() => {});

    // When delivered, mark the linked product order as delivered too
    if (status === 'delivered') {
      pool.query(
        "UPDATE product_orders SET status = 'delivered', updated_at = NOW() WHERE store_order_id = $1",
        [order.id]
      ).catch(() => {});
    }

    // Fire-and-forget: auto-notify client on shipped + delivered
    if (status === 'shipped' || status === 'delivered') {
      ;(async () => {
        try {
          const { rows } = await pool.query(
            'SELECT name, email, phone FROM clients WHERE id = $1',
            [order.clientId]
          );
          const clientRow = rows[0];
          if (!clientRow) return;

          if (clientRow.email) {
            sendOrderStatusEmail({
              clientName:      clientRow.name,
              clientEmail:     clientRow.email,
              studioName:      '',
              orderId:         order.id,
              status:          status,
              trackingNumber:  trackingNumber || null,
              trackingCarrier: trackingCarrier || null,
            }).catch(() => {});
          }

          if (clientRow.phone) {
            sendOrderStatusSms({
              phone:      clientRow.phone,
              clientName: clientRow.name,
              studioName: '',
              status:     status,
            }).catch(() => {});
          }
        } catch (notifyErr) {
          logger.warn(`[supplierOrders] Client notification failed for order ${order.id}: ${notifyErr.message}`);
        }
      })();
    }

    return res.json(order);
  })
);

// GET /api/supplier/orders/:id/images/download
router.get(
  '/:id/images/download',
  asyncHandler(async (req, res) => {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const order = await StoreOrder.findById(req.params.id);
    if (!order || order.supplierId !== req.supplier.id || !SUPPLIER_VISIBLE_STATUSES.includes(order.status)) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Collect all selected image IDs across all items
    const imageIds = [];
    for (const item of order.items || []) {
      const ids = Array.isArray(item.selectedImageIds) ? item.selectedImageIds : [];
      for (const imgId of ids) {
        if (imgId && !imageIds.includes(imgId)) {
          imageIds.push(imgId);
        }
      }
    }

    if (imageIds.length === 0) {
      return res.json({ urls: [] });
    }

    let urls;

    if (s3.isEnabled()) {
      // Presigned URL path — resolve each image's S3 key then sign
      const urlResults = await Promise.all(
        imageIds.map(async (imgId) => {
          try {
            const { rows } = await pool.query(
              'SELECT path FROM gallery_images WHERE id = $1',
              [imgId]
            );
            if (!rows[0] || !rows[0].path) return null;

            const storedPath = rows[0].path;

            // storedPath can be an S3 key (e.g. "admins/<id>/file.jpg") or a legacy URL
            let key;
            const publicUrl = s3.cfg().publicUrl;
            if (storedPath.startsWith('http') && publicUrl && storedPath.startsWith(publicUrl + '/')) {
              key = storedPath.slice(publicUrl.length + 1);
            } else if (!storedPath.startsWith('/')) {
              // Already a raw key
              key = storedPath;
            } else {
              // Local /uploads/... path — cannot presign
              return null;
            }

            return s3.generatePresignedUrl(key, 3600);
          } catch (err) {
            logger.warn(`[supplierOrders] Presign failed for image ${imgId}: ${err.message}`);
            return null;
          }
        })
      );
      urls = urlResults.filter(Boolean);
    } else {
      // Local file mode — return /uploads/<filename> style paths
      const urlResults = await Promise.all(
        imageIds.map(async (imgId) => {
          try {
            const { rows } = await pool.query(
              'SELECT path, filename FROM gallery_images WHERE id = $1',
              [imgId]
            );
            if (!rows[0]) return null;
            const storedPath = rows[0].path;
            // If it's already a relative path use it; otherwise fall back to filename
            if (storedPath && storedPath.startsWith('/uploads/')) return storedPath;
            if (rows[0].filename) return `/uploads/${rows[0].filename}`;
            return null;
          } catch {
            return null;
          }
        })
      );
      urls = urlResults.filter(Boolean);
    }

    return res.json({ urls });
  })
);

module.exports = router;
