const pool = require('../db');
const { rowToCamel } = require('../db/utils');

// Orders that should be billed to the photographer: their own (Flow 1/3) orders
// that have left draft and have not yet been attached to an invoice.
const BILLABLE_CLAUSE = `
  (o.is_direct = true OR o.flow = 'photographer')
  AND o.status NOT IN ('draft', 'cancelled')
  AND o.invoice_id IS NULL
`;
// Same predicate without the `o.` table alias, for UPDATE store_orders ...
const BILLABLE_CLAUSE_NOALIAS = `
  (is_direct = true OR flow = 'photographer')
  AND status NOT IN ('draft', 'cancelled')
  AND invoice_id IS NULL
`;

/**
 * Sum of not-yet-billed photographer orders for an admin (current open accrual).
 */
async function currentAccrued(adminId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(o.total_amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM store_orders o
      WHERE o.admin_id = $1 AND ${BILLABLE_CLAUSE}`,
    [adminId]
  );
  return { total: Number(rows[0].total), count: rows[0].count };
}

async function findByAdmin(adminId) {
  const { rows } = await pool.query(
    `SELECT * FROM photographer_invoices WHERE admin_id = $1 ORDER BY period_start DESC`,
    [adminId]
  );
  return rows.map(rowToCamel);
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM photographer_invoices WHERE id = $1', [id]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

/**
 * The orders attached to a given invoice (line items).
 */
async function lineItems(invoiceId) {
  const { rows } = await pool.query(
    `SELECT o.id, o.total_amount, o.created_at,
            (SELECT string_agg(p.name, ', ')
               FROM store_order_items i JOIN supplier_products p ON p.id = i.product_id
              WHERE i.order_id = o.id) AS products
       FROM store_orders o WHERE o.invoice_id = $1 ORDER BY o.created_at ASC`,
    [invoiceId]
  );
  return rows.map(rowToCamel);
}

/**
 * Close the billing period for ONE admin: create an invoice from their unbilled
 * orders and attach those orders to it. Returns the invoice, or null if nothing
 * to bill. Idempotent per (admin_id, period_start) via the UNIQUE constraint.
 */
async function closePeriodForAdmin(adminId, periodStart, periodEnd, dueAt) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // No FOR UPDATE (illegal with aggregates). Idempotency is guaranteed by the
    // UNIQUE(admin_id, period_start) constraint below + the invoice_id IS NULL
    // filter on the order-attach UPDATE.
    const { rows: sumRows } = await client.query(
      `SELECT COALESCE(SUM(o.total_amount), 0)::numeric AS total, COUNT(*)::int AS count
         FROM store_orders o
        WHERE o.admin_id = $1 AND ${BILLABLE_CLAUSE}`,
      [adminId]
    );
    const total = Number(sumRows[0].total);
    const count = sumRows[0].count;
    if (count === 0) { await client.query('ROLLBACK'); return null; }

    const { rows: invRows } = await client.query(
      `INSERT INTO photographer_invoices
         (admin_id, period_start, period_end, total_amount, status, due_at)
       VALUES ($1, $2, $3, $4, 'pending_payment', $5)
       ON CONFLICT (admin_id, period_start) DO NOTHING
       RETURNING *`,
      [adminId, periodStart, periodEnd, total, dueAt]
    );
    if (!invRows[0]) { await client.query('ROLLBACK'); return null; } // already closed
    const invoice = invRows[0];

    await client.query(
      `UPDATE store_orders SET invoice_id = $1, updated_at = NOW()
        WHERE admin_id = $2 AND ${BILLABLE_CLAUSE_NOALIAS}`,
      [invoice.id, adminId]
    );

    await client.query('COMMIT');
    return rowToCamel(invoice);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markPaid(id, transactionUid) {
  const { rows } = await pool.query(
    `UPDATE photographer_invoices
        SET status = 'paid', paid_at = NOW(),
            payplus_transaction_uid = COALESCE($2, payplus_transaction_uid),
            updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, transactionUid || null]
  );
  if (!rows[0]) return null;
  // Clearing this invoice may lift the block — only if no other unpaid invoices remain
  await pool.query(
    `UPDATE admins a SET billing_blocked = false
      WHERE a.id = $1
        AND NOT EXISTS (
          SELECT 1 FROM photographer_invoices pi
           WHERE pi.admin_id = a.id AND pi.status IN ('pending_payment','failed')
        )`,
    [rows[0].admin_id]
  );
  return rowToCamel(rows[0]);
}

async function markFailed(id) {
  const { rows } = await pool.query(
    `UPDATE photographer_invoices
        SET status = 'failed', attempts = attempts + 1, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id]
  );
  if (rows[0]) {
    await pool.query('UPDATE admins SET billing_blocked = true WHERE id = $1', [rows[0].admin_id]);
  }
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function setLink(id, link) {
  await pool.query('UPDATE photographer_invoices SET payplus_link = $2, updated_at = NOW() WHERE id = $1', [id, link]);
}

/**
 * Superadmin overview: every photographer with their open accrual + latest invoice.
 */
async function overview() {
  const { rows } = await pool.query(
    `SELECT a.id AS admin_id, a.name, a.email, a.billing_blocked, a.payplus_card_token IS NOT NULL AS has_card,
            COALESCE((SELECT SUM(o.total_amount) FROM store_orders o
                       WHERE o.admin_id = a.id AND ${BILLABLE_CLAUSE}), 0)::numeric AS accrued,
            COALESCE((SELECT SUM(pi.total_amount) FROM photographer_invoices pi
                       WHERE pi.admin_id = a.id AND pi.status IN ('pending_payment','failed')), 0)::numeric AS unpaid_total,
            (SELECT row_to_json(li) FROM (
               SELECT pi.id, pi.status, pi.total_amount, pi.period_start, pi.due_at
                 FROM photographer_invoices pi
                WHERE pi.admin_id = a.id
                ORDER BY pi.period_start DESC LIMIT 1
             ) li) AS latest_invoice
       FROM admins a
      WHERE a.role = 'admin'
      ORDER BY a.billing_blocked DESC, accrued DESC`
  );
  return rows.map((r) => {
    const accrued = Number(r.accrued);
    const unpaidTotal = Number(r.unpaid_total);
    return {
      adminId: r.admin_id,
      name: r.name,
      email: r.email,
      billingBlocked: r.billing_blocked,
      hasCard: r.has_card,
      accrued,
      unpaidTotal,                       // sum of existing pending/failed invoices
      outstanding: accrued + unpaidTotal, // total owed = new accrual + unpaid invoices
      latestInvoice: r.latest_invoice ? rowToCamel(r.latest_invoice) : null,
    };
  });
}

/**
 * Unpaid invoices (pending_payment / failed) — for retrying a charge.
 * Optionally restricted to a subset of admins.
 */
async function findUnpaid(adminIds) {
  const hasFilter = Array.isArray(adminIds) && adminIds.length > 0;
  const { rows } = await pool.query(
    `SELECT * FROM photographer_invoices
      WHERE status IN ('pending_payment','failed')
        ${hasFilter ? 'AND admin_id = ANY($1::uuid[])' : ''}
      ORDER BY period_start ASC`,
    hasFilter ? [adminIds] : []
  );
  return rows.map(rowToCamel);
}

module.exports = {
  currentAccrued, findByAdmin, findById, lineItems,
  closePeriodForAdmin, markPaid, markFailed, setLink, overview, findUnpaid,
};
