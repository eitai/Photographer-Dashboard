# koral-light-studio — Web Frontend Claude Instructions

> Parent monorepo context: see `../CLAUDE.md`

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:8080
npm run build        # Production build → dist/
npm run test         # vitest run (once)
npm run test:watch   # vitest watch mode
npm run lint         # ESLint
```

## Project Structure

```
src/
├── pages/
│   ├── admin/        ← Protected admin dashboard pages
│   └── photographer/ ← Public photographer landing/portfolio pages
├── components/
│   ├── admin/        ← Admin-specific components (galleries, clients, blog)
│   ├── gallery/      ← Gallery viewer, lightbox, image grid
│   └── ui/           ← shadcn/ui base components (do not modify)
├── hooks/            ← useAuth, useI18n, use-mobile, use-toast
├── lib/
│   ├── api.ts        ← ALL Axios API calls live here
│   ├── i18n.tsx      ← Translation keys (he + en), I18nProvider, useI18n
│   └── utils.ts      ← cn() and other utilities
├── services/         ← Business logic (not API calls)
├── store/            ← Zustand stores
└── types/            ← TypeScript interfaces
```

## Agent Routing

| Agent                      | When to use                                              |
| -------------------------- | -------------------------------------------------------- |
| `product-orchestrator`     | New feature spanning design + code, unclear requirements |
| `react-frontend-engineer`  | Components, hooks, pages, forms, routing                 |
| `product-design-architect` | Design system tokens, layout, UX patterns                |
| `fullstack-ts-reviewer`    | Review, TypeScript, performance                          |

## Key Patterns

### New Page

1. Create file in `src/pages/`
2. Add route in `src/App.tsx` (wrap with `<ProtectedRoute>` if admin-only)
3. Add i18n keys for all display text

### New API Call

Add to `src/lib/api.ts` — never call `axios` directly from components. Use React Query `useQuery`/`useMutation` in the component.

### New Component

- Place in `src/components/<feature>/`
- Use shadcn/ui primitives from `src/components/ui/` for base elements
- Style with Tailwind only — no inline styles, no CSS modules
- Must work in both LTR and RTL

### Zustand Store

```ts
// src/store/exampleStore.ts
import { create } from 'zustand'
interface ExampleState { ... }
export const useExampleStore = create<ExampleState>()((set) => ({ ... }))
```

### React Query Pattern

```ts
// Query
const { data, isLoading } = useQuery({
  queryKey: ['galleries'],
  queryFn: () => api.getGalleries(),
})

// Mutation
const mutation = useMutation({
  mutationFn: (data) => api.createGallery(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['galleries'] }),
})
```

### i18n Usage

```tsx
const { t, dir } = useI18n()
// Always add both he and en keys to src/lib/i18n.tsx
<p>{t('gallery.noPhotos')}</p>
```

## Design System

| Token          | Value            | Tailwind class |
| -------------- | ---------------- | -------------- |
| Primary accent | `#E7B8B5`        | `blush`        |
| Background     | `#FAF8F4`        | `ivory`        |
| Heading        | Playfair Display | ``             |
| Body           | Inter            | `font-sans`    |

Themes for photographer landing pages: Soft, Luxury, Bold, Minimal, Warm, Ocean, Forest, Rose, Vintage, Midnight, B&W

## Auth Flow

- Auth is **cookie-first**: the server sets an httpOnly session cookie on login — the JWT never touches JavaScript
- `koral_admin_user` in `localStorage` is a UI-only cache of the `AdminUser` profile object (name, email, role) used to hydrate the Zustand `authStore` for immediate render; `koral_admin_token` is a legacy key that `clearAuthAndRedirect()` removes but is never written by current code
- The Axios instance in `api.ts` is created with `withCredentials: true`; there is **no** request interceptor attaching a Bearer header
- 401 response interceptor calls `clearAuthAndRedirect()`, which removes both localStorage keys then calls `window.location.replace('/admin')` (replace, not push, so the login page is not on the history stack)
- `<ProtectedRoute>` checks the `admin` object from `useAuthStore` (hydrated from the `koral_admin_user` cache); a missing or expired cookie surfaces as a 401 on the next API call, which triggers the redirect

## Testing

- Framework: Vitest + Testing Library
- Test files: `*.test.ts` / `*.test.tsx` alongside source
- Run before committing: `npm run test`
