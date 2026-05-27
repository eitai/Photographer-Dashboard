const crypto = require('crypto');

const BASE_URL =
  process.env.PAYPLUS_ENV === 'production'
    ? 'https://restapi.payplus.co.il'
    : 'https://restapidev.payplus.co.il';

async function payplusRequest(method, path, body = null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'api-key':      process.env.PAYPLUS_API_KEY,
      'secret-key':   process.env.PAYPLUS_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.description || data?.message || 'PayPlus API error');
    err.status  = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

/**
 * Generate a hosted payment page link for a plan subscription.
 * The link redirects the customer to PayPlus where they complete payment.
 * On success, PayPlus fires refURL_callback with the transaction payload.
 */
async function generatePaymentLink({
  amount,
  adminId,
  planId,
  planName,
  billingInterval, // 'monthly' | 'annual'
  customStorageGb, // null unless plan is 'custom'
  successUrl,
  failureUrl,
  cancelUrl,
  callbackUrl,
}) {
  // For annual billing we charge the full annual amount once every 12 months.
  // recurring_type 2 = Monthly; recurring_range is the multiplier (1=monthly, 12=annual).
  const recurringRange = billingInterval === 'annual' ? 12 : 1;

  const moreInfo = JSON.stringify({ adminId, planId, billingInterval, customStorageGb });

  const payload = {
    payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,
    amount,
    currency_code:       'ILS',
    sendEmailApproval:   true,
    sendEmailFailure:    true,
    refURL_success:      successUrl,
    refURL_failure:      failureUrl,
    refURL_cancel:       cancelUrl,
    refURL_callback:     callbackUrl,
    more_info:           moreInfo,
    items: [
      { name: planName, quantity: 1, price: amount, vat_type: 0 },
    ],
    recurring_settings: {
      recurring_type:    2,          // Monthly unit
      recurring_range:   recurringRange,
      number_of_charges: 0,          // 0 = until cancelled
    },
  };

  return payplusRequest('POST', '/api/v1.0/PaymentPages/generateLink', payload);
}

/**
 * Enable or disable a recurring payment (subscription).
 * valid=false cancels; valid=true reactivates.
 */
async function setRecurringValid(recurringUid, valid) {
  return payplusRequest('POST', `/api/v1.0/RecurringPayments/${recurringUid}/Valid`, {
    terminal_uid: process.env.PAYPLUS_TERMINAL_UID,
    valid,
  });
}

/**
 * Query PayPlus for full transaction details (IPN verification).
 * Used in the webhook handler to verify the payment actually succeeded.
 */
async function getTransactionDetails(paymentRequestUid) {
  return payplusRequest('POST', '/api/v1.0/PaymentPages/ipn', {
    payment_request_uid: paymentRequestUid,
  });
}

/**
 * Verify that an incoming callback actually originated from PayPlus.
 * PayPlus signs callbacks with HMAC-SHA256 using your secret key.
 * The signature is sent in the `more_info_signature` field of the payload.
 *
 * NOTE: Confirm the exact field name and algorithm with PayPlus support
 * once you have account access. Adjust SIGNATURE_FIELD below if needed.
 */
const SIGNATURE_FIELD = 'more_info_signature';

function verifyWebhookSignature(payload) {
  const secretKey = process.env.PAYPLUS_SECRET_KEY;
  if (!secretKey) return false;

  const receivedSig = payload[SIGNATURE_FIELD];
  if (!receivedSig) return false;

  // Compute HMAC-SHA256 over the more_info string
  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(payload.more_info || '')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(receivedSig.toLowerCase()),
    Buffer.from(expected.toLowerCase()),
  );
}

/**
 * Generate a one-time (non-recurring) PayPlus payment page link for a store order.
 * Uses the PAYPLUS_STORE_PAYMENT_PAGE_UID payment page (separate from subscription page).
 */
async function generateStorePaymentLink({
  amount,          // total order amount (number, 2 decimal places)
  orderId,         // our store_orders.id (UUID)
  clientName,      // for PayPlus customer identification
  items,           // [{ name, quantity, unitPrice }]
  successUrl,
  failureUrl,
  cancelUrl,
  callbackUrl,
}) {
  const moreInfo = JSON.stringify({ orderId, flow: 'client' });

  const payload = {
    payment_page_uid: process.env.PAYPLUS_STORE_PAYMENT_PAGE_UID,
    amount,
    currency_code:     'ILS',
    sendEmailApproval: true,
    sendEmailFailure:  true,
    refURL_success:    successUrl,
    refURL_failure:    failureUrl,
    refURL_cancel:     cancelUrl,
    refURL_callback:   callbackUrl,
    more_info:         moreInfo,
    fullName:          clientName || '',
    items: items.map((i) => ({
      name:     i.name,
      quantity: i.quantity,
      price:    Number(i.unitPrice).toFixed(2),
      vat_type: 0,
    })),
    // No recurring_settings — one-time payment
  };

  return payplusRequest('POST', '/api/v1.0/PaymentPages/generateLink', payload);
}

module.exports = {
  generatePaymentLink,
  generateStorePaymentLink,
  setRecurringValid,
  getTransactionDetails,
  verifyWebhookSignature,
};
