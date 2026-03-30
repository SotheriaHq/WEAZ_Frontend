# Threadly Frontend — Agent Context

> You are in `fthreadly/` — the React frontend. See root `CODEMAP.md` for task routing.

## Stack

React 19 + Vite + TypeScript + Redux Toolkit + Tailwind CSS + PrimeReact + Framer Motion

## Architecture

- **Entry**: `src/App.tsx` — ALL routes defined here (~550 lines), global overlays, providers
- **State**: Redux Toolkit — 8 slices in `src/features/` + store config in `src/store.ts`
- **API layer**: 26 client files in `src/api/`, all use `src/api/httpClient.ts` (Axios with JWT interceptor)
- **Pages**: `src/pages/` — organized by domain (admin/, studio/, checkout/, etc.)
- **Components**: `src/components/` — 30+ directories, reusable UI
- **Hooks**: `src/hooks/` — custom React hooks

## Patterns to Follow

- **Route guards**: `ProtectedRoute` (auth), `GuestRoute` (unauth only), `RequireBrand`, `RequireStoreSetup`, `RequireAdmin` + `RequireAdminPermission`
- **API responses**: Backend wraps in `{ data, message, statusCode }` — unwrap `.data.data` in thunks
- **Forms**: Use `UniversalSelect` for ALL dropdowns (Rule 9). No native `<select>`.
- **Identity data**: Single canonical source — shared hooks/selectors (Rule 1). Never re-derive per component.
- **Avatars**: `rounded-xl` shape always. Never circles. (Rule 6)
- **Markers**: Emoji only. No Lucide/Heroicons for status indicators. (Rule 5)
- **Images**: `object-contain`, no background, no padding, max `85vh`. (Rule 4)
- **Modals with media**: `overflow-y-auto no-scrollbar`, frosted glass bg. (Rule 3)
- **Code splitting**: Lazy loading via `React.lazy()` + `Suspense` for all page routes

## Commands

```bash
npm run dev      # Vite dev server (port 5173)
npm run build    # TypeScript check + Vite build → dist/
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Key Files

| What | Where |
|---|---|
| All routes | `src/App.tsx` |
| Redux store | `src/store.ts` |
| User state | `src/features/userSlice.ts` |
| Cart state | `src/features/cartSlice.ts` |
| Auth context | `src/context/AuthContext.tsx` |
| HTTP client | `src/api/httpClient.ts` |
| Layout shell | `src/components/Layout.tsx` |
| Studio scaffold | `src/components/studio/StudioScaffold.tsx` |
| Universal dropdown | `src/components/forms/UniversalSelect.tsx` |
| Tailwind config | `tailwind.config.js` |
| Vite config | `vite.config.ts` |
