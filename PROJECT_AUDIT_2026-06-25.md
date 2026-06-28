# Project Audit — Light Studio

**Date:** 2026-06-25
**Branch reviewed:** `feat/dashboard-purple-redesign`
**Method:** 4 parallel specialist review agents — Backend Security/API, Code Quality/TypeScript, Design/UX/RTL, Architecture/DevOps. Read-only; no code changed.

> Findings that appeared independently in more than one agent are marked **[cross-confirmed]** — high confidence.

---

## 0. What's good (keep this)

- **Queue/worker layer** (`backend/src/workers/index.js`) is production-grade: pg-boss with real idempotency gates keyed on `assetId`+status, CAS-style state gates, retry/backoff, `singletonKey` set producer-side, a boot self-test that proves cjxl/djxl round-trips **bit-exact** before touching live data (refuses to start otherwise), graceful drain on SIGTERM with 120s timeout aligned to systemd.
- **No SQL injection** — all query values consistently parameterized (`$1`, `$2`...) across all models. No string concatenation of user values into query bodies.
- **TypeScript clean** — `cd frontend && npx tsc --noEmit` passes with **0 errors**; only 16 `any` occurrences total.
- **Store webhook** (`backend/src/routes/store.js:321-409`) done right: HMAC + `timingSafeEqual` + idempotency guard (`paymentStatus === 'paid'` short-circuit) + hard fail-closed. **Use this as the template** to fix the plans webhook.
- Magic-bytes validation on all upload endpoints; filename sanitization strips path separators; `formatAdmin` never exposes `payplusCardToken` (only `hasCardOnFile`).
- `asyncHandler` used in all 29 route files; global error handler suppresses stack traces in prod.
- Health checks: DB-gated `/api/health` returns 503 when pool down; `/api/admin/queue/health` per-queue state.
- systemd hardening (`ops/`): `LoadCredential=` secret projection, `ProtectSystem=strict`, per-service seccomp, SHA-256-pinned binary bootstrap, least-privilege Wasabi IAM with source-IP allowlist.
- Code-splitting via `React.lazy` for all public/client routes; gallery virtualization exists.
- No real secrets committed — only `.env.example` templates and non-secret frontend `VITE_*` URLs.

---

## 1. CRITICAL — Payments (fix immediately, before any deploy)

**[cross-confirmed by Security + Architecture agents]**

### C1. Plans/subscriptions webhook fails OPEN on missing secret
`backend/src/routes/plans.js:242`
```js
if (process.env.PAYPLUS_SECRET_KEY && !payplus.verifyWebhookSignature(payload)) {
```
If `PAYPLUS_SECRET_KEY` is unset, the signature check is **skipped entirely**, and this handler grants subscriptions and stores card-on-file tokens (`plans.js:256-269`). A forged POST to `/api/plans/webhook` can activate subscriptions or set an attacker-controlled card token on any admin. The store webhook (`store.js:328-336`) correctly hard-rejects when the secret is missing.

**Fix:** fail closed, identical to the store webhook:
```js
if (!process.env.PAYPLUS_SECRET_KEY) {
  logger.warn('PayPlus plans webhook: PAYPLUS_SECRET_KEY not configured');
  return res.status(500).json({ message: 'Webhook secret not configured' });
}
if (!payplus.verifyWebhookSignature(payload)) {
  return res.status(401).json({ message: 'Invalid signature' });
}
```

### C2. PayPlus HMAC signs only `more_info`, not `status_code`/`amount`
`backend/src/utils/payplus.js:116-124` — `crypto.createHmac('sha256', secretKey).update(payload.more_info || '')`. Signature covers only the echoed `more_info`, not the transaction `status_code` or `amount`. An attacker who replays a valid `more_info` (observed from a real transaction) can forge a `status_code: '000'` success without a real charge. Affects **both** webhooks.

**Fix:** after the signature check passes, call `payplus.getTransactionDetails(payload.payment_request_uid)` and assert `status_code === '000'` and `amount` matches `order.totalAmount` before updating state. The backend becomes the authoritative verifier, not the inbound payload.

### C3. Plans webhook activates any plan for any `adminId` without verifying amount
`backend/src/routes/plans.js:282-306` — `adminId`, `planId`, `billingInterval`, `customStorageGb` all come from `more_info` (user-controlled). No assertion that the charged amount matches the plan price. Combined with C1/C2: provision a paid plan for ₪0.

**Fix:**
```js
const plan = await Plan.findById(planId);
const expectedAmount = billingInterval === 'annual' ? plan.priceAnnualIls : plan.priceMonthlyIls;
if (Number(payload.data?.amount) < Number(expectedAmount)) {
  return res.status(400).json({ message: 'Amount mismatch' });
}
```

### C4. Card-tokenization callback writes `payplusCardToken` on any `adminId` in `more_info`
`backend/src/routes/plans.js:256-271` — when `moreInfo.type === 'card_token'`, the card token (used for all future direct charges to that photographer) is written to `Admin.findByIdAndUpdate(moreInfo.adminId, {...})`. If C1/C2 are exploited, an attacker can redirect a photographer's billing to a different card.

**Fix:** when generating the card-token page link, set a short-lived flag (e.g. `pending_card_token_session: true`) on the admin row; reject the webhook if absent.

### C5. PayPlus signature scheme is UNCONFIRMED
`backend/src/utils/payplus.js:103-124` — code comments admit the field name (`more_info_signature`) and algorithm are **guesses pending PayPlus account confirmation**. Also `crypto.timingSafeEqual` (line 121) **throws if buffers differ in length** → malformed signature becomes a 500 instead of a clean 400.

**Fix:** confirm the real scheme with PayPlus; length-guard before `timingSafeEqual`.

---

## 2. HIGH — Security (before production)

### H-S1. Public gallery endpoint leaks full row including `adminId`
`backend/src/routes/galleries.js:109` — `res.json(gallery)` over `SELECT *`. Any client with a gallery link obtains the photographer's internal `adminId` UUID (the FK used in every order/billing/settings query), plus `delivery_of`, `client_id`, etc. **Fix:** explicit projection of only client-facing fields.

### H-S2. Public images endpoint leaks `path` (S3 key / disk path); orders endpoint leaks `unitCostPrice` + PII
- `backend/src/routes/images.js:47-49` — returns `path` (raw S3 key `admins/<adminId>/<file>.jpg`, or absolute server path locally) to any unauthenticated caller knowing a `galleryId`.
- `backend/src/routes/orders.js:96-100` — public selection endpoint returns `unitCostPrice` (photographer's internal cost to supplier) + `client.email`/`client.phone`.

**Fix:** project both responses to only what the page needs.

### H-S3. Google OAuth auto-links accounts by email even without SSO enabled
`backend/src/routes/auth.js:381-387` (and superadmin flow 338-345) — a Google login for an existing email with no linked `google_id` auto-links (`ssoEnabled: true`) without checking whether the admin ever opted in. Any Google account matching an admin's email gains full access. **Fix:** only auto-link if `admin.ssoEnabled === true`.

### H-S4. No rate limiting on superadmin-login / register / supplier login
`backend/src/app.js:135` — `authLimiter` covers only `/api/auth/login`. `superadmin-login` is the highest-value target; `register` creates a DB record + subscription per request; supplier login unprotected. **Fix:** apply `authLimiter` to all three.

### H-S5. Public selection endpoint does not validate photo counts
`backend/src/routes/orders.js:104-128` — never calls `checkPhotoCount` (the checkout flow `store.js:166-174` does). A client can submit 0 photos for a product requiring 5, or 500 for a product capped at 10. **Fix:** iterate items and call `checkPhotoCount(prod, count)`.

### H-S6. Mass assignment
- `backend/src/routes/adminSuppliers.js:31-36` — `Supplier.create({ ...req.body, ... })` persists `isExclusive`, `apiWebhookUrl`, etc. (only name/email/password validated).
- Same pattern risk on Admin creation. **Fix:** destructure explicitly.

### H-S7. Other
- `supplierAuth.js:58-61` — login leaks full supplier row (`api_webhook_url`, `payplus_*`...). Whitelist via `formatSupplier`.
- `uploads.js:255-278` — secondary quota check reads legacy `admins.storage_quota_bytes` instead of the subscription-driven quota.
- `store.js:188-276` — order committed to DB before PayPlus call; failure orphans a `pending` order with no `orderId` returned for retry.

---

## 3. HIGH — Infrastructure & Quality

### H-I1. `node_modules` committed to git — 88% of the repo
`git ls-files` tracks 4499 files; **3938 under `node_modules`** (2597 root, 1341 backend, plus disabled-koral-mobile). **No root `.gitignore`** (only `backend/.gitignore`, `ops/.gitignore`). **Fix:** add root `.gitignore` with `node_modules/`, then `git rm -r --cached node_modules */node_modules`.

### H-I2. In-memory rate limiting — bypassable under multiple instances
`backend/src/app.js:89-150` — all six limiters use `express-rate-limit`'s default `MemoryStore`. With N instances the limit becomes N× per instance; a load-balanced attacker bypasses auth/contact/submission/store throttles. **Fix:** `rate-limit-redis` (or equivalent) before running >1 instance.

### H-I3. No CI/CD and no error tracking
No `.github/`, no pipeline — every deploy is a hand-run `ops/deploy.sh` with no lint/test/build gate. Zero APM/error-tracking (no Sentry/Datadog/OTel); prod errors live only in local rotating logs (`backend/src/utils/logger.js`). **Fix:** CI workflow (lint + jest + build) + Sentry DSN for API and worker.

### H-I4. Zero test coverage on money paths
`backend/tests/` (785 lines, 95 cases) covers auth/clients/galleries/blog/contact/storage/infra. **Nothing touches payments, billing, store orders, or settlements** (`grep payplus backend/tests` → nothing). Untested high-risk surface: webhook outcome handling (`store.js:321-409`), `StoreOrder.js` lifecycle (`submitSelection`, `approve`, `sendToSupplier`, `updateSupplierStatus`, `cancel`), `billingService.js`, `billingMonthlyHandler`. **Fix:** add `backend/tests/payments.test.js` driving the webhook for: missing signature → 400; valid + `'000'` → paid; replayed valid on already-paid → no double-processing; non-`'000'` → not paid.

### H-I5. Two parallel order systems both live
`backend/src/app.js:195-202` mounts both `product-orders` (legacy `ProductOrder` model, 127 lines) and `orders`/`store`/`supplier/orders` (`StoreOrder`, 1001 lines). Both implement "client selects photos against a product/quota and submits." Two sources of truth → every payment/security fix must be applied twice. **Fix:** decide the canonical model; schedule removal of `productOrders.js` + `ProductOrder.js` + `AdminProduct.js` if dead, or document the boundary.

### H-I6. `multer@1.4.5-lts.1` — deprecated, CVE-affected line
`backend/package.json` — 1.x is EOL with known DoS advisories (unhandled exception on malformed multipart), while the app accepts batch uploads up to 5000 files/request. **Fix:** migrate to `multer@2.x`; run `npm audit` in backend.

---

## 4. HIGH — Design / UX

### H-D1. `bg-blush text-white` fails WCAG contrast app-wide (~20 sites)
White on blush `#E7B8B5` ≈ **1.6:1** (min 4.5:1). The spec explicitly warns "Raw Blush CANNOT carry text." It's the primary-button pattern everywhere.
- `frontend/src/components/admin/Button.tsx:8` — shared `primary` variant (fixing here covers most consumers)
- Also: `QuickAddClient.tsx:59`, `ClientOrderSelection.tsx:276`, `ProductOrdersClient.tsx:124,141`, `SendToSupplierModal.tsx:184`, `StoreOrderCard.tsx:186`, `CreateOrderModal.tsx:256`, `AddGalleryModal.tsx:170`, `GalleriesSection.tsx:149`, `SettingsSectionsTab.tsx:538,618,698,950,1013,1071`

**Fix:** change `primary` foreground to `text-charcoal` (#2D2D2D on blush ≈ 5.6:1 ✓), matching the `--primary-foreground: #3c3a38` already in `index.css:19`. The codebase is internally contradictory: CSS var says charcoal, every hand-rolled button hardcodes white.

### H-D2. Purple redesign diverges from the token system
`index.css:67-77` defines a clean abstraction (`.dash-theme` remaps `--blush`→violet + dark-mode variant), but components ignore it and hardcode `violet-*`/`purple-*`/`fuchsia-*` — two parallel color systems on one screen, hardcoded ones won't adapt to dark mode.
- `AdminDashboard.tsx:93` (`bg-violet-600`), `:124,133,142` (three different icon hues), `:167-168` (filter chips)
- `ring-violet-100` repeated in `StatCard.tsx:17`, `QuickAddClient.tsx:44`, `ActivityPanel.tsx:16`, `UpcomingShoots.tsx:35`, `WaitingForDelivery.tsx:42`, `AdminDashboard.tsx:153`

**Fix:** drive everything off `--blush`/`--beige` so the `.dash-theme` remap + dark mode take effect; **needs design sign-off on violet-vs-blush before merge** — conflicts with the blush brand used in every other admin screen.

### H-D3. StatusBadge ignores the verified-contrast palette
`frontend/src/components/admin/StatusBadge.tsx:3-9` uses generic Tailwind (`bg-yellow-100 text-yellow-700` borderline/failing) instead of the spec's verified ≥4.5:1 pairs. Also `selection_submitted: 'bg-blush/20 text-charcoal'` silently turns purple only on the dashboard (`.dash-theme` remap). **Fix:** static lookup to exact verified hex pairs, theme-independent.

### H-D4. NotificationBell: hardcoded Hebrew + RTL-broken dropdown
`frontend/src/components/admin/NotificationBell.tsx` — lines 155,162,168,175,200,215 hardcode Hebrew (English users see Hebrew); line 152 dropdown `absolute left-0` opens off-edge in RTL (use `start-0`); line 145 badge `right-1` (use `end-1`).

---

## 5. MEDIUM

### Security / Infra
- **M-1** Public images endpoint doesn't check gallery active/not-expired (`images.js:31`) — any `galleryId` lists images of expired/inactive galleries without the token.
- **M-2** Gallery bearer tokens written to plaintext morgan logs (`app.js:64-71`) — token is in the URL path of public routes; redact path segments.
- **M-3** `/uploads` served with `Access-Control-Allow-Origin: *` (`app.js:158-159`) — private gallery images embeddable from any origin. Restrict to `FRONTEND_URL` or serve via signed S3 URLs only.
- **M-4** Local-disk upload fallback breaks multi-instance reads (`middleware/upload.js:8-15`, `config/s3.js:171-281`) — leaves files on one instance's disk when S3 fails; reads routed elsewhere 404. Make S3 mandatory in prod (hard error, not silent fallback).
- **M-5** In-process `setInterval(deleteExpiredGalleries, 5min)` in every API instance (`server.js:617`) → N racey delete passes; pg-boss face consumer + orphan-reset also registered in every API instance. Move to a single pg-boss `boss.schedule`; keep consumers in the dedicated worker only.
- **M-6** Hand-rolled migrations, no version table (`server.js` ~30 try/catch ALTER blocks that swallow errors with `logger.warn` → boots against half-migrated schema); duplicate numbering in `src/db/migrations/` (two `005_*`, two `006_*`). Indexing itself is good (all hot paths covered). Adopt `node-pg-migrate` with fail-fast.
- **M-7** `faceRecognition.js:54-58` reaches into pg-boss internal tables (`UPDATE pgboss.job ...`) — couples to internal schema. Use the public API.
- **M-8** `docker-compose.yml` omits the worker and face-recognition services entirely → under Compose, image compression and face recognition silently don't run. Postgres password hardcoded `koral/koral/koral`. Document Compose as dev-only or add the services.
- **M-9** No CSRF on payment-critical mutating endpoints (`/plans/checkout`, `/billing/card`, `/plans/cancel`) — `sameSite: lax` doesn't cover same-origin fetch. Add a `CSRF-Token` custom-header check.
- **M-10** `billingService.closeCycle` (`:81-85`) accepts raw date strings without the `DATE_RE` validation used elsewhere.
- **M-11** `validatePassword` not applied to supplier `change-password` (`supplierAuth.js:143`, only length≥8).
- **M-12** `console.error`/`console.log` in committed routes (`auth.js:301,314`; `orders.js:569`) — bypasses Winston.

### Maintainability (oversized files)
- **M-13** `emailService.js` (1181 lines) — 8 inline HTML templates duplicating the RTL/LTR shell. Extract `renderEmailShell({lang, body, cta})` + `services/emailTemplates/`.
- **M-14** `AdminSettings.tsx` (507 lines, ~40 `useState` + a 56-line hydrating `useEffect`) — tabs already extracted but state/handlers prop-drilled from the parent. Give each tab its own `useState`/`useMutation` seeded from a `useSettings()` hook.
- **M-15** `workers/index.js` (1101 lines) mixes JXL transcode, verify, cleanup, face recognition, binary self-tests, and monthly billing in one process. Split; billing shouldn't share lifecycle with CPU-bound transcoding.
- **M-16** `StoreOrder.js` (1001 lines) — split reporting (`report`/`reportForSupplier`) out from the lifecycle state machine.

### Design
- **M-17** Inline-ternary i18n (`dir === 'rtl' ? ... : ...`) instead of `t()` keys — `AdminOrders.tsx` (CSV headers, pagination, toasts), `StoreCheckoutView.tsx:35,42-44` (payment errors hardcoded Hebrew), `StoreConfigureView.tsx:199,206`.
- **M-18** Physical direction classes breaking RTL — `AdminShowcase.tsx:146` (`pr-9 pl-3` → `pe-9 ps-3`), `GalleriesSection.tsx:179`/`FolderUploadQueue.tsx:145` (`pr-1` → `pe-1`), selection badges `left/right` in `AdminSelections.tsx`/`SubmissionsSection.tsx`, `AdminBlogEditor.tsx:351` (`file:mr-3` → `file:me-3`).
- **M-19** Global `[dir='rtl'] { text-align: right }` (`index.css:138-140`) — blunt; centered/justified elements inherit right-align. Prefer `text-start` on containers.
- **M-20** `ClientRow.tsx:33-41` accordion uses `role="button"` div with interactive children (invalid nesting); no `aria-expanded`. Use a native button/collapsible.

---

## 6. LOW

- **L-1** `socket.io@^4.8.3` is a dead dependency — zero usage in backend. Drop it (if real-time is added later it'll need `@socket.io/redis-adapter` + `io.use` JWT middleware).
- **L-2** Boot env validation too narrow (`config/validateEnv.js:5` — only DATABASE_URL/JWT_SECRET/FRONTEND_URL). PayPlus/SMTP/S3/BACKEND_URL unvalidated; `BACKEND_URL` defaults to localhost (would send PayPlus a localhost callback in prod). Validate payment/storage/SMTP vars at boot.
- **L-3** DB TLS `rejectUnauthorized: false` (`config/db.js:24`, `queue/index.js:76`) — intentional for self-signed CNPG certs; document it.
- **L-4** Worker vs API differ on `unhandledRejection` — API exits (`server.js:648-657`), worker logs and continues (`workers/index.js:1089-1091`). Pick one posture.
- **L-5** `.claude/settings.json` uses `defaultMode: "bypassPermissions"` — risky if shared (mitigated by a `deny` list).
- **L-6** `staleTime` missing on 13 of 44 `useQuery` sites — static data (plans, supplier catalog, settings) refetches on every mount. Set sensible values.
- **L-7** Inline styles violating the "no inline styles" rule — static `mixBlendMode`/`backgroundColor` movable to Tailwind in `StoreOrderStatus.tsx:16,24`, `AdminLogin.tsx:60`, `ClientGallery.tsx:49`. (Dynamic widths in StorageBar/QuotaSlider are legitimately inline.)
- **L-8** Min touch target (44dp) inconsistent — icon buttons `DashboardGalleryCard.tsx:84-111` (~26px), dashboard filter chips sub-44 on mobile web.
- **L-9** Component-reuse duplication — primary button reimplemented inline ~15×; avatar-initials block duplicated in `ClientRow.tsx:18-22` and `ActivityPanel.tsx:23-27`; two placeholder-thumbnail systems (`DashboardThumb` vs `GalleryMosaic`).

---

## 7. Repo hygiene

- `disabled-koral-mobile/` — 85 tracked files, dead, not gitignored. CLAUDE.md still routes mobile work there. Delete (recoverable from history) or archive to a branch.
- `backend/CLAUDE.md` still documents **MongoDB/Mongoose/`MONGODB_URI`** — the stack is PostgreSQL. Misleading to any dev/agent.
- `FLOWS_HE.md` and `FLOWS_HE.txt` are both tracked and have **diverged** (not duplicates — different content). Two sources of truth.
- `face-recognition-service/` has committed `*.log` files (`service.log`, `face-service.log`, `service-err.log`); `faceService.js` header comments still describe the removed CompreFace/@vladmandic implementation (now calls InsightFace FastAPI).

---

## 8. Top 5 actions, in order

1. **Plans webhook → fail-closed** + verify `status_code`/`amount` in both webhooks (C1–C3). Confirm the real PayPlus signature scheme (C5). Use the store webhook as the template.
2. **Close the public-endpoint exposures** — explicit projection in galleries/images/orders (H-S1, H-S2); fix OAuth auto-link (H-S3); add photo-count validation (H-S5).
3. **Fix `bg-blush text-white` contrast** at `Button.tsx:8` (broad impact, one change) (H-D1).
4. **Payment tests** (H-I4) + **un-commit `node_modules`** + root `.gitignore` (H-I1).
5. **Before scaling:** Redis rate-limit store (H-I2), S3 mandatory in prod (M-4), single-leader cron (M-5), CI + Sentry (H-I3).

---

*Generated from a 4-agent parallel review. All file:line references verified against the working tree at the date above.*
