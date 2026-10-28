import { Types } from 'mongoose';
import {
  SEARCH_ENTITY_TYPES,
  type SearchEntityType,
  type ISearchResultItem,
  type ISearchGroup,
  type IGlobalSearchResponse,
} from '../types/search.js';
import { ROLES, type Role } from '../permissions/roles.js';
import {
  Faculty,
  Department,
  Subject,
  Publication,
  Project,
  StudentProject,
  PhdScholar,
  AcademicActivity,
  Patent,
} from '../models/index.js';
import { appCache } from '../utils/cache.js';
import { verifiedFundedMatch } from './funding-lifecycle.js';

export interface ISearchUser {
  userId: string;
  role: Role;
  departmentId?: string;
  facultyId?: string;
  name?: string;
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Builds RBAC filter for departmental / personal resources.
 * - ADMIN, PRINCIPAL, DEAN: Full institution-wide read access.
 * - HOD: Full access within own department; for other departments, only VERIFIED/published.
 * - FACULTY: Full access to own records; for others, strictly only VERIFIED/published.
 */
function buildRbacFilter(
  user: ISearchUser,
  facultyField = 'facultyId',
  deptField = 'departmentId',
  verifiedConditionsOverride?: any[]
): any {
  if (user.role === ROLES.ADMIN || user.role === ROLES.PRINCIPAL || user.role === ROLES.DEAN) {
    return null;
  }

  const verifiedConditions = verifiedConditionsOverride || [
    { verificationStatus: 'VERIFIED' },
    { status: 'VERIFIED' },
    { status: 'COMPLETED' },
    { status: 'GRANTED' },
  ];

  if (user.role === ROLES.HOD) {
    const orClauses: any[] = [...verifiedConditions];
    if (user.departmentId && Types.ObjectId.isValid(user.departmentId)) {
      orClauses.push({ [deptField]: new Types.ObjectId(user.departmentId) });
    }
    return { $or: orClauses };
  }

  // FACULTY role
  const ownClauses: any[] = [];
  if (user.facultyId && Types.ObjectId.isValid(user.facultyId)) {
    ownClauses.push({ [facultyField]: new Types.ObjectId(user.facultyId) });
  }
  if (user.userId && Types.ObjectId.isValid(user.userId)) {
    ownClauses.push({ userId: new Types.ObjectId(user.userId) });
  }

  return {
    $or: [...ownClauses, ...verifiedConditions],
  };
}

function combineQuery(rbac: any, query: any): any {
  if (!rbac) return query;
  return { $and: [rbac, query] };
}

export const searchService = {
  async search(
    user: ISearchUser,
    queryString: string,
    filterType?: SearchEntityType
  ): Promise<IGlobalSearchResponse> {
    const rawQuery = queryString.trim();
    if (!rawQuery || rawQuery.length < 2) {
      return { query: rawQuery, totalCount: 0, groups: [] };
    }

    const cacheKey = `search:${user.userId || ''}:${user.role}:${user.departmentId || ''}:${rawQuery.toLowerCase()}:${filterType || 'all'}`;
    const cached = appCache.get<IGlobalSearchResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const regex = new RegExp(escapeRegex(rawQuery), 'i');
    const limitPerGroup = 6;
    const groups: ISearchGroup[] = [];

    // Run parallel queries across all entity collections with projections
    const [
      faculties,
      departments,
      subjects,
      publications,
      projects,
      studentProjects,
      phdScholars,
      conferences,
      workshops,
      seminars,
      patents,
      projectDocs,
    ] = await Promise.all([
      // 1. Faculty & Employee ID
      (!filterType || filterType === SEARCH_ENTITY_TYPES.FACULTY)
        ? Faculty.find({
            $or: [
              { name: regex },
              { employeeId: regex },
              { designation: regex },
              { 'basicInfo.alternateEmail': regex },
            ],
          })
            .select('name employeeId designation departmentId profilePhoto basicInfo')
            .populate('departmentId', 'name code')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 2. Department
      (!filterType || filterType === SEARCH_ENTITY_TYPES.DEPARTMENT)
        ? Department.find({
            isActive: true,
            $or: [{ name: regex }, { code: regex }],
          })
            .select('name code type')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 3. Subject / Course
      (!filterType || filterType === SEARCH_ENTITY_TYPES.SUBJECT)
        ? Subject.find({
            isActive: true,
            $or: [{ code: regex }, { name: regex }, { department: regex }],
          })
            .select('code name department credits')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 4. Publication
      (!filterType || filterType === SEARCH_ENTITY_TYPES.PUBLICATION)
        ? Publication.find(
            combineQuery(
              buildRbacFilter(user, 'facultyId', 'departmentId', [
                { verificationStatus: 'VERIFIED' },
              ]),
              {
                $or: [
                  { title: regex },
                  { journalName: regex },
                  { bookTitle: regex },
                  { authors: regex },
                  { doi: regex },
                ],
              }
            )
          )
            .select('title journalOrConference publisher doi academicYear publicationDate facultyId verificationStatus journalName bookTitle authors indexing')
            .populate('facultyId', 'name employeeId')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 5. Research Project
      (!filterType || filterType === SEARCH_ENTITY_TYPES.PROJECT)
        ? Project.find(
            combineQuery(
              buildRbacFilter(user, 'facultyId', 'departmentId', [
                verifiedFundedMatch(),
              ]),
              {
                $or: [
                  { title: regex },
                  { fundingAgency: regex },
                  { projectNumber: regex },
                  { piName: regex },
                ],
              }
            )
          )
            .select('title fundingAgency projectNumber sanctionYear grantAmount sanctionedAmount facultyId status piName')
            .populate('facultyId', 'name employeeId')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 6. Student Project
      (!filterType || filterType === SEARCH_ENTITY_TYPES.STUDENT_PROJECT)
        ? StudentProject.find(
            combineQuery(buildRbacFilter(user, 'guideFacultyId'), {
              $or: [
                { projectTitle: regex },
                { guide: regex },
                { teamMembers: regex },
                { registerNumbers: regex },
              ],
            })
          )
            .select('projectTitle guide teamMembers projectType academicYear status departmentId batch')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 7. PhD Scholar
      (!filterType || filterType === SEARCH_ENTITY_TYPES.PHD_SCHOLAR)
        ? PhdScholar.find(
            combineQuery(buildRbacFilter(user, 'supervisorFacultyId'), {
              $or: [
                { scholarName: regex },
                { registrationNumber: regex },
                { title: regex },
                { supervisor: regex },
              ],
            })
          )
            .select('scholarName registrationNumber title supervisor status stage progress thesisStatus')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 8. Conference
      (!filterType || filterType === SEARCH_ENTITY_TYPES.CONFERENCE)
        ? AcademicActivity.find(
            combineQuery(buildRbacFilter(user), {
              activityType: 'CONFERENCE',
              $or: [
                { title: regex },
                { organizer: regex },
                { presentationTitle: regex },
                { facultyName: regex },
              ],
            })
          )
            .select('title organizer presentationTitle facultyName activityType academicYear startDate endDate paperPresented')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 9. Workshop
      (!filterType || filterType === SEARCH_ENTITY_TYPES.WORKSHOP)
        ? AcademicActivity.find(
            combineQuery(buildRbacFilter(user), {
              activityType: 'WORKSHOP',
              $or: [{ title: regex }, { organizer: regex }, { facultyName: regex }],
            })
          )
            .select('title organizer facultyName activityType academicYear startDate endDate mode')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 10. Seminar
      (!filterType || filterType === SEARCH_ENTITY_TYPES.SEMINAR)
        ? AcademicActivity.find(
            combineQuery(buildRbacFilter(user), {
              activityType: 'SEMINAR',
              $or: [
                { title: regex },
                { organizer: regex },
                { topic: regex },
                { facultyName: regex },
              ],
            })
          )
            .select('title organizer topic facultyName activityType academicYear startDate endDate')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 11. Patent
      (!filterType || filterType === SEARCH_ENTITY_TYPES.PATENT)
        ? Patent.find(
            combineQuery(buildRbacFilter(user), {
              $or: [
                { title: regex },
                { applicationNumber: regex },
                { patentNumber: regex },
                { inventors: regex },
              ],
            })
          )
            .select('title applicationNumber patentNumber inventors status country facultyId')
            .populate('facultyId', 'name employeeId')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),

      // 12. Documents in Projects & Supporting Documents
      (!filterType || filterType === SEARCH_ENTITY_TYPES.DOCUMENT)
        ? Project.find(
            combineQuery(buildRbacFilter(user), {
              'documents.title': regex,
            })
          )
            .select('_id title documents')
            .limit(limitPerGroup)
            .lean()
        : Promise.resolve([]),
    ]);

    // Map Faculty Results
    if (faculties.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.FACULTY,
        label: 'Faculty & Researchers',
        icon: 'bi-person-badge',
        count: faculties.length,
        items: faculties.map((f: any) => ({
          id: f._id.toString(),
          type: SEARCH_ENTITY_TYPES.FACULTY,
          title: f.name,
          subtitle: `${f.employeeId || 'ID Pending'} • ${f.designation || 'Faculty'}`,
          description: (f.departmentId as any)?.name || 'Department of Engineering',
          url: `/portal/directory`,
          badge: f.verificationStatus || 'VERIFIED',
          badgeVariant: f.verificationStatus === 'VERIFIED' ? 'success' : 'neutral',
          metadata: {
            employeeId: f.employeeId,
            designation: f.designation,
            department: (f.departmentId as any)?.name || 'Engineering',
            email: f.basicInfo?.alternateEmail,
            cadre: f.employment?.cadre,
          },
          sourceCollection: 'faculties',
        })),
      });
    }

    // Map Department Results
    if (departments.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.DEPARTMENT,
        label: 'Academic Departments',
        icon: 'bi-building',
        count: departments.length,
        items: departments.map((d: any) => ({
          id: d._id.toString(),
          type: SEARCH_ENTITY_TYPES.DEPARTMENT,
          title: d.name,
          subtitle: `Department Code: ${d.code}`,
          url: `/portal/directory`,
          badge: 'Active Dept',
          badgeVariant: 'primary',
          metadata: {
            code: d.code,
            name: d.name,
            type: d.type || 'Academic',
          },
          sourceCollection: 'departments',
        })),
      });
    }

    // Map Subject Results
    if (subjects.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.SUBJECT,
        label: 'Courses & Curriculum',
        icon: 'bi-book',
        count: subjects.length,
        items: subjects.map((s: any) => ({
          id: s._id.toString(),
          type: SEARCH_ENTITY_TYPES.SUBJECT,
          title: `${s.code} - ${s.name}`,
          subtitle: `Dept: ${s.department} • Semester ${s.semester}`,
          description: `${s.credits || 3} Credits (L-T-P: ${s.lectureHours || 3}-${s.tutorialHours || 0}-${s.practicalHours || 0})`,
          url: `/portal/subjects`,
          badge: `${s.credits || 3} Credits`,
          badgeVariant: 'info',
          metadata: {
            code: s.code,
            name: s.name,
            department: s.department,
            semester: s.semester,
            credits: s.credits,
            hours: `L:${s.lectureHours || 3} T:${s.tutorialHours || 0} P:${s.practicalHours || 0}`,
          },
          sourceCollection: 'subjects',
        })),
      });
    }

    // Map Publication Results
    if (publications.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.PUBLICATION,
        label: 'Publications & Papers',
        icon: 'bi-journal-bookmark',
        count: publications.length,
        items: publications.map((p: any) => ({
          id: p._id.toString(),
          type: SEARCH_ENTITY_TYPES.PUBLICATION,
          title: p.title,
          subtitle: `${p.journalName || p.bookTitle || p.journalOrConference || 'Publication'} (${p.academicYear || p.publicationYear || 'Recent'})`,
          description: `Authors: ${p.authors || p.facultyId?.name || 'Faculty Author'} • Indexing: ${p.indexing || 'SCOPUS'}`,
          url: `/portal/publications`,
          badge: p.verificationStatus || 'PENDING',
          badgeVariant: p.verificationStatus === 'VERIFIED' ? 'success' : 'warning',
          metadata: {
            journal: p.journalName || p.bookTitle || p.journalOrConference || 'Journal Publication',
            authors: p.authors || p.facultyId?.name,
            year: p.academicYear || p.publicationYear,
            doi: p.doi,
            indexing: p.indexing || 'SCOPUS',
            publisher: p.publisher,
            status: p.verificationStatus,
          },
          sourceCollection: 'publications',
        })),
      });
    }

    // Map Project Results
    if (projects.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.PROJECT,
        label: 'Sponsored Research & Grants',
        icon: 'bi-cash-coin',
        count: projects.length,
        items: projects.map((pr: any) => ({
          id: pr._id.toString(),
          type: SEARCH_ENTITY_TYPES.PROJECT,
          title: pr.title,
          subtitle: `Agency: ${pr.fundingAgency} • PI: ${pr.piName || pr.facultyId?.name || 'PI'}`,
          description: `Sanctioned: ₹${(pr.sanctionedAmount || pr.grantAmount || 0).toLocaleString('en-IN')} • Status: ${pr.status}`,
          url: `/portal/projects`,
          badge: pr.status || 'SANCTIONED',
          badgeVariant: pr.status === 'COMPLETED' ? 'success' : 'primary',
          metadata: {
            fundingAgency: pr.fundingAgency,
            projectNumber: pr.projectNumber,
            pi: pr.piName || pr.facultyId?.name,
            sanctionedAmount: pr.sanctionedAmount || pr.grantAmount,
            status: pr.status,
            sanctionYear: pr.sanctionYear,
          },
          sourceCollection: 'projects',
        })),
      });
    }

    // Map Student Project Results
    if (studentProjects.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.STUDENT_PROJECT,
        label: 'Student Capstone Projects',
        icon: 'bi-kanban',
        count: studentProjects.length,
        items: studentProjects.map((sp: any) => ({
          id: sp._id.toString(),
          type: SEARCH_ENTITY_TYPES.STUDENT_PROJECT,
          title: sp.projectTitle,
          subtitle: `Guide: ${sp.guide} • Batch ${sp.batch || ''}`,
          description: `Team: ${Array.isArray(sp.teamMembers) ? sp.teamMembers.join(', ') : sp.teamMembers || 'Students'}`,
          url: `/portal/student-projects`,
          badge: sp.projectType || 'UG',
          badgeVariant: 'neutral',
          metadata: {
            guide: sp.guide,
            teamMembers: Array.isArray(sp.teamMembers) ? sp.teamMembers.join(', ') : sp.teamMembers,
            batch: sp.batch,
            academicYear: sp.academicYear,
            projectType: sp.projectType,
            status: sp.status,
          },
          sourceCollection: 'studentprojects',
        })),
      });
    }

    // Map PhD Scholar Results
    if (phdScholars.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.PHD_SCHOLAR,
        label: 'Doctoral Scholars',
        icon: 'bi-mortarboard-fill',
        count: phdScholars.length,
        items: phdScholars.map((ph: any) => ({
          id: ph._id.toString(),
          type: SEARCH_ENTITY_TYPES.PHD_SCHOLAR,
          title: `${ph.scholarName} (${ph.registrationNumber})`,
          subtitle: `Title: ${ph.title}`,
          description: `Supervisor: ${ph.supervisor} • Stage: ${ph.stage} (${ph.progress || 0}%)`,
          url: `/portal/phd-scholars`,
          badge: ph.stage || 'RESEARCH',
          badgeVariant: ph.thesisStatus === 'AWARDED' ? 'success' : 'info',
          metadata: {
            scholarName: ph.scholarName,
            registrationNumber: ph.registrationNumber,
            supervisor: ph.supervisor,
            stage: ph.stage,
            progress: ph.progress,
            thesisStatus: ph.thesisStatus,
            title: ph.title,
          },
          sourceCollection: 'phdscholars',
        })),
      });
    }

    // Map Conference Results
    if (conferences.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.CONFERENCE,
        label: 'Conferences & Proceedings',
        icon: 'bi-easel',
        count: conferences.length,
        items: conferences.map((c: any) => ({
          id: c._id.toString(),
          type: SEARCH_ENTITY_TYPES.CONFERENCE,
          title: c.presentationTitle || c.title,
          subtitle: `Organizer: ${c.organizer || 'Conference Body'}`,
          description: `Participant: ${c.facultyName} • Paper: ${c.paperPresented ? 'Presented' : 'Attended'}`,
          url: `/portal/activities`,
          badge: 'Conference',
          badgeVariant: 'primary',
          metadata: {
            organizer: c.organizer,
            presentationTitle: c.presentationTitle,
            facultyName: c.facultyName,
            activityType: 'Conference',
            academicYear: c.academicYear,
            paperPresented: c.paperPresented ? 'Yes' : 'No',
          },
          sourceCollection: 'academicactivities',
        })),
      });
    }

    // Map Workshop Results
    if (workshops.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.WORKSHOP,
        label: 'Workshops & Training',
        icon: 'bi-tools',
        count: workshops.length,
        items: workshops.map((w: any) => ({
          id: w._id.toString(),
          type: SEARCH_ENTITY_TYPES.WORKSHOP,
          title: w.title,
          subtitle: `Host: ${w.organizer || 'Organizing Institute'}`,
          description: `Participant: ${w.facultyName} • Mode: ${w.mode || 'Offline'}`,
          url: `/portal/activities`,
          badge: 'Workshop',
          badgeVariant: 'warning',
          metadata: {
            organizer: w.organizer,
            facultyName: w.facultyName,
            activityType: 'Workshop',
            mode: w.mode,
            academicYear: w.academicYear,
          },
          sourceCollection: 'academicactivities',
        })),
      });
    }

    // Map Seminar Results
    if (seminars.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.SEMINAR,
        label: 'Seminars & Symposia',
        icon: 'bi-megaphone',
        count: seminars.length,
        items: seminars.map((s: any) => ({
          id: s._id.toString(),
          type: SEARCH_ENTITY_TYPES.SEMINAR,
          title: s.title,
          subtitle: `Host: ${s.organizer || 'Organizer'}`,
          description: `Topic: ${s.topic || s.title} • Faculty: ${s.facultyName}`,
          url: `/portal/activities`,
          badge: 'Seminar',
          badgeVariant: 'info',
          metadata: {
            organizer: s.organizer,
            topic: s.topic,
            facultyName: s.facultyName,
            activityType: 'Seminar',
            academicYear: s.academicYear,
          },
          sourceCollection: 'academicactivities',
        })),
      });
    }

    // Map Patent Results
    if (patents.length > 0) {
      groups.push({
        type: SEARCH_ENTITY_TYPES.PATENT,
        label: 'Patents & Innovations',
        icon: 'bi-lightbulb',
        count: patents.length,
        items: patents.map((pt: any) => ({
          id: pt._id.toString(),
          type: SEARCH_ENTITY_TYPES.PATENT,
          title: pt.title,
          subtitle: `App No: ${pt.applicationNumber} • Status: ${pt.status}`,
          description: `Inventors: ${Array.isArray(pt.inventors) ? pt.inventors.join(', ') : pt.facultyId?.name || 'Inventor'}`,
          url: `/portal/ipr-consultancy`,
          badge: pt.status || 'FILED',
          badgeVariant: pt.status === 'GRANTED' ? 'success' : 'primary',
          metadata: {
            applicationNumber: pt.applicationNumber,
            patentNumber: pt.patentNumber,
            inventors: Array.isArray(pt.inventors) ? pt.inventors.join(', ') : pt.facultyId?.name,
            status: pt.status,
            country: pt.country,
          },
          sourceCollection: 'patents',
        })),
      });
    }

    // Map Document Results
    if (projectDocs.length > 0) {
      const docItems: ISearchResultItem[] = [];
      for (const pr of projectDocs) {
        if (pr.documents && Array.isArray(pr.documents)) {
          for (const doc of pr.documents) {
            if (regex.test(doc.title) || regex.test(doc.fileName)) {
              docItems.push({
                id: (doc as any)._id ? (doc as any)._id.toString() : pr._id.toString(),
                type: SEARCH_ENTITY_TYPES.DOCUMENT,
                title: doc.title,
                subtitle: `Project Attachment: ${pr.title}`,
                description: `File: ${doc.fileName} (${doc.documentType || 'DOCUMENT'})`,
                url: `/portal/documents`,
                badge: doc.documentType || 'FILE',
                badgeVariant: 'neutral',
                metadata: {
                  fileName: doc.fileName,
                  documentType: doc.documentType,
                  projectTitle: pr.title,
                },
                sourceCollection: 'projects.documents',
              });
            }
          }
        }
      }

      if (docItems.length > 0) {
        groups.push({
          type: SEARCH_ENTITY_TYPES.DOCUMENT,
          label: 'Documents & Attachments',
          icon: 'bi-file-earmark-pdf',
          count: docItems.length,
          items: docItems.slice(0, limitPerGroup),
        });
      }
    }

    const totalCount = groups.reduce((acc, g) => acc + g.count, 0);

    const result: IGlobalSearchResponse = {
      query: rawQuery,
      totalCount,
      groups,
    };

    appCache.set(cacheKey, result, 30); // Cache search for 30s
    return result;
  },
};
