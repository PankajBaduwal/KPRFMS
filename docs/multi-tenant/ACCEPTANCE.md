# FacultyCore multi-institution transformation — acceptance checklist

Status as of 2026-10-28, after milestones M1–M9 (commits `3c10cdf` … M9). "Verified" means covered
by an automated suite that passes in the full run (`npm test`, 47 suites, two isolated test
institutions) and, where noted, checked by hand in the browser. Anything not fully met is marked
as such: nothing below is claimed beyond what was actually built and tested.

## Final acceptance criteria (prompt phase 25)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Supports multiple institutions | Met | Database per institution (`fc_t_<code>`), registry in `fc_platform`; phases 64, 71, 72 |
| 2 | Super Admin can create an institution | Met | Console wizard with resumable provisioning; phase 67; browser-checked in M4 |
| 3 | Each institution has its own database | Met | Names generated from the code, never from input; phases 64, 67 |
| 4 | KPRIET migrated without losing required data | Met, with a note | `tenant:migrate` with count, content-hash and reference checks (M3 manifest). 136 of 137 KPRIET files were already missing before migration; they are reported, not recoverable |
| 5 | First institution administrator can be provisioned | Met | Provisioning creates accounts and sends single-use activation links; phase 67 |
| 6 | Faculty created individually and in bulk | Met | Admin user editor; planned import with modes, preview, jobs; phase 68 |
| 7 | Secure account activation | Met | Hashed single-use links with expiry, per institution; reminders (once a day); phases 60, 67, 71 |
| 8 | Change and reset passwords | Met | Phases 60, 65; reset links only work at their institution (phase 71) |
| 9 | Departments and roles assigned correctly | Met | Assignment rules (one HOD per department, one Principal, last admin kept); phase 68 |
| 10 | Faculty can submit records | Met | Existing module suites (phases 1–59) |
| 11 | HODs verify records within their departments | Met | Approval queue department limits; phases 53, 54, 63 |
| 12 | Deans and Principals perform authorised reviews | Met | Phases 51, 54, 69 (funding decisions) |
| 13 | Funding: applied, pending, approved, sanctioned, completed | Met | 13-stage lifecycle with checked transitions and audit; phase 69; browser-checked |
| 14 | Rankings count only eligible verified records | Met | Phases 62, 70 (an unverified sanction never ranks) |
| 15 | Department rankings are institution-specific | Met | Per-institution database and cache; phases 70, 71 |
| 16 | All existing FMS modules keep working | Met | The original suites (phases 1–63) pass inside institution A in every full run |
| 17 | Super Admin sees institution-level counts and usage | Met | Console dashboard with real counts; no cross-institution faculty ranking; phase 67 |
| 18 | Institutional branding is independent | Met | Name, logo, colour, timezone, modules per institution; emails branded; phases 70, 71 |
| 19 | Documents, AI, search, exports and notifications isolated | Met | Phase 71 (files per owner, search, notifications, audit logs, exports, AI authorisation, streams) |
| 20 | Cross-tenant access tests pass | Met | Phases 64, 66, 71, 72 |
| 21 | Existing automated tests still pass | Met | Full run green |
| 22 | New multi-tenant tests pass | Met | Phases 64–72 |
| 23 | CI and Docker configuration functional | **Configured, not yet verified** | Workflow and compose updated for multi-tenancy; `docker compose config` validates. The images were not built locally (Docker daemon not running) and the workflow has not run on GitHub because nothing has been pushed |
| 24 | Documentation: setup, migration, recovery, deployment | Met | README; `docs/deployment/PRODUCTION.md`; `docs/multi-tenant/PHASE-1-AUDIT-AND-PLAN.md` (progress log) |
| 25 | No unimplemented feature reported as complete | — | See "Known gaps" below |

## Required test areas (prompt phase 22)

| # | Area | Suite(s) |
|---|---|---|
| 1 | Super Admin authentication | 67 |
| 2 | Institution creation | 67 |
| 3 | Institution provisioning | 67 |
| 4 | Provisioning failure recovery | 67 ("A failed setup is never usable and resumes") |
| 5 | Activation and suspension | 64, 67, 71 |
| 6 | Individual account creation | 51, 68 |
| 7 | Bulk account import | 68 (and 60 for the original importer) |
| 8 | Department assignment | 68 |
| 9 | Role assignment | 68 |
| 10 | Account activation | 60, 67, 71 |
| 11 | Password change | 60 |
| 12 | Password reset | 60, 65, 71 |
| 13 | Faculty login | 64, 65 |
| 14 | HOD department restrictions | 53, 63, 69, 71 |
| 15 | Principal institution restrictions | 64, 69, 70 |
| 16 | Dean institution restrictions | 69, 70 |
| 17 | Document isolation | 66, 71 |
| 18 | Search isolation | 71 |
| 19 | Notification isolation | 60, 71 |
| 20 | AI retrieval isolation | 61, 71 (authorisation checked with AI switched off; live Gemini calls are not made in tests) |
| 21 | Funding workflow | 69 |
| 22 | Verified rankings | 62, 70 |
| 23 | Department rankings | 62, 70 |
| 24 | Institution branding | 70, 71 |
| 25 | Data migration | 66 (verified migration), 69 (funding migration) |
| 26 | Audit history | 67, 68, 69, 70, 71 |
| 27 | Cross-tenant request attacks | 64, 71 |
| 28 | Suspended institution access | 64, 71 |
| 29 | Concurrent requests to different tenants | 64, 72 |
| 30 | Database connection failures | 72 (startup without a database, 503 on database errors, readiness) |

The required cross-tenant scenario (a user of institution A attempting B's records through
identifiers, search, export, documents and AI, repeated for HOD and Admin) is covered by phases
64 and 71.

## Known gaps (not implemented or not verified)

* **Not deployed.** No production server exists yet; `docs/deployment/PRODUCTION.md` is the plan.
* **CI and Docker images** have not run outside this machine (see criterion 23).
* **Platform console two-factor sign-in** is not implemented (institution users have it).
* **Live notifications** run in one API process; several API instances need a shared pub/sub.
* **File storage** is a local volume; several API hosts need shared or object storage.
* **Emails** use one platform sender address with the institution as display name.
* **Rankings "Rising"** uses earlier verified records as its history rule because faculty joining
  dates are not reliable in existing data.
* **Server-side PDF dossiers** are not generated; printing uses the browser with an institution
  letterhead.
* **KPRIET data notes:** CSE and ECE are headed by test HOD accounts from earlier test runs, and 26
  older funded projects await HOD verification after the conservative funding migration.
