# FacultyCore — Faculty Management System

Institutional ERP for colleges and universities: faculty records, teaching, research, attendance and leave, appraisals, approvals, analytics and administration — in one role-aware web portal.

FacultyCore is not tied to any one college. Each installation sets its own college name, short code, logo, address and email domain in **Admin → Settings**; the product name lives in `server/src/config/brand.ts` and `client/src/config/brand.ts`.

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
| Administration | Users & roles, Excel bulk import, departments, academic years, institution settings, audit logs, notifications, global search |
| AI assistant | Certificate reading, proof checks for HODs, appraisal drafts and summaries, NAAC Criterion III draft, plain-English questions, mentoring risk flags (Google Gemini) |
| Accounts | Email password reset, email-confirmed self-registration, two-factor sign-in, signed-in devices, live notifications + email, calendar sync, installable on phones |

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
| `PORT` | API port (default `5055`; the Docker stack uses `5000` internally) |
| `NODE_ENV` | `development` / `production` / `test` |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs session tokens |
| `JWT_EXPIRES_IN` | Session lifetime (default `12h`) |
| `COOKIE_SECRET` | Signs cookies |
| `CLIENT_URL` | Allowed browser origin for CORS; also the base of links in emails |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Google Gemini for the AI assistant (empty key = AI features hidden). Defaults `gemini-flash-latest`, falling back to `gemini-flash-lite-latest` when busy |
| `TWO_FACTOR_KEY` | Encrypts two-factor secrets (random, 32+ characters; required in production; keep stable) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Outgoing email. Without `SMTP_HOST`, every email is written to `server/mail-outbox/` as a JSON file instead (handy in development) |
| `PUBLIC_API_URL` | Public API address used in calendar-feed links (default `http://localhost:PORT/api`, or `CLIENT_URL/api` in production) |

`client/.env` only needs `VITE_API_URL` (default `http://localhost:5055/api`).

> **Production:** the server refuses to start if `JWT_SECRET` / `COOKIE_SECRET` are shorter than 32 characters, still contain the `.env.example` placeholder, or are identical. Generate them with
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 3. Register an institution and seed development data

FacultyCore keeps each institution in its own database (`fc_t_<code>`), listed in the platform
registry (`fc_platform`). Scripts that touch institutional data name the institution with
`--tenant <code>`; there is no default institution.

```bash
npm run tenant:register -- --code demo --name "Demo Institute of Technology" --city Chennai --domain college.edu
npm run seed -- --tenant demo
```

In the web app, choose the institution on the sign-in page (the choice is remembered).
To move an existing single-institution database into its own institution database, copy it first
(the source is never changed), then register it:

For a real institution use the verified migration instead. It archives the source to disk,
proves the archive restores, copies, checks every collection (count and SHA-256 of every
document) and every schema reference, then registers the institution. The source is never changed:

```bash
npm run tenant:migrate -- --from <old-database> --code kpriet --name "KPR Institute of Engineering and Technology" --domain kpriet.ac.in
npm run tenant:files -- --tenant kpriet      # copies the files its records point to, verified by SHA-256
```

Quick copy for development data only (no archive or proof):

```bash
npm run tenant:copy -- --from kpriet-fms --to demo
npm run tenant:register -- --code demo --name "Demo Institute of Technology" --adopt-existing-data
```

### Platform console (FacultyCore operators)

The Super Admin console at `/platform` manages institutions. There is **one sign-in page**
(`/login`): choose **FacultyCore Super Admin** there (or open `/login?as=platform`; the old
`/platform/login` address redirects to it). The choice only selects the form; the server decides
who is a Super Admin. Platform accounts, sessions and cookies are separate from every institution's,
and the console shows registry data and counts, never academic records. It can edit each
institution's name, type, address, contact, email domains and logo. Create the first operator account once from the command line;
it prints a single-use activation link (24 hours) where the operator chooses the password:

```bash
npm run platform:create-admin -- --email you@example.com --name "Your Name"
npm run platform:create-admin -- --email you@example.com --reissue   # new link if it expired
```

From the console: **New institution** runs the setup wizard (details, departments, initial
administrator/principal/dean/HODs, branding, review). Provisioning is a recorded, resumable
sequence (registry, database and indexes, settings, structure, accounts, activation emails,
final checks); the institution becomes usable only after the last check passes, and a failed
setup can be retried from the failed step. Institutions can be suspended (all sessions stop on
their next request), reactivated or archived, and activation links re-sent.

### Bulk import and leadership assignments

**Admin → Users → Import from Excel** (and the same screen on an institution's page in the
platform console) imports faculty and staff of every role, including administrators. Choose how
existing people are treated (create new only / update existing / skip existing / refuse the file),
whether missing departments may be created, and map spreadsheet department names to existing
codes. Every row is previewed (create, update with each field change, skip, or the reason it
cannot be imported) before anything is written; errors and final results download as CSV. Role and
department changes of existing people are only applied when explicitly allowed. The import runs as
a background job with live progress; new people are emailed their set-password link once their
account exists.

Leadership rules apply everywhere (user editor, department form, import, `/api/assignments` for
Admins and Principals): an HOD heads their own department and each department has one HOD; there
is one Principal; several Deans are allowed; the last active administrator cannot be removed;
moving someone to another department keeps their past records where they were made. Replacing
an HOD or the Principal must be confirmed, and every change is audited.

### Funding applications

Research → Funding Pipeline tracks each application from idea to completion (applied, pending,
under review, clarification, approved, sanctioned, ongoing, completed, rejected, withdrawn). The
investigator records progress; only their HOD, the Dean, Principal or Admin can record an
agency's approval, sanction or rejection. Money counts as sanctioned or received only after the
HOD has verified the record. Faculty see their own applications, HODs their department, and the
Dean and Principal the whole institution by agency and department. Older records get a
verification state with `npm run tenant:migrate-funding -- --tenant <code>` (add
`--trust-existing` only if past sanctions were already HOD-checked).

### Rankings and institution settings

Principal and Dean dashboards rank faculty and departments from verified records only (overall,
publications, funded projects, funding, patents, FDPs, activities), with a designation filter and
a "Rising" list that compares like-for-like periods. "How these rankings are calculated" shows the
formula, the configuration version in force and what still awaits verification; the Principal or
an Admin can save new weights as a new version (effective date, optional academic year, history
kept). Admin → Settings holds the logo, accent colour, timezone, enabled modules, appraisal
deadlines, maintenance mode, idle timeout and upload limit; all of them are enforced.

Emails name the institution they come from (sender name, subject prefix, header and footer).
Admins can send invitation reminders to accounts that have never signed in (once a day at most).
Uploaded evidence opens only for its owner, their HOD and the Dean, Principal and Admin.

Files: each institution's uploads and document vault live in
`server/storage/tenants/<code>/uploads` and `server/storage/tenants/<code>/secure_documents`,
and are only served to signed-in users of that institution. The old shared `server/uploads/`
and `server/storage/secure_documents/` folders are only read by `tenant:files`.

### 4. Run

In two terminals, from the project root:

```bash
npm run dev:server   # API  → http://localhost:5055/api
npm run dev:client   # Web  → http://localhost:5180
```

### Development logins

Created by `npm run seed` (development databases only). The sample data uses a made-up college, *Demo Institute of Technology* (`@college.edu`). A database seeded before the rename keeps its old addresses until you seed it again.

| Role | Email | Employee ID | Password |
|---|---|---|---|
| Admin | admin@college.edu | EMP001 | `Admin@12345` |
| Principal | principal@college.edu | EMP002 | `Principal@12345` |
| Dean | dean.acad@college.edu | EMP003 | `Dean@12345` |
| HOD (CSE) | hod.cse@college.edu | EMP004 | `Hod@12345` |
| Faculty (CSE) | faculty.cse@college.edu | EMP005 | `Faculty@12345` |
| Inactive (login is rejected) | inactive@college.edu | EMP099 | `Inactive@12345` |

Sign in with either the email or the employee ID. These accounts only exist in seeded dev databases — never create them in production.

### Full sample data (every module)

```bash
npm run seed:sample -- --tenant demo
```

Run after `npm run seed`. Adds a complete institution for demos and testing — re-runnable, and removed by `npm run seed:clean`:

- 7 departments (CSE, ECE, MECH, EEE, IT, AI&DS, CIVIL) with UG/PG/Ph.D. programs and master data
- 34 more faculty with full profiles; new HODs for MECH, EEE, IT, AIDS and CIVIL
- Publications, funded projects, activities, patents, copyrights and consultancy across 2023-24 → 2026-27, in every verification state
- Student mentoring, student projects and PhD scholars
- Subjects, allocations, a conflict-free timetable and substitutions
- Attendance (Sep 2026 → today) with correction requests, leave applications and balances
- 2026-27 appraisal cycle with appraisals at every workflow stage, plus completed 2025-26 appraisals
- Document vault with real PDF files, notifications, approval history and audit entries

It also sets 2026-2027 as the current academic year.

| Sample account | Login | Password |
|---|---|---|
| HOD — Mechanical | hod.mech@college.edu | `Hod@12345` |
| HOD — EEE / IT / AI&DS / Civil | hod.eee@ / hod.it@ / hod.aids@ / hod.civil@college.edu | `Hod@12345` |
| Faculty — CSE | k.divya.cse@college.edu | `Faculty@12345` |
| Any sample faculty | see the Faculty Directory (employee IDs KPR2101–KPR2134) | `Faculty@12345` |

---

## Scripts

From the project root:

| Command | Effect |
|---|---|
| `npm run dev:server` / `npm run dev:client` | Start API / web app in watch mode |
| `npm run build` | Type-check and build server (`server/dist`) and client (`client/dist`) |
| `npm start` | Run the built API (`node server/dist/server.js`) |
| `npm test` | Run every backend test suite against isolated test institutions (emails go to `server/mail-outbox-test/`) |
| `npm run seed -- --tenant demo` | Create / refresh development seed data in one institution |
| `npm run backup -- --tenant demo` | Back up one institution's database + uploaded files to `server/backups/<code>-<timestamp>/` |
| `npm run lint:server` / `npm run lint:client` | Type-check server / lint client |

Run only some suites with `npm test -- 2 3 54` (phase numbers).

### Tests

The backend suites live in `server/src/scripts/test-phase*.ts`. `npm test` never touches your development database: it drops and recreates test-only databases (`fctest_platform`, `fctest_t_testa`, `fctest_t_testb`), registers two test institutions, seeds A with the base + sample data and B with the base data, starts a private API on port 5099 (`TEST_API_PORT`), runs the suites and stops the API. No dev server needs to be running. CI runs the same on every push (`.github/workflows/ci.yml`).

---

## Deployment

Production setup, backups, monitoring and rollback for the multi-institution platform:
**[docs/deployment/PRODUCTION.md](docs/deployment/PRODUCTION.md)**. Acceptance status and known
gaps: [docs/multi-tenant/ACCEPTANCE.md](docs/multi-tenant/ACCEPTANCE.md).


A production-style stack (MongoDB + API + nginx serving the web app) is defined in `docker-compose.yml`:

```bash
cp .env.production.example .env.production   # fill in JWT_SECRET, COOKIE_SECRET, CLIENT_URL
docker compose --env-file .env.production up -d --build
```

- The app is served on port `8080` (`WEB_PORT`); nginx proxies `/api` and `/uploads` to the API, so the browser talks to a single origin.
- **Put HTTPS in front** (institutional reverse proxy / load balancer) — production cookies are `Secure`. `TRUST_PROXY=1` is set so rate limiting sees real client IPs.
- Data lives in Docker volumes: `mongo-data` (every database: `fc_platform` and one `fc_t_<code>` per institution), `documents` (each institution's files under `storage/tenants/<code>/`), `backups`, and `uploads` (pre-multi-tenant files, read only by the migration).
- Create the first Super Admin with `docker compose exec server node dist/scripts/platform-create-admin.js --email … --name "…"`.
- Sessions expire after `JWT_EXPIRES_IN` of inactivity (default `12h`); active users are renewed automatically.

### Backups

```bash
npm run backup -- --all                       # platform registry + every institution, one folder each
npm run backup -- --tenant demo               # -> server/backups/demo-<timestamp>/
BACKUP_DIR=D:\fms-backups BACKUP_KEEP=30 npm run backup -- --tenant demo
npm run restore -- server/backups/demo-<timestamp> --tenant demo --yes   # same institution only; replaces DB + files
```

Each backup contains every collection of one institution's database (type-preserving, gzipped) plus that institution's files; `--platform` backs up the registry and console accounts. The newest 14 per institution are kept by default. No extra tools are needed. **Schedule it daily** (Windows Task Scheduler or cron) and copy the backup folder to another machine or cloud storage — a backup on the same disk does not survive a disk failure.

With the Docker stack run the same tools inside the API container (no extra software needed):

```bash
docker compose exec server node dist/scripts/backup.js --all          # writes to the backups volume
docker compose exec server node dist/scripts/restore.js backups/<code>-<time> --tenant <code> --yes
```

Copy the `backups` volume off the host; see [docs/deployment/PRODUCTION.md](docs/deployment/PRODUCTION.md#7-backups-and-restore).

---

## Email Setup

Without SMTP settings nothing is sent: every email is saved as a JSON file in `server/mail-outbox/` (fine for development). To send real email, add these to `server/.env` (or `.env.production` for Docker) and restart the API:

| Provider | `SMTP_HOST` | `SMTP_PORT` / `SMTP_SECURE` | `SMTP_USER` / `SMTP_PASS` |
|---|---|---|---|
| Microsoft 365 / Outlook (college mailbox) | `smtp.office365.com` | `587` / `false` | the mailbox address / its password (SMTP AUTH must be enabled for that mailbox by the IT admin) |
| Google Workspace / Gmail | `smtp.gmail.com` | `465` / `true` | the address / a 16-character **App Password** (needs 2-Step Verification on that account) |
| Institutional mail server | ask IT | usually `587` / `false` | as provided |

Set `MAIL_FROM` to the sending address, e.g. `FacultyCore <no-reply@your-college.edu>` (most providers require it to match `SMTP_USER`). Then check it:

```bash
npm run mail:test -- your.name@your-college.edu
```

It logs in to the mail server, sends a test message and tells you exactly what is wrong if it fails. In production the API prints a warning at startup while `SMTP_HOST` is empty.

## Calendar Sync on the Hosted Server

The calendar link is built from `PUBLIC_API_URL`. Google Calendar and Outlook fetch it from their own servers, so it must be a public **https** address — a `localhost` link only works for calendar apps on the same computer. When the portal is deployed (e.g. `https://fms.your-college.edu`), set `PUBLIC_API_URL=https://fms.your-college.edu/api` (the Docker stack defaults to `CLIENT_URL/api`, so usually nothing extra is needed). Users then press **Get a new link** once so their link uses the public address.

---

## AI Assistant

Powered by Google Gemini (key from [Google AI Studio](https://aistudio.google.com/apikey) in `GEMINI_API_KEY`). Every AI result is a suggestion shown to the user — nothing is saved or approved automatically.

| Feature | Who | Where |
|---|---|---|
| **Read a certificate** | Everyone | Academic Activities → Add → "Upload certificate": attaches the file and fills title, organizer, dates, duration, mode and role; warns if the name on it differs or the activity already exists |
| **Check against proof** | HOD (own department), Dean, Principal, Admin | Review dialog for activities and publications → "Run check": compares the entered details with the uploaded certificate/paper and lists possible duplicates (same DOI or near-identical title) |
| **Draft my remarks** | The teacher | Appraisals → My Appraisal → "Draft remarks": writes first-person remarks per category from verified records only |
| **Appraisal summary** | Reviewers | Appraisal evaluation dialog → "Summarise": strengths, claims without evidence, questions to ask |
| **NAAC Criterion III draft** | HOD (own department), leadership | AI Assistant → NAAC Criterion III: sections 3.1–3.5 with real figures, [placeholders] and a list of missing data; copy or download |
| **Ask the data** | HOD (own department), leadership | AI Assistant → Ask the data, e.g. "How many Q1 papers did ECE publish this year?" — answers with the filters used and a table when useful |
| **Mentoring insights** | Mentor (own mentees), HOD (department), leadership | Student Mentoring → "Analyse mentoring notes": flags students needing help with reasons and next steps |

How it is kept safe:
- "Ask the data" and the NAAC draft only see **aggregated counts** (grouped by department, year, type), scoped to the user's department for HODs — the AI cannot run database queries.
- Certificate and proof checks send that one file plus the record being checked; mentoring insights send the notes of at most 40 active mentees.
- Data sent to Gemini includes faculty names and record details, so use a key from the institution's own Google account and review Google's data-use terms for it (paid-tier keys are not used for training).
- Calls are limited to 60 per user per hour in production and every call is written to the audit log (`AI_ASSIST`).
- The automated tests never call Gemini (`npm test` runs with the key switched off).

---

## Account Features

| Feature | Where | Notes |
|---|---|---|
| **Forgot password** | Sign-in page → Forgot Password? | Emails a one-time link valid for 30 minutes; using it signs the account out everywhere. Same reply whether or not the account exists |
| **Registration email code** | `/register` | A 6-digit code (15 min, 5 tries) confirms the college address. Admins/HOD are alerted only after it is confirmed, and Approve stays disabled until then |
| **Email notifications** | Automatic | Approval requests, approve/return/reject decisions, leave applications and leave decisions are also emailed. Each user can switch this off under Notifications → Preferences → "Email Me Too" |
| **Live notifications** | Bell icon | New notifications appear instantly (Server-Sent Events at `/api/notifications/stream`), with a toast. Falls back to polling if the stream drops |
| **Two-factor sign-in** | Profile menu → Account & Security | Authenticator-app codes (Google/Microsoft Authenticator, Authy) plus 10 one-time recovery codes. Recommended on the page for Admin/Principal/Dean. Admins can reset it for a user who lost their phone (Users list → shield icon) |
| **Signed-in devices** | Account & Security | Lists every browser/phone signed in, with last activity; sign out one device or all others |
| **Calendar sync** | Account & Security | Private iCal link with leave (approved + pending) and weekly timetable, for Google Calendar, Outlook or Apple Calendar. Google/Outlook need the server to be reachable from the internet (`PUBLIC_API_URL`) |
| **Excel bulk import** | Admin → Users → Import from Excel | Download the template, upload, review per-row errors, then import. Each new account is emailed a "set your password" link (7 days) |
| **DOI / ORCID fill** | Publications → Add / Import from ORCID | Crossref fills title, venue, date, volume/pages, authors and citations from a DOI; ORCID lists a researcher's public works to add one by one. Google Scholar has no public API, so it is not supported |
| **Install as an app** | Profile menu → Install App (Chrome/Edge/Android), or Share → Add to Home Screen (iPhone) | Production builds register a service worker; API data is never cached |

Live notifications keep their connections in the API process; if you ever run several API instances, add a shared pub/sub (e.g. Redis) in `server/src/services/notification-dispatch.ts`.

---

## Security

- Session JWT in an HTTP-only, `SameSite` cookie; CSRF double-submit token (`X-CSRF-Token`) on every state-changing request
- Login rate limiting and account lockout (5 failed attempts → 15 min)
- Every sign-in is a tracked session (device, IP, last activity) that can be revoked; changing or resetting a password signs the user out of every other session
- Optional two-factor sign-in (TOTP); secrets are encrypted at rest with AES-256-GCM using `TWO_FACTOR_KEY` (required in production, separate from `JWT_SECRET` so that can be rotated freely). Never change `TWO_FACTOR_KEY` after go-live — it would turn off everyone's two-factor. Secrets created before the key existed are moved onto it automatically at the user's next sign-in
- Faculty can **self-register** at `/register` with a college email (domain taken from the institution contact email, e.g. `@college.edu`). New accounts stay **PENDING** and cannot sign in until an admin approves them under Admin → Users (the HOD is notified too); approval creates the faculty profile for HOD verification. Switch it on/off in Admin → Settings → "Allow faculty self-registration"
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
