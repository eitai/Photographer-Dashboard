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

const copy = {
  he: {
    dir: 'rtl',
    htmlLang: 'he',
    title: 'הגלריה שלך מוכנה',
    heading: 'הגלריה שלך מוכנה',
    tagline: 'כל תמונה מספרת סיפור קטן',
    greeting: (name) => `שלום ${name},`,
    body: (gallery) => `שמחה לבשר לך שהגלריה <span style="color:#2C1F1F;font-weight:600;">${gallery}</span> מוכנה לצפייה ובחירה.`,
    instruction: 'לחצי על הכפתור למטה כדי לצפות בתמונות ולבחור את האהובות עליך.',
    cta: 'לצפייה בגלריה שלי',
    ctaArrow: '&#8592;',
    fallback: 'אם הכפתור לא עובד, העתיקי את הקישור:',
    noteBorder: 'border-right:3px solid #E7B8B5',
    subject: (gallery) => `הגלריה שלך מוכנה ✨ | ${gallery}`,
  },
  en: {
    dir: 'ltr',
    htmlLang: 'en',
    title: 'Your gallery is ready',
    heading: 'Your gallery is ready',
    tagline: 'Every photo tells a small story',
    greeting: (name) => `Hi ${name},`,
    body: (gallery) => `Your gallery <span style="color:#2C1F1F;font-weight:600;">${gallery}</span> is ready to view and make your selections.`,
    instruction: 'Click the button below to browse your photos and choose your favourites.',
    cta: 'View my gallery',
    ctaArrow: '&#8594;',
    fallback: 'If the button doesn\'t work, copy the link below:',
    noteBorder: 'border-left:3px solid #E7B8B5',
    subject: (gallery) => `Your gallery is ready ✨ | ${gallery}`,
  },
};

async function sendGalleryLink({ clientName, clientEmail, galleryName, galleryUrl, headerMessage, lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping gallery email');
    return false;
  }

  const t = copy[lang] || copy.he;

  const html = `
<!DOCTYPE html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Inter:wght@400;500;600&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;min-width:100%;">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;">

          <!-- Top accent line -->
          <tr>
            <td style="background-color:#E7B8B5;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:44px 40px 36px;background-color:#ffffff;">
              <p style="margin:0 0 6px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:4px;color:#C48F8C;text-transform:uppercase;">LightStudio</p>
              <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:30px;font-weight:400;color:#2C1F1F;line-height:1.3;">${t.heading}</h1>
              <div style="margin:16px auto 0;width:40px;height:1px;background-color:#E7B8B5;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 40px 40px;" dir="${t.dir}">

              <p style="margin:0 0 12px;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:500;color:#2C1F1F;line-height:1.6;">
                ${t.greeting(esc(clientName))}
              </p>
              <p style="margin:0 0 24px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#5C4B4B;line-height:1.8;">
                ${t.body(esc(galleryName))}
              </p>

              ${headerMessage ? `
              <!-- Personal note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#FAF8F4;border-radius:12px;padding:20px 24px;${t.noteBorder};">
                    <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#5C4B4B;line-height:1.8;font-style:italic;">${esc(headerMessage)}</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin:0 0 32px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#5C4B4B;line-height:1.8;">
                ${t.instruction}
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 36px;">
                <tr>
                  <td align="center" style="background-color:#E7B8B5;border-radius:12px;">
                    <a href="${galleryUrl}"
                       style="display:inline-block;padding:16px 44px;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:600;color:#2C1F1F;text-decoration:none;letter-spacing:0.3px;white-space:nowrap;">
                      ${t.cta} ${t.ctaArrow}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-top:1px solid #F0EAE4;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#A08080;line-height:1.7;text-align:center;">
                ${t.fallback}<br/>
                <a href="${galleryUrl}" style="color:#C48F8C;word-break:break-all;text-decoration:underline;">${galleryUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 40px;background-color:#FAF8F4;border-top:1px solid #F0EAE4;">
              <p style="margin:0 0 4px;font-family:'Playfair Display',Georgia,serif;font-size:14px;color:#2C1F1F;font-weight:400;">LightStudio</p>
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#B0A0A0;letter-spacing:1.5px;text-transform:uppercase;">${t.tagline}</p>
            </td>
          </tr>

          <!-- Bottom accent line -->
          <tr>
            <td style="background-color:#E7B8B5;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"LightStudio" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject: t.subject(galleryName),
    html,
  });

  return true;
}

module.exports = { sendGalleryLink };
