let twilioClient = null;

function getClient() {
  if (twilioClient) return twilioClient;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
}

const copy = {
  he: (clientName, galleryUrl) =>
    `שלום ${clientName}, הגלריה שלך מוכנה לצפייה 📸\n${galleryUrl}`,
  en: (clientName, galleryUrl) =>
    `Hi ${clientName}, your gallery is ready to view 📸\n${galleryUrl}`,
};

/**
 * Send an SMS with the gallery link to the client.
 * Returns true on success, false if Twilio is not configured or send failed.
 */
async function sendGallerySms({ clientName, clientPhone, galleryUrl, lang = 'he' }) {
  const client = getClient();
  if (!client) {
    console.warn('[sms] Twilio not configured — skipping gallery SMS');
    return false;
  }

  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    console.warn('[sms] TWILIO_FROM_NUMBER not set — skipping gallery SMS');
    return false;
  }

  // Normalise Israeli numbers: 05x → +9725x
  const digits = clientPhone.replace(/\D/g, '');
  const to = digits.startsWith('972')
    ? `+${digits}`
    : digits.startsWith('0')
    ? `+972${digits.slice(1)}`
    : `+${digits}`;

  console.log('[sms] raw phone:', clientPhone, '→ sending to:', to);

  const body = (copy[lang] || copy.he)(clientName, galleryUrl);

  await client.messages.create({ from, to, body });
  return true;
}

module.exports = { sendGallerySms };
