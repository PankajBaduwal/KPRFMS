import { Types } from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { Patent } from '../models/Patent.js';
import { Copyright } from '../models/Copyright.js';
import { Consultancy } from '../models/Consultancy.js';
import { StudentProject } from '../models/StudentProject.js';
import { LeaveApplication } from '../models/LeaveApplication.js';
import { AttendanceCorrectionRequest } from '../models/AttendanceCorrectionRequest.js';
import { FacultyAttendance } from '../models/FacultyAttendance.js';
import { FacultyAppraisal } from '../models/FacultyAppraisal.js';
import { ApprovalHistory, ApprovalActionType } from '../models/ApprovalHistory.js';
import { AuditLog } from '../models/AuditLog.js';
import { notificationService } from './notification.service.js';
import { ROLES } from '../permissions/roles.js';
import { appCache } from '../utils/cache.js';

export type UnifiedStatus = 'PENDING' | 'APPROVED' | 'RETURNED_FOR_CORRECTION' | 'REJECTED';

export interface UnifiedApprovalRecord {
  id: string;
  recordType: string;
  recordTypeLabel: string;
  title: string;
  academicYear: string;
  submittedDate: Date;
  status: UnifiedStatus;
  rawStatus: string;
  faculty: {
    _id: string;
    name: string;
    employeeId: string;
    designation: string;
    email?: string;
    profilePhoto?: string;
  };
  department: {
    _id: string;
    name: string;
    code: string;
  };
  summary: string;
  actionNote?: string;
  hasDocuments: boolean;
  documentCount: number;
  updatedAt: Date;
}

export class ApprovalQueueService {
  /**
   * Helper: Resolve authorized department for current user
   */
  async resolveDepartmentId(
    user: { id?: Types.ObjectId | string; _id?: Types.ObjectId | string; role: string },
    requestedDeptId?: string
  ): Promise<Types.ObjectId> {
    const isHod = user.role === ROLES.HOD;
    const isElevated = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN].includes(user.role as any);
    const userId = user.id || user._id;

    if (isHod) {
      const faculty = await Faculty.findOne({ userId });
      if (!faculty) {
        throw AppError.forbidden('HOD profile not found. Please contact administration.');
      }

      // hodId is the HOD's user id (older data may still hold the faculty profile id)
      let department = await Department.findOne({ hodId: { $in: [new Types.ObjectId(String(userId)), faculty._id] } });
      if (!department && faculty.departmentId) {
        department = await Department.findById(faculty.departmentId);
      }

      if (!department) {
        throw AppError.forbidden('You are not assigned as HOD of any department.');
      }

      // If HOD requested another department, reject it
      if (requestedDeptId && requestedDeptId !== department._id.toString()) {
        throw AppError.forbidden('HOD can only access their authorized department data.');
      }

      return department._id;
    }

    if (isElevated) {
      if (requestedDeptId) {
        const department = await Department.findById(requestedDeptId);
        if (!department) {
          throw AppError.notFound('Requested department not found');
        }
        return department._id;
      }

      // Default to first active department
      const firstDept = await Department.findOne({ isActive: true });
      if (!firstDept) {
        throw AppError.notFound('No active department found in the system');
      }
      return firstDept._id;
    }

    throw AppError.forbidden('Unauthorized access to department approval queue.');
  }

  /**
   * Fetch all unified approval records for a department with filtering, sorting, and pagination
   */
  async getApprovalQueue(options: {
    departmentId: Types.ObjectId;
    statusTab?: string;
    recordType?: string;
    academicYear?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      departmentId,
      statusTab = 'ALL',
      recordType,
      academicYear,
      search,
      page = 1,
      limit = 15,
      sortBy = 'submittedDate',
      sortOrder = 'desc',
    } = options;

    const dept = await Department.findById(departmentId).select('name code');
    const deptInfo = {
      _id: departmentId.toString(),
      name: dept?.name || 'Department',
      code: dept?.code || 'DEPT',
    };

    const allRecords: UnifiedApprovalRecord[] = [];

    // Query 1: Publications
    if (!recordType || recordType === 'PUBLICATION') {
      const pubs = await Publication.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const p of pubs) {
        const fac: any = p.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (p.verificationStatus === 'VERIFIED') status = 'APPROVED';
        else if (p.verificationStatus === 'RETURNED_FOR_CORRECTION') status = 'RETURNED_FOR_CORRECTION';
        else if (p.verificationStatus === 'REJECTED') status = 'REJECTED';

        allRecords.push({
          id: p._id.toString(),
          recordType: 'PUBLICATION',
          recordTypeLabel: 'Research Publication',
          title: p.title,
          academicYear: p.academicYear || '',
          submittedDate: p.submittedAt || (p as any).createdAt,
          status,
          rawStatus: p.verificationStatus,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name || 'Faculty Member',
            employeeId: fac.employeeId || '',
            designation: fac.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `${p.publicationType} • ${p.journalOrConference || p.publisher || 'Published'} • Indexing: ${p.indexing || 'N/A'}`,
          actionNote: p.verificationRemarks,
          hasDocuments: !!p.pdfUrl,
          documentCount: p.pdfUrl ? 1 : 0,
          updatedAt: (p as any).updatedAt || (p as any).createdAt,
        });
      }
    }

    // Query 2: Projects
    if (!recordType || recordType === 'PROJECT') {
      const projs = await Project.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const pr of projs) {
        const fac: any = pr.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (['SANCTIONED', 'ONGOING', 'COMPLETED'].includes(pr.status)) status = 'APPROVED';
        else if (pr.status === 'REJECTED') status = 'REJECTED';
        else if (pr.status === 'DRAFT' || pr.status === 'IDEA') status = 'RETURNED_FOR_CORRECTION';

        allRecords.push({
          id: pr._id.toString(),
          recordType: 'PROJECT',
          recordTypeLabel: 'Research / Funded Project',
          title: pr.title,
          academicYear: pr.academicYear || '',
          submittedDate: pr.submissionDate || (pr as any).createdAt,
          status,
          rawStatus: pr.status,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name || pr.piName,
            employeeId: fac.employeeId || pr.piEmployeeId || '',
            designation: fac.designation || 'Principal Investigator',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Agency: ${pr.fundingAgency} • Budget: ₹${(pr.requestedAmount || pr.sanctionedAmount || 0).toLocaleString('en-IN')}`,
          actionNote: pr.remarks,
          hasDocuments: (pr.documents && pr.documents.length > 0) || false,
          documentCount: pr.documents?.length || 0,
          updatedAt: (pr as any).updatedAt || (pr as any).createdAt,
        });
      }
    }

    // Query 3: Academic Activity (FDP/Conferences)
    if (!recordType || recordType === 'ACADEMIC_ACTIVITY') {
      const acts = await AcademicActivity.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const a of acts) {
        const fac: any = a.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (a.status === 'VERIFIED') status = 'APPROVED';
        else if (a.status === 'RETURNED_FOR_CORRECTION') status = 'RETURNED_FOR_CORRECTION';
        else if (a.status === 'REJECTED') status = 'REJECTED';

        allRecords.push({
          id: a._id.toString(),
          recordType: 'ACADEMIC_ACTIVITY',
          recordTypeLabel: `${a.activityType} Activity`,
          title: a.title,
          academicYear: a.academicYear || '',
          submittedDate: (a as any).createdAt,
          status,
          rawStatus: a.status,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name || a.facultyName,
            employeeId: fac.employeeId || a.facultyEmployeeId || '',
            designation: fac.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Organizer: ${a.organizer} • Mode: ${a.mode || 'Offline'} • Role: ${a.participationType || 'Participant'}`,
          actionNote: (a as any).reviewRemarks,
          hasDocuments: !!(a as any).certificateUrl,
          documentCount: (a as any).certificateUrl ? 1 : 0,
          updatedAt: (a as any).updatedAt || (a as any).createdAt,
        });
      }
    }

    // Query 4: Patents
    if (!recordType || recordType === 'PATENT') {
      const patents = await Patent.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const pat of patents) {
        const fac: any = pat.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (pat.verificationStatus === 'VERIFIED') status = 'APPROVED';
        else if (pat.verificationStatus === 'RETURNED_FOR_CORRECTION') status = 'RETURNED_FOR_CORRECTION';
        else if (pat.verificationStatus === 'REJECTED') status = 'REJECTED';

        allRecords.push({
          id: pat._id.toString(),
          recordType: 'PATENT',
          recordTypeLabel: 'Patent / IPR',
          title: pat.title,
          academicYear: pat.academicYear || '',
          submittedDate: pat.submittedAt || pat.filingDate || (pat as any).createdAt,
          status,
          rawStatus: pat.verificationStatus,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name,
            employeeId: fac.employeeId || '',
            designation: fac.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `App No: ${pat.applicationNumber} • Status: ${pat.status} • Jurisdiction: ${pat.jurisdiction}`,
          actionNote: pat.reviewRemarks,
          hasDocuments: !!pat.documentUrl,
          documentCount: pat.documentUrl ? 1 : 0,
          updatedAt: (pat as any).updatedAt || (pat as any).createdAt,
        });
      }
    }

    // Query 5: Copyrights
    if (!recordType || recordType === 'COPYRIGHT') {
      const crs = await Copyright.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const cr of crs) {
        const fac: any = cr.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (cr.verificationStatus === 'VERIFIED') status = 'APPROVED';
        else if (cr.verificationStatus === 'RETURNED_FOR_CORRECTION') status = 'RETURNED_FOR_CORRECTION';
        else if (cr.verificationStatus === 'REJECTED') status = 'REJECTED';

        allRecords.push({
          id: cr._id.toString(),
          recordType: 'COPYRIGHT',
          recordTypeLabel: 'Copyright / IPR',
          title: cr.title,
          academicYear: cr.academicYear || '',
          submittedDate: cr.submittedAt || cr.registrationDate || (cr as any).createdAt,
          status,
          rawStatus: cr.verificationStatus,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name,
            employeeId: fac.employeeId || '',
            designation: fac.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Reg No: ${cr.registrationNumber} • Category: ${cr.category}`,
          actionNote: cr.reviewRemarks,
          hasDocuments: !!cr.documentUrl,
          documentCount: cr.documentUrl ? 1 : 0,
          updatedAt: (cr as any).updatedAt || (cr as any).createdAt,
        });
      }
    }

    // Query 6: Consultancy
    if (!recordType || recordType === 'CONSULTANCY') {
      const consultancies = await Consultancy.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const con of consultancies) {
        const fac: any = con.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (con.verificationStatus === 'VERIFIED') status = 'APPROVED';
        else if (con.verificationStatus === 'RETURNED_FOR_CORRECTION') status = 'RETURNED_FOR_CORRECTION';
        else if (con.verificationStatus === 'REJECTED') status = 'REJECTED';

        allRecords.push({
          id: con._id.toString(),
          recordType: 'CONSULTANCY',
          recordTypeLabel: 'Industry Consultancy',
          title: con.projectTitle,
          academicYear: con.academicYear || '',
          submittedDate: con.submittedAt || con.startDate || (con as any).createdAt,
          status,
          rawStatus: con.verificationStatus,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name,
            employeeId: fac.employeeId || '',
            designation: fac.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Client: ${con.organization} • Value: ₹${con.value?.toLocaleString('en-IN')} • Role: ${con.role}`,
          actionNote: con.reviewRemarks,
          hasDocuments: !!con.agreementUrl,
          documentCount: con.agreementUrl ? 1 : 0,
          updatedAt: (con as any).updatedAt || (con as any).createdAt,
        });
      }
    }

    // Query 7: Student Projects
    if (!recordType || recordType === 'STUDENT_PROJECT') {
      const sps = await StudentProject.find({ departmentId })
        .populate('guideFacultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const sp of sps) {
        const fac: any = sp.guideFacultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (['APPROVED', 'ONGOING', 'COMPLETED'].includes(sp.status)) status = 'APPROVED';
        else if (sp.status === 'PROPOSED') status = 'PENDING';

        allRecords.push({
          id: sp._id.toString(),
          recordType: 'STUDENT_PROJECT',
          recordTypeLabel: `${sp.projectType} Student Project`,
          title: sp.projectTitle,
          academicYear: sp.academicYear || '',
          submittedDate: sp.submissionDate || (sp as any).createdAt,
          status,
          rawStatus: sp.status,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name || sp.guide,
            employeeId: fac.employeeId || '',
            designation: fac.designation || 'Project Guide',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Batch: ${sp.batch} • Section: ${sp.section} • Team: ${sp.teamMembers?.slice(0, 2).join(', ')}${sp.teamMembers?.length > 2 ? '...' : ''}`,
          actionNote: sp.reviewRemarks,
          hasDocuments: !!sp.document,
          documentCount: sp.document ? 1 : 0,
          updatedAt: (sp as any).updatedAt || (sp as any).createdAt,
        });
      }
    }

    // Query 8: Leave Applications
    if (!recordType || recordType === 'LEAVE') {
      const leaves = await LeaveApplication.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const lv of leaves) {
        const fac: any = lv.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (lv.status === 'APPROVED') status = 'APPROVED';
        else if (lv.status === 'REJECTED') status = 'REJECTED';
        else if (lv.status === 'CANCELLED') status = 'REJECTED';

        const leaveTitle = `${(lv.leaveType || 'LEAVE').replace(/_/g, ' ')} (${lv.numberOfDays} Day${lv.numberOfDays > 1 ? 's' : ''})`;

        allRecords.push({
          id: lv._id.toString(),
          recordType: 'LEAVE',
          recordTypeLabel: 'Faculty Leave Application',
          title: leaveTitle,
          academicYear: lv.academicYear || '',
          submittedDate: lv.submittedDate || (lv as any).createdAt,
          status,
          rawStatus: lv.status,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name,
            employeeId: fac.employeeId || '',
            designation: fac.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Duration: ${new Date(lv.startDate).toLocaleDateString()} to ${new Date(lv.endDate).toLocaleDateString()} • Reason: ${lv.reason || 'Personal'}`,
          actionNote: lv.reviewerComments,
          hasDocuments: !!lv.supportingDocument,
          documentCount: lv.supportingDocument ? 1 : 0,
          updatedAt: (lv as any).updatedAt || (lv as any).createdAt,
        });
      }
    }

    // Query 9: Attendance Corrections
    if (!recordType || recordType === 'ATTENDANCE_CORRECTION') {
      const corrs = await AttendanceCorrectionRequest.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const ac of corrs) {
        const fac: any = ac.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (ac.status === 'APPROVED') status = 'APPROVED';
        else if (ac.status === 'REJECTED') status = 'REJECTED';

        allRecords.push({
          id: ac._id.toString(),
          recordType: 'ATTENDANCE_CORRECTION',
          recordTypeLabel: 'Attendance Correction',
          title: `Attendance Rectification: ${ac.currentStatus} → ${ac.requestedStatus}`,
          academicYear: ac.academicYear || '',
          submittedDate: (ac as any).createdAt,
          status,
          rawStatus: ac.status,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name,
            employeeId: fac.employeeId || '',
            designation: fac.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Date: ${new Date(ac.date).toLocaleDateString()} • Requested Status: ${ac.requestedStatus} • Reason: ${ac.reason}`,
          actionNote: ac.reviewRemarks,
          hasDocuments: !!ac.supportingDocumentUrl,
          documentCount: ac.supportingDocumentUrl ? 1 : 0,
          updatedAt: (ac as any).updatedAt || (ac as any).createdAt,
        });
      }
    }

    // Query 10: Appraisals
    if (!recordType || recordType === 'APPRAISAL') {
      const appraisals = await FacultyAppraisal.find({ departmentId })
        .populate('facultyId', 'name employeeId designation email profilePhoto')
        .lean();

      for (const ap of appraisals) {
        const fac: any = ap.facultyId;
        if (!fac) continue;

        let status: UnifiedStatus = 'PENDING';
        if (['APPROVED', 'DEAN_REVIEW'].includes(ap.status)) status = 'APPROVED';
        else if (ap.status === 'REVISION_REQUESTED') status = 'RETURNED_FOR_CORRECTION';
        else if (ap.status === 'REJECTED') status = 'REJECTED';

        allRecords.push({
          id: ap._id.toString(),
          recordType: 'APPRAISAL',
          recordTypeLabel: 'Faculty Appraisal PBAS',
          title: `Annual Performance Appraisal — ${ap.designation || fac.designation}`,
          academicYear: (ap as any).academicYear || `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
          submittedDate: ap.submissionDate || (ap as any).createdAt,
          status,
          rawStatus: ap.status,
          faculty: {
            _id: fac._id?.toString(),
            name: fac.name || ap.facultyName,
            employeeId: fac.employeeId || ap.facultyEmployeeId || '',
            designation: fac.designation || ap.designation || 'Faculty',
            email: fac.email,
            profilePhoto: fac.profilePhoto,
          },
          department: deptInfo,
          summary: `Self-Score: ${ap.totalSelfScore || 0}/100 • Categories: ${ap.categorySubmissions?.length || 0} evaluated`,
          actionNote: ap.revisionRemarks || ap.lastReviewerComments,
          hasDocuments: true,
          documentCount: ap.categorySubmissions?.reduce((acc: number, c: any) => acc + (c.evidenceDocuments?.length || 0), 0) || 0,
          updatedAt: (ap as any).updatedAt || (ap as any).createdAt,
        });
      }
    }

    // Calculate status counts across all records for this department & filters
    const counts = {
      all: allRecords.length,
      pending: allRecords.filter((r) => r.status === 'PENDING').length,
      approved: allRecords.filter((r) => r.status === 'APPROVED').length,
      returned: allRecords.filter((r) => r.status === 'RETURNED_FOR_CORRECTION').length,
      rejected: allRecords.filter((r) => r.status === 'REJECTED').length,
      // Pending items per record type, for the filter chips on the HOD dashboard
      pendingByType: allRecords.reduce<Record<string, number>>((acc, r) => {
        if (r.status === 'PENDING') acc[r.recordType] = (acc[r.recordType] ?? 0) + 1;
        return acc;
      }, {}),
    };

    // Apply Status Tab Filter
    let filtered = allRecords;
    if (statusTab !== 'ALL') {
      filtered = filtered.filter((r) => r.status === statusTab);
    }

    // Apply Academic Year Filter
    if (academicYear) {
      filtered = filtered.filter((r) => r.academicYear === academicYear);
    }

    // Apply Search Filter (faculty name, employeeId, title, or summary)
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.faculty.name.toLowerCase().includes(q) ||
          r.faculty.employeeId.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q)
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'submittedDate') {
        comparison = new Date(a.submittedDate).getTime() - new Date(b.submittedDate).getTime();
      } else if (sortBy === 'facultyName') {
        comparison = a.faculty.name.localeCompare(b.faculty.name);
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortBy === 'academicYear') {
        comparison = (a.academicYear || '').localeCompare(b.academicYear || '');
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);

    return {
      department: deptInfo,
      counts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      items: paginatedItems,
    };
  }

  /**
   * Get detailed record information along with its complete audit & review history
   */
  async getRecordDetail(
    recordType: string,
    recordId: string,
    user: { id?: Types.ObjectId | string; _id?: Types.ObjectId | string; role: string }
  ) {
    if (!Types.ObjectId.isValid(recordId)) {
      throw AppError.badRequest('Invalid record ID');
    }

    const recObjId = new Types.ObjectId(recordId);
    let recordDoc: any = null;
    let deptId: Types.ObjectId | null = null;
    let facultyId: Types.ObjectId | null = null;
    let rawStatus = '';
    let recordTitle = '';
    let submittedDate: Date = new Date();
    let academicYear = '';
    let documents: Array<{ name: string; url: string; type?: string; uploadedAt?: Date }> = [];
    let customDetails: Record<string, unknown> = {};

    switch (recordType) {
      case 'PUBLICATION': {
        recordDoc = await Publication.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('reviewedBy', 'name email role');
        if (!recordDoc) throw AppError.notFound('Publication not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.verificationStatus;
        recordTitle = recordDoc.title;
        submittedDate = recordDoc.submittedAt || recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.pdfUrl) {
          documents.push({
            name: recordDoc.pdfFileName || 'Publication Proof PDF',
            url: recordDoc.pdfUrl,
            type: 'PDF',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          publicationType: recordDoc.publicationType,
          journalOrConference: recordDoc.journalOrConference,
          publisher: recordDoc.publisher,
          issn: recordDoc.issn,
          doi: recordDoc.doi,
          url: recordDoc.url,
          indexing: recordDoc.indexing,
          quartile: recordDoc.quartile,
          impactFactor: recordDoc.impactFactor,
          citationCount: recordDoc.citationCount,
          authorPosition: recordDoc.authorPosition,
          numberOfAuthors: recordDoc.numberOfAuthors,
          coAuthors: recordDoc.coAuthors,
          affiliation: recordDoc.affiliation,
          correspondingAuthor: recordDoc.correspondingAuthor,
          remarks: recordDoc.verificationRemarks,
        };
        break;
      }

      case 'PROJECT': {
        recordDoc = await Project.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId');
        if (!recordDoc) throw AppError.notFound('Project not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.status;
        recordTitle = recordDoc.title;
        submittedDate = recordDoc.submissionDate || recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.documents) {
          for (const d of recordDoc.documents) {
            documents.push({
              name: d.title || d.fileName,
              url: d.fileUrl,
              type: d.documentType,
              uploadedAt: d.uploadedAt,
            });
          }
        }
        customDetails = {
          piName: recordDoc.piName,
          fundingAgency: recordDoc.fundingAgency,
          fundingType: recordDoc.fundingType,
          projectNumber: recordDoc.projectNumber,
          grantNumber: recordDoc.grantNumber,
          sanctionNumber: recordDoc.sanctionNumber,
          requestedAmount: recordDoc.requestedAmount,
          sanctionedAmount: recordDoc.sanctionedAmount,
          receivedAmount: recordDoc.receivedAmount,
          startDate: recordDoc.startDate,
          endDate: recordDoc.endDate,
          durationMonths: recordDoc.durationMonths,
          utilizationStatus: recordDoc.utilizationStatus,
          coInvestigators: recordDoc.coInvestigators,
          remarks: recordDoc.remarks,
        };
        break;
      }

      case 'ACADEMIC_ACTIVITY': {
        recordDoc = await AcademicActivity.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('reviewedBy', 'name email role');
        if (!recordDoc) throw AppError.notFound('Academic activity not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.status;
        recordTitle = recordDoc.title;
        submittedDate = recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.certificateUrl) {
          documents.push({
            name: 'Activity Certificate',
            url: recordDoc.certificateUrl,
            type: 'CERTIFICATE',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          activityType: recordDoc.activityType,
          organizer: recordDoc.organizer,
          mode: recordDoc.mode,
          duration: recordDoc.duration,
          startDate: recordDoc.startDate,
          endDate: recordDoc.endDate,
          participationType: recordDoc.participationType,
          location: recordDoc.location,
          remarks: recordDoc.reviewRemarks,
        };
        break;
      }

      case 'PATENT': {
        recordDoc = await Patent.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('verifiedBy', 'name email role');
        if (!recordDoc) throw AppError.notFound('Patent not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.verificationStatus;
        recordTitle = recordDoc.title;
        submittedDate = recordDoc.submittedAt || recordDoc.filingDate || recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.documentUrl) {
          documents.push({
            name: 'Patent Document / Filing Receipt',
            url: recordDoc.documentUrl,
            type: 'PATENT_DOC',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          applicationNumber: recordDoc.applicationNumber,
          patentNumber: recordDoc.patentNumber,
          inventors: recordDoc.inventors,
          filingDate: recordDoc.filingDate,
          publicationDate: recordDoc.publicationDate,
          grantDate: recordDoc.grantDate,
          status: recordDoc.status,
          jurisdiction: recordDoc.jurisdiction,
          remarks: recordDoc.reviewRemarks,
        };
        break;
      }

      case 'COPYRIGHT': {
        recordDoc = await Copyright.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('verifiedBy', 'name email role');
        if (!recordDoc) throw AppError.notFound('Copyright not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.verificationStatus;
        recordTitle = recordDoc.title;
        submittedDate = recordDoc.submittedAt || recordDoc.registrationDate || recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.documentUrl) {
          documents.push({
            name: 'Copyright Registration Certificate',
            url: recordDoc.documentUrl,
            type: 'COPYRIGHT_DOC',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          registrationNumber: recordDoc.registrationNumber,
          category: recordDoc.category,
          applicants: recordDoc.applicants,
          registrationDate: recordDoc.registrationDate,
          remarks: recordDoc.reviewRemarks,
        };
        break;
      }

      case 'CONSULTANCY': {
        recordDoc = await Consultancy.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('verifiedBy', 'name email role');
        if (!recordDoc) throw AppError.notFound('Consultancy record not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.verificationStatus;
        recordTitle = recordDoc.projectTitle;
        submittedDate = recordDoc.submittedAt || recordDoc.startDate || recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.agreementUrl) {
          documents.push({
            name: 'MoU / Consultancy Agreement',
            url: recordDoc.agreementUrl,
            type: 'AGREEMENT',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          organization: recordDoc.organization,
          role: recordDoc.role,
          value: recordDoc.value,
          duration: recordDoc.duration,
          startDate: recordDoc.startDate,
          endDate: recordDoc.endDate,
          status: recordDoc.status,
          remarks: recordDoc.reviewRemarks,
        };
        break;
      }

      case 'STUDENT_PROJECT': {
        recordDoc = await StudentProject.findById(recObjId)
          .populate('guideFacultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('reviewedBy', 'name email role');
        if (!recordDoc) throw AppError.notFound('Student project not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.guideFacultyId?._id;
        rawStatus = recordDoc.status;
        recordTitle = recordDoc.projectTitle;
        submittedDate = recordDoc.submissionDate || recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.document) {
          documents.push({
            name: 'Project Synopsis / Report',
            url: recordDoc.document,
            type: 'REPORT',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          projectType: recordDoc.projectType,
          batch: recordDoc.batch,
          section: recordDoc.section,
          teamMembers: recordDoc.teamMembers,
          registerNumbers: recordDoc.registerNumbers,
          guide: recordDoc.guide,
          coGuide: recordDoc.coGuide,
          publication: recordDoc.publication,
          patent: recordDoc.patent,
          remarks: recordDoc.reviewRemarks,
        };
        break;
      }

      case 'LEAVE': {
        recordDoc = await LeaveApplication.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('reviewer', 'name email role')
          .populate('reviews.reviewerId', 'name email role');
        if (!recordDoc) throw AppError.notFound('Leave application not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.status;
        recordTitle = `${recordDoc.leaveType?.replace(/_/g, ' ')} (${recordDoc.numberOfDays} Days)`;
        submittedDate = recordDoc.submittedDate || recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.supportingDocument) {
          documents.push({
            name: 'Medical / Supporting Document',
            url: recordDoc.supportingDocument,
            type: 'PROOF',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          leaveType: recordDoc.leaveType,
          startDate: recordDoc.startDate,
          endDate: recordDoc.endDate,
          numberOfDays: recordDoc.numberOfDays,
          reason: recordDoc.reason,
          workflowStage: recordDoc.workflowStage,
          reviewerComments: recordDoc.reviewerComments,
        };
        break;
      }

      case 'ATTENDANCE_CORRECTION': {
        recordDoc = await AttendanceCorrectionRequest.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('reviewedBy', 'name email role');
        if (!recordDoc) throw AppError.notFound('Attendance correction request not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.status;
        recordTitle = `Attendance Correction: ${recordDoc.currentStatus} → ${recordDoc.requestedStatus}`;
        submittedDate = recordDoc.createdAt;
        academicYear = recordDoc.academicYear;
        if (recordDoc.supportingDocumentUrl) {
          documents.push({
            name: 'Supporting Document',
            url: recordDoc.supportingDocumentUrl,
            type: 'PROOF',
            uploadedAt: recordDoc.createdAt,
          });
        }
        customDetails = {
          attendanceDate: recordDoc.date,
          currentStatus: recordDoc.currentStatus,
          requestedStatus: recordDoc.requestedStatus,
          currentCheckIn: recordDoc.currentCheckIn,
          currentCheckOut: recordDoc.currentCheckOut,
          requestedCheckIn: recordDoc.requestedCheckIn,
          requestedCheckOut: recordDoc.requestedCheckOut,
          reason: recordDoc.reason,
          reviewRemarks: recordDoc.reviewRemarks,
        };
        break;
      }

      case 'APPRAISAL': {
        recordDoc = await FacultyAppraisal.findById(recObjId)
          .populate('facultyId', 'name employeeId designation email profilePhoto departmentId')
          .populate('lastReviewerId', 'name email role');
        if (!recordDoc) throw AppError.notFound('Appraisal not found');

        deptId = recordDoc.departmentId;
        facultyId = recordDoc.facultyId?._id;
        rawStatus = recordDoc.status;
        recordTitle = `PBAS Faculty Appraisal — ${recordDoc.designation}`;
        submittedDate = recordDoc.submissionDate || recordDoc.createdAt;
        academicYear = (recordDoc as any).academicYear || 'Current';

        if (recordDoc.categorySubmissions) {
          for (const cat of recordDoc.categorySubmissions) {
            if (cat.evidenceDocuments) {
              for (const ev of cat.evidenceDocuments) {
                documents.push({
                  name: `[${cat.displayName}] ${ev.title}`,
                  url: ev.documentUrl,
                  type: ev.referenceEntityType || 'EVIDENCE',
                  uploadedAt: ev.uploadedAt,
                });
              }
            }
          }
        }

        customDetails = {
          currentStage: recordDoc.currentStage,
          totalSelfScore: recordDoc.totalSelfScore,
          totalHodScore: recordDoc.totalHodScore,
          totalDeanScore: recordDoc.totalDeanScore,
          finalScore: recordDoc.finalScore,
          finalGrade: recordDoc.finalGrade,
          categories: recordDoc.categorySubmissions?.map((c: any) => ({
            key: c.categoryKey,
            name: c.displayName,
            weightage: c.weightage,
            selfScore: c.selfScore,
            facultyRemarks: c.facultyRemarks,
            hodEvaluation: c.hodEvaluation,
            deanEvaluation: c.deanEvaluation,
            evidenceCount: c.evidenceDocuments?.length || 0,
          })),
          revisionRemarks: recordDoc.revisionRemarks,
        };
        break;
      }

      default:
        throw AppError.badRequest(`Unknown record type: ${recordType}`);
    }

    // Verify Department Authorization
    const userRole = user.role;
    if (userRole === ROLES.HOD) {
      const authorizedDeptId = await this.resolveDepartmentId(user);
      if (!deptId || deptId.toString() !== authorizedDeptId.toString()) {
        throw AppError.forbidden('You are not authorized to view records from another department.');
      }
    }

    // Fetch Complete Record History
    // 1. ApprovalHistory entries
    const historyEntries = await ApprovalHistory.find({
      recordType,
      recordId: recObjId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Embedded reviews if present (e.g. Leave reviews or Appraisal reviewHistory)
    const embeddedReviews: any[] = [];
    if (recordDoc.reviews && Array.isArray(recordDoc.reviews)) {
      for (const r of recordDoc.reviews) {
        embeddedReviews.push({
          action: r.action,
          actorName: r.reviewerId?.name || 'Reviewer',
          actorRole: r.reviewerRole || 'Reviewer',
          comments: r.comments,
          createdAt: r.reviewedAt,
          stage: 'LEAVE_WORKFLOW',
        });
      }
    }
    if (recordDoc.reviewHistory && Array.isArray(recordDoc.reviewHistory)) {
      for (const rh of recordDoc.reviewHistory) {
        embeddedReviews.push({
          action: rh.action,
          actorName: rh.reviewerName,
          actorRole: rh.reviewerRole,
          comments: rh.comments,
          reason: rh.comments,
          previousStatus: rh.previousStatus,
          newStatus: rh.newStatus,
          createdAt: rh.reviewDate,
          stage: rh.stage,
        });
      }
    }

    const deptDoc = await Department.findById(deptId).select('name code');
    let facultyDoc: any = recordDoc.facultyId || recordDoc.guideFacultyId;
    if (!facultyDoc && facultyId) {
      facultyDoc = await Faculty.findById(facultyId).select('name employeeId designation email profilePhoto');
    }

    return {
      record: {
        id: recordDoc._id.toString(),
        recordType,
        title: recordTitle,
        academicYear,
        submittedDate,
        rawStatus,
        status: this.mapToUnifiedStatus(recordType, rawStatus),
        faculty: {
          _id: facultyDoc?._id?.toString() || '',
          name: facultyDoc?.name || 'Faculty Member',
          employeeId: facultyDoc?.employeeId || '',
          designation: facultyDoc?.designation || '',
          email: facultyDoc?.email || '',
          profilePhoto: facultyDoc?.profilePhoto,
        },
        department: {
          _id: deptDoc?._id?.toString() || '',
          name: deptDoc?.name || '',
          code: deptDoc?.code || '',
        },
        customDetails,
        documents,
        updatedAt: recordDoc.updatedAt || recordDoc.createdAt,
      },
      history: {
        timeline: historyEntries,
        embeddedReviews,
      },
    };
  }

  /**
   * Helper: map raw status to unified status
   */
  mapToUnifiedStatus(_recordType: string, rawStatus: string): UnifiedStatus {
    const raw = (rawStatus || '').toUpperCase();
    if (
      ['VERIFIED', 'SANCTIONED', 'APPROVED', 'COMPLETED', 'ONGOING'].includes(raw)
    ) {
      return 'APPROVED';
    }
    if (['RETURNED_FOR_CORRECTION', 'REVISION_REQUESTED'].includes(raw)) {
      return 'RETURNED_FOR_CORRECTION';
    }
    if (['REJECTED', 'CANCELLED'].includes(raw)) {
      return 'REJECTED';
    }
    return 'PENDING';
  }

  /**
   * Validate state machine transitions and self-approval constraints before executing approval action
   */
  private async validateApprovalPreconditions(
    targetDoc: any,
    actorId: Types.ObjectId,
    action: string,
    previousStatus: string,
    deptId: Types.ObjectId | null,
    user: { role: string; id?: any; _id?: any }
  ) {
    const docUserId = targetDoc.userId?._id
      ? targetDoc.userId._id.toString()
      : targetDoc.userId?.toString() ||
        targetDoc.guideUserId?.toString();

    if (docUserId && docUserId === actorId.toString()) {
      throw AppError.forbidden('Self-approval violation: You cannot review or approve your own record.');
    }

    if (user.role === ROLES.HOD && deptId) {
      const authorizedDeptId = await this.resolveDepartmentId(user);
      if (deptId.toString() !== authorizedDeptId.toString()) {
        throw AppError.forbidden('You are not authorized to review records for another department.');
      }
    }

    if (previousStatus === 'DRAFT' || previousStatus === 'IDEA') {
      throw AppError.badRequest('A draft record cannot be reviewed until submitted by faculty.');
    }

    if (previousStatus === 'REJECTED' && action === 'APPROVE') {
      throw AppError.badRequest('A rejected record cannot be directly approved.');
    }

    if (['VERIFIED', 'SANCTIONED', 'APPROVED', 'COMPLETED'].includes(previousStatus)) {
      throw AppError.badRequest(`This record is already finalized (${previousStatus}) and cannot be re-evaluated.`);
    }
  }

  /**
   * Execute Approval Action: APPROVE, REJECT, or RETURN_FOR_CORRECTION
   */
  async executeApprovalAction(params: {
    recordType: string;
    recordId: string;
    action: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION';
    reason?: string;
    comments?: string;
    user: { id?: Types.ObjectId | string; _id?: Types.ObjectId | string; name: string; role: string };
    meta?: { ipAddress?: string; userAgent?: string };
  }) {
    const { recordType, recordId, action, reason, comments, user, meta } = params;

    if (!Types.ObjectId.isValid(recordId)) {
      throw AppError.badRequest('Invalid record ID');
    }

    // MANDATORY CONSTRAINT ENFORCEMENT:
    // Reject and return MUST require a reason.
    if ((action === 'REJECT' || action === 'RETURN_FOR_CORRECTION') && (!reason || reason.trim().length < 5)) {
      throw AppError.badRequest(
        `A specific justification reason of at least 5 characters is required to ${action.replace(/_/g, ' ').toLowerCase()} this record.`
      );
    }

    const recObjId = new Types.ObjectId(recordId);
    const actorId = new Types.ObjectId(user.id || user._id);

    let targetDoc: any = null;
    let deptId: Types.ObjectId | null = null;
    let facultyUserId: Types.ObjectId | null = null;
    let facultyDocId: Types.ObjectId | null = null;
    let recordTitle = '';
    let previousStatus = '';
    let newStatus = '';
    let academicYear = '';

    switch (recordType) {
      case 'PUBLICATION': {
        targetDoc = await Publication.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Publication not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = targetDoc.title;
        previousStatus = targetDoc.verificationStatus;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.verificationStatus = 'VERIFIED';
          targetDoc.verificationRemarks = reason || comments || 'Verified and approved by HOD';
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.verificationStatus = 'RETURNED_FOR_CORRECTION';
          targetDoc.verificationRemarks = reason;
        } else if (action === 'REJECT') {
          targetDoc.verificationStatus = 'REJECTED';
          targetDoc.verificationRemarks = reason;
        }
        targetDoc.reviewedBy = actorId;
        targetDoc.reviewedAt = new Date();
        newStatus = targetDoc.verificationStatus;
        await targetDoc.save();
        break;
      }

      case 'PROJECT': {
        targetDoc = await Project.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Project not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = targetDoc.title;
        previousStatus = targetDoc.status;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.status = 'SANCTIONED';
          targetDoc.approvalDate = new Date();
          targetDoc.remarks = reason || comments || 'Approved by HOD';
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.status = 'DRAFT';
          targetDoc.remarks = `[Returned for Revision] ${reason}`;
        } else if (action === 'REJECT') {
          targetDoc.status = 'REJECTED';
          targetDoc.remarks = reason;
        }
        newStatus = targetDoc.status;
        await targetDoc.save();
        break;
      }

      case 'ACADEMIC_ACTIVITY': {
        targetDoc = await AcademicActivity.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Academic activity not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = targetDoc.title;
        previousStatus = targetDoc.status;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.status = 'VERIFIED';
          targetDoc.reviewRemarks = reason || comments || 'Verified by HOD';
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.status = 'RETURNED_FOR_CORRECTION';
          targetDoc.reviewRemarks = reason;
        } else if (action === 'REJECT') {
          targetDoc.status = 'REJECTED';
          targetDoc.reviewRemarks = reason;
        }
        targetDoc.reviewedBy = actorId;
        targetDoc.reviewedAt = new Date();
        newStatus = targetDoc.status;
        await targetDoc.save();
        break;
      }

      case 'PATENT': {
        targetDoc = await Patent.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Patent not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = targetDoc.title;
        previousStatus = targetDoc.verificationStatus;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.verificationStatus = 'VERIFIED';
          targetDoc.reviewRemarks = reason || comments || 'Verified by HOD';
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.verificationStatus = 'RETURNED_FOR_CORRECTION';
          targetDoc.reviewRemarks = reason;
        } else if (action === 'REJECT') {
          targetDoc.verificationStatus = 'REJECTED';
          targetDoc.reviewRemarks = reason;
        }
        targetDoc.verifiedBy = actorId;
        targetDoc.verifiedAt = new Date();
        newStatus = targetDoc.verificationStatus;
        await targetDoc.save();
        break;
      }

      case 'COPYRIGHT': {
        targetDoc = await Copyright.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Copyright not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = targetDoc.title;
        previousStatus = targetDoc.verificationStatus;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.verificationStatus = 'VERIFIED';
          targetDoc.reviewRemarks = reason || comments || 'Verified by HOD';
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.verificationStatus = 'RETURNED_FOR_CORRECTION';
          targetDoc.reviewRemarks = reason;
        } else if (action === 'REJECT') {
          targetDoc.verificationStatus = 'REJECTED';
          targetDoc.reviewRemarks = reason;
        }
        targetDoc.verifiedBy = actorId;
        targetDoc.verifiedAt = new Date();
        newStatus = targetDoc.verificationStatus;
        await targetDoc.save();
        break;
      }

      case 'CONSULTANCY': {
        targetDoc = await Consultancy.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Consultancy record not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = targetDoc.projectTitle;
        previousStatus = targetDoc.verificationStatus;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.verificationStatus = 'VERIFIED';
          targetDoc.reviewRemarks = reason || comments || 'Verified by HOD';
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.verificationStatus = 'RETURNED_FOR_CORRECTION';
          targetDoc.reviewRemarks = reason;
        } else if (action === 'REJECT') {
          targetDoc.verificationStatus = 'REJECTED';
          targetDoc.reviewRemarks = reason;
        }
        targetDoc.verifiedBy = actorId;
        targetDoc.verifiedAt = new Date();
        newStatus = targetDoc.verificationStatus;
        await targetDoc.save();
        break;
      }

      case 'STUDENT_PROJECT': {
        targetDoc = await StudentProject.findById(recObjId).populate('guideFacultyId');
        if (!targetDoc) throw AppError.notFound('Student project not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.guideUserId;
        facultyDocId = targetDoc.guideFacultyId?._id;
        recordTitle = targetDoc.projectTitle;
        previousStatus = targetDoc.status;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.status = 'APPROVED';
          targetDoc.reviewRemarks = reason || comments || 'Approved by HOD';
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.status = 'PROPOSED';
          targetDoc.reviewRemarks = `[Correction Requested] ${reason}`;
        } else if (action === 'REJECT') {
          targetDoc.status = 'PROPOSED';
          targetDoc.reviewRemarks = `[Rejected] ${reason}`;
        }
        targetDoc.reviewedBy = actorId;
        targetDoc.reviewedAt = new Date();
        newStatus = targetDoc.status;
        await targetDoc.save();
        break;
      }

      case 'LEAVE': {
        targetDoc = await LeaveApplication.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Leave application not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = `${targetDoc.leaveType?.replace(/_/g, ' ')} (${targetDoc.numberOfDays} Days)`;
        previousStatus = targetDoc.status;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        // Constraint: User must never approve their own leave!
        if (targetDoc.userId?.toString() === (user.id || user._id)?.toString()) {
          throw AppError.forbidden('You cannot approve, return, or reject your own leave application.');
        }

        if (action === 'APPROVE') {
          targetDoc.status = 'APPROVED';
          targetDoc.workflowStage = 'COMPLETED';
          targetDoc.reviewerComments = reason || comments || 'Leave approved by HOD';
          targetDoc.reviews.push({
            reviewerId: actorId,
            reviewerRole: user.role,
            action: 'APPROVED',
            comments: reason || comments || 'Leave approved by HOD',
            reviewedAt: new Date(),
          });
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.status = 'PENDING';
          targetDoc.reviewerComments = reason;
          targetDoc.reviews.push({
            reviewerId: actorId,
            reviewerRole: user.role,
            action: 'REJECTED',
            comments: `[Returned for correction] ${reason}`,
            reviewedAt: new Date(),
          });
        } else if (action === 'REJECT') {
          targetDoc.status = 'REJECTED';
          targetDoc.workflowStage = 'COMPLETED';
          targetDoc.reviewerComments = reason;
          targetDoc.reviews.push({
            reviewerId: actorId,
            reviewerRole: user.role,
            action: 'REJECTED',
            comments: reason,
            reviewedAt: new Date(),
          });
        }
        targetDoc.reviewer = actorId;
        targetDoc.reviewedAt = new Date();
        newStatus = targetDoc.status;
        await targetDoc.save();
        break;
      }

      case 'ATTENDANCE_CORRECTION': {
        targetDoc = await AttendanceCorrectionRequest.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Attendance correction request not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = `Attendance Correction: ${targetDoc.currentStatus} → ${targetDoc.requestedStatus}`;
        previousStatus = targetDoc.status;
        academicYear = targetDoc.academicYear;

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.status = 'APPROVED';
          targetDoc.reviewRemarks = reason || comments || 'Correction approved by HOD';

          // Update actual FacultyAttendance document
          if (targetDoc.attendanceId) {
            await FacultyAttendance.findByIdAndUpdate(targetDoc.attendanceId, {
              status: targetDoc.requestedStatus,
              correctionStatus: 'APPROVED',
              remarks: `Corrected per HOD approval: ${reason || comments || 'Approved'}`,
              ...(targetDoc.requestedCheckIn ? { checkIn: targetDoc.requestedCheckIn } : {}),
              ...(targetDoc.requestedCheckOut ? { checkOut: targetDoc.requestedCheckOut } : {}),
            });
          }
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.status = 'REJECTED';
          targetDoc.reviewRemarks = `[Correction Needed] ${reason}`;
        } else if (action === 'REJECT') {
          targetDoc.status = 'REJECTED';
          targetDoc.reviewRemarks = reason;
        }
        targetDoc.reviewedBy = actorId;
        targetDoc.reviewedAt = new Date();
        newStatus = targetDoc.status;
        await targetDoc.save();
        break;
      }

      case 'APPRAISAL': {
        targetDoc = await FacultyAppraisal.findById(recObjId).populate('facultyId');
        if (!targetDoc) throw AppError.notFound('Appraisal not found');

        deptId = targetDoc.departmentId;
        facultyUserId = targetDoc.userId;
        facultyDocId = targetDoc.facultyId?._id;
        recordTitle = `Appraisal Submission — ${targetDoc.designation}`;
        previousStatus = targetDoc.status;
        academicYear = (targetDoc as any).academicYear || 'Current';

        await this.validateApprovalPreconditions(targetDoc, actorId, action, previousStatus, deptId, user);

        if (action === 'APPROVE') {
          targetDoc.status = 'DEAN_REVIEW';
          targetDoc.currentStage = 'DEAN_REVIEW';
          targetDoc.lastReviewerComments = reason || comments || 'HOD recommended appraisal to Dean';
          targetDoc.reviewHistory.push({
            stage: 'HOD_REVIEW',
            action: 'RECOMMEND',
            reviewerId: actorId,
            reviewerName: user.name,
            reviewerRole: user.role,
            reviewDate: new Date(),
            comments: reason || comments || 'HOD recommended appraisal to Dean',
            decision: 'RECOMMENDED',
            previousStatus: 'HOD_REVIEW',
            newStatus: 'DEAN_REVIEW',
          });
        } else if (action === 'RETURN_FOR_CORRECTION') {
          targetDoc.status = 'REVISION_REQUESTED';
          targetDoc.revisionRemarks = reason;
          targetDoc.reviewHistory.push({
            stage: 'HOD_REVIEW',
            action: 'REQUEST_REVISION',
            reviewerId: actorId,
            reviewerName: user.name,
            reviewerRole: user.role,
            reviewDate: new Date(),
            comments: reason || '',
            decision: 'REVISION_REQUESTED',
            previousStatus: 'HOD_REVIEW',
            newStatus: 'REVISION_REQUESTED',
          });
        } else if (action === 'REJECT') {
          targetDoc.status = 'REJECTED';
          targetDoc.lastReviewerComments = reason;
          targetDoc.reviewHistory.push({
            stage: 'HOD_REVIEW',
            action: 'REJECT',
            reviewerId: actorId,
            reviewerName: user.name,
            reviewerRole: user.role,
            reviewDate: new Date(),
            comments: reason || '',
            decision: 'REJECTED',
            previousStatus: 'HOD_REVIEW',
            newStatus: 'REJECTED',
          });
        }
        targetDoc.lastReviewerId = actorId;
        targetDoc.lastReviewerName = user.name;
        targetDoc.lastReviewDate = new Date();
        newStatus = targetDoc.status;
        await targetDoc.save();
        break;
      }

      default:
        throw AppError.badRequest(`Unknown record type: ${recordType}`);
    }

    if (!deptId || !facultyDocId) {
      throw AppError.badRequest('Invalid record department or faculty assignment');
    }

    // Verify Department Match for HOD
    if (user.role === ROLES.HOD) {
      const authorizedDeptId = await this.resolveDepartmentId(user);
      if (deptId.toString() !== authorizedDeptId.toString()) {
        throw AppError.forbidden('You are not authorized to review records for another department.');
      }
    }

    // Create Dedicated ApprovalHistory Entry
    const faculty = await Faculty.findById(facultyDocId).select('name employeeId');
    await ApprovalHistory.create({
      recordType,
      recordId: recObjId,
      departmentId: deptId,
      facultyId: facultyDocId,
      facultyName: faculty?.name || '',
      facultyEmployeeId: faculty?.employeeId || '',
      recordTitle,
      academicYear,
      action: action as ApprovalActionType,
      previousStatus,
      newStatus,
      actorId,
      actorName: user.name,
      actorRole: user.role,
      reason: reason || comments || '',
      comments: comments || reason || '',
      metadata: {
        meta,
        actionTime: new Date(),
      },
    });

    // Write to Central AuditLog
    await AuditLog.create({
      userId: actorId,
      action: 'WORKLOAD_CONFIG_UPDATED', // General compliance or specific action
      ipAddress: meta?.ipAddress || '127.0.0.1',
      userAgent: meta?.userAgent || 'Browser',
      details: {
        approvalQueueAction: action,
        recordType,
        recordId: recObjId.toString(),
        departmentId: deptId?.toString(),
        facultyId: facultyDocId?.toString(),
        previousStatus,
        newStatus,
        reason: reason || comments || '',
        actorName: user.name,
        actorRole: user.role,
      },
    });

    // Send In-App Notification to Faculty User
    if (facultyUserId) {
      await notificationService.notifyApprovalDecision({
        recipientId: facultyUserId,
        senderId: actorId,
        reviewerName: user.name || 'HOD',
        reviewerRole: user.role || 'HOD',
        recordType,
        recordTitle,
        decision: action === 'APPROVE' ? 'APPROVED' : action === 'RETURN_FOR_CORRECTION' ? 'RETURNED' : 'REJECTED',
        remarks: reason,
        relatedEntityId: recObjId.toString(),
      });
    }

    // Invalidate caches to ensure live, fresh statistics across all consoles and reports
    appCache.invalidate('pub_analytics:');
    appCache.invalidate('dean_');
    appCache.invalidate('hod_');
    appCache.invalidate('search:');
    appCache.invalidate('analytics:');
    appCache.invalidate('report:');

    return {
      success: true,
      message: `Record successfully ${action === 'APPROVE' ? 'approved' : action === 'RETURN_FOR_CORRECTION' ? 'returned for correction' : 'rejected'}.`,
      recordId: recObjId.toString(),
      recordType,
      action,
      previousStatus,
      newStatus,
    };
  }
}

export const approvalQueueService = new ApprovalQueueService();
