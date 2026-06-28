'use strict';

const { esc, emailWrapper, emailFooter } = require('./shell');

/**
 * Build the full HTML for the monthly invoice / payment-failure email
 * sent to the photographer (admin).
 *
 * @param {object}   opts
 * @param {string}   opts.adminName
 * @param {string}   opts.studioName
 * @param {number}   opts.amount
 * @param {string}   opts.periodStart   ISO date string
 * @param {'charged'|'failed'} opts.outcome
 * @param {string}   [opts.payLink]     Hosted payment link (failure case only)
 */
function buildInvoiceHtml({ adminName, studioName, amount, periodStart, outcome, payLink }) {
  const studio  = esc(studioName || 'LightStudio');
  const month   = new Date(periodStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const charged = outcome === 'charged';

  const bodyRows = `
    <tr><td align="center" style="padding:40px 40px 24px;background-color:#ffffff;">
      <p style="margin:0 0 20px;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:5px;color:#888;text-transform:uppercase;">${studio}</p>
      <p style="margin:0 0 10px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:500;letter-spacing:3px;color:#888;text-transform:uppercase;">${charged ? 'Invoice Paid' : 'Payment Needed'}</p>
      <h1 style="margin:0 0 20px;font-family:'Playfair Display',Georgia,serif;font-size:30px;font-weight:400;color:#111;line-height:1.2;">${charged ? `Your ${month} invoice` : 'We could not process your payment'}</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="width:40px;height:1px;background-color:#111;font-size:0;"></td></tr></table>
    </td></tr>
    <tr><td style="padding:0 40px 40px;">
      <p style="margin:0 0 16px;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:500;color:#111;">Hi ${esc(adminName)},</p>
      <p style="margin:0 0 20px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#444;line-height:1.85;">
        ${charged
          ? `Your supplier orders for ${month} totaled <strong style="color:#111;">₪${Number(amount).toLocaleString()}</strong> and were charged to your card on file.`
          : `Your supplier orders for ${month} totaled <strong style="color:#111;">₪${Number(amount).toLocaleString()}</strong>, but the charge to your card did not go through. Ordering is paused until this is settled.`}
      </p>
      ${(!charged && payLink) ? `<p style="margin:0;"><a href="${payLink}" style="display:inline-block;background:#111;color:#fff;font-family:'Inter',Arial,sans-serif;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;">Pay now</a></p>` : ''}
    </td></tr>
    ${emailFooter(studio, false)}
  `;

  return emailWrapper('ltr', 'en', bodyRows);
}

function invoiceSubject({ studioName, periodStart, outcome }) {
  const month   = new Date(periodStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const charged = outcome === 'charged';
  return `${studioName ? studioName + ' · ' : ''}${charged ? `Invoice paid — ${month}` : `Payment needed — ${month}`}`;
}

module.exports = { buildInvoiceHtml, invoiceSubject };
