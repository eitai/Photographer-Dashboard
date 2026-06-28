# Performance Optimization — Handoff

> **Status as of 2026-06-28.** Branch: `feat/dashboard-purple-redesign`.
> Author: Claude (performance-profiler skill + backend-api-guardian / react-frontend-engineer / fullstack-ts-reviewer agents).
> **Nothing is committed** — all changes below live in the working tree, unstaged.

This doc lets a future session resume without re-deriving anything. It records (1) the full bottleneck audit, (2) what was implemented for bottleneck #1, (3) verification state, and (4) the remaining prioritized work.

---

## TL;DR

We ran a performance audit of Light Studio (Express + raw `pg` backend, React/Vite frontend, RN mobile). Found 5 bottlenecks. **Bottleneck #1 (gallery-list N+1) is DONE** in the working tree, reviewed, and type-checks/lints clean. Bottlenecks #2–#5 are **not started**.

---

## The audit — 5 bottlenecks (prioritized)

| # | Severity | Area | Status |
|---|----------|------|--------|
| 1 | 🔴 Critical | Gallery-list N+1 (2N HTTP requests + 1+N SQL) | ✅ **DONE (uncommitted)** |
| 2 | 🟠 High | Image proxy bypasses CDN cache when `S3_PUBLIC_URL` unset; `Cache-Control: private, max-age=3600` | ⬜ Not started |
| 3 | 🟠 High | (folded into #1) per-gallery client lookup in `Gallery.find` | ✅ Done as part of #1 |
| 4 | 🟡 Medium | `cleanupNonSelectedOriginals` — sequential S3 deletes + per-row UPDATE in a loop | ⬜ Not started |
| 5 | 🟢 Low | Frontend bundle ~1.7 MB / 272 chunks; lazy-load heavy deps (Tiptap, jszip) | ⬜ Not started |

---

## Bottleneck #1 — DONE. What & where

**Problem:** the gallery list rendered one `GalleryCard` per gallery, and each card independently fetched preview images + submissions → **2N HTTP requests**, each its own DB query. Plus `Gallery.find({populate})` did 1 client query per gallery. A 30-gallery page = ~60 requests; the all-galleries list (cap 500) could fire ~1000.

**Fix:** moved enrichment server-side. `GET /api/galleries` now returns each gallery with `previewImages` + `submissions` embedded, built in **~4 flat queries regardless of N**.

### Backend changes
- **`backend/src/models/Gallery.js`**
  - New `findEnriched(filter)` (around line 144). Queries: (1) galleries `LIMIT 500`, (2) clients via `id = ANY($1::uuid[])`, (3) top-5 preview images/gallery via `ROW_NUMBER() OVER (PARTITION BY gallery_id ORDER BY sort_order ASC, created_at ASC)` + outer `WHERE rn <= 5`, (4) **latest** submission/gallery via `ROW_NUMBER() … ORDER BY submitted_at DESC` + `WHERE rn = 1`, selecting explicit columns (NOT `*`, omits `image_comments` JSONB).
  - New `_populateClientsForGalleries()` replaces the per-gallery `_populateClient` fan-out (now one `ANY` query).
  - Exported `findEnriched` in module.exports.
  - Empty-input guards: `if (!galleryRows.length) return []` before queries 3/4; query 2 guarded by `if (clientIds.length)`.
- **`backend/src/routes/galleries.js`**
  - `GET /api/galleries` handler (~line 117) calls `findEnriched({ adminId, clientId })` instead of `find(..., {populate:true})`.
  - Public `GET /token/:token` (~line 109-112) now strips `adminId`/`clientId`/`deliveryOf` — security hardening, **deliberate** (call out in PR).

### Response contract (each gallery in the LIST only)
```jsonc
{
  /* …existing gallery fields… */
  "previewImages": [ { "_id": "uuid", "thumbnailPath": "…|null", "previewPath": "…|null", "filename": "…", "sortOrder": 0, "createdAt": "…" } ], // ≤5
  "submissions":   [ { "_id": "uuid", "selectedImageIds": ["uuid"], "sessionId": "…", "clientMessage": "…|null", "heroImageId": "…|null", "submittedAt": "…" } ] // 0 or 1 (latest)
}
```
`rowToCamel` (`backend/src/db/utils.js`) already aliases `id`→`_id`, so nested objects carry `_id`.

### Frontend changes
- **`frontend/src/types/gallery.ts`** — added `GalleryPreviewImage`, `EmbeddedSubmission`; extended `GalleryData` with optional `previewImages?` / `submissions?`.
- **`frontend/src/components/admin/GalleryCard.tsx`** — removed `useGalleryPreviewImages`/`useSubmissions` calls; now reads `g.previewImages ?? []` / `g.submissions ?? []`. Download/delete handlers unchanged. Still `memo`'d.
- **`frontend/src/pages/admin/dashboard/DashboardThumb.tsx`** — takes `previewImages` prop instead of `galleryId`; no per-thumb fetch. Fallback `thumbnailPath ?? previewPath`.
- **`frontend/src/pages/admin/dashboard/UpcomingShoots.tsx`** + **`WaitingForDelivery.tsx`** — pass `previewImages={g.previewImages}` to `DashboardThumb`.
- **`frontend/src/hooks/useQueries.ts`** — `useDeleteSubmission` and `useDeleteSubmissionImage` now also `invalidateQueries({ queryKey: queryKeys.galleries })` (submissions data now rides on the galleries query). `useGalleryPreviewImages`/`useSubmissions` hooks kept — still used by `AdminSelections.tsx` (detail page).

### Data-flow sanity (verified)
Both `useGalleries()` (dashboard) and `useGalleriesByClient()` (client-detail) call `GET /api/galleries` → both get enriched data. `galleryService.listGalleries`/`fetchGalleries` in `frontend/src/services/galleryService.ts`.

---

## Review outcome (fullstack-ts-reviewer)

**No Critical/High blockers.** SQL correct + parameterized, no cross-admin leak, public token route correctly left lean, other `Gallery.find` callers (`productOrders.js`, `settings.js`, selections, images) still get lean objects.

**Applied from review:**
- ✅ Medium #2 — capped submissions to latest + dropped `image_comments` from list query (was unbounded payload).
- ✅ Low #5 — flat `galleries` invalidation in delete-submission mutations.

**Noted, NOT applied (optional / pre-existing):**
- Low #4 — `useGalleryUpload.ts` / `useImageDeletion.ts` don't invalidate the galleries list, so card thumbnails refresh only on 30s `staleTime` after upload/delete. Pre-existing; behavior actually improved (old preview staleTime was 5min). Add `invalidateQueries({ queryKey: queryKeys.galleries })` to both hooks if you want instant refresh.
- Medium #1 — public token route contract change (the field strip above). Mention in PR.

---

## Verification state

- ✅ `node -e "require('./src/models/Gallery.js'); require('./src/routes/galleries.js')"` — loads clean.
- ✅ Submission column names verified against `backend/src/db/schema.sql` (lines 71-76).
- ✅ Frontend `npx tsc --noEmit` — exit 0.
- ✅ Frontend `npx eslint` on touched files — exit 0.
- ✅ Frontend `npm run test` (vitest) — passes (only 1 trivial test exists).
- ⚠️ **Backend `npm test` NOT run** — all backend tests are integration tests gated on a live `DATABASE_URL` (they `throw` on startup without it). **Run against a real DB before merge.**
- ⬜ **No runtime/manual verification** — backend wasn't started against a DB. Recommend: load the dashboard + a client-detail page, confirm thumbnails + "X selected" strips render and Network shows ONE `/api/galleries` call (not 2N).

---

## Suggested commit (when ready)
```
perf(galleries): eliminate N+1 on gallery list (2N requests → 1)

GET /api/galleries now embeds previewImages (≤5) + latest submission per
gallery via ~4 batched queries (ROW_NUMBER windows + id = ANY), replacing
1 + 2N. Frontend cards/thumbs read embedded data instead of per-card fetches.
Public token route now strips adminId/clientId/deliveryOf (hardening).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## Next up (resume here)

**Bottleneck #2 (recommended next — cheap, high impact):**
- Confirm `S3_PUBLIC_URL` is set in production so images go direct-to-CDN (not streamed through Node `/api/media`). See `frontend/src/lib/api.ts:35` (`getImageUrl`) and `backend/src/routes/media.js`.
- Fix `Cache-Control` in `backend/src/routes/media.js:63` — currently `private, max-age=3600`. Image filenames are content-hashed → safe to use `public, max-age=31536000, immutable`.
- Measure: repeat-load transfer size / cache hits in Network panel; Node CPU under image load.

**Bottleneck #4:** `cleanupNonSelectedOriginals` in `backend/src/routes/galleries.js` (~line 32-65) — batch the path-null UPDATE into one `WHERE id = ANY($1)`, parallelize S3 deletes with `p-limit` (already a dep) or bulk `DeleteObjects`.

**Bottleneck #5:** run `rollup-plugin-visualizer` on a `vite build`, lazy-`import()` Tiptap (blog editor) and jszip (ZIP download).

**Golden rule (performance-profiler skill):** always measure baseline → fix → measure again. Don't optimize without a before/after number.
