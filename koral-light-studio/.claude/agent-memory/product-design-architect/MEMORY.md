# Product Design Architect — Persistent Memory

## Active Projects
- **Web**: `koral-light-studio/` — React + Vite + TypeScript + Tailwind + shadcn/ui
- **Mobile**: `koral-mobile/apps/admin/` — Expo + React Native + TypeScript (no Tailwind)

## Brand Tokens (canonical)
| Token       | Hex       | Usage                                      |
|-------------|-----------|--------------------------------------------|
| Blush       | `#E7B8B5` | Primary accent, buttons, focus borders     |
| Ivory       | `#FAF8F4` | App/page background                        |
| Charcoal    | `#2D2D2D` | Primary text, text on blush                |
| Beige       | `#C8B8A2` | Muted text, placeholders, borders          |
| Border      | `#E8E0D8` | Input/divider borders (warm light grey)    |

## Mobile Design System (koral-mobile)
- **Token file**: `apps/admin/theme/index.ts` — single source of truth; StyleSheet-compatible
- **UI components**: `apps/admin/components/ui/` — Button, Card, Input, StatusBadge + barrel index.ts
- `GalleryStatus` type imported from `@koral/types` (do not redefine locally)
- Touch targets: minimum 44dp height on all interactive elements (WCAG 2.5.5)
- Shadow pattern: spread `shadows.sm/md/lg` from theme directly into StyleSheet rules

## Mobile Button System
- `primary` — Blush bg (`#E7B8B5`), Charcoal text, semibold
- `secondary` — Transparent bg, Blush border 1.5px, Blush text
- `ghost` — No bg/border, Blush text
- `size_md` minHeight 44, `size_lg` minHeight 52
- Disabled: `opacity: 0.45` layered on top of variant styles

## StatusBadge Colour Map (mobile)
| Status               | Background | Text      |
|----------------------|------------|-----------|
| gallery_sent         | `#F7E4E3`  | `#8B3A38` |
| viewed               | `#DDEEF9`  | `#1A5276` |
| selection_submitted  | `#FEF0D9`  | `#784212` |
| in_editing           | `#EDE3F5`  | `#512E77` |
| delivered            | `#D5F0E0`  | `#1A5C36` |
All pairs verified ≥4.5:1 contrast on their respective backgrounds.
Note: raw Blush (#E7B8B5) CANNOT be used as a badge background — it fails 4.5:1
for 11pt text. Use the lighter tinted surface (#F7E4E3) instead.

## Spacing Grid
8pt base (xs:4, sm:8, md:16, lg:24, xl:32, xxl:48) — same on web and mobile.

## Key Conventions
- Web uses Tailwind utility classes; mobile uses `StyleSheet.create` + theme tokens
- Import order in RN components: React → RN core → expo packages → @koral/* → local theme
- `_layout.tsx` migrated to theme tokens (colors.background, colors.primary) — no raw hex
- TypeScript strict mode enabled on all packages; `npx tsc --noEmit` passes clean

## Pipeline Status (client/gallery)
`gallery_sent → viewed → selection_submitted → in_editing → delivered`

## Detailed Notes
See `patterns.md` for component anatomy and accessibility decisions.
