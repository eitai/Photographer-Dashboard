const pool = require('../db');
const Admin = require('../models/Admin');
const PhotographerInvoice = require('../models/PhotographerInvoice');
const payplus = require('../utils/payplus');
const logger = require('../utils/logger');

/**
 * Resolve the previous calendar month as [start, end) for a given "run date".
 * Closing on the 1st bills everything from the month that just ended.
 */
function previousMonthPeriod(runDate = new Date()) {
  const end = new Date(Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth(), 1)); // 1st of current month
  const start = new Date(Date.UTC(runDate.getUTCFullYear(), runDate.getUTCMonth() - 1, 1));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd:   end.toISOString().slice(0, 10),
  };
}

/**
 * Attempt to charge an invoice against the photographer's saved card token.
 * On success → markPaid; on failure → markFailed (which blocks the photographer).
 * Returns the updated invoice.
 */
async function chargeInvoice(invoice) {
  const admin = await Admin.findById(invoice.adminId);
  if (!admin?.payplusCardToken) {
    logger.warn(`[billing] invoice ${invoice.id}: no card token, marking failed`);
    return PhotographerInvoice.markFailed(invoice.id);
  }
  const { sendInvoiceEmail } = require('./emailService');
  try {
    const result = await payplus.chargeByToken({
      token:  admin.payplusCardToken,
      amount: Number(invoice.totalAmount),
      orderRef: invoice.id,
      moreInfo: { type: 'photographer_invoice', invoiceId: invoice.id, adminId: invoice.adminId },
    });
    const txUid = result?.data?.transaction_uid || result?.transaction_uid || null;
    logger.info(`[billing] invoice ${invoice.id} charged (tx ${txUid})`);
    const paid = await PhotographerInvoice.markPaid(invoice.id, txUid);
    if (admin.email) {
      sendInvoiceEmail({
        adminName: admin.name, adminEmail: admin.email, studioName: admin.studioName || admin.name,
        amount: invoice.totalAmount, periodStart: invoice.periodStart, outcome: 'charged',
      }).catch(() => {});
    }
    // Formal receipt (קבלה) for the monthly charge
    const invoiceService = require('./invoiceService');
    invoiceService.issueReceipt({
      sourceKind: 'photographer_invoice',
      sourceId:   invoice.id,
      recipientKind: 'admin',
      recipient: { id: admin.id, name: admin.name, email: admin.email },
      items: [{ name: `הזמנות מהספק · ${new Date(invoice.periodStart).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`, quantity: 1, unitPrice: Number(invoice.totalAmount) }],
      amount: invoice.totalAmount,
    }).catch(() => {});
    return paid;
  } catch (err) {
    logger.warn(`[billing] invoice ${invoice.id} charge failed: ${err.message}`);
    const failed = await PhotographerInvoice.markFailed(invoice.id);
    if (admin.email) {
      sendInvoiceEmail({
        adminName: admin.name, adminEmail: admin.email, studioName: admin.studioName || admin.name,
        amount: invoice.totalAmount, periodStart: invoice.periodStart, outcome: 'failed',
      }).catch(() => {});
    }
    return failed;
  }
}

/**
 * Close a billing cycle: for every photographer with unbilled orders in the
 * period, create an invoice and charge it. Idempotent — re-running skips
 * already-invoiced periods (UNIQUE(admin_id, period_start)).
 *
 * @param {{periodStart?:string, periodEnd?:string, adminIds?:string[]}} [opts]
 *        defaults to previous month, all photographers. `adminIds` restricts to a subset.
 * @returns {Promise<{invoiced:number, paid:number, failed:number, period:object}>}
 */
async function closeCycle(opts = {}) {
  const period = (opts.periodStart && opts.periodEnd)
    ? { periodStart: opts.periodStart, periodEnd: opts.periodEnd }
    : previousMonthPeriod();

  // Admins with at least one billable order (optionally restricted to a subset)
  const hasFilter = Array.isArray(opts.adminIds) && opts.adminIds.length > 0;
  const { rows: adminRows } = await pool.query(
    `SELECT DISTINCT o.admin_id
       FROM store_orders o
      WHERE (o.is_direct = true OR o.flow = 'photographer')
        AND o.status NOT IN ('draft','cancelled')
        AND o.invoice_id IS NULL
        ${hasFilter ? 'AND o.admin_id = ANY($1::uuid[])' : ''}`,
    hasFilter ? [opts.adminIds] : []
  );

  const dueAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  let invoiced = 0, paid = 0, failed = 0;

  for (const { admin_id: adminId } of adminRows) {
    const invoice = await PhotographerInvoice.closePeriodForAdmin(adminId, period.periodStart, period.periodEnd, dueAt);
    if (!invoice) continue; // already closed or nothing to bill
    invoiced++;
    const charged = await chargeInvoice(invoice);
    if (charged?.status === 'paid') paid++; else failed++;
  }

  logger.info(`[billing] cycle ${period.periodStart} closed: ${invoiced} invoiced, ${paid} paid, ${failed} failed`);
  return { invoiced, paid, failed, period };
}

/**
 * Collect everything a photographer owes (manual "charge now" from the
 * collection screen): first retry their existing unpaid invoices
 * (failed / pending_payment), then bill any new unbilled orders into a fresh
 * invoice (today-dated) and charge it. Optionally restricted to `adminIds`.
 *
 * Idempotent & safe: unpaid invoices are re-queried per run (a paid one drops
 * out), new orders are attached by invoice_id, and today's period_start never
 * collides with the monthly cron's 1st-of-month key.
 *
 * @returns {Promise<{invoiced:number, paid:number, failed:number}>}
 *          invoiced = number of invoices acted on (retried + newly created)
 */
async function chargeOutstanding({ adminIds } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  let invoiced = 0, paid = 0, failed = 0;
  const tally = (inv) => { invoiced++; if (inv?.status === 'paid') paid++; else failed++; };

  // 1. Retry existing unpaid invoices (failed / pending_payment).
  const unpaid = await PhotographerInvoice.findUnpaid(
    Array.isArray(adminIds) && adminIds.length ? adminIds : undefined
  );
  for (const invoice of unpaid) {
    tally(await chargeInvoice(invoice));
  }

  // 2. Bill new unbilled orders for each target admin.
  const hasFilter = Array.isArray(adminIds) && adminIds.length > 0;
  const { rows: adminRows } = await pool.query(
    `SELECT DISTINCT o.admin_id
       FROM store_orders o
      WHERE (o.is_direct = true OR o.flow = 'photographer')
        AND o.status NOT IN ('draft','cancelled')
        AND o.invoice_id IS NULL
        ${hasFilter ? 'AND o.admin_id = ANY($1::uuid[])' : ''}`,
    hasFilter ? [adminIds] : []
  );
  const dueAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  for (const { admin_id: adminId } of adminRows) {
    const invoice = await PhotographerInvoice.closePeriodForAdmin(adminId, today, today, dueAt);
    if (!invoice) continue;
    tally(await chargeInvoice(invoice));
  }

  logger.info(`[billing] chargeOutstanding: ${invoiced} invoice(s), ${paid} paid, ${failed} failed`);
  return { invoiced, paid, failed };
}

/**
 * Superadmin financial report. Read-only.
 *
 * Period-bound figures (use from/to): revenue actually collected from
 * photographers (paid invoices by paid_at) and settlements paid to suppliers
 * (by settled_at). Point-in-time figures (ignore the range): current open debt
 * — unbilled accrual, unpaid invoices, and open supplier balances.
 *
 * @param {{from?:string, to?:string}} [opts]  YYYY-MM-DD (inclusive)
 */
async function financialReport({ from, to } = {}) {
  const f = from || null;
  const t = to || null;

  // Per-photographer: current open accrual + unpaid invoices (reuse overview).
  const overview = await PhotographerInvoice.overview();

  // Per-photographer revenue collected within the period (paid invoices).
  const { rows: paidRows } = await pool.query(
    `SELECT admin_id, COALESCE(SUM(total_amount),0)::numeric AS total
       FROM photographer_invoices
      WHERE status = 'paid'
        AND ($1::date IS NULL OR paid_at >= $1)
        AND ($2::date IS NULL OR paid_at < ($2::date + interval '1 day'))
      GROUP BY admin_id`,
    [f, t]
  );
  const paidMap = new Map(paidRows.map((r) => [r.admin_id, Number(r.total)]));

  const photographers = overview.map((p) => ({
    adminId: p.adminId,
    name: p.name,
    email: p.email,
    paidInPeriod: paidMap.get(p.adminId) || 0,
    accrued: p.accrued,
    unpaidTotal: p.unpaidTotal,
    outstanding: p.outstanding,
  }));

  // Current pending / failed split (point-in-time).
  const { rows: pf } = await pool.query(
    `SELECT status, COALESCE(SUM(total_amount),0)::numeric AS total
       FROM photographer_invoices
      WHERE status IN ('pending_payment','failed')
      GROUP BY status`
  );
  const revenuePending = Number(pf.find((r) => r.status === 'pending_payment')?.total || 0);
  const revenueFailed = Number(pf.find((r) => r.status === 'failed')?.total || 0);

  // Suppliers: current open balance (point-in-time) + settled within period.
  const { rows: suppliers } = await pool.query(
    `SELECT id, name FROM suppliers WHERE is_active = true ORDER BY is_exclusive DESC, created_at ASC`
  );
  const { rows: openRows } = await pool.query(
    `SELECT o.supplier_id, COALESCE(SUM(i.unit_cost_price * i.quantity),0)::numeric AS total
       FROM store_orders o
       LEFT JOIN store_order_items i ON i.order_id = o.id
      WHERE o.status IN ('sent_to_supplier','in_production','ready_to_ship','shipped','delivered')
        AND o.settlement_id IS NULL
      GROUP BY o.supplier_id`
  );
  const openMap = new Map(openRows.map((r) => [r.supplier_id, Number(r.total)]));
  const { rows: settledRows } = await pool.query(
    `SELECT supplier_id, COALESCE(SUM(total_cost),0)::numeric AS total
       FROM supplier_settlements
      WHERE status = 'settled'
        AND ($1::date IS NULL OR settled_at >= $1)
        AND ($2::date IS NULL OR settled_at < ($2::date + interval '1 day'))
      GROUP BY supplier_id`,
    [f, t]
  );
  const settledMap = new Map(settledRows.map((r) => [r.supplier_id, Number(r.total)]));

  const supplierRows = suppliers.map((s) => ({
    supplierId: s.id,
    name: s.name,
    openBalance: openMap.get(s.id) || 0,
    settledInPeriod: settledMap.get(s.id) || 0,
  }));

  const round = (n) => Math.round(n * 100) / 100;
  const totals = {
    revenuePaid:     round(photographers.reduce((a, p) => a + p.paidInPeriod, 0)),
    revenuePending:  round(revenuePending),
    revenueFailed:   round(revenueFailed),
    openAccrual:     round(photographers.reduce((a, p) => a + p.accrued, 0)),
    outstanding:     round(photographers.reduce((a, p) => a + p.outstanding, 0)),
    supplierOwed:    round(supplierRows.reduce((a, s) => a + s.openBalance, 0)),
    supplierSettled: round(supplierRows.reduce((a, s) => a + s.settledInPeriod, 0)),
  };

  return { period: { from: f, to: t }, photographers, suppliers: supplierRows, totals };
}

module.exports = { closeCycle, chargeOutstanding, chargeInvoice, previousMonthPeriod, financialReport };
