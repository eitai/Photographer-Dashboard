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

async function sendGalleryLink({ clientName, clientEmail, galleryName, galleryUrl, headerMessage }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping gallery email');
    return false;
  }

  const html = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>הגלריה שלך מוכנה</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F4;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#E7B8B5;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:3px;color:#6B5B5B;text-transform:uppercase;">Koral Light Studio</p>
              <h1 style="margin:8px 0 0;font-size:26px;color:#3D2C2C;font-weight:normal;">הגלריה שלך מוכנה ✨</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#3D2C2C;line-height:1.7;">
                שלום ${clientName},
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#5C4B4B;line-height:1.7;">
                שמחה לבשר לך שהגלריה שלך <strong>${galleryName}</strong> מוכנה לצפייה.
              </p>
              ${headerMessage ? `<p style="margin:0 0 24px;font-size:14px;color:#7A6060;line-height:1.7;padding:16px;background:#FAF8F4;border-radius:8px;border-right:3px solid #E7B8B5;">${headerMessage}</p>` : ''}
              <p style="margin:0 0 28px;font-size:15px;color:#5C4B4B;line-height:1.7;">
                לחצי על הכפתור להלן כדי לצפות בתמונות ולבחור את האהובות עליך.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td align="center" style="background:#E7B8B5;border-radius:10px;">
                    <a href="${galleryUrl}"
                       style="display:inline-block;padding:14px 36px;color:#3D2C2C;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.5px;">
                      לצפייה בגלריה שלי
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9E8080;line-height:1.6;text-align:center;">
                אם הכפתור לא עובד, העתיקי את הקישור הבא:<br/>
                <a href="${galleryUrl}" style="color:#C48F8C;word-break:break-all;">${galleryUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F0EAE4;text-align:center;">
              <p style="margin:0;font-size:12px;color:#B0A0A0;letter-spacing:1px;">
                Koral Light Studio &nbsp;·&nbsp; כל תמונה מספרת סיפור קטן
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Koral Light Studio" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject: `הגלריה שלך מוכנה ✨ | ${galleryName}`,
    html,
  });

  return true;
}

module.exports = { sendGalleryLink };
