# Koral Light Studio — Monorepo Claude Instructions

## Repository Structure

```
Photographer-Dashboard/
├── backend/              ← Express.js + MongoDB REST API (port 5000)
├── koral-light-studio/   ← React + Vite + TypeScript web dashboard (port 8080)
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
cd koral-light-studio
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
| Backend | Express 4, MongoDB (Mongoose), JWT, Multer, Sharp |
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
| `backend-api-guardian` | Express routes, MongoDB models, auth, file upload |
| `devops-infrastructure-engineer` | Docker, CI/CD, env config, deployment |
| `product-design-architect` | Design system, tokens, UX patterns |
| `fullstack-ts-reviewer` | Code review, TypeScript, performance |

Go **direct** to a specialist for clearly scoped single-layer tasks.

## Key Conventions

### Authentication
- JWT stored in `localStorage` as `koral_admin_token` + `koral_admin_user`
- All admin API requests use `Authorization: Bearer <token>` via Axios interceptor
- On 401 → interceptor clears storage and redirects to `/admin` (login)
- Mobile: tokens in Expo Secure Store

### API Communication
- Web API base URL: `VITE_API_URL` env var (defaults to `http://localhost:5000/api`)
- All API logic lives in `koral-light-studio/src/lib/api.ts`
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
- Backend: Multer → Sharp (resize/optimize) → `/uploads/` static dir
- Max: 1000 images per gallery, 20MB per file
- Frontend ZIP: jszip from selected images

### Mobile Shared Packages
- Types changed in `@koral/types` propagate to both apps and the API package
- Run `pnpm typecheck` from `koral-mobile/` after any shared package changes

## Environment Variables

### Backend (`backend/.env`)
```
MONGODB_URI=
JWT_SECRET=
SMTP_USER=       # Gmail
SMTP_PASS=
PORT=5000
```

### Frontend (`koral-light-studio/.env`)
```
VITE_API_URL=http://localhost:5000/api
```

## Critical Rules
- **No mock data** — use real MongoDB connections; never fake API responses
- **No console.log in commits** — clean up before committing
- **Never commit .env files**
- **Gallery tokens** are generated server-side; never generate client-side
- **Admin IDs** must be attached to all content models (galleries, clients, posts)
- **RTL support** — every new UI component must work in both `dir="ltr"` and `dir="rtl"`
