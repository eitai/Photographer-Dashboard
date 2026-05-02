# Koral Light Studio — Monorepo Claude Instructions

## Repository Structure

```
Photographer-Dashboard/
├── backend/              ← Express.js + PostgreSQL REST API (port 5000)
├── frontend/             ← React + Vite + TypeScript web dashboard (port 8080)
└── koral-mobile/         ← React Native monorepo (Expo apps + shared packages)
    ├── apps/admin/       ← Photographer admin app (Expo ~54)
    ├── apps/client/      ← Gallery viewer app (Expo ~55)
    └── packages/         ← @koral/api, @koral/types, @koral/i18n
```

## Essential Commands

### Backend
```bash
cd backend
npm install
npm run dev          # nodemon on port 5000
```

### Frontend (Web)
```bash
cd frontend
npm install
npm run dev          # Vite on port 8080
npm run build
npm run test         # vitest run
npm run lint
```

### Mobile
```bash
cd koral-mobile
pnpm install
pnpm admin           # Expo Go — photographer admin app
pnpm client          # Expo Go — client gallery app
pnpm typecheck
pnpm lint
```

### First-time seed
```bash
curl -X POST http://localhost:5000/api/auth/seed
# Then login at http://localhost:8080/admin
```

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Express 4, PostgreSQL (pg), JWT, Multer, Sharp |
| Web Frontend | React 18, Vite 5, TypeScript 5, Tailwind 3, shadcn/ui, Zustand, TanStack Query |
| Mobile | React Native 0.81/0.83, Expo, Expo Router, Zustand, TanStack Query |
| Shared | `@koral/api` (typed Axios client), `@koral/types`, `@koral/i18n` |

## What This App Does

**Koral Light Studio** is a photography business management platform:
- Photographers upload galleries and share unique token links with clients
- Clients browse their private gallery and submit photo selections
- Photographers track status pipeline: `Gallery Sent → Viewed → Selection Submitted → In Editing → Delivered`
- Public landing pages per photographer with 11 configurable themes
- Blog system with Tiptap rich text editor
- Product ordering (albums, prints, canvases)
- Full Hebrew (RTL) + English (LTR) support

## Agent Routing

Route through `product-orchestrator` for any cross-layer or multi-step work.

| Agent | Scope |
|---|---|
| `product-orchestrator` | Feature planning, multi-layer tasks, architecture decisions |
| `react-frontend-engineer` | React components, hooks, Tailwind, shadcn/ui |
| `backend-api-guardian` | Express routes, PostgreSQL models, auth, file upload |
| `devops-infrastructure-engineer` | Docker, CI/CD, env config, deployment |
| `product-design-architect` | Design system, tokens, UX patterns |
| `fullstack-ts-reviewer` | Code review, TypeScript, performance |

Go **direct** to a specialist for clearly scoped single-layer tasks.

---

## Backend API Route Inventory

Route files live in `backend/src/routes/`. Middleware: `protect` = JWT auth required, `superprotect` = superadmin only, `checkQuota` = storage limit check.

### Auth — `routes/auth.js`
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | Email/password login, sets httpOnly cookie |
| POST | `/api/auth/logout` | Clears session cookie |
| GET | `/api/auth/me` | [protect] Current admin profile |
| PUT | `/api/auth/password` | [protect] Change password |
| POST | `/api/auth/push-token` | [protect] Store Expo push token |
| PATCH | `/api/auth/profile` | [protect] Update name/studioName/username |
| POST | `/api/auth/seed` | Init first superadmin (no-op if admins exist) |
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback (login + account linking) |
| GET | `/api/auth/google/link` | [protect] Start account linking flow |
| DELETE | `/api/auth/google/link` | [protect] Unlink Google account |
| PATCH | `/api/auth/sso` | [protect] Toggle SSO enabled flag |

### Admins — `routes/admins.js` (superprotect)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admins` | List all admins with storage stats |
| POST | `/api/admins` | Create admin, auto-seeds product catalog |
| DELETE | `/api/admins/:id` | Delete admin |
| GET | `/api/admins/:id/settings` | Get admin's landing page settings |
| PATCH | `/api/admins/:id` | Update profile (name, email, etc.) |
| PUT | `/api/admins/:id/landing` | Update landing page fields |
| POST | `/api/admins/:id/hero-image` | [upload] Replace hero image |
| POST | `/api/admins/:id/profile-image` | [upload] Replace profile image |
| GET | `/api/admins/:id/storage` | Storage usage stats |
| PATCH | `/api/admins/:id/quota` | Set storage quota in GB |

### Clients — `routes/clients.js` (protect)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/clients` | List clients for current admin |
| POST | `/api/clients` | Create client |
| GET | `/api/clients/:id` | Get client |
| PUT | `/api/clients/:id` | Update client |
| DELETE | `/api/clients/:id` | Delete client |

### Galleries — `routes/galleries.js` (protect)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/galleries/token/:token` | **PUBLIC** — fetch by token, marks as viewed |
| GET | `/api/galleries` | List galleries, optional `?clientId=` filter |
| POST | `/api/galleries` | Create gallery, auto-sends email/SMS |
| POST | `/api/galleries/:id/delivery` | Create delivery gallery from selection |
| POST | `/api/galleries/:id/resend-email` | Resend gallery link email |
| POST | `/api/galleries/:id/send-sms` | Send gallery link SMS |
| GET | `/api/galleries/:id` | [protect] Gallery details |
| PUT | `/api/galleries/:id` | [protect] Update gallery, validates status transitions |
| POST | `/api/galleries/:id/reactivate` | Reset to "viewed" status |
| DELETE | `/api/galleries/:id` | Delete gallery + S3/disk cleanup |
| POST | `/api/galleries/:id/video` | [upload, checkQuota] Upload up to 20 videos |
| DELETE | `/api/galleries/:id/video/:filename` | Remove specific video |

### Images — `routes/images.js` (protect, checkQuota for uploads)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/galleries/:galleryId/images` | **PUBLIC** — list images, supports `?limit=&page=` |
| POST | `/api/galleries/:galleryId/images` | [upload] Batch upload up to 5000, generates thumbnails |
| PATCH | `/api/galleries/:galleryId/images/:imageId/before` | [upload] Upload before-comparison image |
| DELETE | `/api/galleries/:galleryId/images/:imageId` | Delete image + all variants |

### Selections — `routes/selections.js`
| Method | Path | Notes |
|---|---|---|
| POST | `/api/galleries/:galleryId/submit` | **PUBLIC** — client submits selection, triggers push |
| GET | `/api/galleries/:galleryId/submissions` | [protect] List submissions |
| DELETE | `/api/galleries/:galleryId/submissions/:submissionId` | [protect] Delete submission |
| DELETE | `/api/galleries/:galleryId/submissions/:submissionId/images/:imageId` | [protect] Remove one image |

### Blog — `routes/blog.js` (protect)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/blog` | List posts (content excluded) |
| GET | `/api/blog/count` | Count published posts |
| GET | `/api/blog/:id` | Get post |
| POST | `/api/blog` | [upload] Create post with optional featured image |
| PUT | `/api/blog/:id` | [upload] Update post |
| DELETE | `/api/blog/:id` | Delete post |

### Contact — `routes/contact.js`
| Method | Path | Notes |
|---|---|---|
| POST | `/api/contact` | **PUBLIC** — submit contact form |
| GET | `/api/contact` | [protect] List submissions |
| DELETE | `/api/contact/:id` | [protect] Delete submission |

### Settings — `routes/settings.js` (protect)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings/featured` | Featured gallery IDs |
| PUT | `/api/settings/landing` | Landing page fields (bio, phone, theme…) |
| PUT | `/api/settings/services` | Services section (enabled + items, max 8) |
| PUT | `/api/settings/testimonials` | Testimonials (enabled + items, max 12) |
| PUT | `/api/settings/packages` | Packages (enabled + items, max 4) |
| PUT | `/api/settings/video` | Video section (validates YouTube/Vimeo URL) |
| PUT | `/api/settings/cta-banner` | CTA banner config |
| PUT | `/api/settings/contact-section` | Contact section config |
| PUT | `/api/settings/instagram-feed` | Toggle + reorder Instagram feed |
| POST | `/api/settings/instagram-feed-image` | [upload] Append feed image |
| DELETE | `/api/settings/instagram-feed-image/:index` | Remove feed image by index |
| PUT | `/api/settings/notifications` | Toggle auto email/SMS |
| POST | `/api/settings/hero-image` | [upload] Replace hero image |
| POST | `/api/settings/profile-image` | [upload] Replace profile image |
| POST | `/api/settings/logo-image` | [upload] Replace logo image |
| DELETE | `/api/settings/logo-image` | Remove logo image |

### Public Photographer Profile — `routes/public.js`
| Method | Path | Notes |
|---|---|---|
| GET | `/api/p/:id` | **PUBLIC** — photographer profile |
| GET | `/api/p/:id/settings` | **PUBLIC** — landing page settings |
| GET | `/api/p/:id/blog` | **PUBLIC** — published blog posts |
| GET | `/api/p/:id/blog/:slug` | **PUBLIC** — blog post by slug |
| POST | `/api/p/:id/contact` | **PUBLIC** — contact form |

### Product Orders — `routes/productOrders.js`
| Method | Path | Notes |
|---|---|---|
| GET | `/api/product-orders/gallery/:token` | **PUBLIC** — orders for gallery token |
| PUT | `/api/product-orders/:id/selection` | **PUBLIC** — client submits photo selection |
| GET | `/api/product-orders` | [protect] List orders for admin |
| POST | `/api/product-orders` | [protect] Create order |
| DELETE | `/api/product-orders/:id` | [protect] Delete order |

### Admin Products — `routes/adminProducts.js` (protect)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin-products` | List catalog, auto-seeds defaults on first call |
| POST | `/api/admin-products` | Add product (album or print) |
| DELETE | `/api/admin-products/:id` | Remove product |

### Other
| Method | Path | File | Notes |
|---|---|---|---|
| GET | `/api/storage/me` | `routes/storage.js` | [protect] Admin's storage usage |
| GET | `/api/media/*` | `routes/media.js` | **PUBLIC** — proxy S3 presigned URLs, supports Range |

---

## Backend Models

Files in `backend/src/models/`. All use raw SQL (pg), no ORM.

| Model | Key Fields |
|---|---|
| `Admin.js` | id, name, email, password(bcrypt), role(admin\|superadmin), username, studioName, pushToken, googleId, ssoEnabled, storageQuotaBytes |
| `Client.js` | id, adminId, name, phone, email, sessionType, notes, status(gallery_sent\|viewed\|selection_submitted\|delivered) |
| `Gallery.js` | id, adminId, clientId, clientName, name, headerMessage, isActive, status(draft→gallery_sent→viewed→selection_submitted→in_editing→delivered), token, expiresAt, maxSelections, isDelivery, deliveryOf, videos(JSONB) |
| `GalleryImage.js` | id, galleryId, filename, originalName, path(S3 key or local), thumbnailPath, previewPath, beforePath, sortOrder, size |
| `GallerySubmission.js` | id, galleryId, sessionId, selectedImageIds(UUID[]), clientMessage, imageComments(JSONB), heroImageId, submittedAt |
| `BlogPost.js` | id, adminId, title, slug(auto+timestamp), content, featuredImagePath, seoTitle, seoDescription, category, published, publishedAt |
| `ContactSubmission.js` | id, adminId, name, phone, email, sessionType, message |
| `SiteSettings.js` | adminId, bio, heroImagePath, profileImagePath, logoImagePath, phone, theme, featuredImageIds(UUID[]), services(JSONB), testimonials(JSONB), packages(JSONB), instagramFeedImages(text[]), autoSendGalleryEmail, autoSendGallerySms — plus ~25 more landing page fields |
| `ProductOrder.js` | id, adminId, clientId, name, type(album\|print), maxPhotos, allowedGalleryIds, selectedPhotoIds[], status(pending\|submitted) |
| `AdminProduct.js` | adminId, name, type(album\|print), maxPhotos |

---

## Backend Services

| File | Purpose |
|---|---|
| `services/emailService.js` | `sendGalleryLink()` — HTML email via Nodemailer SMTP, Hebrew/English, CTA button |
| `services/smsService.js` | `sendGallerySms()` — SMS via Twilio, normalizes Israeli numbers (05x → +9725x) |

---

## Frontend Key Files

| File | Purpose |
|---|---|
| `src/lib/api.ts` | Axios instance (withCredentials, 401 interceptor). Exports: `API_BASE`, `getImageUrl(path)`, `verifyAuth()`, `getMyStorage()`, `getAdminStorage(id)`, `setAdminQuota(id, gb)` |
| `src/lib/i18n.tsx` | Custom i18n context. Hook: `useI18n()` → `{ lang, dir, toggleLang, t }`. ~470 translation keys |
| `src/store/authStore.ts` | Zustand. State: `admin`, `loading`, `theme`. Methods: `login()`, `logout()`, `setAdmin()`, `setTheme()`. Cookie-first auth (httpOnly) |

---

## Frontend Pages

### Admin Pages — `src/pages/admin/`
| File | Purpose |
|---|---|
| `AdminLogin.tsx` | Login form with Google SSO option |
| `AdminDashboard.tsx` | Stats, recent activity, quick add client |
| `AdminClients.tsx` | Client list — search, status badges, CRUD |
| `AdminClientDetail.tsx` | Single client view/edit |
| `AdminGalleries.tsx` | Gallery list with status, filtering, viewer |
| `AdminGalleryUpload.tsx` | Batch gallery creation + image upload |
| `AdminSelections.tsx` | Gallery submissions, selected photos, export |
| `AdminBlog.tsx` | Blog post list, publish/unpublish |
| `AdminBlogEditor.tsx` | Tiptap rich-text editor, featured image upload |
| `AdminContact.tsx` | Contact form submissions list |
| `AdminSettings.tsx` | Full landing page config: hero/profile images, services, testimonials, packages, video, CTA banner, Instagram feed, notification toggles |
| `AdminShowcase.tsx` | Manage featured portfolio images |
| `AdminUsers.tsx` | [Superadmin] Create/delete admins, set storage quotas |

### Photographer Public Pages — `src/pages/photographer/`
| File | Purpose |
|---|---|
| `PhotographerHome.tsx` | Hero, about, testimonials, CTA |
| `PhotographerPortfolio.tsx` | Portfolio gallery with category filters |
| `PhotographerBlog.tsx` | Published blog posts list |
| `PhotographerBlogPost.tsx` | Full blog post with featured image |
| `PhotographerContact.tsx` | Contact form |

### Client-Facing & Other
| File | Purpose |
|---|---|
| `ClientGallery.tsx` | Main gallery viewer, selection checkboxes, submit flow |
| `ClientProductsPage.tsx` | Product orders, photo selection for prints/albums |
| `Index.tsx` | Home/landing page |
| `NotFound.tsx` | 404 |

---

## Frontend Components

### `src/components/admin/`
| File | Purpose |
|---|---|
| `AdminLayout.tsx` | Sidebar + nav wrapper |
| `AdminSidebar.tsx` | Navigation sidebar |
| `ProtectedRoute.tsx` | Auth guard → redirect to login |
| `AddGalleryModal.tsx` | Create new gallery modal |
| `GalleryCard.tsx` | Gallery preview card (status, thumb, actions) |
| `GalleryGrid.tsx` | Responsive grid of gallery cards |
| `ImageGrid.tsx` | Admin image upload + sorting grid |
| `AdminGalleryLightbox.tsx` | Image viewer with select/deselect |
| `BulkActionBar.tsx` | Multi-select actions bar |
| `SubmissionsSection.tsx` | Client submissions + selected photos |
| `ProductOrdersSection.tsx` | Manage product orders |
| `GalleriesSection.tsx` | Gallery list section on dashboard |
| `DeleteConfirmModal.tsx` | Confirmation dialog for destructive actions |
| `ClientInfoCard.tsx` | Client details card |
| `StorageBar.tsx` | Visual storage quota bar |
| `QuotaSlider.tsx` | Adjust storage quota |
| `StatusBadge.tsx` | Gallery/client status indicator |
| `SSOSetupModal.tsx` | Google SSO account linking flow |

### `src/components/gallery/`
| File | Purpose |
|---|---|
| `SelectionGallery.tsx` | Client gallery viewer with selection checkboxes |
| `DeliveryGallery.tsx` | Final delivery gallery view |
| `Lightbox.tsx` | Full-screen image viewer with navigation |
| `VirtualizedGalleryGrid.tsx` | Virtualized grid for large galleries |
| `BeforeAfterSlider.tsx` | Before/after image comparison slider |
| `ProductOrdersClient.tsx` | Client interface for product photo selection |

### Other
| File | Purpose |
|---|---|
| `Navbar.tsx` | Top nav — language toggle, auth, menu |
| `Footer.tsx` | Footer with branding + links |
| `ErrorBoundary.tsx` | Error boundary wrapper |
| `FadeIn.tsx` | Fade-in animation wrapper |
| `ui/` | shadcn/ui primitives (button, card, dialog, input, select, tabs, toast…) |

---

## Frontend Hooks — `src/hooks/`

| File | Purpose |
|---|---|
| `useAuth.tsx` | Sync authStore with /auth/me, handle first-login SSO setup |
| `useGalleryData.ts` | Fetch gallery + images via React Query |
| `useGalleryUpload.ts` | Batch image upload with progress |
| `useImageDeletion.ts` | Delete image from gallery |
| `useVideoUpload.ts` | Upload videos to gallery |
| `useBeforeImageUpload.ts` | Upload before-comparison image |
| `useSearch.ts` | Filter/search clients, galleries, blog posts |
| `useTablePagination.ts` | Pagination logic for tables |
| `useDeleteConfirmation.ts` | Modal state for delete confirmations |
| `useModal.ts` | Generic modal open/close state |
| `use-mobile.tsx` | Detect mobile viewport (max 768px) |
| `use-toast.ts` | Toast notification API (shadcn/ui) |

---

## Mobile App Structure — `koral-mobile/`

### apps/admin (photographer dashboard)
```
app/(auth)/login.tsx              ← Login screen
app/(app)/_layout.tsx             ← Tab navigator (dashboard, galleries, clients, settings)
app/(app)/dashboard.tsx
app/(app)/galleries/[id].tsx      ← Gallery detail/editor
app/(app)/clients/[id].tsx        ← Client detail
app/(app)/blog/[id].tsx           ← Blog editor
app/(app)/selections/[galleryId]  ← Selection detail
app/(app)/showcase.tsx
app/(app)/users/                  ← Superadmin user management
app/(app)/settings/               ← Settings + change password
```

### apps/client (gallery viewer)
```
app/index.tsx                     ← Entry / redirect
app/gallery/[token].tsx           ← Gallery viewer + selection
app/submitted.tsx                 ← Post-submission confirmation
```

### packages/
| Package | Purpose |
|---|---|
| `shared-types/` | TypeScript interfaces (AdminUser, Gallery, Client, etc.) |
| `shared-api/` | Axios client for mobile (baseURL, interceptors) |
| `shared-ui/` | Shared components across admin + client apps |

---

## Key Conventions

### Authentication
- JWT stored in `localStorage` as `koral_admin_token` + `koral_admin_user`
- All admin API requests use `Authorization: Bearer <token>` via Axios interceptor
- On 401 → interceptor clears storage and redirects to `/admin` (login)
- Mobile: tokens in Expo Secure Store

### API Communication
- Web API base URL: `VITE_API_URL` env var (defaults to `http://localhost:5000/api`)
- All API logic lives in `frontend/src/lib/api.ts`
- Mobile API in `koral-mobile/packages/api/`

### State Management
- Server state → TanStack React Query (queries + mutations)
- Client UI state → Zustand stores in `src/store/`
- No Redux, no Context for data

### i18n
- Custom React Context (not i18next) — do NOT add i18next
- All translation keys in `src/lib/i18n.tsx` (~470 keys)
- Hook: `const { t, lang, dir } = useI18n()`
- Adding new text: always add both `he` and `en` keys

### Design Tokens
- Primary accent: `blush` = `#E7B8B5`
- Background: `ivory` = `#FAF8F4`
- Heading font: Playfair Display (serif)
- Body font: Inter (sans)
- Use Tailwind classes for all styling — no inline styles

### File Upload
- Backend: Multer → Sharp (resize/optimize) → `/uploads/` static dir or S3
- Max: 1000 images per gallery, 20MB per file
- Frontend ZIP: jszip from selected images

### Gallery Status Pipeline
`draft → gallery_sent → viewed → selection_submitted → in_editing → delivered`
- Status transitions are validated server-side in `PUT /api/galleries/:id`
- Delivery galleries created via `POST /api/galleries/:id/delivery` (isDelivery=true, deliveryOf=sourceId)

### Mobile Shared Packages
- Types changed in `@koral/types` propagate to both apps and the API package
- Run `pnpm typecheck` from `koral-mobile/` after any shared package changes

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=
FRONTEND_URL=
JWT_SECRET=
SMTP_USER=       # Gmail
SMTP_PASS=
PORT=5000
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000/api
```

---

## Critical Rules
- **No mock data** — use real PostgreSQL connections; never fake API responses
- **No console.log in commits** — clean up before committing
- **Never commit .env files**
- **Gallery tokens** are generated server-side; never generate client-side
- **Admin IDs** must be attached to all content models (galleries, clients, posts)
- **RTL support** — every new UI component must work in both `dir="ltr"` and `dir="rtl"`
