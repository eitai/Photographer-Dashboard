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

/**
 * Generate a hosted page for a photographer to add a card on file.
 * PayPlus tokenizes the card on its side; the callback returns a token we store
 * (we never see the PAN). Uses a small verification charge that the terminal
 * tokenizes (`create_token: true`).
 *
 * NOTE: confirm with the PayPlus account whether token-only (amount 0) is
 * permitted on the terminal; otherwise the verification amount below is charged
 * and should be refunded or credited. Adjust TOKENIZE_AMOUNT accordingly.
 */
const TOKENIZE_AMOUNT = Number(process.env.PAYPLUS_TOKENIZE_AMOUNT || 1);

async function generateCardTokenPage({ adminId, customerName, successUrl, failureUrl, cancelUrl, callbackUrl }) {
  const moreInfo = JSON.stringify({ type: 'card_token', adminId });
  const payload = {
    payment_page_uid: process.env.PAYPLUS_STORE_PAYMENT_PAGE_UID,
    amount:            TOKENIZE_AMOUNT,
    currency_code:     'ILS',
    create_token:      true,   // ask PayPlus to save the card and return a token
    sendEmailApproval: false,
    sendEmailFailure:  false,
    refURL_success:    successUrl,
    refURL_failure:    failureUrl,
    refURL_cancel:     cancelUrl,
    refURL_callback:   callbackUrl,
    more_info:         moreInfo,
    fullName:          customerName || '',
    items: [{ name: 'Card verification', quantity: 1, price: TOKENIZE_AMOUNT, vat_type: 0 }],
  };
  return payplusRequest('POST', '/api/v1.0/PaymentPages/generateLink', payload);
}

/**
 * Charge a previously-saved card token for an arbitrary amount (monthly invoice).
 * Returns the PayPlus transaction result; throws on API error.
 *
 * NOTE: token-charge must be enabled on the terminal. Confirm the exact endpoint
 * and field names with PayPlus support once account access is available.
 */
async function chargeByToken({ token, amount, orderRef, moreInfo }) {
  const payload = {
    terminal_uid:  process.env.PAYPLUS_TERMINAL_UID,
    amount,
    currency_code: 'ILS',
    use_token:     true,
    token,
    more_info:     typeof moreInfo === 'string' ? moreInfo : JSON.stringify(moreInfo || {}),
    ...(orderRef ? { transaction_origin: orderRef } : {}),
  };
  return payplusRequest('POST', '/api/v1.0/Transactions/charge', payload);
}

/**
 * Issue an accounting document (receipt / tax-invoice-receipt) via PayPlus.
 * Returns { documentUid, documentNumber, pdfUrl }.
 *
 * NOTE: the PayPlus Documents module must be enabled on the terminal, and the
 * exact endpoint + field names should be confirmed with PayPlus support once
 * account access is available (same posture as verifyWebhookSignature). The
 * shape below follows PayPlus's documented generateDocument call.
 *
 * @param {object} opts
 * @param {'receipt'|'tax_invoice_receipt'} opts.docType
 * @param {string} opts.customerName
 * @param {string} [opts.customerEmail]
 * @param {string} [opts.customerTaxId]
 * @param {{ name:string, quantity:number, unitPrice:number }[]} opts.items
 * @param {number} opts.vatAmount       0 for עוסק פטור / exempt
 */
async function issueDocument({ docType, customerName, customerEmail, customerTaxId, items, vatAmount }) {
  // PayPlus document type codes (confirm exact codes with PayPlus):
  //   קבלה (receipt) and חשבונית מס/קבלה (tax invoice + receipt)
  const PAYPLUS_DOC_TYPE = { receipt: 'receipt', tax_invoice_receipt: 'invrec' };

  const payload = {
    terminal_uid:  process.env.PAYPLUS_TERMINAL_UID,
    document_type: PAYPLUS_DOC_TYPE[docType] || PAYPLUS_DOC_TYPE.receipt,
    language:      'he',
    vat_type:      (vatAmount && vatAmount > 0) ? 1 : 0,   // 0 = no VAT (עוסק פטור)
    customer_name: customerName || '',
    email:         customerEmail || undefined,
    send_email:    false, // we send our own branded email; PDF link is attached
    ...(customerTaxId ? { vat_number: customerTaxId } : {}),
    items: (items || []).map((i) => ({
      name:     i.name,
      quantity: i.quantity || 1,
      price:    Number(i.unitPrice).toFixed(2),
    })),
  };

  const data = await payplusRequest('POST', '/api/v1.0/Documents/generateDocument', payload);
  const d = data?.data || data || {};
  return {
    documentUid:    d.document_uid || d.uid || null,
    documentNumber: d.document_number || d.number || null,
    pdfUrl:         d.original_document_url || d.pdf_link || d.document_url || null,
  };
}

module.exports = {
  generatePaymentLink,
  generateStorePaymentLink,
  generateCardTokenPage,
  chargeByToken,
  issueDocument,
  setRecurringValid,
  getTransactionDetails,
  verifyWebhookSignature,
};
