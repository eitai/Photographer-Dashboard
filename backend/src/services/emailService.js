const nodemailer = require('nodemailer');

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

// Minimal HTML escaper — prevents stored XSS when admin input is interpolated into email HTML
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ─── Shared layout primitives ───────────────────────────────────────────────

const emailWrapper = (dir, lang, bodyContent) =>
  `
<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
    body { margin:0; padding:0; background-color:#F4F4F4; -webkit-text-size-adjust:100%; }
    a { color:#111111; }
    @media only screen and (max-width:600px) {
      .email-wrapper { padding:20px 8px !important; }
      .email-card { border-radius:12px !important; }
      .email-body-cell { padding:0 20px 28px !important; }
      .cta-btn a { padding:15px 28px !important; font-size:14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F4F4F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#F4F4F4;min-width:100%;">
  <tr>
    <td class="email-wrapper" align="center" style="padding:48px 16px;">
      <!-- Card -->
      <table role="presentation" class="email-card" width="580" cellpadding="0" cellspacing="0" border="0"
             style="max-width:580px;width:100%;background-color:#ffffff;border-radius:16px;
                    box-shadow:0 2px 24px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- Top bar -->
        <tr>
          <td style="background-color:#111111;height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        ${bodyContent}
        <!-- Bottom bar -->
        <tr>
          <td style="background-color:#111111;height:2px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
      </table>
      <!-- /Card -->
    </td>
  </tr>
</table>
</body>
</html>`.trim();

const emailFooter = (studio, isHe = true) => `
<tr>
  <td align="center"
      style="padding:24px 40px 28px;background-color:#F9F9F9;border-top:1px solid #E8E8E8;">
    <p style="margin:0 0 4px;
              font-family:'Playfair Display',Georgia,serif;
              font-size:15px;font-weight:400;color:#111111;letter-spacing:0.3px;">
      ${studio}
    </p>
    <p style="margin:0;
              font-family:'Inter',Arial,sans-serif;
              font-size:10px;color:#AAAAAA;letter-spacing:1px;">
      ${isHe ? 'Light Studio נוצר באמצעות' : 'Powered by Light Studio'}
    </p>
  </td>
</tr>`;

// ─── 1. Gallery link email ───────────────────────────────────────────────────

const galleryCopy = {
  he: {
    dir: 'rtl',
    align: 'right',
    htmlLang: 'he',
    subject: (gallery, studio) => `${studio ? studio + ' · ' : ''}הגלריה שלך מוכנה | ${gallery}`,
    eyebrow: 'גלריה אישית',
    heading: 'הגלריה שלך מוכנה',
    greeting: (name) => `שלום ${name},`,
    body: (gallery) =>
      `שמחנו להכין עבורך את גלריית <strong style="color:#111111;">${gallery}</strong>. התמונות מוכנות לצפייה ולבחירה.`,
    noteLabel: 'הודעה אישית',
    instruction: 'לחצי על הכפתור כדי לפתוח את הגלריה ולבחור את התמונות האהובות עליך.',
    cta: 'לצפייה בגלריה ←',
    fallback: 'אם הכפתור לא נפתח, העתיקי את הקישור:',
    noteBorder: 'border-right:3px solid #111111;padding-right:16px;',
  },
  en: {
    dir: 'ltr',
    align: 'left',
    htmlLang: 'en',
    subject: (gallery, studio) => `${studio ? studio + ' · ' : ''}Your gallery is ready | ${gallery}`,
    eyebrow: 'Personal Gallery',
    heading: 'Your gallery is ready',
    greeting: (name) => `Hi ${name},`,
    body: (gallery) =>
      `Your gallery <strong style="color:#111111;">${gallery}</strong> is ready to view and select your favourite photos.`,
    noteLabel: 'Personal note',
    instruction: 'Click the button below to open your gallery and choose the photos you love.',
    cta: 'Open my gallery →',
    fallback: "If the button doesn't work, copy the link:",
    noteBorder: 'border-left:3px solid #111111;padding-left:16px;',
  },
};

async function sendGalleryLink({ clientName, clientEmail, galleryName, galleryUrl, headerMessage, studioName, lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping gallery email');
    return false;
  }

  const t = galleryCopy[lang] || galleryCopy.he;
  const studio = esc(studioName || 'LightStudio');

  const body = `
    <!-- Header -->
    <tr>
      <td align="center" style="padding:44px 40px 28px;background-color:#ffffff;">
        <!-- Studio wordmark -->
        <p style="margin:0 0 24px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:10px;font-weight:600;
                  letter-spacing:5px;color:#888888;
                  text-transform:uppercase;">
          ${studio}
        </p>
        <!-- Eyebrow -->
        <p style="margin:0 0 10px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:11px;font-weight:500;
                  letter-spacing:3px;color:#888888;
                  text-transform:uppercase;">
          ${t.eyebrow}
        </p>
        <!-- Heading -->
        <h1 style="margin:0 0 20px;
                   font-family:'Playfair Display',Georgia,serif;
                   font-size:34px;font-weight:400;
                   color:#111111;line-height:1.2;letter-spacing:-0.5px;">
          ${t.heading}
        </h1>
        <!-- Divider -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="margin:0 auto;">
          <tr>
            <td style="width:40px;height:1px;background-color:#111111;font-size:0;"></td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td class="email-body-cell" dir="${t.dir}"
          style="padding:0 44px 44px;">

        <p style="margin:0 0 16px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:17px;font-weight:500;color:#111111;
                  line-height:1.5;text-align:${t.align};">
          ${t.greeting(esc(clientName))}
        </p>

        <p style="margin:0 0 28px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:15px;color:#444444;line-height:1.85;
                  text-align:${t.align};">
          ${t.body(esc(galleryName))}
        </p>

        ${
          headerMessage
            ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:28px;">
          <tr>
            <td dir="${t.dir}"
                style="background-color:#F9F9F9;border-radius:8px;
                       padding:16px 20px;${t.noteBorder}">
              <p style="margin:0 0 6px;
                         font-family:'Inter',Arial,sans-serif;
                         font-size:10px;font-weight:600;
                         letter-spacing:2px;color:#888888;
                         text-transform:uppercase;text-align:${t.align};">
                ${t.noteLabel}
              </p>
              <p style="margin:0;
                         font-family:'Playfair Display',Georgia,serif;
                         font-size:14px;font-style:italic;
                         color:#444444;line-height:1.85;
                         text-align:${t.align};">
                ${esc(headerMessage)}
              </p>
            </td>
          </tr>
        </table>
        `
            : ''
        }

        <p style="margin:0 0 32px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:14px;color:#666666;line-height:1.85;
                  text-align:${t.align};">
          ${t.instruction}
        </p>

        <!-- CTA Button -->
        <table role="presentation" class="cta-btn" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:36px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#111111;border-radius:50px;">
                    <a href="${galleryUrl}"
                       style="display:inline-block;
                              padding:17px 52px;
                              font-family:'Inter',Arial,sans-serif;
                              font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;
                              letter-spacing:0.5px;white-space:nowrap;">
                      ${t.cta}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:20px;">
          <tr>
            <td style="border-top:1px solid #E8E8E8;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>

        <!-- Fallback URL -->
        <p style="margin:0;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:12px;color:#999999;line-height:1.7;
                  text-align:center;">
          ${t.fallback}<br/>
          <a href="${galleryUrl}"
             style="color:#555555;word-break:break-all;text-decoration:none;
                    border-bottom:1px solid #CCCCCC;">
            ${galleryUrl}
          </a>
        </p>

      </td>
    </tr>

    ${emailFooter(studio, lang === 'he')}
  `;

  const html = emailWrapper(t.dir, t.htmlLang, body);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject: t.subject(galleryName, studioName),
    html,
  });

  return true;
}

// ─── 2. Product order links email ───────────────────────────────────────────

async function sendProductOrderLinks({ clientName, clientEmail, studioName, links, lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping product order email');
    return false;
  }

  const isHe = lang === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const align = isHe ? 'right' : 'left';
  const studio = esc(studioName || 'LightStudio');

  const subject = isHe ? `${studio} · הזמנות המוצרים שלך מוכנות לבחירה` : `${studio} · Your product orders are ready`;

  const heading = isHe ? 'הזמנות המוצרים שלך' : 'Your Product Orders';
  const eyebrow = isHe ? 'בחירת תמונות' : 'Photo Selection';
  const greeting = isHe ? `שלום ${esc(clientName)},` : `Hi ${esc(clientName)},`;
  const intro = isHe
    ? 'הצלם שלך הכין עבורך הזמנות מוצרים. לחץ על כל קישור כדי לבחור תמונות:'
    : 'Your photographer has prepared product orders for you. Click each link to select your photos:';
  const ctaText = isHe ? 'בחר תמונות ←' : 'Select Photos →';
  const albumLabel = isHe ? 'אלבום' : 'Album';
  const printLabel = isHe ? 'הדפסה' : 'Print';

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

  const body = `
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
          ${eyebrow}
        </p>
        <h1 style="margin:0 0 20px;
                   font-family:'Playfair Display',Georgia,serif;
                   font-size:30px;font-weight:400;
                   color:#111111;line-height:1.2;letter-spacing:-0.3px;">
          ${heading}
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="margin:0 auto;">
          <tr>
            <td style="width:40px;height:1px;background-color:#111111;font-size:0;"></td>
          </tr>
        </table>
      </td>
    </tr>

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

  const html = emailWrapper(dir, isHe ? 'he' : 'en', body);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject,
    html,
  });

  return true;
}

// ─── 3. Order selection link (to client) ────────────────────────────────────

/**
 * Send the client a link to complete their image selection for a store order.
 *
 * @param {object} opts
 * @param {string} opts.clientName
 * @param {string} opts.clientEmail
 * @param {string} opts.studioName
 * @param {string} opts.selectionUrl    Full URL to the order selection page
 * @param {Array}  opts.orderItems      [{ productName, quantity }]
 * @param {string} [opts.lang='he']
 */
async function sendOrderSelectionLink({
  clientName,
  clientEmail,
  studioName,
  selectionUrl,
  orderItems = [],
  lang = 'he',
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping order selection email');
    return false;
  }

  const isHe = lang === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const align = isHe ? 'right' : 'left';
  const studio = esc(studioName || 'LightStudio');

  const subject = isHe
    ? `${studio} · ממתינים לבחירתך`
    : `${studio} · Waiting for your selection`;

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

  const body = `
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
          ${eyebrow}
        </p>
        <h1 style="margin:0 0 20px;
                   font-family:'Playfair Display',Georgia,serif;
                   font-size:30px;font-weight:400;
                   color:#111111;line-height:1.2;letter-spacing:-0.3px;">
          ${heading}
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="margin:0 auto;">
          <tr>
            <td style="width:40px;height:1px;background-color:#111111;font-size:0;"></td>
          </tr>
        </table>
      </td>
    </tr>

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

        <!-- CTA Button -->
        <table role="presentation" class="cta-btn" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:32px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#111111;border-radius:50px;">
                    <a href="${selectionUrl}"
                       style="display:inline-block;
                              padding:17px 52px;
                              font-family:'Inter',Arial,sans-serif;
                              font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;
                              letter-spacing:0.5px;white-space:nowrap;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Divider -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:20px;">
          <tr>
            <td style="border-top:1px solid #E8E8E8;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>

        <!-- Fallback URL -->
        <p style="margin:0;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:12px;color:#999999;line-height:1.7;
                  text-align:center;">
          ${fallback}<br/>
          <a href="${selectionUrl}"
             style="color:#555555;word-break:break-all;text-decoration:none;
                    border-bottom:1px solid #CCCCCC;">
            ${selectionUrl}
          </a>
        </p>
      </td>
    </tr>

    ${emailFooter(studio, isHe)}
  `;

  const html = emailWrapper(dir, isHe ? 'he' : 'en', body);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to:   clientEmail,
    subject,
    html,
  });

  return true;
}

// ─── 4. Order to supplier email ──────────────────────────────────────────────

/**
 * Send a new order notification to the supplier with full order details.
 *
 * @param {object} opts
 * @param {string} opts.supplierEmail
 * @param {string} opts.supplierName
 * @param {string} opts.studioName
 * @param {string} opts.orderId
 * @param {Array}  opts.orderItems       [{ productName, quantity, specs }]
 * @param {object} [opts.shippingAddress]
 * @param {string} [opts.notes]
 */
async function sendOrderToSupplier({
  supplierEmail,
  supplierName,
  studioName,
  orderId,
  orderItems = [],
  shippingAddress,
  notes,
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping supplier order email');
    return false;
  }

  const studio = esc(studioName || 'LightStudio');
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

  const body = `
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

  const html = emailWrapper('ltr', 'en', body);

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to:      supplierEmail,
    subject: `New Order #${orderRef} from ${studio}`,
    html,
  });

  return true;
}

// ─── 5. Order status email (to client) ──────────────────────────────────────

/**
 * Notify a client about their order status change.
 *
 * @param {object} opts
 * @param {string} opts.clientName
 * @param {string} opts.clientEmail
 * @param {string} opts.studioName
 * @param {string} opts.orderId
 * @param {'in_production'|'shipped'|'delivered'} opts.status
 * @param {string} [opts.trackingNumber]
 * @param {string} [opts.trackingCarrier]
 */
async function sendOrderStatusEmail({
  clientName,
  clientEmail,
  studioName,
  orderId,
  status,
  trackingNumber,
  trackingCarrier,
}) {
  const variants = {
    in_production: {
      subject:  (studio) => `${studio ? studio + ' · ' : ''}Your order is in production`,
      eyebrow:  'Order Update',
      heading:  'Your order is in production',
      bodyText: () =>
        'Great news — your photo products are now being produced. We\'ll send you another update as soon as they\'re on their way.',
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

  const variant = variants[status];
  if (!variant) return;

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping order status email');
    return false;
  }

  const studio   = esc(studioName || 'LightStudio');
  const orderRef = orderId ? String(orderId).slice(0, 8).toUpperCase() : '';

  const body = `
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
          ${esc(variant.eyebrow)}
        </p>
        <h1 style="margin:0 0 20px;
                   font-family:'Playfair Display',Georgia,serif;
                   font-size:30px;font-weight:400;
                   color:#111111;line-height:1.2;letter-spacing:-0.3px;">
          ${esc(variant.heading)}
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"
               style="margin:0 auto;">
          <tr>
            <td style="width:40px;height:1px;background-color:#111111;font-size:0;"></td>
          </tr>
        </table>
      </td>
    </tr>

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

  const html = emailWrapper('ltr', 'en', body);

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to:      clientEmail,
    subject: variant.subject(studioName || ''),
    html,
  });

  return true;
}

/**
 * Order confirmation receipt — sent to the client right after a successful
 * store payment (PayPlus webhook).
 *
 * @param {object} opts
 * @param {string} opts.clientName
 * @param {string} opts.clientEmail
 * @param {string} opts.studioName
 * @param {string} opts.orderId
 * @param {{ productName: string, quantity: number, unitPrice: number|null }[]} opts.items
 * @param {number} opts.totalAmount
 * @param {string} [opts.currency]
 * @param {object} [opts.shippingAddress]
 */
async function sendOrderConfirmationEmail({
  clientName,
  clientEmail,
  studioName,
  orderId,
  items = [],
  totalAmount,
  currency = 'ILS',
  shippingAddress,
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping order confirmation email');
    return false;
  }

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

  const body = `
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

  const html = emailWrapper('ltr', 'en', body);

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to:      clientEmail,
    subject: `${studioName ? studioName + ' · ' : ''}Order confirmed${orderRef ? ` #${orderRef}` : ''}`,
    html,
  });

  return true;
}

/**
 * Monthly invoice notification to the photographer (statement / receipt / failure).
 *
 * @param {object} opts
 * @param {string} opts.adminName
 * @param {string} opts.adminEmail
 * @param {string} opts.studioName
 * @param {number} opts.amount
 * @param {string} opts.periodStart  ISO date
 * @param {'charged'|'failed'} opts.outcome
 * @param {string} [opts.payLink]    hosted payment link (failure case)
 */
async function sendInvoiceEmail({ adminName, adminEmail, studioName, amount, periodStart, outcome, payLink }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping invoice email');
    return false;
  }
  const studio = esc(studioName || 'LightStudio');
  const month = new Date(periodStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const charged = outcome === 'charged';

  const body = `
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

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to:      adminEmail,
    subject: `${studioName ? studioName + ' · ' : ''}${charged ? `Invoice paid — ${month}` : `Payment needed — ${month}`}`,
    html:    emailWrapper('ltr', 'en', body),
  });
  return true;
}

/**
 * Accounting-document email (Hebrew-first): receipt / tax-invoice-receipt.
 * When `provisional` (PayPlus documents not yet enabled) it's worded as a
 * payment confirmation; once issued it carries the official PDF link.
 *
 * @param {object} opts
 * @param {string} opts.recipientName
 * @param {string} opts.recipientEmail
 * @param {'receipt'|'tax_invoice_receipt'} opts.docType
 * @param {number} opts.amount
 * @param {number} [opts.vatAmount]
 * @param {{ name:string, quantity:number, unitPrice:number|null }[]} [opts.items]
 * @param {string} [opts.documentNumber]
 * @param {string} [opts.pdfUrl]
 * @param {boolean} [opts.provisional]
 * @param {string} [opts.businessName]
 */
async function sendDocumentEmail({
  recipientName, recipientEmail, docType, amount, vatAmount = 0,
  items = [], documentNumber, pdfUrl, provisional, businessName,
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping document email');
    return false;
  }
  const studio = esc(businessName || 'LightStudio');
  const docLabel = docType === 'tax_invoice_receipt' ? 'חשבונית מס/קבלה' : 'קבלה';
  const symbol = '₪';

  const itemRows = items.map((it) => `
    <tr>
      <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#111;">${esc(it.name)}${it.quantity > 1 ? ` ×${it.quantity}` : ''}</td>
      <td align="left" style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#444;" dir="ltr">${it.unitPrice != null ? `${symbol}${(Number(it.unitPrice) * (it.quantity || 1)).toLocaleString()}` : ''}</td>
    </tr>`).join('');

  const body = `
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

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || `"${businessName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to:      recipientEmail,
    subject: `${businessName ? businessName + ' · ' : ''}${provisional ? 'אישור תשלום' : docLabel}${documentNumber ? ` ${documentNumber}` : ''}`,
    html:    emailWrapper('rtl', 'he', body),
  });
  return true;
}

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
