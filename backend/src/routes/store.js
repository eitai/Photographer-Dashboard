const express    = require('express');
const pool       = require('../db');
const { rowToCamel } = require('../db/utils');
const { UUID_RE }    = require('../utils/uuid');
const asyncHandler   = require('../middleware/asyncHandler');
const Admin          = require('../models/Admin');
const payplus        = require('../utils/payplus');
const logger         = require('../utils/logger');
const { checkPhotoCount } = require('../utils/validatePhotoCounts');

const router = express.Router();

// ─── GET /store/products/:galleryToken ── public ──────────────────────────────
// Returns the active product catalogue for the exclusive supplier.
// A missing exclusive supplier returns { products: [] } instead of 404 because
// the store panel simply should not render rather than show an error page.
router.get(
  '/products/:galleryToken',
  asyncHandler(async (req, res) => {
    const { galleryToken } = req.params;

    // 1. Resolve gallery by token (+ the photographer's store permission)
    const { rows: galRows } = await pool.query(
      `SELECT g.id, g.admin_id, g.client_id, g.name, a.clients_can_order
       FROM galleries g
       JOIN admins a ON a.id = g.admin_id
       WHERE g.token = $1 AND g.is_active = true
       LIMIT 1`,
      [galleryToken],
    );
    if (!galRows[0]) {
      return res.status(404).json({ message: 'Gallery not found' });
    }
    // Photographer's clients are not allowed to order → render nothing (no store tab)
    if (galRows[0].clients_can_order === false) {
      return res.json({ products: [] });
    }

    // 2. Find exclusive active supplier
    const { rows: supRows } = await pool.query(
      `SELECT id, name FROM suppliers
       WHERE is_exclusive = true AND is_active = true
       LIMIT 1`,
    );
    if (!supRows[0]) {
      return res.json({ products: [] });
    }
    const supplier = supRows[0];

    // 3. Fetch active products ordered by sort_order
    const { rows: prodRows } = await pool.query(
      `SELECT id, name, type, description, sku, specs,
              client_price, image_preview_path, sort_order,
              min_photos, max_photos, production_days, variations
       FROM supplier_products
       WHERE supplier_id = $1 AND is_active = true
       ORDER BY sort_order ASC`,
      [supplier.id],
    );

    const products = prodRows.map((r) => rowToCamel(r));

    return res.json({
      supplierId:   supplier.id,
      supplierName: supplier.name,
      products,
    });
  }),
);

// ─── POST /store/:galleryToken/checkout ── public ─────────────────────────────
// Client submits cart → order created → PayPlus payment link returned.
router.post(
  '/:galleryToken/checkout',
  asyncHandler(async (req, res) => {
    const { galleryToken } = req.params;
    const { items, shippingAddress, clientNote } = req.body;

    // 1. Validate top-level body shape
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items must be a non-empty array' });
    }
    if (
      !shippingAddress ||
      typeof shippingAddress !== 'object' ||
      !shippingAddress.name ||
      !shippingAddress.street ||
      !shippingAddress.city
    ) {
      return res.status(400).json({
        message: 'shippingAddress must include name, street, and city',
      });
    }

    // 2. Validate each item
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item.productId || !UUID_RE.test(item.productId)) {
        return res
          .status(400)
          .json({ message: `items[${idx}].productId is not a valid UUID` });
      }
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return res
          .status(400)
          .json({ message: `items[${idx}].quantity must be a positive integer` });
      }
    }

    // 3. Resolve gallery by token (+ store permission)
    const { rows: galRows } = await pool.query(
      `SELECT g.id, g.admin_id, g.client_id, g.name, a.clients_can_order
       FROM galleries g
       JOIN admins a ON a.id = g.admin_id
       WHERE g.token = $1 AND g.is_active = true
       LIMIT 1`,
      [galleryToken],
    );
    if (!galRows[0]) {
      return res.status(404).json({ message: 'Gallery not found' });
    }
    if (galRows[0].clients_can_order === false) {
      return res.status(403).json({ message: 'Store ordering is not available for this gallery' });
    }
    const gallery   = galRows[0];
    const adminId   = gallery.admin_id;
    const clientId  = gallery.client_id;
    const galleryId = gallery.id;

    // 4. Find exclusive active supplier — 503 if absent (store temporarily unavailable)
    const { rows: supRows } = await pool.query(
      `SELECT id FROM suppliers
       WHERE is_exclusive = true AND is_active = true
       LIMIT 1`,
    );
    if (!supRows[0]) {
      return res
        .status(503)
        .json({ message: 'Store is not available at this time' });
    }
    const supplierId = supRows[0].id;

    // 5. Fetch and validate all products in one query
    const productIds = items.map((i) => i.productId);
    const { rows: prodRows } = await pool.query(
      `SELECT id, name, cost_price, client_price, is_active, min_photos, max_photos
       FROM supplier_products
       WHERE id = ANY($1::uuid[]) AND supplier_id = $2`,
      [productIds, supplierId],
    );

    if (prodRows.length !== productIds.length) {
      return res
        .status(422)
        .json({ message: 'One or more products were not found' });
    }
    const inactiveProducts = prodRows.filter((p) => !p.is_active);
    if (inactiveProducts.length > 0) {
      return res.status(422).json({ message: 'One or more products are inactive' });
    }

    // Build a map for O(1) lookups during total computation and item inserts
    const productMap = new Map(prodRows.map((p) => [p.id, p]));

    // 5b. Enforce per-product photo selection requirements
    for (const item of items) {
      const prod = productMap.get(item.productId);
      const count = Array.isArray(item.selectedImageIds) ? item.selectedImageIds.length : 0;
      try {
        checkPhotoCount(prod, count);
      } catch (countErr) {
        return res.status(countErr.status || 422).json({ message: countErr.message });
      }
    }

    // 6. Compute total using client_price
    let total = 0;
    for (const item of items) {
      const prod = productMap.get(item.productId);
      total += item.quantity * Number(prod.client_price);
    }
    total = Math.round(total * 100) / 100; // round to 2 dp

    if (total <= 0) {
      return res.status(422).json({ message: 'Order total must be greater than zero' });
    }

    // 7. Create order + items in a transaction
    const txClient = await pool.connect();
    let orderId;
    try {
      await txClient.query('BEGIN');

      const orderRes = await txClient.query(
        `INSERT INTO store_orders
           (admin_id, client_id, gallery_id, supplier_id, flow, status,
            payment_status, total_amount, currency, shipping_address, client_note)
         VALUES ($1, $2, $3, $4, 'client', 'pending_selection',
                 'pending', $5, 'ILS', $6, $7)
         RETURNING id`,
        [
          adminId,
          clientId,
          galleryId,
          supplierId,
          total,
          JSON.stringify(shippingAddress),
          clientNote || null,
        ],
      );
      orderId = orderRes.rows[0].id;

      for (const item of items) {
        const prod         = productMap.get(item.productId);
        const selectedIds  = Array.isArray(item.selectedImageIds) && item.selectedImageIds.length > 0
          ? item.selectedImageIds
          : [];
        const imageNotes   = item.imageNotes && typeof item.imageNotes === 'object'
          ? item.imageNotes
          : {};
        const productOpts  = item.productOptions && typeof item.productOptions === 'object'
          ? item.productOptions
          : {};

        await txClient.query(
          `INSERT INTO store_order_items
             (order_id, product_id, quantity, unit_cost_price, unit_client_price,
              selected_image_ids, image_notes, product_options)
           VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7, $8)`,
          [
            orderId,
            item.productId,
            item.quantity,
            prod.cost_price,
            prod.client_price,
            selectedIds.length > 0 ? JSON.stringify(selectedIds) : '{}',
            JSON.stringify(imageNotes),
            JSON.stringify(productOpts),
          ],
        );
      }

      await txClient.query('COMMIT');
    } catch (err) {
      await txClient.query('ROLLBACK');
      throw err;
    } finally {
      txClient.release();
    }

    // 8. Generate PayPlus payment link
    const payplusResult = await payplus.generateStorePaymentLink({
      amount:     total,
      orderId,
      clientName: shippingAddress.name,
      items: items.map((item) => {
        const prod = productMap.get(item.productId);
        return { name: prod.name, quantity: item.quantity, unitPrice: prod.client_price };
      }),
      successUrl:  `${process.env.FRONTEND_URL}/store/order/${orderId}`,
      failureUrl:  `${process.env.FRONTEND_URL}/store/order/${orderId}?failed=1`,
      cancelUrl:   `${process.env.FRONTEND_URL}/gallery/${galleryToken}`,
      callbackUrl: `${process.env.BACKEND_URL}/api/store/webhook/payplus`,
    });

    // 9. Persist the PayPlus payment page UID against the order
    const paymentPageUid = payplusResult?.data?.payment_page_uid ?? payplusResult?.payment_page_uid ?? null;
    await pool.query(
      'UPDATE store_orders SET payplus_payment_page_uid = $1 WHERE id = $2',
      [paymentPageUid, orderId],
    );

    // 10. Return checkout URL to client
    const paymentUrl = payplusResult?.data?.payment_page_url ?? payplusResult?.payment_page_url ?? null;
    return res.status(201).json({ orderId, url: paymentUrl });
  }),
);

// ─── GET /store/orders/:orderId/status ── public (status polling) ─────────────
router.get(
  '/orders/:orderId/status',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params;

    if (!UUID_RE.test(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const { rows } = await pool.query(
      `SELECT id, status, payment_status, total_amount, currency,
              tracking_number, tracking_carrier, shipped_at, created_at
       FROM store_orders
       WHERE id = $1 AND flow = 'client'`,
      [orderId],
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = rowToCamel(rows[0]);

    // Receipt PDF link, if a document has been issued for this order
    const IssuedDocument = require('../models/IssuedDocument');
    const receipt = await IssuedDocument.findBySource('store_order', orderId, 'receipt');

    return res.json({
      id:              order.id,
      status:          order.status,
      paymentStatus:   order.paymentStatus,
      totalAmount:     order.totalAmount,
      currency:        order.currency,
      trackingNumber:  order.trackingNumber  || null,
      trackingCarrier: order.trackingCarrier || null,
      shippedAt:       order.shippedAt       || null,
      createdAt:       order.createdAt,
      receiptUrl:      receipt?.pdfUrl || null,
    });
  }),
);

// ─── POST /store/webhook/payplus ── public (PayPlus IPN callback) ─────────────
router.post(
  '/webhook/payplus',
  asyncHandler(async (req, res) => {
    const payload = req.body;

    // 1. Verify signature — hard reject if missing or invalid (C1)
    if (!process.env.PAYPLUS_SECRET_KEY) {
      logger.warn('PayPlus store webhook: PAYPLUS_SECRET_KEY not configured');
      return res.status(400).json({ message: 'Webhook secret not configured' });
    }
    const valid = payplus.verifyWebhookSignature(payload);
    if (!valid) {
      logger.warn('PayPlus store webhook: invalid signature');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // 2. Parse more_info to extract orderId and flow discriminator
    let orderId;
    try {
      const info = JSON.parse(payload.more_info || '{}');
      orderId = info.orderId;
      if (info.flow !== 'client') {
        // Subscription webhook routed here by mistake — ignore it
        return res.json({ received: true });
      }
    } catch {
      logger.warn('PayPlus store webhook: could not parse more_info');
      return res.status(400).json({ message: 'Invalid payload' });
    }

    if (!orderId || !UUID_RE.test(orderId)) {
      return res.status(400).json({ message: 'Invalid orderId in more_info' });
    }

    // 3. Fetch the order
    const { rows: orderRows } = await pool.query(
      `SELECT * FROM store_orders WHERE id = $1 AND flow = 'client'`,
      [orderId],
    );
    const order = orderRows[0] ? rowToCamel(orderRows[0]) : null;
    if (!order) {
      logger.warn(`PayPlus store webhook: order ${orderId} not found`);
      return res.status(404).json({ message: 'Order not found' });
    }

    // Idempotency guard — already processed (C2)
    if (order.paymentStatus === 'paid') {
      return res.json({ received: true });
    }

    // 4. Determine payment outcome — PayPlus status_code '000' = success
    const statusCode    = payload.status_code || payload.StatusCode || '';
    const transactionUid = payload.transaction_uid || payload.paymentRequestUid || '';

    if (statusCode === '000') {
      // Payment succeeded — mark order paid
      await pool.query(
        `UPDATE store_orders
         SET status                   = 'approved',
             payment_status           = 'paid',
             payplus_transaction_uid  = $1,
             updated_at               = NOW()
         WHERE id = $2`,
        [transactionUid, orderId],
      );

      // Fire-and-forget: push notification to photographer
      ;(async () => {
        try {
          const admin = await Admin.findById(order.adminId);
          if (admin?.pushToken) {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                to:       admin.pushToken,
                title:    'New Store Order',
                body:     'A client just paid for a store order',
                data:     { orderId },
                sound:    'default',
                priority: 'high',
              }),
            });
          }
        } catch (err) {
          logger.warn(`Push notification failed for store order ${orderId}: ${err.message}`);
        }
      })();

      // Fire-and-forget: order confirmation receipt to the client
      ;(async () => {
        try {
          const { rows: clientRows } = await pool.query(
            'SELECT c.name, c.email FROM clients c JOIN store_orders o ON o.client_id = c.id WHERE o.id = $1',
            [orderId],
          );
          const clientRow = clientRows[0];
          if (!clientRow?.email) return;

          const { rows: itemRows } = await pool.query(
            `SELECT i.quantity, i.unit_client_price, p.name AS product_name
               FROM store_order_items i
               JOIN supplier_products p ON p.id = i.product_id
              WHERE i.order_id = $1`,
            [orderId],
          );
          const admin = await Admin.findById(order.adminId);

          const { sendOrderConfirmationEmail } = require('../services/emailService');
          await sendOrderConfirmationEmail({
            clientName:  clientRow.name,
            clientEmail: clientRow.email,
            studioName:  admin?.studioName || admin?.name || '',
            orderId,
            items: itemRows.map((r) => ({
              productName: r.product_name,
              quantity:    r.quantity,
              unitPrice:   r.unit_client_price,
            })),
            totalAmount:     order.totalAmount,
            currency:        order.currency || 'ILS',
            shippingAddress: order.shippingAddress,
          });
        } catch (err) {
          logger.warn(`Order confirmation email failed for store order ${orderId}: ${err.message}`);
        }
      })();

      // Fire-and-forget: formal receipt (קבלה) to the client for the payment
      ;(async () => {
        try {
          const { rows: clientRows } = await pool.query(
            'SELECT c.name, c.id, c.email FROM clients c JOIN store_orders o ON o.client_id = c.id WHERE o.id = $1',
            [orderId],
          );
          const clientRow = clientRows[0];
          if (!clientRow?.email) return;
          const { rows: itemRows } = await pool.query(
            `SELECT i.quantity, i.unit_client_price, p.name AS product_name
               FROM store_order_items i JOIN supplier_products p ON p.id = i.product_id
              WHERE i.order_id = $1`,
            [orderId],
          );
          const invoiceService = require('../services/invoiceService');
          await invoiceService.issueReceipt({
            sourceKind: 'store_order',
            sourceId:   orderId,
            recipientKind: 'client',
            recipient: { id: clientRow.id, name: clientRow.name, email: clientRow.email },
            items: itemRows.map((r) => ({ name: r.product_name, quantity: r.quantity, unitPrice: r.unit_client_price })),
            amount: order.totalAmount,
          });
        } catch (err) {
          logger.warn(`Receipt issuance failed for store order ${orderId}: ${err.message}`);
        }
      })();

      // Auto-send to exclusive supplier — sequential after payment update (C3)
      if (order.supplierId) {
        try {
          const { rows: supRows } = await pool.query(
            'SELECT is_exclusive FROM suppliers WHERE id = $1',
            [order.supplierId],
          );
          if (supRows[0]?.is_exclusive) {
            await pool.query(
              `UPDATE store_orders
               SET status              = 'sent_to_supplier',
                   sent_to_supplier_at = NOW(),
                   updated_at          = NOW()
               WHERE id = $1`,
              [orderId],
            );
            logger.info(`Store order ${orderId} auto-sent to exclusive supplier`);
          }
        } catch (err) {
          logger.warn(`Auto-send to supplier failed for order ${orderId}: ${err.message}`);
        }
      }
    } else {
      // Payment failed or declined — use 'failed', not 'refunded' (C6)
      await pool.query(
        `UPDATE store_orders
         SET status         = 'cancelled',
             payment_status = 'failed',
             updated_at     = NOW()
         WHERE id = $1`,
        [orderId],
      );
    }

    // Always return 200 — PayPlus retries on non-2xx
    return res.json({ received: true });
  }),
);

module.exports = router;
