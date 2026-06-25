const pool = require('../db');
const { rowToCamel } = require('../db/utils');

// Orders the supplier fulfilled that have not yet been settled.
// Anything that reached the supplier (sent_to_supplier onward) counts.
const SETTLEABLE_CLAUSE = `
  o.supplier_id = $1
  AND o.status IN ('sent_to_supplier','in_production','ready_to_ship','shipped','delivered')
  AND o.settlement_id IS NULL
`;

/**
 * Preview the open (unsettled) balance owed to a supplier — sum of cost prices
 * across all fulfilled, not-yet-settled orders.
 */
async function openBalance(supplierId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(i.unit_cost_price * i.quantity), 0)::numeric AS total,
            COUNT(DISTINCT o.id)::int AS order_count
       FROM store_orders o
       LEFT JOIN store_order_items i ON i.order_id = o.id
      WHERE ${SETTLEABLE_CLAUSE}`,
    [supplierId]
  );
  return { total: Number(rows[0].total), orderCount: rows[0].order_count };
}

async function history(supplierId) {
  const { rows } = await pool.query(
    `SELECT * FROM supplier_settlements WHERE supplier_id = $1 ORDER BY period_start DESC`,
    [supplierId]
  );
  return rows.map(rowToCamel);
}

/**
 * Create a settlement record capturing the current open balance and attach the
 * included orders to it. Returns the settlement, or null if nothing to settle.
 */
async function createForPeriod(supplierId, periodStart, periodEnd, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: sumRows } = await client.query(
      `SELECT COALESCE(SUM(i.unit_cost_price * i.quantity), 0)::numeric AS total,
              COUNT(DISTINCT o.id)::int AS order_count
         FROM store_orders o
         LEFT JOIN store_order_items i ON i.order_id = o.id
        WHERE ${SETTLEABLE_CLAUSE}`,
      [supplierId]
    );
    const total = Number(sumRows[0].total);
    const orderCount = sumRows[0].order_count;
    if (orderCount === 0) { await client.query('ROLLBACK'); return null; }

    const { rows: setRows } = await client.query(
      `INSERT INTO supplier_settlements
         (supplier_id, period_start, period_end, total_cost, order_count, status, note)
       VALUES ($1, $2, $3, $4, $5, 'open', $6)
       RETURNING *`,
      [supplierId, periodStart, periodEnd, total, orderCount, note || null]
    );
    const settlement = setRows[0];

    await client.query(
      `UPDATE store_orders SET settlement_id = $1, updated_at = NOW()
        WHERE supplier_id = $2
          AND status IN ('sent_to_supplier','in_production','ready_to_ship','shipped','delivered')
          AND settlement_id IS NULL`,
      [settlement.id, supplierId]
    );

    await client.query('COMMIT');
    return rowToCamel(settlement);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markSettled(id, note) {
  const { rows } = await pool.query(
    `UPDATE supplier_settlements
        SET status = 'settled', settled_at = NOW(),
            note = COALESCE($2, note)
      WHERE id = $1 RETURNING *`,
    [id, note || null]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

module.exports = { openBalance, history, createForPeriod, markSettled };
