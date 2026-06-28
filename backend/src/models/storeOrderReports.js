'use strict';

const pool = require('../db');
const { rowToCamel } = require('../db/utils');

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

module.exports = { report, reportForSupplier };
