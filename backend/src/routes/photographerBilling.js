const express = require('express');
const Admin = require('../models/Admin');
const PhotographerInvoice = require('../models/PhotographerInvoice');
const payplus = require('../utils/payplus');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(protect);

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:8080';
const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';

// POST /api/billing/card — start the add-card-on-file flow (returns hosted page link)
router.post('/card', asyncHandler(async (req, res) => {
  const result = await payplus.generateCardTokenPage({
    adminId:     req.admin.id,
    customerName: req.admin.studioName || req.admin.name,
    successUrl:  `${FRONTEND}/admin/billing-store?card=ok`,
    failureUrl:  `${FRONTEND}/admin/billing-store?card=fail`,
    cancelUrl:   `${FRONTEND}/admin/billing-store`,
    callbackUrl: `${BACKEND}/api/plans/webhook`,
  });
  const url = result?.data?.payment_page_link || result?.payment_page_link || result?.data?.url;
  if (!url) return res.status(502).json({ message: 'Failed to generate card page' });
  res.json({ url });
}));

// GET /api/billing/me — current accrual + card-on-file + invoice history
router.get('/me', asyncHandler(async (req, res) => {
  const accrued = await PhotographerInvoice.currentAccrued(req.admin.id);
  const invoices = await PhotographerInvoice.findByAdmin(req.admin.id);
  const admin = await Admin.findById(req.admin.id);
  res.json({
    accrued,
    invoices,
    hasCardOnFile: !!admin?.payplusCardToken,
    cardLast4: admin?.cardLast4 || null,
    cardBrand: admin?.cardBrand || null,
    billingBlocked: admin?.billingBlocked ?? false,
    canOrderSupplier: admin?.canOrderSupplier ?? true,
  });
}));

// GET /api/billing/documents — receipts/invoices issued to this photographer
router.get('/documents', asyncHandler(async (req, res) => {
  const IssuedDocument = require('../models/IssuedDocument');
  res.json(await IssuedDocument.findByRecipient('admin', req.admin.id));
}));

// GET /api/billing/invoices/:id — line items for one of the photographer's invoices
router.get('/invoices/:id', asyncHandler(async (req, res) => {
  const invoice = await PhotographerInvoice.findById(req.params.id);
  if (!invoice || invoice.adminId !== req.admin.id) {
    return res.status(404).json({ message: 'Invoice not found' });
  }
  const items = await PhotographerInvoice.lineItems(req.params.id);
  res.json({ invoice, items });
}));

module.exports = router;
