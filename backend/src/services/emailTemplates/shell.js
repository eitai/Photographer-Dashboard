'use strict';

// ─── Shared HTML escaper ──────────────────────────────────────────────────────

/** Prevents stored XSS when admin/client input is interpolated into email HTML. */
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ─── Outer email shell ────────────────────────────────────────────────────────

/**
 * Wraps body rows in the full responsive HTML email document.
 *
 * @param {string} dir       - 'ltr' | 'rtl'
 * @param {string} lang      - HTML lang attribute value ('he' | 'en')
 * @param {string} bodyContent - One or more <tr>...</tr> blocks
 */
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

// ─── Shared footer row ────────────────────────────────────────────────────────

/**
 * @param {string}  studio  - Escaped studio name
 * @param {boolean} isHe    - true → Hebrew "נוצר באמצעות", false → English "Powered by"
 */
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

// ─── Shared header block ──────────────────────────────────────────────────────

/**
 * The repeated studio-wordmark → eyebrow → h1 → divider block used by most emails.
 *
 * @param {object} opts
 * @param {string}  opts.studio    - Escaped studio name (used as wordmark)
 * @param {string}  opts.eyebrow   - Small caps label above the heading
 * @param {string}  opts.heading   - Main h1 text
 * @param {string}  [opts.topPadding] - Override padding on the outer <td> (default '40px 40px 24px')
 * @param {string}  [opts.headingFontSize] - Override h1 font-size (default '30px')
 */
const renderEmailHeader = ({
  studio,
  eyebrow,
  heading,
  topPadding = '40px 40px 24px',
  headingFontSize = '30px',
}) => `
    <!-- Header -->
    <tr>
      <td align="center" style="padding:${topPadding};background-color:#ffffff;">
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
                   font-size:${headingFontSize};font-weight:400;
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
    </tr>`;

// ─── Shared CTA button ────────────────────────────────────────────────────────

/**
 * The pill CTA button used wherever a primary action link is needed.
 *
 * @param {string} url   - Destination URL (unescaped — caller must not double-escape)
 * @param {string} label - Button text
 * @param {string} [marginBottom] - Bottom margin on the wrapping table (default '36px')
 */
const renderCtaButton = (url, label, marginBottom = '36px') => `
        <!-- CTA Button -->
        <table role="presentation" class="cta-btn" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:${marginBottom};">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#111111;border-radius:50px;">
                    <a href="${url}"
                       style="display:inline-block;
                              padding:17px 52px;
                              font-family:'Inter',Arial,sans-serif;
                              font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;
                              letter-spacing:0.5px;white-space:nowrap;">
                      ${label}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;

// ─── Shared fallback URL block ────────────────────────────────────────────────

/**
 * The "if the button doesn't work" text + plain-text URL shown below the CTA.
 *
 * @param {string} url        - The same URL as the CTA button
 * @param {string} fallbackText - Localised fallback instruction
 */
const renderFallbackUrl = (url, fallbackText) => `
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
          ${fallbackText}<br/>
          <a href="${url}"
             style="color:#555555;word-break:break-all;text-decoration:none;
                    border-bottom:1px solid #CCCCCC;">
            ${url}
          </a>
        </p>`;

module.exports = {
  esc,
  emailWrapper,
  emailFooter,
  renderEmailHeader,
  renderCtaButton,
  renderFallbackUrl,
};
