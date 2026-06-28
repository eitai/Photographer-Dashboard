'use strict';

const { esc, emailWrapper, emailFooter } = require('./shell');

/**
 * Build the full HTML for the accounting-document email (receipt / tax-invoice-receipt).
 * Hebrew-first (dir="rtl").
 *
 * @param {object}   opts
 * @param {string}   opts.recipientName
 * @param {'receipt'|'tax_invoice_receipt'} opts.docType
 * @param {number}   opts.amount
 * @param {number}   [opts.vatAmount]
 * @param {Array}    [opts.items]           - [{ name, quantity, unitPrice }]
 * @param {string}   [opts.documentNumber]
 * @param {string}   [opts.pdfUrl]
 * @param {boolean}  [opts.provisional]
 * @param {string}   [opts.businessName]
 */
function buildDocumentHtml({ recipientName, docType, amount, vatAmount = 0, items = [], documentNumber, pdfUrl, provisional, businessName }) {
  const studio   = esc(businessName || 'LightStudio');
  const docLabel = docType === 'tax_invoice_receipt' ? 'חשבונית מס/קבלה' : 'קבלה';
  const symbol   = '₪';

  const itemRows = items.map((it) => `
    <tr>
      <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#111;">${esc(it.name)}${it.quantity > 1 ? ` ×${it.quantity}` : ''}</td>
      <td align="left" style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#444;" dir="ltr">${it.unitPrice != null ? `${symbol}${(Number(it.unitPrice) * (it.quantity || 1)).toLocaleString()}` : ''}</td>
    </tr>`).join('');

  const bodyRows = `
    <tr><td align="center" style="padding:40px 40px 24px;background:#fff;">
      <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:5px;color:#888;text-transform:uppercase;">${studio}</p>
      <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:500;letter-spacing:3px;color:#888;">${provisional ? 'אישור תשלום' : docLabel}</p>
      <h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:400;color:#111;">${provisional ? 'התקבל תשלום' : docLabel}${documentNumber ? ` · ${esc(documentNumber)}` : ''}</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="width:40px;height:1px;background:#111;font-size:0;"></td></tr></table>
    </td></tr>
    <tr><td style="padding:0 40px 32px;" dir="rtl">
      <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:16px;font-weight:500;color:#111;">שלום ${esc(recipientName || '')},</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:0 0 16px;">
        ${itemRows}
        ${vatAmount > 0 ? `<tr><td style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:#888;">מע"מ</td><td align="left" dir="ltr" style="padding:8px 0;font-family:Arial,sans-serif;font-size:13px;color:#888;">${symbol}${Number(vatAmount).toLocaleString()}</td></tr>` : ''}
        <tr><td style="padding:12px 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#111;border-top:1px solid #eee;">סה"כ</td><td align="left" dir="ltr" style="padding:12px 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#111;border-top:1px solid #eee;">${symbol}${Number(amount || 0).toLocaleString()}</td></tr>
      </table>
      ${pdfUrl ? `<p style="margin:0;"><a href="${pdfUrl}" style="display:inline-block;background:#111;color:#fff;font-family:Arial,sans-serif;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:999px;">הורדת ${docLabel}</a></p>` : ''}
      ${provisional ? `<p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888;">${docLabel} רשמית תישלח בנפרד.</p>` : ''}
    </td></tr>
    ${emailFooter(studio, true)}
  `;

  return emailWrapper('rtl', 'he', bodyRows);
}

function documentSubject({ businessName, docType, documentNumber, provisional }) {
  const docLabel = docType === 'tax_invoice_receipt' ? 'חשבונית מס/קבלה' : 'קבלה';
  return `${businessName ? businessName + ' · ' : ''}${provisional ? 'אישור תשלום' : docLabel}${documentNumber ? ` ${documentNumber}` : ''}`;
}

module.exports = { buildDocumentHtml, documentSubject };
