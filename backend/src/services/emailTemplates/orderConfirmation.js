'use strict';

const { esc, emailWrapper, emailFooter } = require('./shell');

/**
 * Build the full HTML for the order-confirmation receipt email.
 *
 * @param {object}   opts
 * @param {string}   opts.clientName
 * @param {string}   opts.studioName
 * @param {string}   [opts.orderId]
 * @param {Array}    [opts.items]           - [{ productName, quantity, unitPrice }]
 * @param {number}   opts.totalAmount
 * @param {string}   [opts.currency]
 * @param {object}   [opts.shippingAddress]
 */
function buildOrderConfirmationHtml({ clientName, studioName, orderId, items = [], totalAmount, currency = 'ILS', shippingAddress }) {
  const studio   = esc(studioName || 'LightStudio');
  const orderRef = orderId ? String(orderId).slice(0, 8).toUpperCase() : '';
  const symbol   = currency === 'ILS' ? '₪' : currency + ' ';

  const itemRows = items.map((it) => `
    <tr>
      <td style="padding:8px 0;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#111111;">
        ${esc(it.productName)} ×${it.quantity}
      </td>
      <td align="right" style="padding:8px 0;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#444444;" dir="ltr">
        ${it.unitPrice != null ? `${symbol}${(it.unitPrice * it.quantity).toLocaleString()}` : ''}
      </td>
    </tr>`).join('');

  const addressBlock = shippingAddress ? `
    <p style="margin:20px 0 0;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#888888;line-height:1.7;">
      Shipping to: <strong style="color:#111111;">${esc(shippingAddress.name || '')}</strong>,
      ${esc(shippingAddress.street || '')}${shippingAddress.apartment ? ' ' + esc(shippingAddress.apartment) : ''},
      ${esc(shippingAddress.city || '')}${shippingAddress.zip ? ' ' + esc(shippingAddress.zip) : ''}
    </p>` : '';

  const bodyRows = `
    <tr>
      <td align="center" style="padding:40px 40px 24px;background-color:#ffffff;">
        <p style="margin:0 0 20px;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:5px;color:#888888;text-transform:uppercase;">
          ${studio}
        </p>
        <p style="margin:0 0 10px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:500;letter-spacing:3px;color:#888888;text-transform:uppercase;">
          Order Confirmed
        </p>
        <h1 style="margin:0 0 20px;font-family:'Playfair Display',Georgia,serif;font-size:30px;font-weight:400;color:#111111;line-height:1.2;letter-spacing:-0.3px;">
          Thank you for your order
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr><td style="width:40px;height:1px;background-color:#111111;font-size:0;"></td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 40px;">
        <p style="margin:0 0 16px;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:500;color:#111111;line-height:1.5;">
          Hi ${esc(clientName)},
        </p>
        <p style="margin:0 0 20px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#444444;line-height:1.85;">
          Your payment was received and your order is being prepared. Here's a summary:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="border-top:1px solid #eeeeee;border-bottom:1px solid #eeeeee;margin:0 0 16px;">
          ${itemRows}
          <tr>
            <td style="padding:12px 0 8px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;border-top:1px solid #eeeeee;">
              Total
            </td>
            <td align="right" style="padding:12px 0 8px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;color:#111111;border-top:1px solid #eeeeee;" dir="ltr">
              ${symbol}${Number(totalAmount || 0).toLocaleString()}
            </td>
          </tr>
        </table>
        ${orderRef ? `
        <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:13px;color:#888888;line-height:1.7;">
          Order reference: <strong style="color:#111111;">#${orderRef}</strong>
        </p>` : ''}
        ${addressBlock}
      </td>
    </tr>
    ${emailFooter(studio, false)}
  `;

  return emailWrapper('ltr', 'en', bodyRows);
}

function orderConfirmationSubject({ studioName, orderId }) {
  const orderRef = orderId ? String(orderId).slice(0, 8).toUpperCase() : '';
  return `${studioName ? studioName + ' · ' : ''}Order confirmed${orderRef ? ` #${orderRef}` : ''}`;
}

module.exports = { buildOrderConfirmationHtml, orderConfirmationSubject };
