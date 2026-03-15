# DevOps Infrastructure Engineer — Agent Memory

## Project: Koral Photography

### Repository Layout
- `c:/Users/eitai/Desktop/codevalue/store test/koral-light-studio/` — React + Vite web frontend
- `c:/Users/eitai/Desktop/codevalue/store test/backend/` — Express.js API (port 5000)
- `c:/Users/eitai/Desktop/codevalue/store test/koral-mobile/` — React Native monorepo (created 2026-03-09)

### Mobile Monorepo (koral-mobile)
- Package manager: pnpm 10 workspaces
- `apps/admin` → `@koral/admin`, bundle ID `com.koral.admin` (Expo ~55, RN 0.83)
- `apps/client` → `@koral/client`, bundle ID `com.koral.client` (Expo ~55, RN 0.83)
- Shared packages: `@koral/api`, `@koral/i18n`, `@koral/types` (workspace:* protocol)
- Key env var: `EXPO_PUBLIC_API_URL` must be LAN IP (not localhost) for physical devices

### Tooling Versions Confirmed on This Machine
- Node.js: 22.16.0
- pnpm: 10.31.0 (installed globally via npm)
- create-expo-app: 3.5.3 (bootstraps with npm by default — delete package-lock.json after)

### Patterns
- `create-expo-app --template blank-typescript` leaves a `package-lock.json` — always delete it when using pnpm workspaces
- Run `pnpm install` from the workspace root after all app package.json files are updated to wire symlinks

### EAS Build (Phase 5, 2026-03-09)
- `eas.json` lives per-app: `apps/admin/eas.json` and `apps/client/eas.json`
- Profiles: development (developmentClient, internal), preview (APK), production (autoIncrement)
- `.env.example` in each app explains LAN IP requirement
- EAS CLI >= 10 required; run `eas init` once per app to populate `extra.eas.projectId` in app.json

### Push Notifications (Phase 5, 2026-03-09)
- Hook: `apps/admin/hooks/usePushNotifications.ts` (expo-notifications + expo-device)
- Called in: `apps/admin/app/(app)/_layout.tsx` (authenticated context only)
- Backend: `POST /api/auth/push-token` route added to `backend/src/routes/auth.js`
- Backend: Admin model (`backend/src/models/Admin.js`) has `pushToken` field (nullable String)
- Trigger: selection submit route (`backend/src/routes/selections.js`) sends push via Expo Push API
- Push delivery: fire-and-forget fetch to `https://exp.host/--/api/v2/push/send`
- Android channel id: `selections`; gracefully skipped on simulators / denied permission

### TanStack Query Offline Config (Phase 5, 2026-03-09)
- Applied to both `apps/admin/app/_layout.tsx` and `apps/client/app/_layout.tsx`
- queries: staleTime 2 min, gcTime 10 min, retry 1, retryDelay 1000, networkMode offlineFirst
- mutations: retry 0, networkMode always

### Design Tokens (shared across web + mobile)
- Blush accent: `#E7B8B5`
- Ivory background: `#FAF8F4`
