const IssuedDocument = require('../models/IssuedDocument');
const payplus = require('../utils/payplus');
const logger = require('../utils/logger');

// ── Config (env, safe defaults) ───────────────────────────────────────────────
const cfg = () => ({
  businessName: process.env.BUSINESS_NAME || 'Light Studio',
  taxId:        process.env.BUSINESS_TAX_ID || '',
  docType:      process.env.INVOICE_DOC_TYPE || 'receipt',        // receipt | tax_invoice_receipt
  vatMode:      process.env.INVOICE_VAT_MODE || 'exempt',         // exempt | included | added
  vatRate:      Number(process.env.INVOICE_VAT_RATE || 18),
  enabled:      process.env.PAYPLUS_DOCUMENTS_ENABLED === 'true',
});

/**
 * Split a gross amount into { net, vat } per the configured VAT mode.
 *   exempt  → vat 0 (עוסק פטור)
 *   included→ amount already includes VAT; back it out
 *   added   → VAT added on top (amount is net)
 * Returns { total, vat } where total is what the customer pays.
 */
function computeVat(amount) {
  const { vatMode, vatRate } = cfg();
  const a = Number(amount) || 0;
  const r = vatRate / 100;
  if (vatMode === 'included') {
    const vat = +(a - a / (1 + r)).toFixed(2);
    return { total: a, vat };
  }
  if (vatMode === 'added') {
    const vat = +(a * r).toFixed(2);
    return { total: +(a + vat).toFixed(2), vat };
  }
  return { total: a, vat: 0 }; // exempt
}

/**
 * Issue (or scaffold) a receipt for a payment. Idempotent per source.
 * While PayPlus documents are disabled, records the doc as `pending` and sends
 * a provisional payment-confirmation email; once enabled, issues the real doc.
 */
async function issueReceipt({ sourceKind, sourceId, recipientKind, recipient, items = [], amount }) {
  const c = cfg();
  const { total, vat } = computeVat(amount);
  const docType = c.docType; // receipt (עוסק פטור) or tax_invoice_receipt

  const { doc, created } = await IssuedDocument.getOrCreate(sourceKind, sourceId, docType, {
    recipientKind,
    recipientId:    recipient?.id,
    recipientName:  recipient?.name,
    recipientEmail: recipient?.email,
    amount: total,
    vatAmount: vat,
  });
  if (!doc) return null;
  // Already issued on a prior run → don't double-send
  if (!created && doc.status === 'issued') return doc;

  let issued = doc;
  if (c.enabled) {
    try {
      const res = await payplus.issueDocument({
        docType,
        customerName:  recipient?.name,
        customerEmail: recipient?.email,
        items,
        vatAmount: vat,
      });
      issued = await IssuedDocument.markIssued(doc.id, {
        payplusDocumentUid: res.documentUid,
        documentNumber:     res.documentNumber,
        pdfUrl:             res.pdfUrl,
      });
    } catch (err) {
      logger.warn(`[invoice] issue failed for ${sourceKind}/${sourceId}: ${err.message}`);
      await IssuedDocument.markFailed(doc.id, err.message);
    }
  }

  // Always email the recipient (official PDF if issued, else provisional)
  if (recipient?.email) {
    const { sendDocumentEmail } = require('./emailService');
    sendDocumentEmail({
      recipientName:  recipient.name,
      recipientEmail: recipient.email,
      docType,
      amount: total,
      vatAmount: vat,
      items,
      documentNumber: issued?.documentNumber,
      pdfUrl: issued?.pdfUrl,
      provisional: !issued?.pdfUrl,
      businessName: c.businessName,
    }).catch((e) => logger.warn(`[invoice] email failed for ${sourceKind}/${sourceId}: ${e.message}`));
  }

  return issued || doc;
}

/**
 * Per-order confirmation to the photographer (NOT a tax document — no payment
 * happened yet; the real receipt comes at the monthly charge). Records an
 * order_confirmation row for the audit trail + emails the photographer.
 */
async function sendOrderConfirmation({ admin, order }) {
  if (!admin?.email) return;
  const items = (order.items || []).map((it) => ({
    name: it.product?.name || 'Product',
    quantity: it.quantity || 1,
    unitPrice: it.unitCostPrice != null ? Number(it.unitCostPrice) : null,
  }));
  const amount = Number(order.totalAmount) || 0;

  await IssuedDocument.getOrCreate('order_confirmation', order.id, 'order_confirmation', {
    recipientKind: 'admin',
    recipientId: admin.id,
    recipientName: admin.name,
    recipientEmail: admin.email,
    amount,
    vatAmount: 0,
  });

  const { sendDocumentEmail } = require('./emailService');
  sendDocumentEmail({
    recipientName:  admin.name,
    recipientEmail: admin.email,
    docType: 'order_confirmation',
    amount,
    items,
    provisional: true, // worded as a confirmation, never a tax doc
    businessName: cfg().businessName,
  }).catch((e) => logger.warn(`[invoice] order-confirmation email failed for order ${order.id}: ${e.message}`));
}

/**
 * Issue all pending receipts — run once after enabling PayPlus documents.
 */
async function backfillPending() {
  if (!cfg().enabled) return { skipped: true, reason: 'PayPlus documents disabled' };
  const pending = await IssuedDocument.findPending();
  let issued = 0, failed = 0;
  for (const doc of pending) {
    try {
      const res = await payplus.issueDocument({
        docType: doc.docType,
        customerName: doc.recipientName,
        customerEmail: doc.recipientEmail,
        items: [{ name: doc.docType === 'receipt' ? 'תשלום' : 'Payment', quantity: 1, unitPrice: Number(doc.amount) }],
        vatAmount: Number(doc.vatAmount),
      });
      const updated = await IssuedDocument.markIssued(doc.id, {
        payplusDocumentUid: res.documentUid, documentNumber: res.documentNumber, pdfUrl: res.pdfUrl,
      });
      issued++;
      if (doc.recipientEmail && updated?.pdfUrl) {
        const { sendDocumentEmail } = require('./emailService');
        sendDocumentEmail({
          recipientName: doc.recipientName, recipientEmail: doc.recipientEmail, docType: doc.docType,
          amount: Number(doc.amount), vatAmount: Number(doc.vatAmount),
          documentNumber: updated.documentNumber, pdfUrl: updated.pdfUrl, businessName: cfg().businessName,
        }).catch(() => {});
      }
    } catch (err) {
      await IssuedDocument.markFailed(doc.id, err.message);
      failed++;
    }
  }
  return { issued, failed, total: pending.length };
}

module.exports = { computeVat, issueReceipt, sendOrderConfirmation, backfillPending, cfg };
