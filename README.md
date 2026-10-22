# KPRIET Faculty Management System (FMS)

Centralized institutional Faculty Management System for **KPR Institute of Engineering and Technology (KPRIET)**.

---

## 1. Project Overview

The **KPRIET Faculty Management System (FMS)** is an institutional enterprise resource planning platform engineered to streamline faculty academic workloads, research governance, profile credentials, departmental operations, and administrative oversight across all colleges and departments.

### Architecture Scope: Phase 1 — Project Initialization + Core Foundation
Phase 1 establishes the production-grade foundation for all future modules:
- Monorepo architecture (`client/` and `server/`)
- Strict TypeScript configuration across both stacks
- Centralized REST API response standards and error handling
- Security middleware (Helmet, strict CORS, rate limiting, request-size limits)
- TanStack Query, Zustand, React Router, and React Hook Form + Zod architecture
- Professional institutional design system built on Bootstrap 5 and CSS variables (no Tailwind)
- Modular MongoDB connection and institutional entity blueprints

---

## 2. Technology Stack

### Frontend (`client/`)
- **Core:** React 19, TypeScript (Strict Mode), Vite
- **Routing:** React Router v7
- **Forms & Validation:** React Hook Form, Zod, `@hookform/resolvers`
- **Server State:** TanStack React Query v5
- **Client State:** Zustand
- **UI & Styling:** Bootstrap 5, Bootstrap Icons, Custom CSS Design Tokens (CSS Variables)
- **HTTP Client:** Axios with centralized error normalization and credential cookies
- **Utilities:** `date-fns`, `recharts` (installed for future analytics phases)

### Backend (`server/`)
- **Core:** Node.js, Express, TypeScript (Strict Mode, NodeNext)
- **Database:** MongoDB, Mongoose ODM
- **Validation:** Zod schemas
- **Security:** Helmet, CORS, Express Rate Limit, Cookie Parser
- **Authentication Prep:** JWT, bcrypt (for Phase 2 implementation)
- **Logging:** Structured JSON/timestamped logging utility with log sanitization

---

## 3. Directory Structure

```
kpriet-fms/
├── client/
│   ├── src/
│   │   ├── api/          # Axios instance and typed request wrappers
│   │   ├── app/          # App root, React Router, QueryClient setup
│   │   ├── components/   # Foundational reusable UI components
│   │   ├── constants/    # Route names, institutional roles, app constants
│   │   ├── layouts/      # AppLayout, AuthLayout, PublicLayout
│   │   ├── pages/        # HomePage, LoginPage, UnauthorizedPage, NotFoundPage
│   │   ├── stores/       # Zustand UI store & Auth state skeleton
│   │   ├── styles/       # Design tokens, global CSS, components, responsive styles
│   │   └── types/        # TypeScript interfaces for API & domain entities
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
│
├── server/
│   ├── src/
│   │   ├── config/       # MongoDB connection, env parser, CORS options
│   │   ├── middleware/   # Centralized error handler, rate limiters, 404 handler
│   │   ├── models/       # Mongoose schemas (User, Department)
│   │   ├── permissions/  # Institutional roles and hierarchy constants
│   │   ├── routes/       # API router registry, health check endpoint
│   │   ├── types/        # Typed Express requests and common interfaces
│   │   ├── utils/        # AppError class, logger, apiResponse helpers
│   │   ├── app.ts        # Express app initialization & middleware pipeline
│   │   └── server.ts     # HTTP server lifecycle and graceful shutdown
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── package.json          # Root scripts orchestration
├── .gitignore
└── README.md
```

---

## 4. Environment Configuration

### Server Configuration (`server/.env`)
Copy `server/.env.example` to `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/kpriet-fms
JWT_SECRET=your-secure-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d
COOKIE_SECRET=your-secure-cookie-secret-key
CLIENT_URL=http://localhost:5173
```

### Client Configuration (`client/.env`)
Copy `client/.env.example` to `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 5. Development & Running

### Starting Development Servers

Run backend (from `server/` directory):
```bash
cd server
npm run dev
```

Run frontend (from `client/` directory):
```bash
cd client
npm run dev
```

Or from the root directory:
```bash
# Start backend
npm run dev:server

# Start frontend
npm run dev:client
```

### Building for Production
```bash
# Build both client and server
npm run build

# Or individually
npm run build:server
npm run build:client
```

### Starting Production Server
```bash
npm run start
```

---

## 6. Centralized API Standard

### Health Endpoint
`GET /api/health`
```json
{
  "success": true,
  "message": "KPRIET FMS API is running",
  "data": {
    "status": "healthy",
    "timestamp": "2026-10-04T09:20:00.000Z",
    "uptime": 12.34
  }
}
```

### Standard Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Standard Error Response
```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": []
}
```

---

## 7. Institutional Roles

The application establishes the following role hierarchy:
- `ADMIN`: Institutional super-administrator
- `PRINCIPAL`: Head of the institution
- `DEAN`: Academic, Research, and Student Affairs leadership
- `HOD`: Head of Department
- `FACULTY`: Teaching and research faculty member

---

## 8. Next Roadmap (Phase 2)
- Complete Authentication (JWT in HTTP-only cookies)
- Role-based Access Control (RBAC) middleware
- Password hashing with bcrypt
- Session lifecycle and profile bootstrap

---

## Development Seed Data vs Production Data (Phase 37)

Production screens (dashboards, analytics, profiles, reports, filters) read only from database APIs. Academic-year options and defaults come from `GET /api/academic-years`, which is backed by Institution Settings, the Academic Year master and years already used by records. Nothing in the client hardcodes years, statistics or faculty lists.

Development sample data lives only in `server/src/scripts/seed.ts`:

| Command (in `server/`) | Effect |
|---|---|
| `npm run seed` | Creates dev seed records. Replaces only earlier seed records. |
| `npm run seed:clean` | Deletes every dev seed record. Real records are untouched. |
| `npm run seed:reset` | One-off: also wipes untagged rows left by pre-Phase-37 seeds in the seeded research/teaching collections. |

- Every seeded document is stamped `devSeed: { isDevSeed: true, batchId, seededAt }` and listed in the `dev_seed_registry` collection.
- The seed, cleanup and `test-phase*.ts` scripts refuse to run when `NODE_ENV=production` or when `MONGODB_URI` points to a non-local host (override with `ALLOW_REMOTE_DEV_SEED=true` only for a dedicated dev database).
- The login page shows the seed accounts only under `vite dev` (`client/src/dev/devSeedAccounts.ts`). They are stripped from production builds, and you can hide them in dev with `VITE_HIDE_DEV_SEED=true`.
- The `/portal/design-system` component catalogue uses illustrative sample rows and is registered only in development builds.
