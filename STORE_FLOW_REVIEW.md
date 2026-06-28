# Store / Product-Ordering Flow — Review & Work Log

> Review date: 2026-06-25 · Branch: `feat/dashboard-purple-redesign`
> Scope: full product-ordering flow (legacy `ProductOrder` + new `StoreOrder`/PayPlus/billing/settlements).

## Architecture overview

Two coexisting flows:

| System | Flow | Created by | Status lifecycle | Billing | Tracking |
|--------|------|-----------|------------------|---------|----------|
| **ProductOrder** (Phase 1, legacy) | Photographer curates → client picks | Admin | pending → submitted → delivered | ❌ | via linked StoreOrder |
| **StoreOrder** (Phase 2+) | Client browses → picks + pays (PayPlus) | Client | draft → pending_selection → approved → sent_to_supplier → in_production → ready_to_ship → shipped → delivered | ✅ photographer invoice + supplier settlement | tracking_number/carrier |

Key backend files:
- Routes: `backend/src/routes/store.js`, `productOrders.js`, `supplierOrders.js`, `adminProducts.js`, `adminSuppliers.js`, `supplierProducts.js`, `adminBilling.js`, `photographerBilling.js`, `supplierSettlement.js`
- Models: `StoreOrder.js`, `ProductOrder.js`, `Supplier.js`, `SupplierProduct.js`, `SupplierSettlement.js`, `PhotographerInvoice.js`, `IssuedDocument.js`
- Services: `billingService.js`, `invoiceService.js`, `emailService.js`, `smsService.js`
- Utils: `validatePhotoCounts.js`, `payplus.js`
- Migrations: `008_store_supplier.sql`, `011_product_order_store_link.sql`, `014_billing.sql`, `015_documents.sql`

---

## Findings

### 🔴 C1 — CONFIRMED BUG: client checkout breaks when photos are selected
**File:** `backend/src/routes/store.js:236`

```js
selectedIds.length > 0 ? JSON.stringify(selectedIds) : '{}',
```

`selected_image_ids` is a Postgres `uuid[]` column. `JSON.stringify(["a","b"])` produces the string `["a","b"]`; with the `$6::uuid[]` cast Postgres expects the array-literal form `{a,b}`, not `[...]`. Result: **`malformed array literal` → INSERT throws → transaction rollback → 500**. Every client order that includes at least one selected photo (i.e. essentially every print/album with `min_photos`) fails at checkout. The entire Flow B (client self-service store) is broken for photo products.

Proof it's a bug, not intent: the sibling model `StoreOrder.js:539` (`createDirect`, photographer flow) passes a **native JS array**, which `pg` serializes to `{...}` correctly.

Frontend confirms photos are sent at checkout: `StoreCheckoutView.tsx:62` sends `selectedImageIds`, populated by `StoreConfigureView.tsx`.

**Fix:** pass the native array (empty `[]` → pg emits `'{}'`):
```js
selectedIds,   // native JS array; pg serializes to the Postgres {…} literal
```
- [x] Fixed

### 🟠 C2 — No ownership validation of selected images at checkout
**File:** `backend/src/routes/store.js` (checkout handler)

Checkout validates product existence/active/photo-count but does **not** verify `selectedImageIds` belong to the gallery being ordered from. The model `createDirect` does this (`StoreOrder.js:498-511`). A client could submit arbitrary UUIDs. Add the same ownership check (images must belong to the gallery / admin).
- [x] Fixed (validates image IDs belong to the ordering gallery)

### 🟠 C3 — Auto-send-to-supplier has no retry/backfill
**File:** `backend/src/routes/store.js:480-500`

If the `sent_to_supplier` update fails after payment is already recorded, the order stays `approved` forever with no alerting. Documents have `backfillPending`/retry; this step did not.
- [x] Fixed — added `STORE_DISPATCH_SWEEP` worker job (`store.dispatch_sweep`, every 15 min) in `workers/index.js`: re-dispatches paid `approved` orders for an exclusive supplier where `sent_to_supplier_at IS NULL`. Idempotent (single UPDATE … RETURNING; only touches stranded rows), logs a warning when it acts.

### 🟡 C4 — Webhook does not cross-check paid amount vs `total_amount`
**File:** `backend/src/routes/store.js` (webhook, success branch)

Amount is server-fixed (PayPlus link generated with the computed total), so risk is low, but comparing the payload amount before marking `paid` is a cheap safety belt.
- [x] Fixed — on `status_code === '000'`, before marking paid, compares `payload.amount/total/transaction.amount` to `order.totalAmount` (>0.01 tolerance). On mismatch: logs an error, returns 200 (stops PayPlus retries), leaves the order unpaid for manual review. If no amount field is present in the payload, the check is skipped (field name varies by PayPlus account).

### 🟡 C5 — Invoice charge has single attempt; relies on manual `chargeOutstanding`
**File:** `backend/src/services/billingService.js`, `backend/src/workers/index.js`

`chargeInvoice` tries once then blocks the photographer. Retry existed only via `chargeOutstanding` (manual/superadmin) — and that also bills *new* orders, so it can't be run daily without pre-empting the monthly model.
- [x] Fixed — added `billingService.retryUnpaidInvoices()` (retries failed/pending invoices only, never creates new ones) + a `BILLING_DAILY` worker job (`billing.daily`, 06:30 UTC daily) that runs it plus `invoiceService.backfillPending()` for stuck documents. Both idempotent.

---

## Test Coverage Plan (proposed 2026-06-26)

Existing: `business-logic.test.js` (gallery/client/blog domain), `p0-p1.test.js`
(infra/security), `store-checkout.test.js` (Flow B checkout — new). The entire
store/supplier/billing domain except checkout is **untested**, including the
C4 (webhook amount check) and C5 (invoice retry) fixes.

### Tier 1 — Money paths (highest risk, do first)
- **T1.1 PayPlus store webhook** (`POST /store/webhook/payplus`) — mock `payplus`.
  Invalid/missing signature → 400; non-`client` flow ignored; order not found → 404;
  idempotency (already `paid` → no-op); success `000` → `approved`/`paid` + tx uid;
  **C4 amount mismatch → NOT marked paid**; failure code → `cancelled`/`failed`;
  auto-send to exclusive supplier → `sent_to_supplier`. *(covers C4)*
- **T1.2 Billing engine** (`billingService.closeCycle` / `chargeOutstanding` /
  **`retryUnpaidInvoices`**) — mock `payplus.chargeByToken`. Invoice idempotency
  (UNIQUE per period), charge success→`paid`, fail→`failed` + photographer blocked,
  retry picks up failed/pending only and never double-bills. *(covers C5)*
- **T1.3 invoiceService** — `computeVat` (3 VAT modes, pure unit, cheap) +
  `issueReceipt` idempotency (UNIQUE source).

### Tier 2 — Fulfillment & state machine
- **T2.1 Dispatch sweep** (`storeDispatchSweepHandler`) — stranded paid/`approved`
  order re-dispatched; non-stranded & non-exclusive untouched. *(covers C3)*
- **T2.2 Supplier order status** (`PUT /api/supplier/orders/:id/status`) — allowed
  transitions only, tracking persists, `delivered` → linked product_order delivered,
  supplier-auth required + cross-supplier isolation.
- **T2.3 Send-to-supplier** (`POST /api/product-orders/:id/send-to-supplier`) —
  creates StoreOrder+item, links `store_order_id`, 409 when supplier has no products.
- **T2.4 StoreOrder.createDirect** (photographer flow) — single-supplier enforcement,
  image-ownership validation, total = cost price.

### Tier 3 — Settlements & catalog
- **T3.1 SupplierSettlement** — `openBalance`, `createForPeriod` (attaches orders,
  idempotent), `markSettled`.
- **T3.2 Supplier products CRUD** — type enum, delete blocked with active orders, reorder.
- **T3.3 adminProducts favorites** — mark/unmark, favorites sort first.

### Tier 4 — Public read & polling
- **T4.1** `GET /store/products/:token` — empty when no exclusive supplier /
  `clients_can_order=false`; active products sorted.
- **T4.2** `GET /store/orders/:id/status` — status + receipt URL shape.
- **T4.3** `GET /api/product-orders/gallery/:token` & `order/:orderToken` — public
  fetch + StoreOrder status attach.

Recommended first scope: **Tier 1** (the money paths + the two fixes with zero coverage).

## Test suite delivered (2026-06-26) — all 4 tiers

73 new integration tests across 10 files, all green against the local DB. Run:
`cd backend && NODE_OPTIONS="-r dotenv/config" npx jest --runInBand` (or `npm test`).

| File | Tests | Covers |
|------|-------|--------|
| `store-checkout.test.js` | 10 | Flow B checkout, C1 regression, C2 |
| `store-webhook.test.js` | 8 | PayPlus IPN state machine, **C4** |
| `billing.test.js` | 9 | closeCycle / **retryUnpaidInvoices** (C5) / computeVat / issueReceipt |
| `store-orders-model.test.js` | 5 | dispatchStrandedOrders (**C3**) + createDirect |
| `supplier-orders.test.js` | 7 | supplier status state machine (cookie auth) |
| `product-orders-send.test.js` | 5 | send-to-supplier |
| `supplier-settlement.test.js` | 4 | openBalance / createForPeriod / markSettled |
| `supplier-products.test.js` | 9 | product CRUD, reorder, delete-block, ownership |
| `admin-products-favorites.test.js` | 4 | favorites + sort-first |
| `store-public.test.js` | 12 | public store/product-order reads |

Refactor for testability: extracted `src/services/storeFulfillment.js`
(`dispatchStrandedOrders`) out of the worker; the worker now calls it.

### 🐞 Bug found & fixed by the suite — supplier product reorder
`SupplierProduct.reorder` built `CASE WHEN id=$1 THEN $2 …` with no cast;
Postgres typed the result as `text`, so the assignment to the integer
`sort_order` column failed — **every supplier product reorder returned 500**.
Fixed with `THEN $n::int` in `src/models/SupplierProduct.js`. (Same class of bug
as C1 — a uuid/array/int type mismatch the tests now guard.)

### Pre-existing p0-p1 failures — fixed (stale expectations)
`tests/p0-p1.test.js` had 2 failures (reproduced in isolation, unrelated to this
work). Both were stale test expectations, not code bugs — fixed the tests:
- "Invalid UUID → 400": `/api/galleries/:id` is `protect`-guarded, so the
  unauthenticated request stopped at 401. Test now sends `VALID_TOKEN`, reaching
  the route's UUID validation → 400 'Invalid ID format'.
- "Body > 10kb → 413": the configured `express.json` limit is **2mb** (a
  deliberate app config, not lowered). Test now sends >2mb → 413.

**Full suite: 13 suites, 152 tests, all green.**

## Frontend review (2026-06-26) — store flow

Reviewed the client checkout chain + admin/supplier store pages for validation,
error states, and RTL/i18n. **5 confirmed correctness bugs fixed** (all pass
`tsc --noEmit`):

1. **StoreCheckoutView.tsx** — `onError` read `err.response.data.error`; the
   backend always returns `{ message }`. The client never saw the real checkout
   failure reason (incl. every C1/C2/C4 error) — only a generic toast. → reads
   `.message`. (Codebase convention is `.message`; this was the lone outlier.)
2. **SupplierOrderDetail.tsx** — `NEXT_STATUSES` offered transitions the backend
   state machine rejects (`sent_to_supplier→shipped/delivered`,
   `in_production→delivered`). A supplier picking a "valid" option got a 409.
   → aligned to the backend `VALID_FROM`.
3. **SupplierOrderDetail.tsx** — status-update `onError` swallowed the 409 message
   → now surfaces `.message`.
4. **StoreOrderCard.tsx** — the shared `run()` action handler swallowed backend
   errors → surfaces `.message`; hardcoded `Cancelled` → `t('orders.status.cancelled')`.
5. **ProductFormModal.tsx** — submit `catch` showed a generic toast on 422
   → surfaces the backend validation `.message`.

Client-facing states that are already solid: StoreTab (loading/empty),
StoreConfigureView (min/max-photos + required-options validation matches backend),
StoreOrderStatus (failed/pending/cancelled/paid/tracking/receipt, all i18n + RTL).

### Polish pass (2026-06-28) — done
- **SupplierProducts.tsx** — empty-state hint was hardcoded English
  ("Products assigned to you will appear here.") → new key
  `supplier.products.empty_hint` (he/en). Real bug for Hebrew users.
- **SupplierOrders.tsx** — converted the inline `dir==='rtl' ? he : en` labels for
  export/status (`all_statuses`, `export_csv`, `exporting`, `export_failed`,
  `report_capped`) to `t()` keys for consistency with the rest of the file.

Two review findings turned out to be **false positives** (verified in source, no
change needed):
- ProductFormModal *does* validate `min>max` and `handleSubmit` gates on
  `if (!validate()) return;` — submit is already blocked.
- SupplierOrderDetail label/value rows *do* apply `flex-row-reverse` in RTL.

Deliberately left as-is: the `'ישראל'` country default in AdminStoreOrderComposer.
It's the canonical stored address value for this Israel-only shipping flow;
localizing the default would risk mixing `Israel`/`ישראל` in saved addresses.

## What is well-managed (no action)
- Idempotent PayPlus webhook (`paymentStatus === 'paid'` guard) + signature verification + always returns 200.
- Photo min/max validation in two layers (route + model) via `checkPhotoCount`.
- Server-side total computation from `client_price` (never trusts client price).
- Transactions around order + items creation.
- Supplier/product deletion blocked when active orders reference them.
- Idempotent accounting docs via `UNIQUE(source_kind, source_id, doc_type)`.

---

## Work log
- 2026-06-25: Review written. Starting fixes with C1 (critical), then C2.
- 2026-06-25: **C1 fixed** — `store.js:236` now passes the native `selectedIds` array (pg → `{…}`). Syntax-checked (`node -c`). Matches the working pattern in `StoreOrder.js:539`.
- 2026-06-25: **C2 fixed** — added step `5c` in the checkout handler: validates all `selectedImageIds` are valid UUIDs and belong to the ordering gallery (`gallery_images.gallery_id = galleryId`), else 400/422.
- 2026-06-25: C1+C2 reverted together with the dashboard color experiment; review doc preserved.
- 2026-06-26: **Re-applied C1+C2**, then completed **C3, C4, C5**. All four backend files pass `node -c`:
  - `routes/store.js` — C1 (native array), C2 (image ownership), C4 (amount cross-check).
  - `services/billingService.js` — C5 `retryUnpaidInvoices()` + export.
  - `queue/index.js` — `BILLING_DAILY` + `STORE_DISPATCH_SWEEP` job names.
  - `workers/index.js` — handlers + cron schedules for both new jobs.
- All five findings (C1–C5) now addressed.
- 2026-06-26: **Integration tests added** — `backend/tests/store-checkout.test.js` (10 tests, PayPlus mocked). Covers the C1 regression (selected photos persist as a real `uuid[]`), C2 (foreign-gallery image → 422, non-UUID → 400), photo min/max, body/resource validation, and bad token → 404. **All 10 pass** against the local DB. Verified the C1 test has teeth: reverting the fix makes checkout return 500 and the test fail.
- Remaining (optional): confirm the PayPlus IPN amount field name with the account (C4 check is defensive — skips if the field is absent).
