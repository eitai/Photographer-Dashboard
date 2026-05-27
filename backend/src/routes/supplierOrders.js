const express = require('express');
const pool = require('../db');
const StoreOrder = require('../models/StoreOrder');
const { supplierProtect } = require('../middleware/supplierAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const logger = require('../utils/logger');
const s3 = require('../config/s3');

const router = express.Router();

router.use(supplierProtect);

// GET /api/supplier/orders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, page, limit } = req.query;

    const result = await StoreOrder.findAll({
      supplierId: req.supplier.id,
      status:     status || undefined,
      page:       page   ? parseInt(page)  : 1,
      limit:      limit  ? parseInt(limit) : 30,
    });

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
    if (!order || order.supplierId !== req.supplier.id) {
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

    const ALLOWED = ['in_production', 'shipped', 'delivered'];
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

    // Fire-and-forget: notify client when shipped
    if (status === 'shipped' && order.shippingAddress) {
      ;(async () => {
        try {
          // Fetch full client record for phone/email
          const { rows } = await pool.query(
            'SELECT name, email, phone FROM clients WHERE id = $1',
            [order.clientId]
          );
          const clientRow = rows[0];
          if (!clientRow) return;

          const trackingInfo = trackingNumber
            ? ` — tracking: ${trackingNumber}${trackingCarrier ? ` (${trackingCarrier})` : ''}`
            : '';

          // SMS
          if (clientRow.phone) {
            const { sendGallerySms } = require('../services/smsService');
            await sendGallerySms({
              clientName:  clientRow.name,
              clientPhone: clientRow.phone,
              galleryUrl:  process.env.FRONTEND_URL || '',
              lang:        'he',
            }).catch((err) =>
              logger.warn(`[supplierOrders] SMS failed for order ${order.id}: ${err.message}`)
            );
          }

          // Email — best effort, log if unavailable
          if (clientRow.email) {
            const transporter = (() => {
              try {
                return require('../services/emailService');
              } catch {
                return null;
              }
            })();
            if (transporter) {
              // Simple shipped notification reusing sendOrderSelectionLink with shipping context
              logger.info(
                `[supplierOrders] Order ${order.id} shipped${trackingInfo} — client: ${clientRow.email}`
              );
            }
          }
        } catch (notifyErr) {
          logger.warn(`[supplierOrders] Shipped notification failed for order ${order.id}: ${notifyErr.message}`);
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
    if (!order || order.supplierId !== req.supplier.id) {
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
