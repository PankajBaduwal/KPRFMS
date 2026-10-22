# KPRIET Faculty Management System (FMS)

Institutional ERP for **KPR Institute of Engineering and Technology (KPRIET)**: faculty records, teaching, research, attendance and leave, appraisals, approvals, analytics and administration — in one role-aware web portal.

---

## Features

| Area | Modules |
|---|---|
| Faculty | Master profile, qualifications, experience, directory, document vault |
| Teaching | Subjects, workload, timetable (with clash detection), substitutions |
| Students | Mentoring, student projects, PhD scholars |
| Research | Publications, funded projects, patents, copyrights, consultancy, academic activities |
| Operations | Attendance (daily / monthly / corrections / locking), leave applications & balances |
| Performance | Appraisal cycles, self-appraisal, evidence, multi-level evaluation |
| Governance | Approval queue, HOD / Dean / Principal consoles, institution analytics, faculty comparison, accreditation reports |
| Administration | Users & roles, departments, academic years, institution settings, audit logs, notifications, global search |

### Roles

| Role | Scope |
|---|---|
| `FACULTY` | Own records; submits items for verification |
| `HOD` | Own department; verifies and approves faculty submissions |
| `DEAN` | Institution-wide academic oversight |
| `PRINCIPAL` | Institution-wide oversight and final approvals |
| `ADMIN` | Full system administration |

Access is enforced on the server (`requireAuth`, `requireRole`, `requirePermission`, department and ownership checks); the client additionally hides pages a role cannot use.

---

## Tech Stack

- **Client** (`client/`): React 19, TypeScript, Vite, React Router 7, TanStack Query, Zustand, React Hook Form + Zod, Bootstrap 5 + custom CSS tokens, Recharts
- **Server** (`server/`): Node.js, Express 5, TypeScript, MongoDB + Mongoose, Zod, JWT (HTTP-only cookie), bcrypt, Helmet, express-rate-limit, Multer

---

## Getting Started

### Prerequisites

- Node.js 20+ (developed on 22)
- MongoDB 7+ running locally on `mongodb://localhost:27017`

### 1. Install dependencies

```bash
npm --prefix server install
npm --prefix client install
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

| Variable (`server/.env`) | Purpose |
|---|---|
| `PORT` | API port (default `5000`) |
| `NODE_ENV` | `development` / `production` / `test` |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs session tokens |
| `JWT_EXPIRES_IN` | Session lifetime (default `7d`) |
| `COOKIE_SECRET` | Signs cookies |
| `CLIENT_URL` | Allowed browser origin for CORS |

`client/.env` only needs `VITE_API_URL` (default `http://localhost:5000/api`).

> **Production:** the server refuses to start if `JWT_SECRET` / `COOKIE_SECRET` are shorter than 32 characters, still contain the `.env.example` placeholder, or are identical. Generate them with
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 3. Seed development data

```bash
npm run seed
```

### 4. Run

In two terminals, from the project root:

```bash
npm run dev:server   # API  → http://localhost:5000/api
npm run dev:client   # Web  → http://localhost:5173
```

### Development logins

Created by `npm run seed` (development databases only):

| Role | Email | Employee ID | Password |
|---|---|---|---|
| Admin | admin@kpriet.ac.in | EMP001 | `Admin@12345` |
| Principal | principal@kpriet.ac.in | EMP002 | `Principal@12345` |
| Dean | dean.acad@kpriet.ac.in | EMP003 | `Dean@12345` |
| HOD (CSE) | hod.cse@kpriet.ac.in | EMP004 | `Hod@12345` |
| Faculty (CSE) | faculty.cse@kpriet.ac.in | EMP005 | `Faculty@12345` |
| Inactive (login is rejected) | inactive@kpriet.ac.in | EMP099 | `Inactive@12345` |

Sign in with either the email or the employee ID. These accounts only exist in seeded dev databases — never create them in production.

---

## Scripts

From the project root:

| Command | Effect |
|---|---|
| `npm run dev:server` / `npm run dev:client` | Start API / web app in watch mode |
| `npm run build` | Type-check and build server (`server/dist`) and client (`client/dist`) |
| `npm start` | Run the built API (`node server/dist/server.js`) |
| `npm test` | Run every backend test suite and print a pass/fail summary |
| `npm run seed` | Create / refresh development seed data |
| `npm run lint:server` / `npm run lint:client` | Type-check server / lint client |

Run only some suites with `npm test -- 2 3 54` (phase numbers).

### Tests

The backend suites live in `server/src/scripts/test-phase*.ts`. They run against the local MongoDB from `server/.env`, and several also call the live API — **start `npm run dev:server` before `npm test`**. They refuse to run against production or a remote database (see below).

---

## Security

- Session JWT in an HTTP-only, `SameSite` cookie; CSRF double-submit token (`X-CSRF-Token`) on every state-changing request
- Login rate limiting and account lockout (5 failed attempts → 15 min)
- Changing or resetting a password signs the user out of every other session
- Users change their own password from the profile menu → **Change Password** (policy: 8+ chars, upper, lower, digit, one of `@$!%*?&`)
- Request sanitisation against NoSQL operator injection and XSS payloads; Helmet security headers; strict CORS in production
- Uploaded files require an authenticated session; private documents are stored outside the web root in `server/storage/` and served through `/api/documents` with access checks
- Every sensitive action is written to the audit log (`/portal/audit-logs`)

`server/storage/`, `uploads/` and all `.env` files are git-ignored — never commit them.

---

## Project Structure

```
kpriet-fms/
├── client/src/
│   ├── api/          Axios instance (credentials, CSRF header, error normalisation)
│   ├── app/          App root, router, React Query client
│   ├── components/   Shared UI, modals, dashboard views
│   ├── constants/    Routes, roles
│   ├── hooks/        Shared hooks (e.g. double-submit-safe async actions)
│   ├── layouts/      Public / auth / portal layouts
│   ├── pages/        One page per module
│   ├── services/     Typed API calls per module
│   ├── stores/       Zustand auth + UI state
│   ├── styles/       Design tokens and global CSS
│   └── types/        Domain types
└── server/src/
    ├── audit/        Audit logger
    ├── config/       Env validation, database, CORS
    ├── controllers/  HTTP handlers
    ├── middleware/   Auth, RBAC, CSRF, sanitisation, uploads, errors
    ├── models/       Mongoose schemas
    ├── permissions/  Roles and permission matrix
    ├── routes/       Routers mounted under /api
    ├── services/     Business logic
    ├── validators/   Zod request schemas
    ├── scripts/      Seed, cleanup, test suites, test runner
    └── utils/        JWT, passwords, responses, logging
```

---

## API Conventions

All endpoints are under `/api`. Health check: `GET /api/health`.

```json
{ "success": true,  "message": "Operation successful", "data": {} }
{ "success": false, "message": "Human-readable error", "code": "ERROR_CODE", "details": [] }
```

---

## Development Seed Data vs Production Data

Production screens read only from database APIs; nothing in the client hardcodes years, statistics or faculty lists. Academic-year options come from `GET /api/academic-years`.

| Command (in `server/`) | Effect |
|---|---|
| `npm run seed` | Creates dev seed records. Replaces only earlier seed records. |
| `npm run seed:clean` | Deletes every dev seed record. Real records are untouched. |
| `npm run seed:reset` | One-off: also wipes untagged rows left by older seeds in the seeded research/teaching collections. |

- Every seeded document is stamped `devSeed: { isDevSeed: true, batchId, seededAt }` and listed in the `dev_seed_registry` collection.
- Seed, cleanup and test scripts refuse to run when `NODE_ENV=production` or when `MONGODB_URI` points to a non-local host (override with `ALLOW_REMOTE_DEV_SEED=true` only for a dedicated dev database).
- The login page shows the seed accounts only under `vite dev`; they are stripped from production builds (hide them in dev with `VITE_HIDE_DEV_SEED=true`).
- `/portal/design-system` (component catalogue) exists only in development builds.
