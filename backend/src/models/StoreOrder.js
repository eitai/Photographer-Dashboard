const crypto = require('crypto');
const pool = require('../db');
const { rowToCamel } = require('../db/utils');
const { UUID_RE } = require('../utils/uuid');

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Reshape a flat JOIN row (already camelCased) into the nested shape
 * expected by callers:  { ...orderFields, client:{}, gallery:{}, supplier:{} }
 * The raw order fields are left on the root; nested objects are populated
 * by picking specific properties then deleted from the root.
 */
function shapeOrder(camel) {
  if (!camel) return null;

  const client = {
    name:            camel.clientName,
    email:           camel.clientEmail,
    phone:           camel.clientPhone,
    addressStreet:   camel.addressStreet,
    addressCity:     camel.addressCity,
    addressZip:      camel.addressZip,
    addressCountry:  camel.addressCountry,
    addressApartment: camel.addressApartment,
  };

  const gallery = { name: camel.galleryName };

  const supplier = camel.supplierName ? { name: camel.supplierName } : null;

  // Remove the flat join columns from the root object
  delete camel.clientName;
  delete camel.clientEmail;
  delete camel.clientPhone;
  delete camel.addressStreet;
  delete camel.addressCity;
  delete camel.addressZip;
  delete camel.addressCountry;
  delete camel.addressApartment;
  delete camel.galleryName;
  delete camel.supplierName;

  return { ...camel, client, gallery, supplier };
}

/**
 * Shape a flat item row into a nested structure with product sub-object.
 */
function shapeItem(camel) {
  if (!camel) return null;

  const product = {
    name:             camel.productName,
    type:             camel.productType,
    sku:              camel.productSku,
    specs:            camel.productSpecs,
    imagePreviewPath: camel.productImagePreviewPath,
  };

  delete camel.productName;
  delete camel.productType;
  delete camel.productSku;
  delete camel.productSpecs;
  delete camel.productImagePreviewPath;

  return { ...camel, product };
}

// ─── Core SELECT helpers ──────────────────────────────────────────────────────

async function _fetchOrderRow(id, adminId) {
  const params = [id];
  const adminClause = adminId ? `AND o.admin_id = $2` : '';
  if (adminId) params.push(adminId);

  const { rows } = await pool.query(
    `SELECT o.*,
       c.name              AS client_name,
       c.email             AS client_email,
       c.phone             AS client_phone,
       c.address_street,
       c.address_city,
       c.address_zip,
       c.address_country,
       c.address_apartment,
       g.name              AS gallery_name,
       s.name              AS supplier_name
     FROM store_orders o
     JOIN clients   c ON c.id = o.client_id
     JOIN galleries g ON g.id = o.gallery_id
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.id = $1 ${adminClause}`,
    params
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function _fetchItems(orderId) {
  const { rows } = await pool.query(
    `SELECT i.*,
       p.name               AS product_name,
       p.type               AS product_type,
       p.sku                AS product_sku,
       p.specs              AS product_specs,
       p.image_preview_path AS product_image_preview_path
     FROM store_order_items i
     JOIN supplier_products p ON p.id = i.product_id
     WHERE i.order_id = $1
     ORDER BY i.created_at ASC`,
    [orderId]
  );
  return rows.map((r) => shapeItem(rowToCamel(r)));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single order with full detail (items + nested objects).
 * If adminId is provided, silently returns null for mismatched ownership.
 */
async function findById(id, { adminId } = {}) {
  if (!id || !UUID_RE.test(id)) return null;

  const row = await _fetchOrderRow(id, adminId || null);
  if (!row) return null;

  const items = await _fetchItems(id);
  const order = shapeOrder(row);
  order.items = items;
  return order;
}

/**
 * List orders with pagination.
 * Exactly one of adminId or supplierId must be provided to anchor the query.
 */
async function findAll({
  adminId,
  supplierId,
  clientId,
  galleryId,
  status,
  flow,
  page = 1,
  limit = 30,
} = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (adminId)    { conditions.push(`o.admin_id    = $${i++}`); vals.push(adminId); }
  if (supplierId) { conditions.push(`o.supplier_id = $${i++}`); vals.push(supplierId); }
  if (clientId)   { conditions.push(`o.client_id   = $${i++}`); vals.push(clientId); }
  if (galleryId)  { conditions.push(`o.gallery_id  = $${i++}`); vals.push(galleryId); }
  if (status)     { conditions.push(`o.status      = $${i++}`); vals.push(status); }
  if (flow)       { conditions.push(`o.flow        = $${i++}`); vals.push(flow); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total for pagination
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM store_orders o ${where}`,
    vals
  );
  const total = countRes.rows[0].total;

  // Fetch page
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 30));
  const offset = (pageNum - 1) * limitNum;

  vals.push(limitNum, offset);

  const { rows } = await pool.query(
    `SELECT o.*,
       c.name AS client_name,
       g.name AS gallery_name,
       s.name AS supplier_name,
       (SELECT COUNT(*)::int FROM store_order_items WHERE order_id = o.id) AS items_count
     FROM store_orders o
     JOIN clients   c ON c.id = o.client_id
     JOIN galleries g ON g.id = o.gallery_id
     LEFT JOIN suppliers s ON s.id = o.supplier_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    vals
  );

  const orders = rows.map((r) => {
    const camel = rowToCamel(r);
    const shaped = shapeOrder(camel);
    // items_count was already on camel before shapeOrder moved it; it stays on root
    return shaped;
  });

  return { orders, total, page: pageNum, limit: limitNum };
}

/**
 * Create a new photographer-flow order in a transaction.
 * Returns the full populated order via findById.
 */
async function create({ adminId, clientId, galleryId, items, photographerNote }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify gallery belongs to this admin
    const galRes = await client.query(
      'SELECT id FROM galleries WHERE id = $1 AND admin_id = $2',
      [galleryId, adminId]
    );
    if (!galRes.rows[0]) {
      const err = new Error('Gallery not found or does not belong to this admin');
      err.status = 404;
      throw err;
    }

    // 2. Get exclusive supplier
    const supRes = await client.query(
      'SELECT id FROM suppliers WHERE is_exclusive = true AND is_active = true LIMIT 1'
    );
    const supplierId = supRes.rows[0]?.id || null;

    // 3. Validate products
    const productIds = items.map((it) => it.productId);
    const prodRes = await client.query(
      'SELECT id, cost_price, client_price, is_active FROM supplier_products WHERE id = ANY($1::uuid[])',
      [productIds]
    );

    if (prodRes.rows.length !== productIds.length) {
      const err = new Error('One or more products not found');
      err.status = 422;
      throw err;
    }

    // 4. Reject inactive products
    const inactiveProducts = prodRes.rows.filter((p) => !p.is_active);
    if (inactiveProducts.length > 0) {
      const err = new Error('One or more products are inactive');
      err.status = 422;
      throw err;
    }

    const productMap = new Map(prodRes.rows.map((p) => [p.id, p]));

    // 5. Insert order
    const orderRes = await client.query(
      `INSERT INTO store_orders
         (admin_id, client_id, gallery_id, supplier_id, flow, status, payment_status, photographer_note)
       VALUES ($1, $2, $3, $4, 'photographer', 'draft', 'pending', $5)
       RETURNING *`,
      [adminId, clientId, galleryId, supplierId, photographerNote || null]
    );
    const orderId = orderRes.rows[0].id;

    // 6. Insert items
    for (const item of items) {
      const product = productMap.get(item.productId);
      await client.query(
        `INSERT INTO store_order_items
           (order_id, product_id, quantity, unit_cost_price, unit_client_price, product_options)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.productId,
          item.quantity || 1,
          product.cost_price,
          product.client_price,
          item.productOptions ? JSON.stringify(item.productOptions) : '{}',
        ]
      );
    }

    // 7. Compute and update total
    await client.query(
      `UPDATE store_orders
         SET total_amount = (
           SELECT SUM(quantity * unit_cost_price)
           FROM store_order_items
           WHERE order_id = $1
         )
       WHERE id = $1`,
      [orderId]
    );

    await client.query('COMMIT');

    return findById(orderId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update a draft order's note and/or items.
 * Returns null if the order is not found, not a draft, or not owned by adminId.
 */
async function updateDraft(id, adminId, { photographerNote, items } = {}) {
  if (!id || !UUID_RE.test(id)) return null;

  // Verify ownership and status
  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0] || check.rows[0].status !== 'draft') return null;

  if (items && Array.isArray(items) && items.length > 0) {
    const txClient = await pool.connect();
    try {
      await txClient.query('BEGIN');

      // Validate products
      const productIds = items.map((it) => it.productId);
      const prodRes = await txClient.query(
        'SELECT id, cost_price, client_price, is_active FROM supplier_products WHERE id = ANY($1::uuid[])',
        [productIds]
      );

      if (prodRes.rows.length !== productIds.length) {
        const err = new Error('One or more products not found');
        err.status = 422;
        throw err;
      }

      const inactiveProducts = prodRes.rows.filter((p) => !p.is_active);
      if (inactiveProducts.length > 0) {
        const err = new Error('One or more products are inactive');
        err.status = 422;
        throw err;
      }

      const productMap = new Map(prodRes.rows.map((p) => [p.id, p]));

      // Delete old items
      await txClient.query('DELETE FROM store_order_items WHERE order_id = $1', [id]);

      // Insert new items
      for (const item of items) {
        const product = productMap.get(item.productId);
        await txClient.query(
          `INSERT INTO store_order_items
             (order_id, product_id, quantity, unit_cost_price, unit_client_price, product_options)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            item.productId,
            item.quantity || 1,
            product.cost_price,
            product.client_price,
            item.productOptions ? JSON.stringify(item.productOptions) : '{}',
          ]
        );
      }

      // Recompute total
      await txClient.query(
        `UPDATE store_orders
           SET total_amount = (
             SELECT SUM(quantity * unit_cost_price)
             FROM store_order_items
             WHERE order_id = $1
           ),
           updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      if (photographerNote !== undefined) {
        await txClient.query(
          'UPDATE store_orders SET photographer_note = $1, updated_at = NOW() WHERE id = $2',
          [photographerNote, id]
        );
      }

      await txClient.query('COMMIT');
    } catch (err) {
      await txClient.query('ROLLBACK');
      throw err;
    } finally {
      txClient.release();
    }
  } else if (photographerNote !== undefined) {
    await pool.query(
      'UPDATE store_orders SET photographer_note = $1, updated_at = NOW() WHERE id = $2',
      [photographerNote, id]
    );
  }

  return findById(id, { adminId });
}

/**
 * Generate a selection token and advance status to pending_selection.
 * Returns null if the order is not found or not owned by adminId.
 */
async function generateSelectionToken(id, adminId) {
  if (!id || !UUID_RE.test(id)) return null;

  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0] || check.rows[0].status !== 'draft') return null;

  const token = crypto.randomBytes(32).toString('hex');

  await pool.query(
    `UPDATE store_orders
       SET selection_token = $1,
           status          = 'pending_selection',
           updated_at      = NOW()
     WHERE id = $2`,
    [token, id]
  );

  return findById(id, { adminId });
}

/**
 * Look up an order by its public selection token.
 * Returns full populated order or null.
 */
async function findBySelectionToken(token) {
  if (!token) return null;

  const { rows } = await pool.query(
    'SELECT id FROM store_orders WHERE selection_token = $1',
    [token]
  );
  if (!rows[0]) return null;

  return findById(rows[0].id);
}

/**
 * Client submits their image selection for each order item.
 * Throws an error (status 409) if the order is not in pending_selection status.
 */
async function submitSelection(token, { items, shippingAddress }) {
  if (!token) return null;

  const { rows } = await pool.query(
    'SELECT id, status FROM store_orders WHERE selection_token = $1',
    [token]
  );
  if (!rows[0]) return null;

  const { id, status } = rows[0];
  if (status !== 'pending_selection') {
    const err = new Error('Order is not awaiting selection');
    err.status = 409;
    throw err;
  }

  const txClient = await pool.connect();
  try {
    await txClient.query('BEGIN');

    // Update each item's selected images and notes
    for (const item of items) {
      const selectedIds = Array.isArray(item.selectedImageIds) ? item.selectedImageIds : [];
      const imageNotes = item.imageNotes && typeof item.imageNotes === 'object' ? item.imageNotes : {};

      await txClient.query(
        `UPDATE store_order_items
           SET selected_image_ids = $1::uuid[],
               image_notes        = $2
         WHERE id = $3 AND order_id = $4`,
        [selectedIds, JSON.stringify(imageNotes), item.orderItemId, id]
      );
    }

    // Advance order status
    await txClient.query(
      `UPDATE store_orders
         SET status           = 'selection_submitted',
             shipping_address = $1,
             updated_at       = NOW()
       WHERE id = $2`,
      [JSON.stringify(shippingAddress), id]
    );

    await txClient.query('COMMIT');
  } catch (err) {
    await txClient.query('ROLLBACK');
    throw err;
  } finally {
    txClient.release();
  }

  return findById(id);
}

/**
 * Approve a submitted selection. Returns null on ownership/status mismatch.
 */
async function approve(id, adminId) {
  if (!id || !UUID_RE.test(id)) return null;

  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0] || check.rows[0].status !== 'selection_submitted') return null;

  await pool.query(
    `UPDATE store_orders SET status = 'approved', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return findById(id, { adminId });
}

/**
 * Send an approved order to the supplier. Returns null on ownership/status mismatch.
 */
async function sendToSupplier(id, adminId) {
  if (!id || !UUID_RE.test(id)) return null;

  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0] || check.rows[0].status !== 'approved') return null;

  await pool.query(
    `UPDATE store_orders
       SET status             = 'sent_to_supplier',
           sent_to_supplier_at = NOW(),
           updated_at         = NOW()
     WHERE id = $1`,
    [id]
  );

  return findById(id, { adminId });
}

/**
 * Supplier updates production/shipping status.
 * Valid transitions (from → to):
 *   sent_to_supplier → in_production
 *   in_production    → shipped
 *   shipped          → delivered
 */
async function updateSupplierStatus(id, supplierId, { status, trackingNumber, trackingCarrier, supplierNote }) {
  if (!id || !UUID_RE.test(id)) return null;

  const ALLOWED_STATUSES = ['in_production', 'shipped', 'delivered'];
  if (!ALLOWED_STATUSES.includes(status)) return null;

  const VALID_FROM = {
    in_production: 'sent_to_supplier',
    shipped:       'in_production',
    delivered:     'shipped',
  };

  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND supplier_id = $2`,
    [id, supplierId]
  );
  if (!check.rows[0]) return null;

  const currentStatus = check.rows[0].status;
  if (currentStatus !== VALID_FROM[status]) {
    const err = new Error(`Cannot transition from '${currentStatus}' to '${status}'`);
    err.status = 409;
    throw err;
  }

  const sets = [`status = $1`, `updated_at = NOW()`];
  const vals = [status];
  let i = 2;

  if (trackingNumber !== undefined) { sets.push(`tracking_number = $${i++}`);  vals.push(trackingNumber); }
  if (trackingCarrier !== undefined) { sets.push(`tracking_carrier = $${i++}`); vals.push(trackingCarrier); }
  if (supplierNote !== undefined)    { sets.push(`supplier_note = $${i++}`);    vals.push(supplierNote); }
  if (status === 'shipped')          { sets.push(`shipped_at = NOW()`); }
  if (status === 'delivered')        { sets.push(`delivered_at = NOW()`); }

  vals.push(id, supplierId);

  await pool.query(
    `UPDATE store_orders SET ${sets.join(', ')} WHERE id = $${i++} AND supplier_id = $${i++}`,
    vals
  );

  return findById(id);
}

/**
 * Cancel an order. Returns null if not found or already in a terminal state.
 */
async function cancel(id, adminId) {
  if (!id || !UUID_RE.test(id)) return null;

  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0]) return null;

  const { status } = check.rows[0];
  if (status === 'delivered' || status === 'shipped') {
    const err = new Error('Cannot cancel an order that has already shipped or been delivered');
    err.status = 409;
    throw err;
  }

  await pool.query(
    `UPDATE store_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return findById(id, { adminId });
}

/**
 * Hard-delete a draft order.
 * Returns null if not found, not owned by adminId, or not in draft status.
 */
async function deleteOrder(id, adminId) {
  if (!id || !UUID_RE.test(id)) return null;

  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0]) return null;

  if (check.rows[0].status !== 'draft') {
    const err = new Error('Only draft orders can be deleted');
    err.status = 409;
    throw err;
  }

  await pool.query('DELETE FROM store_orders WHERE id = $1', [id]);
  return true;
}

module.exports = {
  findById,
  findAll,
  create,
  updateDraft,
  generateSelectionToken,
  findBySelectionToken,
  submitSelection,
  approve,
  sendToSupplier,
  updateSupplierStatus,
  cancel,
  deleteOrder,
};
