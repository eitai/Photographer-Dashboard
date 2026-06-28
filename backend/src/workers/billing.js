/**
 * Billing and store-dispatch worker handlers.
 *
 * billingMonthlyHandler     — close the previous month's billing cycle and
 *                             charge saved cards. Scheduled 06:00 UTC on the 1st.
 * billingDailyHandler       — retry unpaid invoices and backfill pending
 *                             accounting documents. Scheduled 06:30 UTC daily.
 * storeDispatchSweepHandler — re-dispatch paid exclusive-supplier orders that
 *                             the PayPlus webhook failed to mark as sent.
 *                             Scheduled every 15 minutes. Idempotent.
 *
 * All three handlers are idempotent — running them multiple times must be
 * safe. billingMonthlyHandler relies on UNIQUE-per-period guards inside
 * billingService.closeCycle; storeDispatchSweepHandler only updates rows
 * that are still stranded at status='approved'.
 */

'use strict';

const logger = require('../utils/logger');

// Monthly billing: close the previous month and charge saved cards.
async function billingMonthlyHandler(job) {
  const billingService = require('../services/billingService');
  const result = await billingService.closeCycle();
  logger.info(`[worker:billing] ${JSON.stringify(result)}`);
  return result;
}

// Daily recovery: retry unpaid invoices (transient PayPlus failures, crash-left
// pending) and backfill any accounting documents still pending. Never bills new
// orders, so it cannot pre-empt the monthly cycle. Idempotent.
async function billingDailyHandler() {
  const billingService = require('../services/billingService');
  const invoiceService = require('../services/invoiceService');
  const invoices = await billingService.retryUnpaidInvoices();
  const documents = await invoiceService.backfillPending();
  const result = { invoices, documents };
  logger.info(`[worker:billing-daily] ${JSON.stringify(result)}`);
  return result;
}

// Fallback dispatch sweep: the PayPlus webhook flips paid orders to
// 'sent_to_supplier' inline, but if that update failed (crash / transient DB
// error) the order is stranded at 'approved'. Re-dispatch any paid order for an
// exclusive supplier that was never sent. Idempotent (only touches stranded rows).
async function storeDispatchSweepHandler() {
  const { dispatchStrandedOrders } = require('../services/storeFulfillment');
  return dispatchStrandedOrders();
}

module.exports = {
  billingMonthlyHandler,
  billingDailyHandler,
  storeDispatchSweepHandler,
};
