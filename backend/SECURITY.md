# Backend Security Checklist

Tracks every security issue identified, its status, and where the fix lives.

---

## Fixed in previous session

| # | Severity | Location | Issue | Fix |
|---|---|---|---|---|
| 1 | Critical | `routes/galleries.js` | `resend-email` used `findById` — IDOR, any admin could trigger email for another admin's gallery | `findOne({ _id, adminId })` |
| 2 | Critical | `routes/selections.js` | `GET /submissions` had no gallery ownership check | Added `Gallery.findOne({ _id, adminId })` guard |
| 3 | High | `routes/images.js` | `PATCH /:imageId/before` had no gallery ownership check | Added gallery ownership guard |
| 4 | High | `routes/selections.js` | `selectedImageIds` not validated against gallery | `GalleryImage.countDocuments` cross-check |
| 5 | Medium | `app.js` | No global fallback rate limiter | `globalLimiter` — 500 req / 15 min / IP on all `/api` routes |

---

## Fixed in this session

| # | Severity | Location | Issue | Fix |
|---|---|---|---|---|
| 6 | High | `routes/auth.js` | NoSQL injection — `email`/`username` passed to `$or` without type-check; sending `{ "$gt": "" }` could match any document | Strict `typeof` guard before query |
| 7 | High | `middleware/upload.js` | MIME spoofing — file type validated using client-controlled `Content-Type` header, not actual content | `validateImageMagicBytes` middleware reads first 12 bytes and checks magic numbers (JPEG, PNG, GIF, WebP) |
| 8 | Medium | `routes/auth.js`, `routes/admins.js` | Weak password policy — 8-char minimum only, no complexity requirement | `validatePassword` util: must contain ≥1 letter and ≥1 digit |
| 9 | Medium | `routes/contact.js`, `routes/public.js` | No input validation — field lengths unbounded, email format unchecked | `validateContact` util: length limits + email regex |
| 10 | Medium | `app.js` | Public submission endpoints (`/submit`, `/selection`) had no dedicated rate limit | `submissionLimiter` — 30 req / 15 min / IP |
| 11 | Low | `app.js` | No HTTPS redirect in production — relies entirely on reverse proxy | `x-forwarded-proto` redirect middleware (production only) |

---

## Remaining / Won't Fix

| # | Severity | Issue | Rationale |
|---|---|---|---|
| R1 | Low | JWT in `localStorage` on web frontend | Tracked in `frontend-improvements.md`; backend already sets httpOnly cookie — frontend migration is a separate task |
| R2 | Low | Helmet CSP not explicitly configured | Backend is a pure API server (no HTML served); default helmet headers are appropriate |
| R3 | Low | Account lockout after N failed logins | Auth rate limiter (20 req / 15 min) is sufficient for this scale; lockout adds complexity and DoS risk |
| R4 | Info | `POST /api/contact` stores submissions with no `adminId` | Generic contact form intentionally has no photographer context; submissions are admin-less by design |

---

## Security Architecture Notes

- **Auth**: JWT in httpOnly `sameSite=strict` cookie (browser) + `Authorization` header (mobile)
- **Ownership**: Every protected DB query scopes by `adminId: req.admin._id` — no cross-tenant leakage
- **Tokens**: Gallery access tokens are 24-byte crypto random, generated server-side only
- **Passwords**: bcryptjs with cost factor 12
- **File uploads**: Admin-only, Multer → magic bytes validation → Sharp (strips EXIF/GPS)
- **Rate limits**: Global (500/15min) → auth (20/15min) → contact (10/hr) → submissions (30/15min)
- **Headers**: Helmet defaults — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, HSTS in prod
