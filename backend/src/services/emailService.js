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

module.exports = { sendGalleryLink, sendProductOrderLinks };
