'use strict';

const { esc, emailWrapper, emailFooter, renderEmailHeader } = require('./shell');

/**
 * Build the full HTML for the product-order-links email.
 *
 * @param {object}   opts
 * @param {string}   opts.clientName
 * @param {string}   opts.studioName
 * @param {Array}    opts.links         - [{ name, type, url }]
 * @param {'he'|'en'} [opts.lang]
 */
function buildProductOrderLinksHtml({ clientName, studioName, links, lang = 'he' }) {
  const isHe  = lang === 'he';
  const dir   = isHe ? 'rtl' : 'ltr';
  const align = isHe ? 'right' : 'left';
  const studio = esc(studioName || 'LightStudio');

  const heading    = isHe ? 'הזמנות המוצרים שלך'     : 'Your Product Orders';
  const eyebrow    = isHe ? 'בחירת תמונות'            : 'Photo Selection';
  const greeting   = isHe ? `שלום ${esc(clientName)},` : `Hi ${esc(clientName)},`;
  const intro      = isHe
    ? 'הצלם שלך הכין עבורך הזמנות מוצרים. לחץ על כל קישור כדי לבחור תמונות:'
    : 'Your photographer has prepared product orders for you. Click each link to select your photos:';
  const ctaText    = isHe ? 'בחר תמונות ←' : 'Select Photos →';
  const albumLabel = isHe ? 'אלבום'         : 'Album';
  const printLabel = isHe ? 'הדפסה'         : 'Print';

  const linksHtml = links
    .map(
      (l) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:14px;">
      <tr>
        <td dir="${dir}"
            style="background-color:#F9F9F9;border-radius:10px;
                   padding:18px 20px;border:1px solid #E8E8E8;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td dir="${dir}" style="text-align:${align};">
                <p style="margin:0 0 4px;font-family:'Inter',Arial,sans-serif;
                           font-size:14px;font-weight:600;color:#111111;">
                  ${esc(l.name)}
                </p>
                <p style="margin:0 0 14px;font-family:'Inter',Arial,sans-serif;
                           font-size:11px;font-weight:500;color:#888888;
                           letter-spacing:1.5px;text-transform:uppercase;">
                  ${l.type === 'album' ? albumLabel : printLabel}
                </p>
                <a href="${l.url}"
                   style="display:inline-block;padding:10px 22px;
                          background-color:#111111;color:#ffffff;text-decoration:none;
                          border-radius:30px;font-family:'Inter',Arial,sans-serif;
                          font-size:13px;font-weight:600;letter-spacing:0.3px;">
                  ${ctaText}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `,
    )
    .join('');

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
        <p style="margin:0 0 28px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:14px;color:#555555;line-height:1.85;
                  text-align:${align};">
          ${intro}
        </p>
        ${linksHtml}
      </td>
    </tr>

    ${emailFooter(studio, isHe)}
  `;

  return emailWrapper(dir, isHe ? 'he' : 'en', bodyRows);
}

function productOrderLinksSubject({ studioName, lang = 'he' }) {
  const studio = esc(studioName || 'LightStudio');
  return lang === 'he'
    ? `${studio} · הזמנות המוצרים שלך מוכנות לבחירה`
    : `${studio} · Your product orders are ready`;
}

module.exports = { buildProductOrderLinksHtml, productOrderLinksSubject };
