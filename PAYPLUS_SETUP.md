# PayPlus Integration Setup Guide

## What Was Built

Subscription billing via PayPlus (Israeli payment gateway) for all photography plan tiers.

### Backend files
- `backend/src/utils/payplus.js` — HTTP client (generatePaymentLink, setRecurringValid, verifyWebhookSignature)
- `backend/src/db/migrations/006_payplus.sql` — Replaces stripe_ columns with payplus_ columns
- `backend/src/routes/plans.js` — PayPlus endpoints: /checkout, /webhook, /cancel, /reactivate, /invoices

### Frontend files
- `frontend/src/pages/PricingPage.tsx` — Public /pricing page with plan cards + custom GB slider
- `frontend/src/pages/admin/BillingPage.tsx` — Wired to PayPlus: upgrade modal, cancel/reactivate, invoice history

---

## Environment Variables Required

Add to `backend/.env` once you have your PayPlus account:

```env
# PayPlus — https://payplus.co.il
PAYPLUS_API_KEY=          # From PayPlus dashboard → API Keys
PAYPLUS_SECRET_KEY=       # From PayPlus dashboard → API Keys
PAYPLUS_TERMINAL_UID=     # From PayPlus dashboard → Terminal UID
PAYPLUS_PAYMENT_PAGE_UID= # Create ONE payment page in PayPlus dashboard → copy its UID here
PAYPLUS_ENV=development   # Change to 'production' when going live

# Base URL of this backend (for webhook callback URL)
BACKEND_URL=https://your-domain.com
```

---

## PayPlus Dashboard Setup

1. **Create API credentials**: Dashboard → Administration → API → API Keys
   - Copy `api-key` → `PAYPLUS_API_KEY`
   - Copy `secret-key` → `PAYPLUS_SECRET_KEY`

2. **Get Terminal UID**: Dashboard → Terminal settings → copy UID → `PAYPLUS_TERMINAL_UID`

3. **Create a Payment Page**: Dashboard → Payment Pages → Create New
   - Name: "Subscription"
   - Enable recurring payments
   - Save → copy the Page UID → `PAYPLUS_PAYMENT_PAGE_UID`
   - This ONE page handles all plan tiers (amount is dynamic per request)

4. **Register Webhook URL**: In your PayPlus payment page settings, set the callback URL to:
   ```
   https://your-domain.com/api/plans/webhook
   ```
   Or set `refURL_callback` dynamically (already done in code).

---

## API Endpoints (Backend)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/plans/checkout` | protect | Create PayPlus payment page → returns `{ url }` |
| POST | `/api/plans/webhook` | none (PayPlus) | PayPlus callback → updates subscription |
| POST | `/api/plans/cancel` | protect | Cancel at period end |
| POST | `/api/plans/reactivate` | protect | Remove cancel flag |
| GET | `/api/plans/invoices` | protect | Billing history |

---

## Webhook Signature Verification

PayPlus signs callbacks with HMAC-SHA256. The current implementation
verifies `more_info_signature` field. Confirm with PayPlus support the
exact field name once you have account access.

The field name is set in `SIGNATURE_FIELD` in `backend/src/utils/payplus.js`
— change it if needed without touching any other code.

---

## PayPlus API Reference

- Docs: https://docs.payplus.co.il/reference/introduction
- Production base URL: https://restapi.payplus.co.il
- Staging base URL: https://restapidev.payplus.co.il
- Payment page: POST /api/v1.0/PaymentPages/generateLink
- Cancel/reactivate recurring: POST /api/v1.0/RecurringPayments/{uid}/Valid
