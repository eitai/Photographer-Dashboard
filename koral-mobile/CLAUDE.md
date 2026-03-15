# koral-mobile — React Native Monorepo Claude Instructions

> Parent monorepo context: see `../CLAUDE.md`

## Commands
```bash
# From koral-mobile/
pnpm install
pnpm admin           # Expo Go — admin app (port varies)
pnpm client          # Expo Go — client gallery app
pnpm admin:android   # Android emulator
pnpm admin:ios       # iOS simulator
pnpm client:android
pnpm client:ios
pnpm typecheck       # TypeScript check across all workspaces
pnpm lint
```

## Workspace Structure
```
apps/
├── admin/           ← Photographer admin app (Expo ~54, RN 0.81)
│   └── app/
│       ├── (app)/   ← Protected tabs (home, galleries, clients, settings)
│       └── (auth)/  ← Login screen
└── client/          ← Gallery viewer app (Expo ~55, RN 0.83)
    └── app/
        ├── gallery/ ← Gallery browser & photo selection
        └── index    ← Token entry screen

packages/
├── api/             ← @koral/api — typed Axios client (shared)
├── types/           ← @koral/types — shared TypeScript interfaces
└── i18n/            ← @koral/i18n — Hebrew + English translations
```

## Shared Packages

### `@koral/types`
Central source of truth for domain models. Change here first; both apps consume these types.

### `@koral/api`
Typed Axios client wrapping all backend endpoints. Both apps import from here.
```ts
import { api } from '@koral/api'
const galleries = await api.galleries.list()
```

### `@koral/i18n`
Same translation keys as the web app. Use the same hook pattern:
```ts
import { useI18n } from '@koral/i18n'
const { t, dir } = useI18n()
```

## Key Conventions
- **Routing**: Expo Router (file-based, like Next.js) — add screens by creating files in `app/`
- **Auth**: Tokens stored in Expo Secure Store (never AsyncStorage for sensitive data)
- **Push notifications**: Admin app registers token on login; backend sends via Expo Push API
- **State**: Zustand for client state, TanStack Query for server state (same as web)
- **RTL**: Test every screen in Hebrew (RTL) mode

## After Changing a Shared Package
```bash
cd koral-mobile
pnpm typecheck       # Verify no type errors across all apps
```
