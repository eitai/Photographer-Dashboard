'use strict';

const nodemailer = require('nodemailer');

const { buildGalleryLinkHtml, galleryLinkSubject }             = require('./emailTemplates/galleryLink');
const { buildProductOrderLinksHtml, productOrderLinksSubject } = require('./emailTemplates/productOrderLinks');
const { buildOrderSelectionLinkHtml, orderSelectionLinkSubject } = require('./emailTemplates/orderSelectionLink');
const { buildOrderToSupplierHtml, orderToSupplierSubject }     = require('./emailTemplates/orderToSupplier');
const { buildOrderStatusHtml, orderStatusSubject }             = require('./emailTemplates/orderStatus');
const { buildOrderConfirmationHtml, orderConfirmationSubject } = require('./emailTemplates/orderConfirmation');
const { buildInvoiceHtml, invoiceSubject }                     = require('./emailTemplates/invoice');
const { buildDocumentHtml, documentSubject }                   = require('./emailTemplates/document');

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ─── Sender helpers ───────────────────────────────────────────────────────────

function fromAddress(studioName) {
  return process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`;
}

// ─── 1. Gallery link email ────────────────────────────────────────────────────

async function sendGalleryLink({ clientName, clientEmail, galleryName, galleryUrl, headerMessage, studioName, lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping gallery email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(studioName),
    to:      clientEmail,
    subject: galleryLinkSubject({ galleryName, studioName, lang }),
    html:    buildGalleryLinkHtml({ clientName, galleryName, galleryUrl, headerMessage, studioName, lang }),
  });

  return true;
}

// ─── 2. Product order links email ─────────────────────────────────────────────

async function sendProductOrderLinks({ clientName, clientEmail, studioName, links, lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping product order email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(studioName),
    to:      clientEmail,
    subject: productOrderLinksSubject({ studioName, lang }),
    html:    buildProductOrderLinksHtml({ clientName, studioName, links, lang }),
  });

  return true;
}

// ─── 3. Order selection link (to client) ──────────────────────────────────────

async function sendOrderSelectionLink({ clientName, clientEmail, studioName, selectionUrl, orderItems = [], lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping order selection email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(studioName),
    to:      clientEmail,
    subject: orderSelectionLinkSubject({ studioName, lang }),
    html:    buildOrderSelectionLinkHtml({ clientName, studioName, selectionUrl, orderItems, lang }),
  });

  return true;
}

// ─── 4. Order to supplier email ───────────────────────────────────────────────

async function sendOrderToSupplier({ supplierEmail, supplierName, studioName, orderId, orderItems = [], shippingAddress, notes }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping supplier order email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(studioName),
    to:      supplierEmail,
    subject: orderToSupplierSubject({ studioName, orderId }),
    html:    buildOrderToSupplierHtml({ supplierName, studioName, orderId, orderItems, shippingAddress, notes }),
  });

  return true;
}

// ─── 5. Order status email (to client) ────────────────────────────────────────

async function sendOrderStatusEmail({ clientName, clientEmail, studioName, orderId, status, trackingNumber, trackingCarrier }) {
  const html    = buildOrderStatusHtml({ clientName, studioName, orderId, status, trackingNumber, trackingCarrier });
  const subject = orderStatusSubject({ studioName, status });
  if (!html || !subject) return; // unknown status — no-op, matches original behaviour

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping order status email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(studioName),
    to:      clientEmail,
    subject,
    html,
  });

  return true;
}

// ─── 6. Order confirmation email ──────────────────────────────────────────────

async function sendOrderConfirmationEmail({ clientName, clientEmail, studioName, orderId, items = [], totalAmount, currency = 'ILS', shippingAddress }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping order confirmation email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(studioName),
    to:      clientEmail,
    subject: orderConfirmationSubject({ studioName, orderId }),
    html:    buildOrderConfirmationHtml({ clientName, studioName, orderId, items, totalAmount, currency, shippingAddress }),
  });

  return true;
}

// ─── 7. Invoice / payment-failure email ───────────────────────────────────────

async function sendInvoiceEmail({ adminName, adminEmail, studioName, amount, periodStart, outcome, payLink }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping invoice email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(studioName),
    to:      adminEmail,
    subject: invoiceSubject({ studioName, periodStart, outcome }),
    html:    buildInvoiceHtml({ adminName, studioName, amount, periodStart, outcome, payLink }),
  });

  return true;
}

// ─── 8. Accounting document email ─────────────────────────────────────────────

async function sendDocumentEmail({ recipientName, recipientEmail, docType, amount, vatAmount = 0, items = [], documentNumber, pdfUrl, provisional, businessName }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping document email');
    return false;
  }

  await transporter.sendMail({
    from:    fromAddress(businessName),
    to:      recipientEmail,
    subject: documentSubject({ businessName, docType, documentNumber, provisional }),
    html:    buildDocumentHtml({ recipientName, docType, amount, vatAmount, items, documentNumber, pdfUrl, provisional, businessName }),
  });

  return true;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  sendGalleryLink,
  sendProductOrderLinks,
  sendOrderSelectionLink,
  sendOrderToSupplier,
  sendOrderStatusEmail,
  sendOrderConfirmationEmail,
  sendInvoiceEmail,
  sendDocumentEmail,
};
