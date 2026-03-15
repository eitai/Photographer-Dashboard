# Frontend Improvement Opportunities

## Quick Wins (Low effort, high impact)

1. **Accessibility** — Add `aria-label` to all icon-only buttons (Phone, Mail, Instagram icons). Improve focus management in modals and add `aria-modal`, `aria-expanded` attributes.

2. **Type Safety** — Replace `any[]` in `galleryStore.ts` and `clientStore.ts` with proper typed interfaces (Gallery, Client, Submission models).

3. **Error Handling** — Replace `catch { // ignore }` blocks with actual error states and user-facing messages via toasts.

4. **Error Boundaries** — Wrap page sections in Error Boundary components so a failed gallery load doesn't crash the whole admin panel.

---

## Medium Priority

5. **Form Validation** — `react-hook-form` and `zod` are already in `package.json` but unused. Apply them to `AdminClients.tsx`, blog editor, and contact forms.

6. **Split Monolithic Components** — `AdminGalleryUpload.tsx` is 300+ lines. Extract upload logic, lightbox, and deletion into separate hooks/components.

7. **Custom Hooks** — Create reusable hooks for repeated patterns: `useModal()`, `useSearch()`, `useTablePagination()`, `useDeleteConfirmation()`.

8. **Code Splitting** — Add `React.lazy()` + `Suspense` for route-level lazy loading. Pages are currently all loaded upfront.

---

## Longer Term

9. **Testing** — Only one test file exists (`example.test.ts`). Write tests for auth flow, gallery selection, and form validation using Vitest + React Testing Library (already configured).

10. **Image Virtualization** — Large galleries with 1000+ images use masonry without virtualization. Add `react-window` to prevent performance issues on slower devices.

11. **React Query Migration** — Zustand is used for data fetching but without caching/invalidation. Migrate data fetching to React Query hooks for better cache management.

12. **Mobile Admin UX** — Admin tables overflow on tablet/mobile. Add responsive table → card collapse pattern for small screens.

---

## Priority Summary Table

| # | Category | Priority | Effort | Impact |
|---|----------|----------|--------|--------|
| 1 | Accessibility (ARIA labels) | Critical | Low | High |
| 2 | Type Safety (any types) | Critical | Medium | High |
| 3 | Error Handling (silent failures) | Critical | Medium | High |
| 4 | Error Boundaries (crash handling) | High | Low | Medium |
| 5 | Form Validation (react-hook-form + zod) | High | Medium | Medium |
| 6 | Component Splitting (monolithic) | High | Medium | Medium |
| 7 | Custom Hooks (reusable logic) | Medium | Medium | Medium |
| 8 | Code Splitting (lazy loading) | Medium | Low | Low |
| 9 | Testing (0 coverage) | High | High | Medium |
| 10 | Image Virtualization (react-window) | Medium | Medium | Low |
| 11 | React Query Migration | Medium | High | High |
| 12 | Mobile Admin UX | Medium | Medium | Medium |
