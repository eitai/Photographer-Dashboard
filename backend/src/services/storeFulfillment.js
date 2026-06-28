const pool = require('../db');
const logger = require('../utils/logger');

/**
 * Re-dispatch paid client orders that the PayPlus webhook failed to flip to
 * 'sent_to_supplier'. The webhook does this inline on payment; if that update
 * was lost (crash / transient DB error) the order is stranded at 'approved'.
 * Only ever touches stranded rows for an exclusive supplier, so it is safe to
 * run on a schedule and idempotent (a re-run finds nothing).
 *
 * @returns {Promise<{dispatched:number, ids:string[]}>}
 */
async function dispatchStrandedOrders() {
  const { rows } = await pool.query(
    `UPDATE store_orders o
        SET status = 'sent_to_supplier', sent_to_supplier_at = NOW(), updated_at = NOW()
       FROM suppliers s
      WHERE o.supplier_id = s.id
        AND s.is_exclusive = true
        AND o.flow = 'client'
        AND o.payment_status = 'paid'
        AND o.status = 'approved'
        AND o.sent_to_supplier_at IS NULL
     RETURNING o.id`,
  );
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    logger.warn(`[store-dispatch] re-dispatched ${ids.length} stranded order(s): ${ids.join(', ')}`);
  }
  return { dispatched: ids.length, ids };
}

module.exports = { dispatchStrandedOrders };
