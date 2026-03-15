# Koral Mobile — React Native Monorepo

This monorepo holds the two Expo apps for the Koral Photography platform, plus the shared packages they consume. It sits alongside the existing web repos:

```
store test/
  koral-light-studio/   <- React + Vite web frontend
  backend/              <- Express.js API (port 5000)
  koral-mobile/         <- This repo
    apps/
      admin/            <- Photographer management app
      client/           <- Client gallery viewer app
    packages/
      api/              <- Shared typed Axios client
      i18n/             <- Shared Hebrew/English translations
      types/            <- Shared TypeScript interfaces
```

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 18 | https://nodejs.org |
| pnpm | 10 | `npm install -g pnpm` |
| EAS CLI | 10 | `npm install -g eas-cli` |
| Expo Go | Latest | App Store / Google Play (for development) |

---

## First-Time Setup

```bash
cd koral-mobile
pnpm install
```

This installs all workspace dependencies across both apps and all packages in a single pass.

---

## Environment Variables — LAN IP Requirement

Physical iOS and Android devices cannot reach `localhost` — `localhost` on a device refers to the device itself, not your development machine.

You must use your machine's **LAN IP address** (e.g. `192.168.1.42`).

**How to find your LAN IP:**

- Windows: run `ipconfig` in a terminal, look for "IPv4 Address" under your Wi-Fi adapter
- macOS: run `ipconfig getifaddr en0`
- Linux: run `ip addr show`

Your device and your development machine must be on the **same Wi-Fi network**.

**Setup steps:**

```bash
# Copy the example env file into each app
cp apps/admin/.env.example apps/admin/.env
cp apps/client/.env.example apps/client/.env

# Edit both files and replace 192.168.X.X with your actual LAN IP
# Example: EXPO_PUBLIC_API_URL=http://192.168.1.42:5000
```

The variable is named `EXPO_PUBLIC_API_URL` — the `EXPO_PUBLIC_` prefix is required by Expo for variables to be accessible in app code.

---

## Running in Development (Expo Go)

### Admin app (photographer management)

```bash
# From the monorepo root
pnpm admin

# Or from the app directory
cd apps/admin
pnpm start
```

Then scan the QR code with Expo Go on your device, or press `a` for Android emulator / `i` for iOS simulator.

### Client app (gallery viewer)

```bash
# From the monorepo root
pnpm client

# Or from the app directory
cd apps/client
pnpm start
```

### Platform-specific shortcuts

```bash
pnpm admin:android   # Open admin app on Android
pnpm admin:ios       # Open admin app on iOS simulator (macOS only)
pnpm client:android  # Open client app on Android
pnpm client:ios      # Open client app on iOS simulator (macOS only)
```

---

## Building with EAS

EAS Build produces production-grade binaries using Expo's cloud build infrastructure. You do not need Xcode or Android Studio installed locally.

### One-time EAS project setup

```bash
npm install -g eas-cli
eas login

# Run once per app to generate a project ID — paste the ID into app.json extra.eas.projectId
cd apps/admin && eas init
cd ../client && eas init
```

### Development build (includes dev client, internal distribution)

```bash
# Admin app
cd apps/admin
eas build --profile development --platform android
eas build --profile development --platform ios

# Client app
cd apps/client
eas build --profile development --platform all
```

### Preview build (APK for Android, ad-hoc for iOS)

Preview builds are suitable for internal testing without going through the App Store / Google Play review process.

```bash
cd apps/admin
eas build --profile preview --platform all
```

### Production build

```bash
cd apps/admin
eas build --profile production --platform all

cd apps/client
eas build --profile production --platform all
```

`autoIncrement: true` in `eas.json` automatically bumps the build number on each production build.

---

## Submitting to App Store / Google Play

### Prerequisites

**Android — Google Play:**
1. Create a service account in the Google Play Console and download the JSON key.
2. Place the key at `apps/admin/google-play-key.json` (and `apps/client/google-play-key.json`).
3. Do not commit this file — add it to `.gitignore`.

**iOS — App Store Connect:**
1. Update the `submit.production.ios` section in `eas.json` with your Apple ID, App Store Connect App ID, and Team ID.

### Submit

```bash
# Submit the latest build for the admin app
cd apps/admin
eas submit --platform android --latest
eas submit --platform ios --latest

# Submit the latest build for the client app
cd apps/client
eas submit --platform android --latest
eas submit --platform ios --latest
```

The `--latest` flag picks up the most recent successful build automatically.

---

## Push Notifications (Admin App)

The admin app registers for push notifications so photographers receive an alert when a client submits a gallery selection.

### How it works

1. On first launch after login, `usePushNotifications` (in `apps/admin/hooks/`) requests permission from the OS.
2. If granted, it calls `Notifications.getExpoPushTokenAsync()` to obtain an Expo push token and then posts it to `POST /api/auth/push-token` on the backend.
3. The backend stores the token on the Admin MongoDB document.
4. When a client submits a selection (`POST /api/galleries/:galleryId/submit`), the backend calls the Expo Push API (`https://exp.host/--/api/v2/push/send`) with the stored token.
5. The photographer receives a notification with the client's name. Tapping it navigates to the Selections tab.

### Limitations

- Push notifications require a **physical device**. They are silently skipped on simulators and in Expo Go (development builds support them fully).
- The Expo push token changes when the app is reinstalled. The app re-registers on every login automatically.
- For production, consider wrapping the Expo Push API call in a retry with exponential back-off and persisting failed deliveries.

---

## Workspace Structure

### Apps

| App | Package name | Bundle ID |
|-----|-------------|-----------|
| `apps/admin` | `@koral/admin` | `com.koral.admin` |
| `apps/client` | `@koral/client` | `com.koral.client` |

### Shared Packages

| Package | Description |
|---------|-------------|
| `packages/api` (`@koral/api`) | Typed Axios client — mirrors the Express API at `backend/` |
| `packages/i18n` (`@koral/i18n`) | Hebrew/English translation strings |
| `packages/types` (`@koral/types`) | TypeScript interfaces for domain models (Admin, Gallery, Client, BlogPost) |

Packages are referenced with the `workspace:*` protocol so pnpm links them locally without publishing to npm:

```json
"dependencies": {
  "@koral/api": "workspace:*",
  "@koral/i18n": "workspace:*",
  "@koral/types": "workspace:*"
}
```

---

## TypeScript

Run type checking across all packages and apps:

```bash
pnpm typecheck
```

---

## Design Tokens

Consistent with the web frontend:

| Token | Hex |
|-------|-----|
| Blush (accent) | `#E7B8B5` |
| Ivory (background) | `#FAF8F4` |

---

## Client Status Pipeline

`gallery_sent` -> `viewed` -> `selection_submitted` -> `in_editing` -> `delivered`

This pipeline is defined in `@koral/types` and mirrors the backend model.
