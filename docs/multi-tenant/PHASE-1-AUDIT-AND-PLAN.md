# FacultyCore multi-tenant transformation — Phase 1: audit and plan

Status: **audit complete, no application code changed.** Baseline commit `3266dfd`, 2026-10-27.

---

## 1. Current architecture (as inspected)

| Area | Finding |
|---|---|
| Server entry | `server/src/server.ts` → `connectDatabase()` → `app.listen(PORT)` (5055). Middleware chain in `server/src/app.ts`: helmet, CORS, rate limit, cookies, XSS clean, CSRF (double-submit), `/uploads` static (auth only), `/api` routes. |
| Web entry | `client/src/main.tsx` → `app/App.tsx` (QueryClientProvider, Toast, Auth) → `app/router.tsx` (30 portal routes + public/auth). Vite on 5180, API base from `VITE_API_URL`. |
| Database | **One global connection**: `mongoose.connect(env.MONGODB_URI)` in `config/database.ts`. All 35 models are registered on that global connection with `mongoose.model(...)`. |
| Model coupling | **512 model import statements across 75 server files** (services, controllers, middleware, routes). No code passes a connection around. |
| Transactions | None used. Local MongoDB 8.0.6 is a **standalone server (no replica set)**, so multi-document transactions are unavailable locally. |
| Authentication | JWT in an httpOnly cookie (`fms_token`) or Bearer header; `requireAuth` verifies the token, the `Session` record (revocation, last seen), password-change time and user status, then sets `req.user`. Token payload: `id, email, role, departmentId, sid`, **no institution**. |
| Authorisation | `requireRole(...)` per route plus service-level checks (HOD department match, self-approval block in the approval queue). |
| Roles | `FACULTY, HOD, DEAN, PRINCIPAL, ADMIN` in `permissions/roles.ts`, with a numeric hierarchy. There is no platform role. |
| Login | Email or employee ID (`auth.service.login`), lockout after 5 failures, 2FA (TOTP + recovery codes), sessions list/revoke, password reset by email. |
| Registration | Self-registration with a college email domain derived from `InstitutionSettings.contactEmail`; account pending admin approval. |
| Bulk import | `faculty-import.service.ts`: Excel/CSV, validate-then-create, roles FACULTY/HOD/DEAN/PRINCIPAL, existing departments only, create-only mode, welcome email per account. |
| Branding/settings | `InstitutionSettings` is a **singleton** (`findOne()` in 9 places) plus a module-level cache in `utils/institution.ts`. The product name is in `config/brand.ts` (server and client). |
| Dashboards, rankings, approvals | Role dashboards (`dashboard.service`), leaderboards (`leaderboard.service`, verified-only, weights in settings), unified approval queue (10 record types, reason required, self-approval blocked, HOD department check before save). |
| Files | Legacy uploads in `server/uploads/{documents,certificates}` served at `/uploads` to **any signed-in user**; secure vault in `server/storage/secure_documents` via `/api/documents`. |
| Live notifications | Server-Sent Events; in-memory `Map<userId, streams>`. |
| Calendar | Unauthenticated `.ics` feed looked up by token hash across the single `users` collection. |
| AI | Gemini; prompts built from an institution snapshot; can be switched off. |
| Tests | 38 suites, `npm test` drops and reseeds `kpriet-fms-test`, private API on 5099. |
| CI / Docker | `.github/workflows/ci.yml`, `docker-compose.yml`, server and client Dockerfiles. |
| Env vars | `PORT NODE_ENV MONGODB_URI JWT_SECRET JWT_EXPIRES_IN COOKIE_SECRET CLIENT_URL TRUST_PROXY PUBLIC_API_URL TWO_FACTOR_KEY GEMINI_API_KEY GEMINI_MODEL GEMINI_FALLBACK_MODEL SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS MAIL_FROM MAIL_OUTBOX_DIR` |

### Baseline test result

`npm test` at `3266dfd`: **38/38 suites passed** (phases 2–14, 19–30, 36, 41, 42, 44, 50, 51, 51-qa, 53, 54, 60–63).

---

## 2. Single-institution assumptions (everything that must change)

1. Global `mongoose.connect` and global model registration (all 35 models).
2. `InstitutionSettings.findOne()` singleton (9 call sites) and the module-level cache in `utils/institution.ts`.
3. Module-level caches: `public.routes.ts` overview cache. **Any cache must be keyed by tenant.**
4. JWT and `Session` have no tenant; `requireAuth` loads the user from the single database.
5. Unauthenticated endpoints with no tenant: `/public/overview`, `/public/institution`, registration options, login, forgot/reset password, email verification, calendar feed.
6. SSE streams keyed by `userId` only. ObjectIds from different databases are unlikely to collide, but isolation must not depend on that.
7. File storage paths are shared (`uploads/…`, `storage/secure_documents`), and `/uploads` has **no ownership check**. This is an existing gap that would become a cross-tenant leak.
8. AI: institution snapshot and the `uploads` root are read from the single database and folder.
9. Seeds, test runner and dev scripts target one database.
10. Client: `useInstitution` and every TanStack Query key are not tenant-scoped; browser storage keys (`facultycore_*`) are not tenant-scoped; there is no institution selector.
11. Email templates name the product but not the tenant consistently.
12. Rate limiting by IP only (acceptable; keep it, and add per-tenant keys for login).

## 3. Hardcoded KPRIET

The product rebrand (`2d99fe6`, `3266dfd`) already removed KPRIET from all user-facing code, emails, seeds and tests. What remains is internal and deliberate:

- the folder `kpriet-fms`
- database names `kpriet-fms` and `kpriet-fms-test`
- the 2FA HKDF salt `'kpriet-fms'` in `utils/totp.ts`; changing it breaks enrolled authenticators, so it stays
- a few README backup commands

There are no KPRIET-specific queries.

## 4. Unfinished or mocked functionality found

- **Admin → Settings → Appraisal**: deadlines, increment benchmark, CAS threshold and the peer-feedback switch are uncontrolled inputs (`defaultValue`) that are **never saved**.
- **HOD dashboard counts** come from queries with `.limit(10)` per type, so totals undercount above 10. The inline approvals panel uses the accurate queue counts.
- **Reports**: `report.service` throws "not implemented" for unhandled report types. Each of the 25 declared types (including NAAC, NBA, NIRF, AACSB, INTERNAL) must be verified in Phase 11.
- **Funding**: `Project` has `requestedAmount`, `sanctionedAmount`, `receivedAmount`, proposal/grant/sanction numbers and documents, but statuses are only `IDEA, DRAFT, SUBMITTED, UNDER_REVIEW, SANCTIONED, ONGOING, COMPLETED, REJECTED`. Missing: `APPLIED, PENDING, CLARIFICATION_REQUIRED, APPROVED, WITHDRAWN`, `scheme`, `applicationDate`, `expectedDecisionDate`, `decisionDate` and structured reviewer comments.
- **Logo upload**: Settings has `logoUrl` text only; there is no upload or validation.

## 5. Data that must be preserved

| Database | Contents | Note |
|---|---|---|
| `kpriet-fms-backup-20261026` | **The KPRIET data** (35 collections, 12,005 documents), copied before the dev reseed on 2026-10-26 | This is the Phase 20 migration source. It has never been deployed to production. |
| `kpriet-fms` | Current development data (Demo Institute of Technology) | Becomes the "demo" tenant. |
| `kpriet-fms-test` | Disposable; recreated by every test run | |
| `server/uploads`, `server/storage/secure_documents` | Files referenced by the records above | Must move to per-tenant folders with references preserved. |

**The same MongoDB server hosts about 35 unrelated databases, including the separate KPRIET project's `eduverse*`.** Provisioning must use a reserved name prefix and refuse to touch any database it did not create.

---

## 6. Target architecture

```
                       ┌──────────────────────────── one MongoDB cluster ───────────────────────────┐
 browser ── /api ──►   │  fc_platform             fc_t_kpriet            fc_t_demo           fc_t_…   │
   │                   │  institutions            users, faculty …       users, faculty …            │
   │  login:           │  platform_users          (all 35 existing       (all 35 existing             │
   │  institution +    │  provisioning_runs        collections)           collections)                │
   │  credentials      │  platform_audit                                                              │
   │                   └──────────────────────────────────────────────────────────────────────────────┘
   ▼
 requireAuth ─► token {tenantId, uid, sid} ─► registry lookup (status ACTIVE?) ─► AsyncLocalStorage
                                                                                  { tenantId, dbName }
 existing services ─► existing model imports ─► tenant model proxy ─► connection.useDb(dbName) ─► model
```

### Core mechanism (validated by a spike on this machine)

- **Tenant context** in `AsyncLocalStorage`, set only by trusted middleware after authentication, or by the public slug resolver for unauthenticated routes. It is never taken from the request body, query, header or local storage.
- **Tenant model proxy**: each existing model file keeps its export name, but the export becomes a proxy that resolves `mongoose.connection.useDb(ctx.dbName, { useCache: true }).model(name)` at call time. **The 512 import sites do not change.** All schemas are registered on each tenant connection on first use, so `populate()` refs resolve inside the same tenant.
- **Fail closed**: using a tenant model with no context throws. There is no default database.
- **One shared pool**: `useDb` reuses the root connection's sockets; no per-request connections.
- Platform models (`Institution`, `PlatformUser`, `ProvisioningRun`, `PlatformAuditLog`, `PlatformConfig`) are bound explicitly to `fc_platform`.

Spike results (throwaway databases, since deleted): each college saw only its own users; `populate` resolved within the college; pre-save hooks ran; unique indexes were per college; the same email could exist in two colleges; no-context access failed closed; 200 concurrent mixed requests never crossed; one shared pool.

### Database naming and safety

- Tenant databases are named `fc_t_<institutionCode lowercased>`, generated server-side from a validated code (`^[a-z0-9]{2,20}$`). They are never accepted from input.
- Provisioning refuses an existing database unless the registry says this run created it (a resumable run).

### No transactions locally

The local MongoDB is standalone, so provisioning is a **resumable state machine**. A `ProvisioningRun` records steps (`REGISTRY → DATABASE → INDEXES → MIGRATIONS → SETTINGS → ACCOUNTS → INVITES → VERIFY`), and each step is idempotent. An institution becomes `ACTIVE` only after `VERIFY` passes; a failure leaves it `PROVISIONING_FAILED` with a retry. Production should use a replica set (e.g. MongoDB Atlas) so transactions are available, but the design does not depend on them.

### Identity and sessions

- Users stay in their tenant's `users` collection (email and employee ID unique per tenant).
- Token payload gains `tid` (tenant id). `requireAuth` resolves `tid` through the registry, checks the tenant is `ACTIVE`, sets the context, then loads the user from that tenant. A **suspended tenant is rejected on the next request** (short registry cache, invalidated on status change).
- Platform Super Admin: a separate `platform_users` collection, separate login route (`/api/platform/auth`), a separate cookie name and a separate console (`/platform`). The `PLATFORM_SUPER_ADMIN` role is not added to the institutional role enum.
- Exceptional support access: a time-limited, justified, audited grant (Phase 2 design, built later).

### Unauthenticated routes

These resolve the tenant from a validated **slug** in the path (`/api/t/:slug/public/...`, `/api/t/:slug/auth/login`, etc.):
- public overview and institution branding
- registration options
- login, forgot/reset password and verification

The calendar feed token embeds the tenant id (`<tid>.<token>`) and is verified against that tenant only.

### Files

Files are stored under `storage/<tenantId>/…` and `uploads/<tenantId>/…`. Downloads go through an authorised route that checks the tenant and record ownership; the open `/uploads` static route is retired.

---

## 7. Delivery plan (milestones with a test checkpoint after each)

| # | Milestone | Prompt phases | Main changes |
|---|---|---|---|
| **M1** | Tenant foundation | 3, 4, 5 (server core) | `fc_platform` connection and platform models; `Institution` registry; tenant context; tenant model proxy for all 35 models; `requireAuth` binds tenant; test runner provisions **two** tenants (A, B); existing 38 suites run inside tenant A unchanged. |
| **M2** | Tenant-aware login and public routes | 5, 7 | Institution selector and slug routes; tenant in the token; registration per tenant; tenant-keyed caches; SSE keyed by tenant; client query keys and storage scoped by tenant. |
| **M3** | KPRIET and demo migration | 20 | Verified backup → `fc_t_kpriet`; demo → `fc_t_demo`; count and reference checks; file moves; rollback script; old databases kept. |
| **M4** | Super Admin console and provisioning wizard | 2, 6, 8, 17 | Platform login; dashboard with real metrics; 6-step wizard; resumable provisioning; activation invites (hashed, single-use, short expiry); suspend/archive; platform audit and exports. |
| **M5** | Bulk import and assignments | 9, 10 | Import modes (create/update/skip/reject), department matching or creation, ADMIN role, downloadable errors, background jobs for large files; HOD/Dean/Principal assignment rules with audit. |
| **M6** | Funding lifecycle | 13 | New statuses and fields (backward-compatible mapping of old statuses), transition rules and audit, faculty/HOD/Dean/Principal funding views. |
| **M7** | Rankings, analytics and branding | 14, 15, 16 | Ranking configuration with history and methodology display, funded-research category, logo upload and validation, accent colour, timezone, enabled modules; Settings appraisal fields actually saved. |
| **M8** | Notifications, AI and security audit | 18, 19, 21 | Tenant-branded emails; AI retrieval authorised per user and tenant before the prompt; full cross-tenant attack suite (identifiers, search, exports, documents, AI, SSE, calendar). |
| **M9** | Tests, CI/Docker, docs, UI | 22, 23, 24, 25 | Remaining tests from the list of 30; CI with two tenants; Docker; production, backup and rollback docs; Super Admin visual identity; acceptance checklist. |

Phase 11 (preserve every module) and Phase 12 (approval workflow) are verified at **every** checkpoint: the 38 existing suites must stay green, run inside a tenant.

### Files to modify (M1)

- `server/src/config/database.ts` — root connection, plus the platform connection helper.
- `server/src/models/*.ts` (35) — replace `mongoose.model(name, schema)` with `tenantModel(name, schema)`. This is a one-line change per model.
- `server/src/middleware/requireAuth.ts`, `utils/jwt.ts`, `models/Session.ts` usage — tenant claim and context.
- `server/src/utils/institution.ts`, `routes/public.routes.ts` — tenant-keyed caches.
- `server/src/scripts/run-tests.ts`, `seed.ts`, `seed-sample.ts` — seed into a tenant context.

### New files (M1)

- `server/src/tenancy/context.ts` (AsyncLocalStorage, `runInTenant`, `currentTenant`)
- `server/src/tenancy/tenantModel.ts` (proxy and schema registry)
- `server/src/tenancy/connectionManager.ts` (root connection, `useDb` cache, health, index sync)
- `server/src/platform/models/{Institution,PlatformUser,ProvisioningRun,PlatformAuditLog}.ts`
- `server/src/tenancy/resolveTenant.ts` (slug and token resolution, status checks, short cache)
- `server/src/scripts/test-phase64-tenancy.ts` (isolation, fail-closed and concurrency tests)

---

## 8. Migration risks

| Risk | Mitigation |
|---|---|
| Proxy misses a Mongoose feature used somewhere (static `Model.prototype` checks, `instanceof Model`, discriminators) | The full 38-suite run after M1; grep for `instanceof` and discriminators before the switch; spike already covers create/save/find/populate/hooks/indexes. |
| Code running outside a request (seeds, scripts, SSE heartbeats, background work) has no context and fails closed | Every script and job wraps work in `runInTenant(...)`; the failure is loud by design. |
| Index builds per new tenant | `Model.syncIndexes()` per tenant during provisioning (an INDEXES step). |
| Existing sessions are invalidated (the token gains a tenant claim) | Expected; users sign in once. |
| Migrating the wrong database | The migration script takes explicit source and target, refuses non-`fc_t_` targets and non-empty targets, writes a manifest with counts, and never deletes the source. |
| Shared MongoDB server with unrelated projects | Reserved prefixes `fc_platform` and `fc_t_*`; an allow-list check in the connection manager. |
| No local transactions | Resumable provisioning; production on a replica set. |

## 9. Compatibility requirements

- All 38 existing suites pass unchanged in behaviour, run inside a tenant.
- Every existing API path keeps working for signed-in users (the tenant comes from the token, so the URLs do not change).
- Only unauthenticated routes gain a slug variant; the old paths return a clear "choose your institution" error instead of guessing.
- No module is removed or simplified.

## 10. Test requirements

- **M1**: new `test-phase64-tenancy` covering fail-closed, isolation between tenants A and B, 200 concurrent mixed requests, a suspended tenant being rejected, and a forged token tenant being rejected.
- **Every milestone**: the full `npm test` run.
- Plus the remaining items from the prompt's 30-item test list, each in the milestone that introduces the feature.

## 11. Decisions needed from the product owner before M1

1. **KPRIET migration source**: migrate `kpriet-fms-backup-20261026` as the KPRIET tenant (recommended; it is the only copy of the KPRIET data).
2. **Super Admin bootstrap**: create the first platform account with a one-time CLI command (`npm run platform:create-admin`) that prints a single-use activation link. No default password.
3. **Local development**: keep the standalone MongoDB (no change to your other projects).

---

## Progress log

### M1 — Tenant foundation: done (commit `3c10cdf`, 2026-10-28)

- Registry `fc_platform.institutions`; tenant context; tenant-model proxies for all 34 models plus seed bookkeeping; `tid` session claim; `/api/t/:slug` discovery routes; per-tenant caches, notification streams, calendar URLs and email links; `--tenant` for scripts; `tenant:register` and `tenant:copy`; per-tenant backup/restore; two-institution test runner; phase 64 isolation suite; web institution finder.
- Tests: 39/39 (38 existing, now running inside tenant A, plus phase 64).
- Data: `kpriet-fms` copied unchanged into `fc_t_demo` (35 collections, 7,627 documents, counts verified) and registered as `demo`. `kpriet-fms` and `kpriet-fms-backup-20261026` are untouched.
- Rollback: check out `3266dfd`; the old `kpriet-fms` database still holds the demo data.
- **Still shared between tenants (planned):** uploaded files (`uploads/`, `storage/`) and the AI uploads root (M3 file move, M8 authorised downloads); there is no Super Admin console yet (M4); institutions are created with the CLI only.

### M2 — Institution-aware sign-in and public routes: done (2026-10-28)

- No account enumeration: one 401 message for unknown account, wrong password and locked account; unknown accounts also run a bcrypt comparison so timing matches; a locked account refuses even the right password with the same message.
- Registration: an existing email or employee ID gets the same 201 answer as a new registration; the mailbox owner is emailed instead; no account is created. `verify-email` no longer confirms that an address is already verified. Roles cannot be self-assigned (always pending FACULTY).
- Email domains come from the registry's `officialEmailDomains` (several allowed) for registration, bulk import and public branding; fallback is the settings contact email's domain.
- `/auth/me` returns `institutionCode`; the web app follows the session's institution.
- Web app: only pre-sign-in calls use `/api/t/<code>`; signed-in calls use `/api` (institution from the token), so a stale browser choice cannot interfere. Query cache cleared on sign-in, two-step sign-in and sign-out. Remembered ID, recent searches and ORCID are stored per institution. Shareable sign-in links `/i/<code>`. Registration form offers every registered domain.
- Tests: new phase 65 (enumeration, timing, per-institution lockout, tenant-bound 2FA, duplicate registration, role escalation, registry domains, email links).
- Not in M2 (later milestones): Super Admin sign-in (M4); subdomain/custom-domain resolution (optional, later).

### M3 — KPRIET migration and per-institution files: done (2026-10-28)

- **Files:** uploads and the document vault are stored per institution (`storage/tenants/<code>/uploads`, `.../secure_documents`); `/uploads/...` links and vault paths in records are unchanged and are resolved inside the signed-in institution's folder (the open shared `/uploads` is gone). AI file reading, backup and restore are per institution (restore no longer wipes other institutions' files). Seeds and tests write to their own institution/test folders.
- **Tools:** `tenant:migrate` (archive → restore proof in a scratch database → copy → count/hash/reference verification → register with index build), `tenant:files` (copies referenced files, SHA-256 verified, reports missing sources, never deletes originals), `registerInstitution()` shared by CLI and migration.
- **KPRIET migrated:** `kpriet-fms-backup-20261026` → `fc_t_kpriet`: 35 collections, 12,005 documents identical (count + SHA-256), archive restore proven, 85 reference fields checked with no new dangling references (pre-existing in the source: audit logs/notifications pointing at deleted users, one appraisal at a deleted cycle). Registered ACTIVE. Source re-fingerprinted afterwards: unchanged. Archive kept at `server/backups/migration-kpriet-2026-10-27T19-47-55-619Z/`.
- **KPRIET files:** 137 referenced, 1 copied; 136 were already missing from the shared folders before the migration (90 vault sample documents and 46 upload links). The sample seed used to delete and rewrite the shared `sample_*` vault folders, which earlier test runs and the 2026-10-26 development reseed did; no other copy was found. Fixed: seeds and tests now only touch their own institution/test folders. Missing files return a clean 404.
- **Demo files:** 126 referenced, 81 copied and verified, 45 never existed (placeholder links in seed data).
- **Logins verified** for KPRIET admin, principal, HOD and faculty; KPRIET accounts cannot sign in to Demo.
- **Tests:** phase 66 (file isolation, traversal, vault isolation, migration rehearsal with restore proof, refusal to overwrite, file copy verification and idempotence).
- **Rollback:** drop `fc_t_kpriet` and its registry entry; the source database and the disk archive are untouched.

### M4 — Platform Super Admin, console and provisioning wizard: done (2026-10-28)

- **Platform identity:** `fc_platform.platform_users` (role PLATFORM_SUPER_ADMIN, not in the institutional role enum), `platform_sessions` (revocable), `platform_audit_logs`, `provisioning_runs`. Separate cookie (`fc_platform_token`), separate signing key, separate routes (`/api/platform/auth`, `/api/platform/admin`). Institutional sessions are refused by platform APIs and platform sessions by institutional APIs; CSRF applies to both cookies. Generic sign-in failures, lockout, password policy (12+ chars).
- **Bootstrap:** `npm run platform:create-admin` prints a single-use activation link (hashed token, 24 h); `--reissue` for a new link. No password is set or printed by the CLI.
- **Console (`/platform`):** real metrics from the registry and each institution's database (institutions by status, users, faculty, active accounts, pending/expired invitations, incomplete onboarding); server-side paginated, searchable, filterable list; institution page with usage counts, details, setup progress, suspend/reactivate/archive (reason required, takes effect on the next request), invitation re-send, recent platform activity; platform audit log. Only metadata and counts are returned, never academic records.
- **Wizard + provisioning:** six steps (institution, structure, administrators, faculty note, branding, review), validated on the client and again on the server (domains, unique codes/emails/IDs, at least one admin, HOD department rules; database names are never accepted). Provisioning runs REGISTRY → DATABASE (claims an empty database with a marker; refuses data it did not create) → SETTINGS → STRUCTURE → ACCOUNTS → INVITATIONS → VERIFY, each step idempotent and recorded; ACTIVE only after VERIFY; failures leave PROVISIONING_FAILED (unreachable) and can be retried from the failed step; interrupted runs can be resumed after 2 minutes.
- **Activation invites:** the existing hashed, single-use, 7-day set-password link, now naming the institution; onboarding counts as completed once an institutional administrator has signed in.
- **Tests:** phase 67 (bootstrap, activation, session separation, CSRF, metrics vs real counts, validation, provisioning end to end with the new admin activating and signing in, failure + resume, suspend/reactivate/archive, re-sent invitations, pagination/search, audit).
- **Not in M4:** importing faculty from the console (M5; the institution's own admin can already import); logo upload and per-institution theme colours in the UI (M7); exceptional support access (designed later, with time limits and audit); multiple platform roles.

### M5 — Bulk import and role/department assignment: done (2026-10-28)

- **Assignment rules** (`services/assignment.service.ts`), used by the user editor, department form, legacy `/auth/role`, bulk import and the new `/api/assignments` (Admin and Principal; only Admins can grant or remove ADMIN): HOD must head their own department, one HOD per department, confirmed replacement (previous head becomes FACULTY); one Principal, confirmed replacement; several Deans allowed; last active ADMIN cannot be demoted, deactivated or deleted; department moves update the user and faculty profile but leave past records with their department, and end any headship. All changes audited (ROLE_CHANGE, DEPARTMENT_CHANGED, HOD_ASSIGNED).
- **`Department.hodId` is now always the head's User id** (model ref, approval queue, sample seed). Existing data normalised with `npm run tenant:normalize-hod`: demo 5 and KPRIET 7 departments converted, none unresolved. This also fixes the department list showing "Not Assigned" for real heads.
- **Import engine:** all roles incl. ADMIN; columns incl. Department (code or name), Department Name, Employment Type, Account Status; modes create/update/skip/reject; department matching, mapping and optional creation; per-row plan with field-level changes; role/department changes of existing people only with explicit permission; HOD/Principal rules checked in the plan; summary counts; background job (`import_jobs`) with progress; invitations after creation; CSV downloads of errors and results; audited (USERS_IMPORTED). The original `/admin/users/import` endpoint still works unchanged.
- **Console import:** preview/commit/job/template for any ACTIVE institution, run inside that institution only, recorded in the platform audit log.
- **Tests:** phase 68 (roles and permissions, HOD/Principal/Dean rules, last admin, department moves keep history, every import mode, mapping, department creation, ADMIN import, leadership conflicts, jobs, invitations, console import isolation, suspended institution). Phase 60 now uses an invalid role (not ADMIN) to check role validation.
- **Noted, not changed:** KPRIET's CSE and ECE are headed by two of the kept test HOD accounts (from earlier test runs), and those departments have 29 active HOD-role accounts each; the new rules apply to future changes only.
- **Found during the full run and fixed:** recording an existing HOD of a department as its head was a no-op (the role and department were unchanged, so nothing was written); it now records the headship under the same replacement rule, and a head whose account is deleted or inactive counts as no head. Suites 51-qa, 53 and 54 now store heads as user ids; 53/54 still leave the head pointing at their deleted temporary user (harmless now), and phase 68 sets up its own starting point. Full run: 43/43.

### M6 — Funding application lifecycle: done (2026-10-28)

- **Two separate states per project:** `status` follows the agency (IDEA, DRAFT, APPLIED, SUBMITTED, PENDING, UNDER_REVIEW, CLARIFICATION_REQUIRED, APPROVED, SANCTIONED, ONGOING, COMPLETED, REJECTED, WITHDRAWN); `verificationStatus` is the institution's check (DRAFT, SUBMITTED, VERIFIED, RETURNED_FOR_CORRECTION, REJECTED). Only VERIFIED + SANCTIONED/ONGOING/COMPLETED counts as an achievement (funding views, leaderboard).
- **Transitions** (`services/funding-lifecycle.ts`): an explicit graph, no skipping; agency decisions (APPROVED, SANCTIONED, REJECTED) only by a reviewer (HOD of the project's department, Dean, Principal, Admin), never the investigator; notes required for clarification, rejection and withdrawal; APPLIED needs agency and amount; SANCTIONED needs amount and sanction/grant number; received ≤ sanctioned. Each step stamps its date, adds to `statusHistory` (and `reviewerComments` with a note) and is audited. A reviewer's step verifies the record; an investigator's step (past draft) sends it to the HOD. `GET /projects/:id/transitions` lists what the signed-in user may do next.
- **Edits:** the edit form can no longer change the status (it goes through the lifecycle), and an investigator's edit of a verified or returned record sends it back for verification. Fixed an older bug: the edit schema filled in create defaults, so every edit reset status to DRAFT, amounts to 0 and cleared co-investigators/documents that were not resent.
- **Approval queue:** verifying a project sets `verificationStatus` only; the agency status is untouched. Drafts are not queued.
- **Funding views:** `GET /funding/overview` — faculty: own applications; HOD: department and what awaits their verification; Dean/Principal/Admin: institution or one department, by agency and by department; requested, sanctioned/received (all records and verified), pending decisions, completed. New page `/portal/funding` (Research → Funding Pipeline) with the status dialog.
- **Existing data** (`npm run tenant:migrate-funding`): demo with `--trust-existing` (seeded through the old HOD workflow) → VERIFIED 22, SUBMITTED 4; KPRIET conservative default → SUBMITTED 26, DRAFT 2 (its HODs must verify before the money counts). `--redo` switches between the two choices for records the migration set.
- **Legacy `POST /projects/:id/approve`** now records APPROVED, or SANCTIONED when a sanction/grant number is sent (it used to mark sanctioned with no amount or order).
- **Tests:** phase 69; phases 6 and 54 unchanged. Full run 44/44.
- **Not in M6:** dashboards, institution analytics, the dean console and reports still count SANCTIONED/ONGOING/COMPLETED without the verification check; they move to verified-only counting with the rankings and analytics work in M7.

### M7 — Rankings, analytics and branding: done (2026-10-28)

- **Verified-only analytics (deferred from M6):** funded-project counts and sanctioned/received money in the HOD, Dean and Principal consoles, dashboards and charts, institution analytics, faculty comparison, the projects and funding reports, search and the AI data now count only funded projects the HOD has verified (`verifiedFundedMatch` / `VERIFIED_FUNDED_EXPR` / `isVerifiedFunded` in `funding-lifecycle.ts`). The HOD console no longer counts drafts and rejections as "ongoing"; the funding report no longer labels every row VERIFIED; department comparisons count verified publications.
- **Rankings** (`leaderboard.service.ts`, `models/RankingConfig.ts`, `/api/rankings/config`): categories publications, funded projects, funding (verified sanctioned ₹ per funding unit), patents, FDP/STTP, other activities, plus an overall weighted score; designation filter; ties share a rank and everyone tied with 10th place is listed; a shared top score names no department of the year. Weights are **versioned** (effective date, optional academic year, note, author; never edited in place; audited RANKING_CONFIG_CHANGED); Principal/Admin save, Dean reads. Every response names the version, formula, rules and how many records still await verification. **Rising** compares the same stretch of the previous year when the current year is in progress, and only people with at least N verified records in that earlier stretch (configurable) are considered. Weights changed in Settings become a new version. The Super Admin console still shows institution-level counts only.
- **Branding and settings:** logo upload (PNG/JPEG/WebP ≤ 512 KB, 32–4000 px, signature checked, SVG refused, server-named file in `storage/tenants/<code>/branding`, served at `/api/t/<code>/public/logo` with nosniff); accent colour (validated hex; sidebar markers, sign-in panel, printed reports); timezone (validated; generated-report times); switchable modules (IPR, mentoring, student projects, PhD scholars, timetable, attendance, leave, appraisal, calendar, AI — hidden in the menu and refused by the API with MODULE_DISABLED); email domains shown read-only (they belong to the platform registration); the five appraisal fields are now saved and the deadlines apply to the active appraisal cycle. Logo URL can no longer be set through the settings form.
- **Settings now enforced:** maintenance mode (non-admins get 503 and cannot sign in; the sign-in page says so); idle timeout (a browser session unused longer than the setting is revoked); upload limit per institution (413).
- **Printed output:** reports embed the logo (data URI), use the accent colour and show the time in the institution's timezone; every printed portal page (e.g. the faculty dossier) gets a letterhead with logo, name and address.
- **Security fix:** the shared in-memory cache (`utils/cache.ts`, used by analytics) was not keyed by institution, so one college could briefly be served another's cached analytics. Every key is now stored under the current institution.
- **Tests:** phase 70; phase 62 updated for the new categories and tie rule; phase 69's waiting-count check no longer depends on suite order.
- **Not in M7:** institution-branded emails (M8); faculty-dossier PDF generated on the server (printing uses the browser with the letterhead); faculty joining dates are not reliable (they default to the record's creation), so "Rising" uses earlier verified records as its history rule.

### M8 — Notifications, AI and security audit: done (2026-10-28)

- **Email** (`mail.service.ts`): every email sent inside an institution carries its name and accent colour in the header, a "[SHORT]" subject prefix, the sender name "<Institution> via FacultyCore" and a footer with the institution's contact address; welcome, reset, rejection and notification texts name the institution. Platform emails keep the product branding. Each email has one recipient.
- **Invitation reminders** (`/api/admin/users/invitations/pending|remind`, Admin): a fresh set-password link for active accounts that have never signed in, at most once a day per person (`User.invitedAt`), audited INVITATION_REMINDERS_SENT.
- **Live notifications:** streams were already keyed by institution and user; they now re-check the session, account and institution every minute and close immediately when that session is signed out ("sign out other devices", logout) or the account is deactivated.
- **Evidence files (per-owner check deferred from M5):** `/uploads/...` files are served only to the owner, the HOD of the record's department, and the Dean/Principal/Admin; anyone else gets 404. New uploads record their owner (`uploaded_files`); older files are matched the first time through the record that links to them (among the requester's own, or the HOD's department's, records). Path tricks return 404.
- **AI:** checked — each feature authorises the user before reading data (faculty: own records; HOD: own department; leadership: institution) and there is no platform-wide AI route; model output is advisory only (verification checks never change a record). Mentoring insights now send students to Gemini as S1, S2… instead of names and register numbers, and map them back on the server.
- **Other fixes:** calendar feeds stop when the institution switches the calendar module off (feeds are public, so module checks did not reach them).
- **Audit results (all covered by phase 71):** unknown institution → 404 and no default; a session from one institution is refused at another's address; an edited token claim fails its signature; headers or query parameters naming another database are ignored; health and error responses reveal no connection details; reset/activation links only work at their institution; role, department and export restrictions hold; search, notifications and audit logs stay within the institution; deactivation and suspension stop existing sessions immediately; calendar feeds are institution-bound.
- **Tests:** phase 71.
- **Not in M8:** institution-level email sender addresses (one platform `MAIL_FROM` with the institution as display name); a shared pub/sub for streams across several API instances (single-process today, noted in the code).
