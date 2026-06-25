const express = require('express');
const pool = require('../db');
const Admin = require('../models/Admin');
const PhotographerInvoice = require('../models/PhotographerInvoice');
const SupplierSettlement = require('../models/SupplierSettlement');
const billingService = require('../services/billingService');
const payplus = require('../utils/payplus');
const { superprotect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');

const router = express.Router();
router.use(superprotect);

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:8080';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

// ── Photographer billing (collection screen) ──────────────────────────────────

// GET /api/admin/billing/overview — all photographers + accrual + latest invoice
router.get('/overview', asyncHandler(async (_req, res) => {
  res.json(await PhotographerInvoice.overview());
}));

// GET /api/admin/billing/invoices/:id — invoice + line items
router.get('/invoices/:id', asyncHandler(async (req, res) => {
  const invoice = await PhotographerInvoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const items = await PhotographerInvoice.lineItems(req.params.id);
  res.json({ invoice, items });
}));

// POST /api/admin/billing/close-cycle — run the monthly billing engine now
router.post('/close-cycle', asyncHandler(async (req, res) => {
  const { periodStart, periodEnd } = req.body || {};
  const result = await billingService.closeCycle({ periodStart, periodEnd });
  res.json(result);
}));

// POST /api/admin/billing/charge — ad-hoc charge now (all photographers, or a selected subset).
// Uses today's date as the invoice period so it never collides with the monthly run.
router.post('/charge', asyncHandler(async (req, res) => {
  const { adminIds } = req.body || {};
  if (adminIds !== undefined) {
    if (!Array.isArray(adminIds) || adminIds.some((id) => !UUID_RE.test(id))) {
      return res.status(400).json({ message: 'adminIds must be an array of UUIDs' });
    }
  }
  // Collect everything owed: retry unpaid invoices + bill new orders.
  const result = await billingService.chargeOutstanding({
    adminIds: adminIds && adminIds.length ? adminIds : undefined,
  });
  res.json(result);
}));

// GET /api/admin/billing/report — superadmin financial report (revenue + open debt) for a date range
router.get('/report', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return res.status(400).json({ message: 'from/to must be YYYY-MM-DD' });
  }
  res.json(await billingService.financialReport({ from: from || undefined, to: to || undefined }));
}));

// POST /api/admin/billing/invoices/:id/mark-paid — manual reconciliation
router.post('/invoices/:id/mark-paid', asyncHandler(async (req, res) => {
  const updated = await PhotographerInvoice.markPaid(req.params.id, req.body?.transactionUid || 'manual');
  if (!updated) return res.status(404).json({ message: 'Invoice not found' });
  res.json(updated);
}));

// POST /api/admin/billing/invoices/:id/resend-link — generate a hosted payment link
router.post('/invoices/:id/resend-link', asyncHandler(async (req, res) => {
  const invoice = await PhotographerInvoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  const link = await payplus.generateStorePaymentLink({
    amount:      Number(invoice.totalAmount),
    orderId:     invoice.id,
    clientName:  '',
    items:       [{ name: `Invoice ${invoice.periodStart}`, quantity: 1, unitPrice: Number(invoice.totalAmount) }],
    successUrl:  `${FRONTEND}/admin/billing-store?paid=1`,
    failureUrl:  `${FRONTEND}/admin/billing-store?paid=0`,
    cancelUrl:   `${FRONTEND}/admin/billing-store`,
    callbackUrl: `${BACKEND}/api/plans/webhook`,
  }).catch(() => null);
  const url = link?.data?.payment_page_link || link?.payment_page_link || null;
  if (url) await PhotographerInvoice.setLink(invoice.id, url);
  res.json({ url });
}));

// POST /api/admin/billing/admins/:id/unblock — lift a delinquency block
router.post('/admins/:id/unblock', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });
  await pool.query('UPDATE admins SET billing_blocked = false WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ── Accounting documents (receipts / invoices) ────────────────────────────────

// GET /api/admin/billing/documents — all issued documents
router.get('/documents', asyncHandler(async (req, res) => {
  const IssuedDocument = require('../models/IssuedDocument');
  res.json(await IssuedDocument.findAll({ status: req.query.status || undefined }));
}));

// POST /api/admin/billing/documents/backfill — issue all pending docs (after PayPlus on)
router.post('/documents/backfill', asyncHandler(async (_req, res) => {
  const invoiceService = require('../services/invoiceService');
  res.json(await invoiceService.backfillPending());
}));

// POST /api/admin/billing/documents/:id/retry — retry a single failed/pending doc
router.post('/documents/:id/retry', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });
  const IssuedDocument = require('../models/IssuedDocument');
  const invoiceService = require('../services/invoiceService');
  const doc = await IssuedDocument.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  const cfg = invoiceService.cfg();
  if (!cfg.enabled) return res.status(409).json({ message: 'PayPlus documents not enabled' });
  const payplus = require('../utils/payplus');
  try {
    const r = await payplus.issueDocument({
      docType: doc.docType, customerName: doc.recipientName, customerEmail: doc.recipientEmail,
      items: [{ name: 'Payment', quantity: 1, unitPrice: Number(doc.amount) }], vatAmount: Number(doc.vatAmount),
    });
    const updated = await IssuedDocument.markIssued(doc.id, { payplusDocumentUid: r.documentUid, documentNumber: r.documentNumber, pdfUrl: r.pdfUrl });
    res.json(updated);
  } catch (err) {
    await IssuedDocument.markFailed(doc.id, err.message);
    res.status(502).json({ message: err.message });
  }
}));

// ── Supplier settlement ───────────────────────────────────────────────────────

// GET /api/admin/billing/settlements — open balance per active supplier + history
router.get('/settlements', asyncHandler(async (_req, res) => {
  const { rows: suppliers } = await pool.query(
    'SELECT id, name FROM suppliers WHERE is_active = true ORDER BY is_exclusive DESC, created_at ASC'
  );
  const out = [];
  for (const s of suppliers) {
    out.push({
      supplierId: s.id,
      name: s.name,
      open: await SupplierSettlement.openBalance(s.id),
      history: await SupplierSettlement.history(s.id),
    });
  }
  res.json(out);
}));

// POST /api/admin/billing/settlements — create a settlement for a supplier's open balance
router.post('/settlements', asyncHandler(async (req, res) => {
  const { supplierId, periodStart, periodEnd, note } = req.body || {};
  if (!supplierId || !UUID_RE.test(supplierId)) return res.status(400).json({ message: 'Valid supplierId required' });
  const now = new Date();
  const ps = periodStart || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const pe = periodEnd || now.toISOString().slice(0, 10);
  const settlement = await SupplierSettlement.createForPeriod(supplierId, ps, pe, note);
  if (!settlement) return res.status(409).json({ message: 'Nothing to settle for this supplier' });
  res.status(201).json(settlement);
}));

// POST /api/admin/billing/settlements/:id/settle — mark a settlement paid (bank transfer done)
router.post('/settlements/:id/settle', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid ID format' });
  const updated = await SupplierSettlement.markSettled(req.params.id, req.body?.note);
  if (!updated) return res.status(404).json({ message: 'Settlement not found' });
  res.json(updated);
}));

module.exports = router;
