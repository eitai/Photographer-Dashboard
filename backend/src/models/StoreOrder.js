const crypto = require('crypto');
const pool = require('../db');
const { rowToCamel } = require('../db/utils');
const { UUID_RE } = require('../utils/uuid');
const { checkPhotoCount } = require('../utils/validatePhotoCounts');

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Reshape a flat JOIN row (already camelCased) into the nested shape
 * expected by callers:  { ...orderFields, client:{}, gallery:{}, supplier:{} }
 * The raw order fields are left on the root; nested objects are populated
 * by picking specific properties then deleted from the root.
 */
function shapeOrder(camel) {
  if (!camel) return null;

  // Direct orders (is_direct) have no client / gallery — LEFT JOINs yield nulls
  const client = camel.clientId ? {
    name:            camel.clientName,
    email:           camel.clientEmail,
    phone:           camel.clientPhone,
    addressStreet:   camel.addressStreet,
    addressCity:     camel.addressCity,
    addressZip:      camel.addressZip,
    addressCountry:  camel.addressCountry,
    addressApartment: camel.addressApartment,
  } : null;

  const gallery = camel.galleryId ? { name: camel.galleryName } : null;

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
    minPhotos:        camel.productMinPhotos,
    maxPhotos:        camel.productMaxPhotos,
    productionDays:   camel.productProductionDays,
    variations:       camel.productVariations,
  };

  delete camel.productName;
  delete camel.productType;
  delete camel.productSku;
  delete camel.productSpecs;
  delete camel.productImagePreviewPath;
  delete camel.productMinPhotos;
  delete camel.productMaxPhotos;
  delete camel.productProductionDays;
  delete camel.productVariations;

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
     LEFT JOIN clients   c ON c.id = o.client_id
     LEFT JOIN galleries g ON g.id = o.gallery_id
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
       p.image_preview_path AS product_image_preview_path,
       p.min_photos         AS product_min_photos,
       p.max_photos         AS product_max_photos,
       p.production_days    AS product_production_days,
       p.variations         AS product_variations
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
  from,
  to,
  page = 1,
  limit = 30,
} = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (adminId)    { conditions.push(`o.admin_id    = $${i++}`); vals.push(adminId); }
  if (supplierId) {
    conditions.push(`o.supplier_id = $${i++}`); vals.push(supplierId);
    // Suppliers must only see orders that were actually sent to them —
    // supplier_id is assigned at creation, before the photographer sends.
    conditions.push(`o.status IN ('sent_to_supplier','in_production','ready_to_ship','shipped','delivered')`);
  }
  if (clientId)   { conditions.push(`o.client_id   = $${i++}`); vals.push(clientId); }
  if (galleryId)  { conditions.push(`o.gallery_id  = $${i++}`); vals.push(galleryId); }
  if (status === 'open') {
    conditions.push(`o.status NOT IN ('delivered','cancelled')`);
  } else if (status) {
    conditions.push(`o.status = $${i++}`); vals.push(status);
  }
  if (flow)       { conditions.push(`o.flow        = $${i++}`); vals.push(flow); }
  if (from)       { conditions.push(`o.created_at >= $${i++}`); vals.push(from); }
  if (to)         { conditions.push(`o.created_at < ($${i++}::date + interval '1 day')`); vals.push(to); }

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
       (SELECT COUNT(*)::int FROM store_order_items WHERE order_id = o.id) AS items_count,
       COALESCE((SELECT SUM(unit_cost_price * quantity) FROM store_order_items WHERE order_id = o.id), 0)::numeric AS cost_total
     FROM store_orders o
     LEFT JOIN clients   c ON c.id = o.client_id
     LEFT JOIN galleries g ON g.id = o.gallery_id
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

// Safety cap so a report can never return an unbounded payload.
const REPORT_CAP = 5000;

/**
 * Full export (no pagination) of a photographer's orders for an optional date
 * range, plus an aggregate summary. Read-only — never mutates anything.
 *
 * @returns {Promise<{rows:object[], summary:{count:number,totalAmount:number,byStatus:object}, capped:boolean}>}
 */
async function report({ adminId, status, flow, from, to } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (adminId) { conditions.push(`o.admin_id = $${i++}`); vals.push(adminId); }
  if (status === 'open') {
    conditions.push(`o.status NOT IN ('delivered','cancelled')`);
  } else if (status) {
    conditions.push(`o.status = $${i++}`); vals.push(status);
  }
  if (flow) { conditions.push(`o.flow = $${i++}`); vals.push(flow); }
  if (from) { conditions.push(`o.created_at >= $${i++}`); vals.push(from); }
  if (to)   { conditions.push(`o.created_at < ($${i++}::date + interval '1 day')`); vals.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Aggregate over the FULL filtered set (not just the returned rows)
  const grp = await pool.query(
    `SELECT o.status, COUNT(*)::int AS count, COALESCE(SUM(o.total_amount),0)::numeric AS total
       FROM store_orders o ${where} GROUP BY o.status`,
    vals
  );
  const byStatus = {};
  let count = 0, totalAmount = 0;
  for (const r of grp.rows) {
    byStatus[r.status] = { count: r.count, total: Number(r.total) };
    count += r.count; totalAmount += Number(r.total);
  }

  vals.push(REPORT_CAP);
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.flow, o.total_amount, o.currency, o.created_at, o.photographer_note,
            c.name AS client_name, g.name AS gallery_name,
            (SELECT COUNT(*)::int FROM store_order_items WHERE order_id = o.id) AS items_count
       FROM store_orders o
       LEFT JOIN clients   c ON c.id = o.client_id
       LEFT JOIN galleries g ON g.id = o.gallery_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${i++}`,
    vals
  );

  return {
    rows: rows.map(rowToCamel),
    summary: { count, totalAmount: Math.round(totalAmount * 100) / 100, byStatus },
    capped: rows.length >= REPORT_CAP,
  };
}

/**
 * Full export of a supplier's orders for an optional date range, plus a summary.
 * Amounts are on a COST basis (unit_cost_price × quantity) — what the supplier
 * is actually paid — never total_amount (which is the client price on client
 * flow). Read-only.
 *
 * @returns {Promise<{rows:object[], summary:{count:number,totalToPay:number,byStatus:object}, capped:boolean}>}
 */
async function reportForSupplier({ supplierId, status, from, to } = {}) {
  const conditions = [
    `o.supplier_id = $1`,
    `o.status IN ('sent_to_supplier','in_production','ready_to_ship','shipped','delivered')`,
  ];
  const vals = [supplierId];
  let i = 2;
  if (status) { conditions.push(`o.status = $${i++}`); vals.push(status); }
  if (from) { conditions.push(`o.created_at >= $${i++}`); vals.push(from); }
  if (to)   { conditions.push(`o.created_at < ($${i++}::date + interval '1 day')`); vals.push(to); }
  const where = `WHERE ${conditions.join(' AND ')}`;

  const grp = await pool.query(
    `SELECT o.status, COUNT(*)::int AS count, COALESCE(SUM(oi.cost),0)::numeric AS total
       FROM store_orders o
       LEFT JOIN LATERAL (
         SELECT SUM(unit_cost_price * quantity) AS cost
           FROM store_order_items WHERE order_id = o.id
       ) oi ON TRUE
       ${where} GROUP BY o.status`,
    vals
  );
  const byStatus = {};
  let count = 0, totalToPay = 0;
  for (const r of grp.rows) {
    byStatus[r.status] = { count: r.count, total: Number(r.total) };
    count += r.count; totalToPay += Number(r.total);
  }

  vals.push(REPORT_CAP);
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.created_at, o.currency,
            a.name AS photographer_name, a.studio_name AS studio_name,
            (SELECT COUNT(*)::int FROM store_order_items WHERE order_id = o.id) AS items_count,
            COALESCE((SELECT SUM(unit_cost_price * quantity) FROM store_order_items WHERE order_id = o.id), 0)::numeric AS cost_total
       FROM store_orders o
       LEFT JOIN admins a ON a.id = o.admin_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${i++}`,
    vals
  );

  return {
    rows: rows.map(rowToCamel),
    summary: { count, totalToPay: Math.round(totalToPay * 100) / 100, byStatus },
    capped: rows.length >= REPORT_CAP,
  };
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

    // 2. Validate products
    const productIds = items.map((it) => it.productId);
    const prodRes = await client.query(
      'SELECT id, supplier_id, cost_price, client_price, is_active FROM supplier_products WHERE id = ANY($1::uuid[])',
      [productIds]
    );

    if (prodRes.rows.length !== productIds.length) {
      const err = new Error('One or more products not found');
      err.status = 422;
      throw err;
    }

    // 3. Reject inactive products
    const inactiveProducts = prodRes.rows.filter((p) => !p.is_active);
    if (inactiveProducts.length > 0) {
      const err = new Error('One or more products are inactive');
      err.status = 422;
      throw err;
    }

    // 4. Derive the supplier from the chosen products — an order fulfills
    // through exactly one supplier, so mixed-supplier carts are rejected.
    const supplierIds = [...new Set(prodRes.rows.map((p) => p.supplier_id))];
    if (supplierIds.length > 1) {
      const err = new Error('All products in an order must belong to the same supplier');
      err.status = 422;
      throw err;
    }
    const supplierId = supplierIds[0];

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
 * Flow 3: photographer orders directly — no client, no selection phase.
 * Photos were already chosen by the photographer (own galleries and/or the
 * hidden system gallery holding ad-hoc uploads). Created as 'approved';
 * the route then calls sendToSupplier() to dispatch it.
 */
async function createDirect({ adminId, items, shippingAddress, photographerNote }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate products (active, single supplier) and photo counts
    const productIds = items.map((it) => it.productId);
    const prodRes = await client.query(
      `SELECT id, name, supplier_id, cost_price, client_price, is_active, min_photos, max_photos
       FROM supplier_products WHERE id = ANY($1::uuid[])`,
      [productIds]
    );
    if (prodRes.rows.length !== productIds.length) {
      const err = new Error('One or more products not found');
      err.status = 422;
      throw err;
    }
    if (prodRes.rows.some((p) => !p.is_active)) {
      const err = new Error('One or more products are inactive');
      err.status = 422;
      throw err;
    }
    const supplierIds = [...new Set(prodRes.rows.map((p) => p.supplier_id))];
    if (supplierIds.length > 1) {
      const err = new Error('All products in an order must belong to the same supplier');
      err.status = 422;
      throw err;
    }
    const supplierId = supplierIds[0];
    const productMap = new Map(prodRes.rows.map((p) => [p.id, p]));

    for (const item of items) {
      const prod = productMap.get(item.productId);
      const count = Array.isArray(item.selectedImageIds) ? item.selectedImageIds.length : 0;
      checkPhotoCount(prod, count); // throws 422
    }

    // 2. Every selected image must belong to one of this admin's galleries
    //    (covers both regular galleries and the hidden uploads gallery)
    const allImageIds = [...new Set(items.flatMap((it) =>
      Array.isArray(it.selectedImageIds) ? it.selectedImageIds : []
    ))];
    if (allImageIds.length > 0) {
      const { rows: owned } = await client.query(
        `SELECT gi.id
           FROM gallery_images gi
           JOIN galleries g ON g.id = gi.gallery_id
          WHERE gi.id = ANY($1::uuid[]) AND g.admin_id = $2`,
        [allImageIds, adminId]
      );
      if (owned.length !== allImageIds.length) {
        const err = new Error('One or more selected images do not belong to your galleries');
        err.status = 422;
        throw err;
      }
    }

    // 3. Insert the order — no client/gallery, already approved
    const orderRes = await client.query(
      `INSERT INTO store_orders
         (admin_id, client_id, gallery_id, supplier_id, flow, is_direct,
          status, payment_status, shipping_address, photographer_note)
       VALUES ($1, NULL, NULL, $2, 'photographer', true,
               'approved', 'not_required', $3, $4)
       RETURNING id`,
      [adminId, supplierId, JSON.stringify(shippingAddress), photographerNote || null]
    );
    const orderId = orderRes.rows[0].id;

    // 4. Items (selected_image_ids passed as a native JS array)
    for (const item of items) {
      const product = productMap.get(item.productId);
      await client.query(
        `INSERT INTO store_order_items
           (order_id, product_id, quantity, unit_cost_price, unit_client_price,
            selected_image_ids, product_options)
         VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7)`,
        [
          orderId,
          item.productId,
          item.quantity || 1,
          product.cost_price,
          product.client_price,
          Array.isArray(item.selectedImageIds) ? item.selectedImageIds : [],
          JSON.stringify(item.productOptions && typeof item.productOptions === 'object' ? item.productOptions : {}),
        ]
      );
    }

    // 5. Total (photographer pays cost price, same as Flow A)
    await client.query(
      `UPDATE store_orders
         SET total_amount = (
           SELECT SUM(quantity * unit_cost_price) FROM store_order_items WHERE order_id = $1
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
async function submitSelection(token, { items, shippingAddress, clientNote }) {
  if (!token) return null;

  const { rows } = await pool.query(
    'SELECT id, status, gallery_id FROM store_orders WHERE selection_token = $1',
    [token]
  );
  if (!rows[0]) return null;

  const { id, status, gallery_id: galleryId } = rows[0];
  if (status !== 'pending_selection') {
    const err = new Error('Order is not awaiting selection');
    err.status = 409;
    throw err;
  }

  const txClient = await pool.connect();
  try {
    await txClient.query('BEGIN');

    // C5: Validate all submitted image IDs belong to this gallery
    const allImageIds = [...new Set(items.flatMap((i) =>
      Array.isArray(i.selectedImageIds) ? i.selectedImageIds : []
    ))];
    if (allImageIds.length > 0) {
      const { rows: validImages } = await txClient.query(
        `SELECT id FROM gallery_images WHERE gallery_id = $1 AND id = ANY($2::uuid[])`,
        [galleryId, allImageIds]
      );
      if (validImages.length !== allImageIds.length) {
        const err = new Error('One or more selected images do not belong to this gallery');
        err.status = 422;
        throw err;
      }
    }

    // Enforce per-product photo requirements before accepting the selection
    const { rows: itemProducts } = await txClient.query(
      `SELECT i.id, p.name, p.min_photos, p.max_photos
         FROM store_order_items i
         JOIN supplier_products p ON p.id = i.product_id
        WHERE i.order_id = $1`,
      [id]
    );
    const productByItemId = new Map(itemProducts.map((r) => [r.id, r]));
    for (const item of items) {
      const prod = productByItemId.get(item.orderItemId);
      if (!prod) continue; // unknown item ids are simply ignored by the UPDATE below
      const count = Array.isArray(item.selectedImageIds) ? item.selectedImageIds.length : 0;
      checkPhotoCount(prod, count); // throws 422
    }

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

    // I10: Advance order status + clientNote inside transaction
    await txClient.query(
      `UPDATE store_orders
         SET status           = 'selection_submitted',
             shipping_address = $1,
             client_note      = COALESCE($2, client_note),
             updated_at       = NOW()
       WHERE id = $3`,
      [JSON.stringify(shippingAddress), clientNote ?? null, id]
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
    `SELECT id, status, supplier_id FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0] || check.rows[0].status !== 'approved') return null;

  // An order must have a supplier to be sent — otherwise it would flip to
  // sent_to_supplier while no supplier panel ever sees it. Orders created
  // before supplier assignment existed may have NULL here; assign the
  // exclusive supplier (or the oldest active one) as a fallback.
  let supplierId = check.rows[0].supplier_id;
  if (!supplierId) {
    const supRes = await pool.query(
      `SELECT id FROM suppliers WHERE is_active = true
       ORDER BY is_exclusive DESC, created_at ASC LIMIT 1`
    );
    supplierId = supRes.rows[0]?.id;
    if (!supplierId) {
      const err = new Error('No active supplier configured — cannot send order to supplier');
      err.status = 409;
      throw err;
    }
  }

  await pool.query(
    `UPDATE store_orders
       SET status             = 'sent_to_supplier',
           supplier_id        = $2,
           sent_to_supplier_at = NOW(),
           updated_at         = NOW()
     WHERE id = $1`,
    [id, supplierId]
  );

  return findById(id, { adminId });
}

/**
 * Supplier updates production/shipping status.
 * Valid transitions (from → to):
 *   sent_to_supplier → in_production
 *   in_production    → ready_to_ship | shipped (skip allowed)
 *   ready_to_ship    → shipped
 *   shipped          → delivered
 */
async function updateSupplierStatus(id, supplierId, { status, trackingNumber, trackingCarrier, supplierNote }) {
  if (!id || !UUID_RE.test(id)) return null;

  const ALLOWED_STATUSES = ['in_production', 'ready_to_ship', 'shipped', 'delivered'];
  if (!ALLOWED_STATUSES.includes(status)) return null;

  const VALID_FROM = {
    in_production: ['sent_to_supplier'],
    ready_to_ship: ['in_production'],
    shipped:       ['in_production', 'ready_to_ship'],
    delivered:     ['shipped'],
  };

  const check = await pool.query(
    `SELECT id, status FROM store_orders WHERE id = $1 AND supplier_id = $2`,
    [id, supplierId]
  );
  if (!check.rows[0]) return null;

  const currentStatus = check.rows[0].status;
  if (!VALID_FROM[status].includes(currentStatus)) {
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
  if (status === 'in_production') { sets.push(`in_production_at = NOW()`); }
  if (status === 'shipped')       { sets.push(`shipped_at = NOW()`); }
  if (status === 'delivered')     { sets.push(`delivered_at = NOW()`); }

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
    `SELECT id, status, flow, payment_status, in_production_at
     FROM store_orders WHERE id = $1 AND admin_id = $2`,
    [id, adminId]
  );
  if (!check.rows[0]) return null;

  const { status, flow, payment_status: paymentStatus, in_production_at: inProductionAt } = check.rows[0];

  if (status === 'delivered' || status === 'shipped' || status === 'ready_to_ship') {
    const err = new Error('Cannot cancel an order that has already shipped or been delivered');
    err.status = 409;
    throw err;
  }

  // F11: Grace period check for in_production orders (15 minutes)
  if (status === 'in_production') {
    if (!inProductionAt || Date.now() - new Date(inProductionAt).getTime() > 15 * 60 * 1000) {
      const err = new Error('Cancellation window has expired (15 minutes from production start)');
      err.status = 409;
      throw err;
    }
  }

  // F11: Mark refund pending for Flow B orders that were already paid
  const needsRefund = flow === 'client' && paymentStatus === 'paid';

  await pool.query(
    `UPDATE store_orders
       SET status         = 'cancelled',
           payment_status = CASE WHEN $1 THEN 'refund_pending' ELSE payment_status END,
           updated_at     = NOW()
     WHERE id = $2`,
    [needsRefund, id]
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
  report,
  reportForSupplier,
  create,
  updateDraft,
  generateSelectionToken,
  findBySelectionToken,
  submitSelection,
  approve,
  createDirect,
  sendToSupplier,
  updateSupplierStatus,
  cancel,
  deleteOrder,
};
