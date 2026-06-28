'use strict';

const { esc, emailWrapper, emailFooter, renderEmailHeader, renderCtaButton, renderFallbackUrl } = require('./shell');

/**
 * Build the full HTML for the order-selection-link email (client chooses photos for a store order).
 *
 * @param {object}   opts
 * @param {string}   opts.clientName
 * @param {string}   opts.studioName
 * @param {string}   opts.selectionUrl
 * @param {Array}    [opts.orderItems]   - [{ productName, quantity }]
 * @param {'he'|'en'} [opts.lang]
 */
function buildOrderSelectionLinkHtml({ clientName, studioName, selectionUrl, orderItems = [], lang = 'he' }) {
  const isHe  = lang === 'he';
  const dir   = isHe ? 'rtl' : 'ltr';
  const align = isHe ? 'right' : 'left';
  const studio = esc(studioName || 'LightStudio');

  const heading     = isHe ? 'ממתינים לבחירתך'          : 'Waiting for your selection';
  const eyebrow     = isHe ? 'הזמנת הדפסה'              : 'Print Order';
  const greeting    = isHe ? `שלום ${esc(clientName)},`  : `Hi ${esc(clientName)},`;
  const intro       = isHe
    ? 'הצלם שלך הכין עבורך הזמנה מיוחדת. אנא בחר תמונות לכל מוצר על ידי לחיצה על הכפתור:'
    : 'Your photographer has prepared a special order for you. Please select images for each product by clicking the button below:';
  const ctaLabel    = isHe ? 'בחר תמונות ←' : 'Select Images →';
  const fallback    = isHe ? 'אם הכפתור לא נפתח, העתיק את הקישור:' : "If the button doesn't work, copy the link:";
  const itemsHeader = isHe ? 'פריטים בהזמנה:' : 'Order items:';

  const itemsHtml = orderItems.length
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:24px;">
      <tr>
        <td dir="${dir}" style="text-align:${align};">
          <p style="margin:0 0 10px;
                    font-family:'Inter',Arial,sans-serif;
                    font-size:11px;font-weight:600;
                    letter-spacing:2px;color:#888888;
                    text-transform:uppercase;">
            ${itemsHeader}
          </p>
          ${orderItems
            .map(
              (it) => `
          <p style="margin:0 0 6px;
                    font-family:'Inter',Arial,sans-serif;
                    font-size:14px;color:#444444;line-height:1.6;">
            &bull; ${esc(it.productName)} &times; ${Number(it.quantity) || 1}
          </p>`
            )
            .join('')}
        </td>
      </tr>
    </table>`
    : '';

  const bodyRows = `
    ${renderEmailHeader({ studio, eyebrow, heading })}

    <!-- Body -->
    <tr>
      <td dir="${dir}" style="padding:0 40px 40px;">
        <p style="margin:0 0 12px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:16px;font-weight:500;color:#111111;
                  line-height:1.5;text-align:${align};">
          ${greeting}
        </p>
        <p style="margin:0 0 24px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:14px;color:#555555;line-height:1.85;
                  text-align:${align};">
          ${intro}
        </p>

        ${itemsHtml}

        ${renderCtaButton(selectionUrl, ctaLabel, '32px')}

        ${renderFallbackUrl(selectionUrl, fallback)}
      </td>
    </tr>

    ${emailFooter(studio, isHe)}
  `;

  return emailWrapper(dir, isHe ? 'he' : 'en', bodyRows);
}

function orderSelectionLinkSubject({ studioName, lang = 'he' }) {
  const studio = esc(studioName || 'LightStudio');
  return lang === 'he'
    ? `${studio} · ממתינים לבחירתך`
    : `${studio} · Waiting for your selection`;
}

module.exports = { buildOrderSelectionLinkHtml, orderSelectionLinkSubject };
