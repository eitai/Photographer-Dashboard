'use strict';

const { esc, emailWrapper, emailFooter, renderEmailHeader } = require('./shell');

// ─── Status variants ──────────────────────────────────────────────────────────

const variants = {
  in_production: {
    subject:  (studio) => `${studio ? studio + ' · ' : ''}Your order is in production`,
    eyebrow:  'Order Update',
    heading:  'Your order is in production',
    bodyText: () =>
      "Great news — your photo products are now being produced. We'll send you another update as soon as they're on their way.",
  },
  ready_to_ship: {
    subject:  (studio) => `${studio ? studio + ' · ' : ''}Your order is ready to ship`,
    eyebrow:  'Order Update',
    heading:  'Your order is ready to ship',
    bodyText: () =>
      'Your photo products are packed and ready — they will be handed to the carrier shortly.',
  },
  shipped: {
    subject:  (studio) => `${studio ? studio + ' · ' : ''}Your order has shipped`,
    eyebrow:  'Order Shipped',
    heading:  'Your order has shipped',
    bodyText: (tracking, carrier) =>
      tracking
        ? `Your order is on its way! Tracking: <strong style="color:#111111;">${esc(carrier || '')}${carrier ? ' ' : ''}#${esc(tracking)}</strong>`
        : 'Your order is on its way!',
  },
  delivered: {
    subject:  (studio) => `${studio ? studio + ' · ' : ''}Your order has been delivered`,
    eyebrow:  'Delivered',
    heading:  'Your order has been delivered',
    bodyText: () =>
      'Your order has arrived! Thank you for choosing us — we hope you love your photos.',
  },
};

/**
 * Build the full HTML for an order-status notification email.
 *
 * @param {object} opts
 * @param {string} opts.clientName
 * @param {string} opts.studioName
 * @param {string} [opts.orderId]
 * @param {'in_production'|'ready_to_ship'|'shipped'|'delivered'} opts.status
 * @param {string} [opts.trackingNumber]
 * @param {string} [opts.trackingCarrier]
 * @returns {string|null}  null when status is unknown
 */
function buildOrderStatusHtml({ clientName, studioName, orderId, status, trackingNumber, trackingCarrier }) {
  const variant = variants[status];
  if (!variant) return null;

  const studio   = esc(studioName || 'LightStudio');
  const orderRef = orderId ? String(orderId).slice(0, 8).toUpperCase() : '';

  const bodyRows = `
    ${renderEmailHeader({ studio, eyebrow: esc(variant.eyebrow), heading: esc(variant.heading) })}

    <!-- Body -->
    <tr>
      <td style="padding:0 40px 40px;">
        <p style="margin:0 0 16px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:16px;font-weight:500;color:#111111;
                  line-height:1.5;">
          Hi ${esc(clientName)},
        </p>
        <p style="margin:0 0 20px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:15px;color:#444444;line-height:1.85;">
          ${variant.bodyText(trackingNumber, trackingCarrier)}
        </p>
        ${orderRef ? `
        <p style="margin:0;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:13px;color:#888888;line-height:1.7;">
          Order reference: <strong style="color:#111111;">#${orderRef}</strong>
        </p>` : ''}
      </td>
    </tr>

    ${emailFooter(studio, false)}
  `;

  return emailWrapper('ltr', 'en', bodyRows);
}

function orderStatusSubject({ studioName, status }) {
  const variant = variants[status];
  if (!variant) return null;
  return variant.subject(studioName || '');
}

/** Expose variants so callers can guard on unknown status before building. */
module.exports = { buildOrderStatusHtml, orderStatusSubject, ORDER_STATUS_VARIANTS: variants };
