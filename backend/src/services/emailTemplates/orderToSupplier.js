'use strict';

const { esc, emailWrapper, emailFooter } = require('./shell');

/**
 * Build the full HTML for the supplier order notification email.
 *
 * @param {object}   opts
 * @param {string}   opts.supplierName
 * @param {string}   opts.studioName
 * @param {string}   [opts.orderId]
 * @param {Array}    [opts.orderItems]       - [{ productName, quantity, specs }]
 * @param {object}   [opts.shippingAddress]
 * @param {string}   [opts.notes]
 */
function buildOrderToSupplierHtml({ supplierName, studioName, orderId, orderItems = [], shippingAddress, notes }) {
  const studio   = esc(studioName || 'LightStudio');
  const orderRef = orderId ? orderId.slice(0, 8).toUpperCase() : '';

  const itemsHtml = orderItems
    .map((it) => {
      const specsText =
        it.specs && typeof it.specs === 'object' && Object.keys(it.specs).length
          ? Object.entries(it.specs)
              .map(([k, v]) => `${esc(String(k))}: ${esc(String(v))}`)
              .join(', ')
          : '';
      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #E8E8E8;
                   font-family:'Inter',Arial,sans-serif;font-size:14px;color:#333333;">
          ${esc(it.productName)}${specsText ? ` <span style="color:#888;font-size:12px;">(${specsText})</span>` : ''}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #E8E8E8;text-align:center;
                   font-family:'Inter',Arial,sans-serif;font-size:14px;color:#333333;">
          ${Number(it.quantity) || 1}
        </td>
      </tr>`;
    })
    .join('');

  const shippingHtml = shippingAddress
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-top:24px;margin-bottom:8px;">
      <tr>
        <td style="background-color:#F9F9F9;border-radius:8px;padding:16px 20px;
                   border-left:3px solid #111111;">
          <p style="margin:0 0 6px;
                     font-family:'Inter',Arial,sans-serif;
                     font-size:10px;font-weight:600;
                     letter-spacing:2px;color:#888888;
                     text-transform:uppercase;">
            Shipping Address
          </p>
          <p style="margin:0;
                     font-family:'Inter',Arial,sans-serif;
                     font-size:14px;color:#444444;line-height:1.7;">
            ${esc(shippingAddress.name || '')}<br/>
            ${esc(shippingAddress.street || '')}${shippingAddress.apartment ? ', ' + esc(shippingAddress.apartment) : ''}<br/>
            ${esc(shippingAddress.city || '')}${shippingAddress.zip ? ' ' + esc(shippingAddress.zip) : ''}<br/>
            ${shippingAddress.country ? esc(shippingAddress.country) : ''}
          </p>
        </td>
      </tr>
    </table>`
    : '';

  const notesHtml = notes
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-top:16px;">
      <tr>
        <td style="background-color:#FFFBF0;border-radius:8px;padding:14px 20px;
                   border-left:3px solid #E8C840;">
          <p style="margin:0 0 4px;
                     font-family:'Inter',Arial,sans-serif;
                     font-size:10px;font-weight:600;
                     letter-spacing:2px;color:#888888;
                     text-transform:uppercase;">
            Notes
          </p>
          <p style="margin:0;
                     font-family:'Playfair Display',Georgia,serif;
                     font-size:14px;font-style:italic;
                     color:#444444;line-height:1.75;">
            ${esc(notes)}
          </p>
        </td>
      </tr>
    </table>`
    : '';

  const bodyRows = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding:40px 40px 24px;background-color:#ffffff;">
        <p style="margin:0 0 20px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:10px;font-weight:600;
                  letter-spacing:5px;color:#888888;
                  text-transform:uppercase;">
          ${studio}
        </p>
        <p style="margin:0 0 10px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:11px;font-weight:500;
                  letter-spacing:3px;color:#888888;
                  text-transform:uppercase;">
          New Order
        </p>
        <h1 style="margin:0 0 8px;
                   font-family:'Playfair Display',Georgia,serif;
                   font-size:28px;font-weight:400;
                   color:#111111;line-height:1.2;letter-spacing:-0.3px;">
          Order #${orderRef}
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="margin:16px auto 0;">
          <tr>
            <td style="width:40px;height:1px;background-color:#111111;font-size:0;"></td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:0 40px 40px;">
        <p style="margin:0 0 20px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:15px;color:#444444;line-height:1.7;">
          Hi ${esc(supplierName || 'Supplier')}, you have received a new order from
          <strong style="color:#111111;">${studio}</strong>.
          Please review the details below and begin production.
        </p>

        <!-- Items table -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <thead>
            <tr>
              <th style="padding:8px 0;border-bottom:2px solid #111111;text-align:left;
                         font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;
                         letter-spacing:1.5px;color:#888888;text-transform:uppercase;">
                Product
              </th>
              <th style="padding:8px 0;border-bottom:2px solid #111111;text-align:center;
                         font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;
                         letter-spacing:1.5px;color:#888888;text-transform:uppercase;width:80px;">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || `
            <tr>
              <td colspan="2" style="padding:14px 0;
                                     font-family:'Inter',Arial,sans-serif;
                                     font-size:14px;color:#888888;">
                No items
              </td>
            </tr>`}
          </tbody>
        </table>

        ${shippingHtml}
        ${notesHtml}
      </td>
    </tr>

    ${emailFooter(studio, false)}
  `;

  return emailWrapper('ltr', 'en', bodyRows);
}

function orderToSupplierSubject({ studioName, orderId }) {
  const studio   = esc(studioName || 'LightStudio');
  const orderRef = orderId ? orderId.slice(0, 8).toUpperCase() : '';
  return `New Order #${orderRef} from ${studio}`;
}

module.exports = { buildOrderToSupplierHtml, orderToSupplierSubject };
