# Faculty dossier — Phase 1 audit and plan (2026-10-29)

What exists today, what the dossier brief needs, and how each gap is closed. Principle: extend
existing models and modules; no parallel copies of the same record.

## Existing building blocks

| Area | Where | State |
|---|---|---|
| Faculty profile | `models/Faculty.ts`, `services/faculty.service.ts`, `pages/FacultyProfilePage.tsx` (15 tabs) | Identity, `basicInfo`, `employment` (joining date, cadre, type), research interests |
| Qualifications, experience | Embedded in Faculty, with `verificationStatus`, remarks, reviewer; own add/edit/submit routes; leadership approve/return/reject routes | Reviewed from the profile's review tab, **not** in the approval queue |
| Publications, projects/funding, patents, copyrights, consultancy, activities, student projects, mentoring, PhD | Standalone models with owner, department, academic year, status; approval queue covers publications, projects, activities, patents, copyrights, consultancy, student projects, leave, attendance corrections, appraisals | Source of truth for those records |
| Activities | `AcademicActivity`: CONFERENCE, WORKSHOP, SEMINAR, FDP, STTP; role/participation free text; certificate URL | No webinar/training types; no organiser fields; no hours |
| Certifications, awards, memberships, invited talks, guest lectures, responsibilities | Embedded arrays in Faculty, edited through the generic `/faculty/me/:section` API | **No status, no evidence, no review** |
| Embedded publications/conferences/workshops/patents/… in Faculty | Legacy copies | Duplicates of the standalone modules (not used for metrics) |
| Secure documents | `DocumentRecord` vault with hashed storage, preview/download, `relatedEntityType/Id` | PRIVATE documents hidden from HODs, so evidence could not be reviewed |
| Approval queue | `approval-queue.service.ts` + Approvals page with detail panel | One decision model (approve / return / reject) with history |
| Rankings | `leaderboard.service.ts` (M7): versioned weights, verified-only, ties, Rising | Top-10 lists per category; no per-category faculty table, no completeness, no per-faculty department figures |

## Problems found

1. **Self-verification hole:** the generic `/faculty/me/:section` API accepts `qualifications` and
   `experience` and passes the body through, so a faculty member could store a qualification as
   `VERIFIED`. Fixed in Phase 2 (verification fields are stripped; those sections must use their own routes).
2. Sidebar links "Invited Talks" and "Awards" point to activity types that do not exist.
3. Certifications have no verification or evidence, so courses cannot be counted as verified.
4. Qualifications and experience are not in the approval queue.

## Plan (each phase committed and tested separately)

| Phase | Work |
|---|---|
| 2 | Dossier summary API (identity, experience totals without double-counting overlaps, record status counts) and **profile completion** from configurable requirements (defaults + `InstitutionSettings.dossierRequirements`); completion panel on the dossier; close the self-verification hole |
| 3 | **Courses & Certifications** module (`FacultyCourse`): own page, multi-entry, secure certificate upload to the vault, statistics (self-reported vs verified, hours, by academic year), filters. **Professional development**: activities gain webinar/training/technical-event types, a standard participation role, hours and organiser fields |
| 4 | **Achievements** module (`FacultyAchievement`: awards, memberships, editorial roles, invited talks, keynotes, guest lectures, responsibilities) replacing the status-less embedded arrays; sidebar links fixed; legacy embedded items migrated |
| 5 | Approval queue covers courses, achievements, qualifications and experience; evidence preview in the review panel (HOD may open private evidence attached to a record in their department) |
| 6 | **Faculty directory** for HOD (own department) and Dean/Principal (institution): completion, verified counts, pending reviews; opens the dossier |
| 7 | **Faculty performance**: per-category rankings (rank, ties, period, verified vs submitted, completeness) and department comparison with per-faculty figures |
| 8 | Dashboard: profile completion, course statistics, "My records & verification status" page, new quick actions |
| 9 | Tests for ownership, review routing, evidence access, completion, verified-only counts, rankings, isolation; full run; migration notes |

## Status (2026-10-29)

All nine phases are implemented and covered by the phase 74 tests; the full suite passes (49/49).

- Phases 2–3, 6–7: commit `00deb1c`.
- Phases 4–5, 8–9 and the new activity types: the commit that follows it.
- Existing data: `npm run tenant:migrate-dossier -- --tenant <code>` copies profile certifications, awards, invited talks and guest lectures as drafts. A dry run on the demo institution found 36 certifications, 15 awards, 1 invited talk and 1 guest lecture. The command has not been run against any institution yet.
- Academic verification of qualifications and experience no longer accepts the Institution Admin role (HOD, Dean, Principal only), matching the dossier records.
- Not done: the faculty dashboard view itself has uncommitted edits by someone else, so the dossier reaches it only through the server data (pending submissions, a completion attention item below 80%, `dossierCompletion`) and Quick Actions. No dashboard component was changed.
