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
    align: 'right',
    htmlLang: 'he',
    title: 'הגלריה שלך מוכנה',
    eyebrow: 'גלריה אישית',
    heading: 'הגלריה שלך מוכנה',
    tagline: 'כל תמונה מספרת סיפור קטן',
    greeting: (name) => `שלום ${name},`,
    body: (gallery) => `שמחנו להכין עבורך את גלריית <strong style="color:#2C1F1F;">${gallery}</strong>. התמונות מוכנות לצפייה ולבחירה.`,
    noteLabel: 'הודעה אישית',
    instruction: 'לחצי על הכפתור כדי לפתוח את הגלריה ולבחור את התמונות האהובות עליך.',
    cta: 'לצפייה בגלריה',
    ctaArrow: ' ←',
    fallback: 'אם הכפתור לא נפתח, העתיקי את הקישור:',
    noteBorder: 'border-right:3px solid #E7B8B5;padding-right:16px;',
    poweredBy: 'נוצר באמצעות',
    subject: (gallery, studio) => `${studio ? studio + ' · ' : ''}הגלריה שלך מוכנה ✨ | ${gallery}`,
  },
  en: {
    dir: 'ltr',
    align: 'left',
    htmlLang: 'en',
    title: 'Your gallery is ready',
    eyebrow: 'Personal Gallery',
    heading: 'Your gallery is ready',
    tagline: 'Every photo tells a small story',
    greeting: (name) => `Hi ${name},`,
    body: (gallery) => `Your gallery <strong style="color:#2C1F1F;">${gallery}</strong> is ready to view and select your favourite photos.`,
    noteLabel: 'Personal note',
    instruction: 'Click the button below to open your gallery and choose the photos you love.',
    cta: 'Open my gallery',
    ctaArrow: ' →',
    fallback: "If the button doesn't work, copy the link below:",
    noteBorder: 'border-left:3px solid #E7B8B5;padding-left:16px;',
    poweredBy: 'Powered by',
    subject: (gallery, studio) => `${studio ? studio + ' · ' : ''}Your gallery is ready ✨ | ${gallery}`,
  },
};

async function sendGalleryLink({ clientName, clientEmail, galleryName, galleryUrl, headerMessage, studioName, lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping gallery email');
    return false;
  }

  const t = copy[lang] || copy.he;
  const studio = esc(studioName || 'LightStudio');

  const html = `
<!DOCTYPE html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.title}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap');
    body { margin:0; padding:0; background-color:#FAF8F4; -webkit-text-size-adjust:100%; }
    a { color:#C48F8C; }
    @media only screen and (max-width:600px) {
      .email-wrapper { padding:24px 12px !important; }
      .email-card { border-radius:12px !important; }
      .email-body-cell { padding:0 24px 32px !important; }
      .cta-btn a { padding:16px 32px !important; font-size:15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F4;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#FAF8F4;min-width:100%;">
  <tr>
    <td class="email-wrapper" align="center" style="padding:48px 16px;">

      <!-- Card -->
      <table role="presentation" class="email-card" width="580" cellpadding="0" cellspacing="0" border="0"
             style="max-width:580px;width:100%;background-color:#ffffff;border-radius:20px;
                    box-shadow:0 4px 32px rgba(44,31,31,0.07);overflow:hidden;">

        <!-- Top accent bar -->
        <tr>
          <td style="background:linear-gradient(90deg,#E7B8B5 0%,#D4A0A0 100%);
                     height:5px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- ── HEADER ── -->
        <tr>
          <td align="center" style="padding:44px 40px 32px;background-color:#ffffff;">

            <!-- Studio wordmark -->
            <p style="margin:0 0 20px;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:11px;font-weight:600;
                      letter-spacing:5px;color:#C48F8C;
                      text-transform:uppercase;">
              ${studio}
            </p>

            <!-- Decorative camera/lens mark -->
            <div style="margin:0 auto 20px;width:52px;height:52px;
                        background-color:#FAF8F4;border-radius:50%;
                        border:1px solid #EAD8D6;
                        display:table-cell;vertical-align:middle;text-align:center;
                        font-size:22px;line-height:52px;">&#128247;</div>

            <!-- Eyebrow label -->
            <p style="margin:0 0 10px;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:12px;font-weight:500;
                      letter-spacing:2px;color:#C48F8C;
                      text-transform:uppercase;">
              ${t.eyebrow}
            </p>

            <!-- Main heading -->
            <h1 style="margin:0;
                       font-family:'Playfair Display',Georgia,serif;
                       font-size:32px;font-weight:400;
                       color:#2C1F1F;line-height:1.25;
                       letter-spacing:-0.3px;">
              ${t.heading}
            </h1>

            <!-- Ornament line -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                   style="margin:20px auto 0;">
              <tr>
                <td style="width:24px;height:1px;background-color:#E7B8B5;font-size:0;"></td>
                <td style="width:8px;height:8px;background-color:#E7B8B5;border-radius:50%;
                           font-size:0;margin:0 6px;padding:0 6px;"></td>
                <td style="width:24px;height:1px;background-color:#E7B8B5;font-size:0;"></td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── BODY ── -->
        <tr>
          <td class="email-body-cell" dir="${t.dir}"
              style="padding:0 44px 44px;">

            <!-- Greeting -->
            <p style="margin:0 0 16px;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:17px;font-weight:500;
                      color:#2C1F1F;line-height:1.5;
                      text-align:${t.align};">
              ${t.greeting(esc(clientName))}
            </p>

            <!-- Body copy -->
            <p style="margin:0 0 28px;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:15px;color:#5C4B4B;line-height:1.85;
                      text-align:${t.align};">
              ${t.body(esc(galleryName))}
            </p>

            ${headerMessage ? `
            <!-- Personal note from photographer -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:28px;">
              <tr>
                <td dir="${t.dir}"
                    style="background-color:#FAF8F4;border-radius:12px;
                           padding:18px 20px;
                           ${t.noteBorder}">
                  <p style="margin:0 0 6px;
                             font-family:'Inter',Arial,sans-serif;
                             font-size:10px;font-weight:600;
                             letter-spacing:2px;color:#C48F8C;
                             text-transform:uppercase;
                             text-align:${t.align};">
                    ${t.noteLabel}
                  </p>
                  <p style="margin:0;
                             font-family:'Playfair Display',Georgia,serif;
                             font-size:14px;font-style:italic;
                             color:#5C4B4B;line-height:1.85;
                             text-align:${t.align};">
                    ${esc(headerMessage)}
                  </p>
                </td>
              </tr>
            </table>
            ` : ''}

            <!-- Instruction -->
            <p style="margin:0 0 32px;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:15px;color:#7A6060;line-height:1.85;
                      text-align:${t.align};">
              ${t.instruction}
            </p>

            <!-- CTA Button — full width strip, centered content -->
            <table role="presentation" class="cta-btn" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-bottom:36px;">
              <tr>
                <td align="center">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color:#2C1F1F;border-radius:50px;">
                        <a href="${galleryUrl}"
                           style="display:inline-block;
                                  padding:17px 52px;
                                  font-family:'Inter',Arial,sans-serif;
                                  font-size:15px;font-weight:600;
                                  color:#FAF8F4;text-decoration:none;
                                  letter-spacing:0.4px;white-space:nowrap;">
                          ${t.cta}${t.ctaArrow}
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
                <td style="border-top:1px solid #F0EAE4;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>

            <!-- Fallback URL -->
            <p style="margin:0;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:12px;color:#A08080;line-height:1.7;
                      text-align:center;">
              ${t.fallback}<br/>
              <a href="${galleryUrl}"
                 style="color:#C48F8C;word-break:break-all;text-decoration:none;
                        border-bottom:1px solid #E7B8B5;">
                ${galleryUrl}
              </a>
            </p>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td align="center"
              style="padding:28px 40px 32px;background-color:#FAF8F4;border-top:1px solid #F0EAE4;">

            <!-- Studio name -->
            <p style="margin:0 0 4px;
                      font-family:'Playfair Display',Georgia,serif;
                      font-size:15px;font-weight:400;
                      color:#2C1F1F;letter-spacing:0.5px;">
              ${studio}
            </p>

            <!-- Tagline -->
            <p style="margin:0 0 16px;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:11px;color:#B0A0A0;
                      letter-spacing:2px;text-transform:uppercase;">
              ${t.tagline}
            </p>

            <!-- Powered by -->
            <p style="margin:0;
                      font-family:'Inter',Arial,sans-serif;
                      font-size:10px;color:#C8B8B8;letter-spacing:0.5px;">
              ${t.poweredBy} Koral Light Studio
            </p>

          </td>
        </tr>

        <!-- Bottom accent bar -->
        <tr>
          <td style="background:linear-gradient(90deg,#E7B8B5 0%,#D4A0A0 100%);
                     height:4px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

      </table>
      <!-- /Card -->

    </td>
  </tr>
</table>

</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject: t.subject(galleryName, studioName),
    html,
  });

  return true;
}

async function sendProductOrderLinks({ clientName, clientEmail, studioName, links, lang = 'he' }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping product order email');
    return false;
  }

  const isHe = lang === 'he';
  const dir = isHe ? 'rtl' : 'ltr';
  const studio = esc(studioName || 'LightStudio');

  const subject = isHe
    ? `${studio} · הזמנות המוצרים שלך מוכנות לבחירה`
    : `${studio} · Your product orders are ready for selection`;

  const greeting = isHe ? `שלום ${esc(clientName)},` : `Hi ${esc(clientName)},`;
  const intro = isHe
    ? 'הצלם שלך הכין עבורך הזמנות מוצרים לבחירת תמונות. לחץ על כל קישור כדי לבחור תמונות:'
    : 'Your photographer has prepared product orders for photo selection. Click each link to select your photos:';

  const linksHtml = links.map((l) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td style="background-color:#FAF8F4;border-radius:12px;padding:16px 20px;border:1px solid #F0EAE4;">
          <p style="margin:0 0 8px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;color:#2C1F1F;">${esc(l.name)}</p>
          <p style="margin:0 0 12px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#7A6060;">${l.type === 'album' ? (isHe ? 'אלבום' : 'Album') : (isHe ? 'הדפסה' : 'Print')}</p>
          <a href="${l.url}" style="display:inline-block;padding:10px 24px;background-color:#2C1F1F;color:#FAF8F4;text-decoration:none;border-radius:30px;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;">
            ${isHe ? 'בחר תמונות ←' : 'Select Photos →'}
          </a>
        </td>
      </tr>
    </table>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="${isHe ? 'he' : 'en'}" dir="${dir}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#FAF8F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAF8F4;">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:20px;box-shadow:0 4px 32px rgba(44,31,31,0.07);overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#E7B8B5 0%,#D4A0A0 100%);height:5px;font-size:0;">&nbsp;</td></tr>
      <tr><td align="center" style="padding:36px 40px 24px;">
        <p style="margin:0 0 8px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:5px;color:#C48F8C;text-transform:uppercase;">${studio}</p>
        <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:400;color:#2C1F1F;">${isHe ? 'הזמנות המוצרים שלך' : 'Your Product Orders'}</h1>
      </td></tr>
      <tr><td dir="${dir}" style="padding:0 40px 40px;">
        <p style="margin:0 0 24px;font-family:'Inter',Arial,sans-serif;font-size:16px;font-weight:500;color:#2C1F1F;">${greeting}</p>
        <p style="margin:0 0 28px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#5C4B4B;line-height:1.8;">${intro}</p>
        ${linksHtml}
      </td></tr>
      <tr><td align="center" style="padding:24px 40px 32px;background-color:#FAF8F4;border-top:1px solid #F0EAE4;">
        <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:14px;color:#2C1F1F;">${studio}</p>
        <p style="margin:4px 0 0;font-family:'Inter',Arial,sans-serif;font-size:10px;color:#C8B8B8;letter-spacing:0.5px;">Powered by Koral Light Studio</p>
      </td></tr>
      <tr><td style="background:linear-gradient(90deg,#E7B8B5 0%,#D4A0A0 100%);height:4px;font-size:0;">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"${studioName || 'LightStudio'}" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject,
    html,
  });

  return true;
}

module.exports = { sendGalleryLink, sendProductOrderLinks };
