'use strict';

const { esc, emailWrapper, emailFooter, renderEmailHeader, renderCtaButton, renderFallbackUrl } = require('./shell');

// ─── Copy table (he / en) ─────────────────────────────────────────────────────

const copy = {
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

/**
 * Build the full HTML for the gallery-link email.
 *
 * @param {object} opts
 * @param {string} opts.clientName
 * @param {string} opts.galleryName
 * @param {string} opts.galleryUrl
 * @param {string} [opts.headerMessage]
 * @param {string} opts.studioName
 * @param {'he'|'en'} [opts.lang]
 */
function buildGalleryLinkHtml({ clientName, galleryName, galleryUrl, headerMessage, studioName, lang = 'he' }) {
  const t = copy[lang] || copy.he;
  const studio = esc(studioName || 'LightStudio');

  const noteBlock = headerMessage
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
    : '';

  const bodyRows = `
    ${renderEmailHeader({ studio, eyebrow: t.eyebrow, heading: t.heading, topPadding: '44px 40px 28px', headingFontSize: '34px' })}

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

        ${noteBlock}

        <p style="margin:0 0 32px;
                  font-family:'Inter',Arial,sans-serif;
                  font-size:14px;color:#666666;line-height:1.85;
                  text-align:${t.align};">
          ${t.instruction}
        </p>

        ${renderCtaButton(galleryUrl, t.cta)}

        ${renderFallbackUrl(galleryUrl, t.fallback)}

      </td>
    </tr>

    ${emailFooter(studio, lang === 'he')}
  `;

  return emailWrapper(t.dir, t.htmlLang, bodyRows);
}

/** Returns the localised subject line. */
function galleryLinkSubject({ galleryName, studioName, lang = 'he' }) {
  const t = copy[lang] || copy.he;
  return t.subject(galleryName, studioName);
}

module.exports = { buildGalleryLinkHtml, galleryLinkSubject };
