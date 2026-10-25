# KPRIET FMS — Web Client

React 19 + TypeScript + Vite front end for the KPRIET Faculty Management System. See the [project README](../README.md) for setup, seed logins and the full feature list.

## Commands

```bash
npm install
npm run dev       # http://localhost:5173 (API expected at VITE_API_URL)
npm run build     # type-check + production bundle in dist/
npm run lint      # oxlint
npm run preview   # serve the production build locally
```

## Configuration

`.env` (copy from `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5055/api` | Base URL of the API |
| `VITE_HIDE_DEV_SEED` | — | `true` hides the seed-account hints on the dev login page |

In development, Vite proxies `/uploads/*` to the API so stored file links open directly.

## Conventions

- **API calls** go through `src/services/*.service.ts`, which use the shared Axios client in `src/api/client.ts` (sends cookies, attaches the CSRF header, normalises errors to `{ message, code, details, status }`).
- **Server state** uses TanStack Query; **client state** (auth, UI) uses Zustand stores in `src/stores/`.
- **Forms** use React Hook Form + Zod; shared inputs live in `src/components/`.
- **Mutations** that a user can trigger by clicking should be wrapped in `useAsyncAction` to block double submits.
- **Routes** are declared in `src/app/router.tsx` (lazy-loaded); role-restricted pages are wrapped in `ProtectedRoute allowedRoles={…}`. The server enforces the same rules — the client check is only for UX.
- **Styling** uses Bootstrap 5 plus the design tokens in `src/styles/variables.css`; no Tailwind.
