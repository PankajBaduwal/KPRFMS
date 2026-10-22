import { Types } from 'mongoose';
import {
  FacultyAttendance,
  ATTENDANCE_STATUS,
  ATTENDANCE_SOURCE,
  CORRECTION_STATUS,
  type AttendanceStatus,
  type AttendanceSource,
} from '../models/FacultyAttendance.js';
import {
  AttendanceCorrectionRequest,
  CORRECTION_REQUEST_STATUS,
  type CorrectionRequestStatus,
} from '../models/AttendanceCorrectionRequest.js';
import { Faculty } from '../models/Faculty.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';

// =============================================
// TYPES
// =============================================
interface RecordAttendanceInput {
  facultyId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  source?: AttendanceSource;
  remarks?: string;
  deviceId?: string;
  rawPayload?: Record<string, unknown>;
}

interface UpdateAttendanceInput {
  checkIn?: string;
  checkOut?: string;
  status?: AttendanceStatus;
  remarks?: string;
}

interface CorrectionRequestInput {
  attendanceId: string;
  requestedStatus: AttendanceStatus;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  supportingDocumentUrl?: string;
}

interface ReviewCorrectionInput {
  status: 'APPROVED' | 'REJECTED';
  reviewRemarks?: string;
}

interface AttendanceFilters {
  facultyId?: string;
  departmentId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
  academicYear?: string;
  month?: number;
  year?: number;
}

interface UserMeta {
  id?: string;
  userId?: string;
  role?: string;
  departmentId?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// =============================================
// HELPER: Derive academic year from a date
// =============================================
function deriveAcademicYear(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  // Academic year: June to May
  if (month >= 5) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

// =============================================
// HELPER: Normalize date to midnight UTC
// =============================================
function normalizeDate(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// =============================================
// SERVICE
// =============================================
export const attendanceService = {
  // -----------------------------------------------
  // Record attendance (manual, self-report, or device)
  // -----------------------------------------------
  async recordAttendance(
    input: RecordAttendanceInput,
    user: UserMeta,
    meta: RequestMeta
  ) {
    // Validate status
    if (!Object.values(ATTENDANCE_STATUS).includes(input.status)) {
      throw AppError.validation(`Invalid attendance status: ${input.status}`);
    }

    // Validate source
    const source = input.source || ATTENDANCE_SOURCE.MANUAL;
    if (!Object.values(ATTENDANCE_SOURCE).includes(source)) {
      throw AppError.validation(`Invalid attendance source: ${source}`);
    }

    // Prevent non-admin/non-HOD from recording for others
    if (source === ATTENDANCE_SOURCE.SELF_REPORT) {
      // Self-report: faculty must be recording their own
      const faculty = await Faculty.findById(input.facultyId).lean();
      if (!faculty) throw AppError.notFound('Faculty profile not found');
      if (String(faculty.userId) !== user.id) {
        throw AppError.forbidden('Self-report can only be done for your own attendance');
      }
    } else if (source === ATTENDANCE_SOURCE.MANUAL) {
      // Manual: only ADMIN, PRINCIPAL, DEAN, HOD can record
      if (!['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user.role || '')) {
        throw AppError.forbidden('Only authorized users can manually record attendance');
      }
    }

    // Get faculty details
    const faculty = await Faculty.findById(input.facultyId)
      .populate('userId', '_id email name')
      .populate('departmentId', '_id name code')
      .lean();
    if (!faculty) throw AppError.notFound('Faculty profile not found');

    // HOD can only record attendance for faculty in their own department
    if (user.role === 'HOD') {
      const facDept = (faculty.departmentId as any)?._id?.toString() || faculty.departmentId?.toString();
      if (user.departmentId && facDept && user.departmentId !== facDept) {
        throw AppError.forbidden('HOD can only record attendance for faculty in their own department');
      }
    }

    const attendanceDate = normalizeDate(input.date);
    const academicYear = deriveAcademicYear(input.date);

    // Prevent future attendance
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    if (attendanceDate > today) {
      throw AppError.validation('Cannot record attendance for future dates');
    }

    // Check for existing record
    const existing = await FacultyAttendance.findOne({
      facultyId: new Types.ObjectId(input.facultyId),
      date: attendanceDate,
    });

    if (existing) {
      if (existing.isLocked) {
        throw AppError.forbidden(
          'This attendance record is locked. Use a correction request to modify it.'
        );
      }
      // Update existing
      if (input.checkIn) existing.checkIn = new Date(input.checkIn);
      if (input.checkOut) existing.checkOut = new Date(input.checkOut);
      existing.status = input.status;
      existing.source = source;
      if (input.remarks !== undefined) existing.remarks = input.remarks;
      existing.markedBy = new Types.ObjectId(user.id);
      await existing.save();

      // Audit
      await AuditLog.create({
        userId: new Types.ObjectId(user.id),
        action: 'ATTENDANCE_UPDATED',
        ipAddress: meta.ipAddress || 'unknown',
        userAgent: meta.userAgent || 'unknown',
        details: {
          attendanceId: existing._id,
          facultyId: input.facultyId,
          date: input.date,
          status: input.status,
          source,
        },
      });

      return existing.toJSON();
    }

    // Create new record
    const attendance = await FacultyAttendance.create({
      facultyId: new Types.ObjectId(input.facultyId),
      userId: faculty.userId && typeof faculty.userId === 'object' ? (faculty.userId as any)._id : faculty.userId,
      departmentId: faculty.departmentId && typeof faculty.departmentId === 'object' ? (faculty.departmentId as any)._id : faculty.departmentId,
      date: attendanceDate,
      checkIn: input.checkIn ? new Date(input.checkIn) : undefined,
      checkOut: input.checkOut ? new Date(input.checkOut) : undefined,
      status: input.status,
      source,
      deviceId: input.deviceId,
      rawPayload: input.rawPayload,
      remarks: input.remarks,
      correctionStatus: CORRECTION_STATUS.NONE,
      markedBy: new Types.ObjectId(user.id),
      academicYear,
      isLocked: false,
    });

    // Audit
    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'ATTENDANCE_RECORDED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        attendanceId: attendance._id,
        facultyId: input.facultyId,
        date: input.date,
        status: input.status,
        source,
      },
    });

    return attendance.toJSON();
  },

  // -----------------------------------------------
  // Bulk record attendance (for entire department on a date)
  // -----------------------------------------------
  async bulkRecordAttendance(
    records: RecordAttendanceInput[],
    user: UserMeta,
    meta: RequestMeta
  ) {
    if (!['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user.role || '')) {
      throw AppError.forbidden('Only authorized users can bulk record attendance');
    }

    const results = [];
    const errors = [];

    for (const record of records) {
      try {
        const result = await this.recordAttendance(record, user, meta);
        results.push(result);
      } catch (err: any) {
        errors.push({ facultyId: record.facultyId, date: record.date, error: err.message });
      }
    }

    return { recorded: results.length, errorCount: errors.length, results, errors };
  },

  // -----------------------------------------------
  // Update attendance (only unlocked records, authorized users)
  // -----------------------------------------------
  async updateAttendance(
    attendanceId: string,
    input: UpdateAttendanceInput,
    user: UserMeta,
    meta: RequestMeta
  ) {
    const attendance = await FacultyAttendance.findById(attendanceId);
    if (!attendance) throw AppError.notFound('Attendance record not found');

    if (attendance.isLocked) {
      throw AppError.forbidden(
        'This attendance record is locked and cannot be directly modified. Submit a correction request.'
      );
    }

    // Authorization: ADMIN, PRINCIPAL can update any; HOD can update own dept; Faculty can't directly update
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role || '')) {
      if (user.role === 'HOD' || user.role === 'DEAN') {
        // HOD/DEAN can update records in their department
        if (user.departmentId && String(attendance.departmentId) !== user.departmentId) {
          throw AppError.forbidden('You can only update attendance in your department');
        }
      } else {
        throw AppError.forbidden('Faculty cannot directly update attendance. Use correction request.');
      }
    }

    const previousState = {
      status: attendance.status,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      remarks: attendance.remarks,
    };

    if (input.status) attendance.status = input.status;
    if (input.checkIn) attendance.checkIn = new Date(input.checkIn);
    if (input.checkOut) attendance.checkOut = new Date(input.checkOut);
    if (input.remarks !== undefined) attendance.remarks = input.remarks;
    attendance.markedBy = new Types.ObjectId(user.id);

    await attendance.save();

    // Audit
    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'ATTENDANCE_UPDATED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        attendanceId,
        previousState,
        newState: {
          status: attendance.status,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          remarks: attendance.remarks,
        },
      },
    });

    return attendance.toJSON();
  },

  // -----------------------------------------------
  // Lock attendance records (prevent unauthorized modification)
  // -----------------------------------------------
  async lockAttendanceRecords(
    filters: { startDate: string; endDate: string; departmentId?: string },
    user: UserMeta,
    meta: RequestMeta
  ) {
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role || '')) {
      throw AppError.forbidden('Only Admin/Principal can lock attendance records');
    }

    const query: Record<string, unknown> = {
      date: {
        $gte: normalizeDate(filters.startDate),
        $lte: normalizeDate(filters.endDate),
      },
      isLocked: false,
    };
    if (filters.departmentId) {
      query.departmentId = new Types.ObjectId(filters.departmentId);
    }

    const result = await FacultyAttendance.updateMany(query, { $set: { isLocked: true } });

    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'ATTENDANCE_LOCKED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        departmentId: filters.departmentId,
        lockedCount: result.modifiedCount,
      },
    });

    return { lockedCount: result.modifiedCount };
  },

  // -----------------------------------------------
  // Get attendance records with filters
  // -----------------------------------------------
  async getAttendanceRecords(filters: AttendanceFilters) {
    const query: Record<string, unknown> = {};

    if (filters.facultyId) {
      query.facultyId = new Types.ObjectId(filters.facultyId);
    }
    if (filters.departmentId) {
      query.departmentId = new Types.ObjectId(filters.departmentId);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.academicYear) {
      query.academicYear = filters.academicYear;
    }

    // Date range
    if (filters.date) {
      query.date = normalizeDate(filters.date);
    } else if (filters.startDate || filters.endDate) {
      const dateRange: Record<string, Date> = {};
      if (filters.startDate) dateRange.$gte = normalizeDate(filters.startDate);
      if (filters.endDate) dateRange.$lte = normalizeDate(filters.endDate);
      query.date = dateRange;
    } else if (filters.month !== undefined && filters.year !== undefined) {
      const start = new Date(Date.UTC(filters.year, filters.month - 1, 1));
      const end = new Date(Date.UTC(filters.year, filters.month, 0));
      query.date = { $gte: start, $lte: end };
    }

    const records = await FacultyAttendance.find(query)
      .populate('facultyId', '_id name employeeId designation')
      .populate('departmentId', '_id name code')
      .populate('markedBy', '_id name email')
      .sort({ date: -1, 'facultyId.name': 1 })
      .lean();

    return records;
  },

  // -----------------------------------------------
  // Get daily attendance for a department
  // -----------------------------------------------
  async getDailyDepartmentAttendance(departmentId: string, date: string) {
    const attendanceDate = normalizeDate(date);

    // Get all faculty in department
    const facultyList = await Faculty.find({
      departmentId: new Types.ObjectId(departmentId),
    })
      .select('_id name employeeId designation userId')
      .populate('userId', '_id name email')
      .lean();

    // Get attendance records for the date
    const records = await FacultyAttendance.find({
      departmentId: new Types.ObjectId(departmentId),
      date: attendanceDate,
    })
      .populate('markedBy', '_id name email')
      .lean();

    // Map attendance to faculty
    const recordMap = new Map<string, typeof records[0]>();
    for (const rec of records) {
      recordMap.set(String(rec.facultyId), rec);
    }

    const summary = {
      total: facultyList.length,
      present: 0,
      absent: 0,
      halfDay: 0,
      onLeave: 0,
      late: 0,
      wfh: 0,
      holiday: 0,
      weekOff: 0,
      notMarked: 0,
    };

    const dailyRecords = facultyList.map((fac) => {
      const record = recordMap.get(String(fac._id));
      if (record) {
        switch (record.status) {
          case 'PRESENT': summary.present++; break;
          case 'ABSENT': summary.absent++; break;
          case 'HALF_DAY': summary.halfDay++; break;
          case 'ON_LEAVE': summary.onLeave++; break;
          case 'LATE': summary.late++; break;
          case 'WORK_FROM_HOME': summary.wfh++; break;
          case 'HOLIDAY': summary.holiday++; break;
          case 'WEEK_OFF': summary.weekOff++; break;
        }
      } else {
        summary.notMarked++;
      }

      return {
        faculty: {
          _id: fac._id,
          name: fac.name,
          employeeId: fac.employeeId,
          designation: fac.designation,
        },
        attendance: record || null,
      };
    });

    return {
      date,
      departmentId,
      summary,
      records: dailyRecords,
    };
  },

  // -----------------------------------------------
  // Get monthly attendance summary for a faculty
  // -----------------------------------------------
  async getMonthlyFacultySummary(facultyId: string, month: number, year: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));

    const records = await FacultyAttendance.find({
      facultyId: new Types.ObjectId(facultyId),
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    const faculty = await Faculty.findById(facultyId)
      .select('_id name employeeId designation')
      .populate('departmentId', '_id name code')
      .lean();

    // Build summary counts
    const statusCounts: Record<string, number> = {};
    Object.values(ATTENDANCE_STATUS).forEach((s) => { statusCounts[s] = 0; });
    let totalWorkingHours = 0;
    let daysWorked = 0;

    const dailyBreakdown = records.map((rec) => {
      statusCounts[rec.status] = (statusCounts[rec.status] || 0) + 1;
      if (rec.workingHours) totalWorkingHours += rec.workingHours;
      if (['PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'].includes(rec.status)) {
        daysWorked++;
      }
      return {
        date: rec.date,
        status: rec.status,
        checkIn: rec.checkIn,
        checkOut: rec.checkOut,
        workingHours: rec.workingHours,
        source: rec.source,
        remarks: rec.remarks,
        correctionStatus: rec.correctionStatus,
        isLocked: rec.isLocked,
      };
    });

    // Count total working days in the month (Mon-Sat)
    let totalWorkingDays = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const dow = cursor.getUTCDay();
      if (dow !== 0) totalWorkingDays++; // Exclude Sunday
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      faculty,
      month,
      year,
      totalWorkingDays,
      daysWorked,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      averageWorkingHours: daysWorked > 0
        ? Math.round((totalWorkingHours / daysWorked) * 100) / 100
        : 0,
      attendancePercentage: totalWorkingDays > 0
        ? Math.round((daysWorked / totalWorkingDays) * 100 * 100) / 100
        : 0,
      statusCounts,
      dailyBreakdown,
    };
  },

  // -----------------------------------------------
  // Get department attendance summary for a month
  // -----------------------------------------------
  async getDepartmentMonthlySummary(departmentId: string, month: number, year: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));

    // Get all faculty in department
    const facultyList = await Faculty.find({
      departmentId: new Types.ObjectId(departmentId),
    })
      .select('_id name employeeId designation')
      .lean();

    // Get all attendance records for the month
    const records = await FacultyAttendance.find({
      departmentId: new Types.ObjectId(departmentId),
      date: { $gte: start, $lte: end },
    }).lean();

    // Build per-faculty summary
    const facultySummaries = facultyList.map((fac) => {
      const facRecords = records.filter((r) => String(r.facultyId) === String(fac._id));
      const statusCounts: Record<string, number> = {};
      Object.values(ATTENDANCE_STATUS).forEach((s) => { statusCounts[s] = 0; });

      let totalHours = 0;
      let daysWorked = 0;

      facRecords.forEach((rec) => {
        statusCounts[rec.status] = (statusCounts[rec.status] || 0) + 1;
        if (rec.workingHours) totalHours += rec.workingHours;
        if (['PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'].includes(rec.status)) {
          daysWorked++;
        }
      });

      return {
        faculty: {
          _id: fac._id,
          name: fac.name,
          employeeId: fac.employeeId,
          designation: fac.designation,
        },
        daysWorked,
        totalHours: Math.round(totalHours * 100) / 100,
        statusCounts,
      };
    });

    // Count total working days in the month (Mon-Sat)
    let totalWorkingDays = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const dow = cursor.getUTCDay();
      if (dow !== 0) totalWorkingDays++;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      departmentId,
      month,
      year,
      totalWorkingDays,
      totalFaculty: facultyList.length,
      facultySummaries,
    };
  },

  // -----------------------------------------------
  // Correction Requests: Submit
  // -----------------------------------------------
  async submitCorrectionRequest(
    input: CorrectionRequestInput,
    user: UserMeta,
    meta: RequestMeta
  ) {
    const attendance = await FacultyAttendance.findById(input.attendanceId);
    if (!attendance) throw AppError.notFound('Attendance record not found');

    // Verify faculty owns this record (or is admin/HOD)
    const faculty = await Faculty.findById(attendance.facultyId).lean();
    if (!faculty) throw AppError.notFound('Faculty not found');

    const isSelf = String(faculty.userId) === user.id;
    const isAuth = ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user.role || '');

    if (!isSelf && !isAuth) {
      throw AppError.forbidden('You can only submit correction requests for your own attendance');
    }

    // Check no pending correction exists
    const existingPending = await AttendanceCorrectionRequest.findOne({
      attendanceId: new Types.ObjectId(input.attendanceId),
      status: CORRECTION_REQUEST_STATUS.PENDING,
    });
    if (existingPending) {
      throw AppError.conflict('A pending correction request already exists for this record');
    }

    const correctionRequest = await AttendanceCorrectionRequest.create({
      attendanceId: new Types.ObjectId(input.attendanceId),
      facultyId: attendance.facultyId,
      userId: attendance.userId,
      departmentId: attendance.departmentId,
      date: attendance.date,
      currentStatus: attendance.status,
      requestedStatus: input.requestedStatus,
      currentCheckIn: attendance.checkIn,
      currentCheckOut: attendance.checkOut,
      requestedCheckIn: input.requestedCheckIn ? new Date(input.requestedCheckIn) : undefined,
      requestedCheckOut: input.requestedCheckOut ? new Date(input.requestedCheckOut) : undefined,
      reason: input.reason,
      supportingDocumentUrl: input.supportingDocumentUrl,
      status: CORRECTION_REQUEST_STATUS.PENDING,
      requestedBy: new Types.ObjectId(user.id),
      academicYear: attendance.academicYear,
    });

    // Update attendance correction status
    attendance.correctionStatus = CORRECTION_STATUS.PENDING;
    await attendance.save();

    // Audit
    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: 'ATTENDANCE_CORRECTION_REQUESTED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        correctionId: correctionRequest._id,
        attendanceId: input.attendanceId,
        currentStatus: attendance.status,
        requestedStatus: input.requestedStatus,
        reason: input.reason,
      },
    });

    return correctionRequest.toJSON();
  },

  // -----------------------------------------------
  // Correction Requests: Review (Approve/Reject)
  // -----------------------------------------------
  async reviewCorrectionRequest(
    correctionId: string,
    input: ReviewCorrectionInput,
    user: UserMeta,
    meta: RequestMeta
  ) {
    // Only ADMIN, PRINCIPAL, HOD can review
    if (!['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user.role || '')) {
      throw AppError.forbidden('Only authorized users can review correction requests');
    }

    const correction = await AttendanceCorrectionRequest.findById(correctionId);
    if (!correction) throw AppError.notFound('Correction request not found');

    if (correction.status !== CORRECTION_REQUEST_STATUS.PENDING) {
      throw AppError.conflict(`Correction request is already ${correction.status.toLowerCase()}`);
    }

    // Security: Reviewer cannot approve their own attendance correction request
    if (String(correction.userId) === user.id || String(correction.requestedBy) === user.id) {
      throw AppError.forbidden('Security Violation: You are not permitted to review or approve your own attendance correction request');
    }

    // HOD can only review their own department
    if (user.role === 'HOD' && user.departmentId) {
      if (String(correction.departmentId) !== user.departmentId) {
        throw AppError.forbidden('You can only review corrections in your department');
      }
    }

    correction.status = input.status as CorrectionRequestStatus;
    correction.reviewedBy = new Types.ObjectId(user.id);
    correction.reviewedAt = new Date();
    correction.reviewRemarks = input.reviewRemarks;
    await correction.save();

    // If approved, update the attendance record
    const attendance = await FacultyAttendance.findById(correction.attendanceId);
    if (attendance) {
      if (input.status === 'APPROVED') {
        attendance.status = correction.requestedStatus;
        if (correction.requestedCheckIn) attendance.checkIn = correction.requestedCheckIn;
        if (correction.requestedCheckOut) attendance.checkOut = correction.requestedCheckOut;
        attendance.correctionStatus = CORRECTION_STATUS.APPROVED;
        // Recalculate working hours
        if (attendance.checkIn && attendance.checkOut) {
          const diff = attendance.checkOut.getTime() - attendance.checkIn.getTime();
          attendance.workingHours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
        }
      } else {
        attendance.correctionStatus = CORRECTION_STATUS.REJECTED;
      }
      await attendance.save();
    }

    // Audit
    await AuditLog.create({
      userId: new Types.ObjectId(user.id),
      action: input.status === 'APPROVED'
        ? 'ATTENDANCE_CORRECTION_APPROVED'
        : 'ATTENDANCE_CORRECTION_REJECTED',
      ipAddress: meta.ipAddress || 'unknown',
      userAgent: meta.userAgent || 'unknown',
      details: {
        correctionId,
        attendanceId: String(correction.attendanceId),
        decision: input.status,
        reviewRemarks: input.reviewRemarks,
        appliedStatus: input.status === 'APPROVED' ? correction.requestedStatus : undefined,
      },
    });

    return correction.toJSON();
  },

  // -----------------------------------------------
  // Get correction requests
  // -----------------------------------------------
  async getCorrectionRequests(filters: {
    departmentId?: string;
    facultyId?: string;
    status?: CorrectionRequestStatus;
    academicYear?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.departmentId) query.departmentId = new Types.ObjectId(filters.departmentId);
    if (filters.facultyId) query.facultyId = new Types.ObjectId(filters.facultyId);
    if (filters.status) query.status = filters.status;
    if (filters.academicYear) query.academicYear = filters.academicYear;

    return AttendanceCorrectionRequest.find(query)
      .populate('facultyId', '_id name employeeId designation')
      .populate('requestedBy', '_id name email')
      .populate('reviewedBy', '_id name email')
      .sort({ createdAt: -1 })
      .lean();
  },

  // -----------------------------------------------
  // Get attendance audit history for a specific record
  // -----------------------------------------------
  async getAttendanceAuditHistory(attendanceId: string) {
    return AuditLog.find({
      action: { $in: [
        'ATTENDANCE_RECORDED',
        'ATTENDANCE_UPDATED',
        'ATTENDANCE_LOCKED',
        'ATTENDANCE_CORRECTION_REQUESTED',
        'ATTENDANCE_CORRECTION_APPROVED',
        'ATTENDANCE_CORRECTION_REJECTED',
      ] },
      'details.attendanceId': attendanceId,
    })
      .populate('userId', '_id name email')
      .sort({ createdAt: -1 })
      .lean();
  },

  // -----------------------------------------------
  // Get yearly summary for a faculty
  // -----------------------------------------------
  async getYearlySummary(facultyId: string, academicYear: string) {
    const records = await FacultyAttendance.find({
      facultyId: new Types.ObjectId(facultyId),
      academicYear,
    })
      .sort({ date: 1 })
      .lean();

    const statusCounts: Record<string, number> = {};
    Object.values(ATTENDANCE_STATUS).forEach((s) => { statusCounts[s] = 0; });

    let totalHours = 0;
    let daysWorked = 0;

    // Monthly breakdown
    const monthlyBreakdown: Record<string, { daysWorked: number; totalHours: number; statusCounts: Record<string, number> }> = {};

    records.forEach((rec) => {
      statusCounts[rec.status] = (statusCounts[rec.status] || 0) + 1;
      if (rec.workingHours) totalHours += rec.workingHours;
      if (['PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'].includes(rec.status)) {
        daysWorked++;
      }

      const monthKey = `${rec.date.getUTCFullYear()}-${String(rec.date.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey] = { daysWorked: 0, totalHours: 0, statusCounts: {} };
        Object.values(ATTENDANCE_STATUS).forEach((s) => { monthlyBreakdown[monthKey].statusCounts[s] = 0; });
      }
      monthlyBreakdown[monthKey].statusCounts[rec.status]++;
      if (rec.workingHours) monthlyBreakdown[monthKey].totalHours += rec.workingHours;
      if (['PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'].includes(rec.status)) {
        monthlyBreakdown[monthKey].daysWorked++;
      }
    });

    return {
      facultyId,
      academicYear,
      totalRecords: records.length,
      daysWorked,
      totalWorkingHours: Math.round(totalHours * 100) / 100,
      statusCounts,
      monthlyBreakdown,
    };
  },

  // -----------------------------------------------
  // Get institution-wide attendance overview
  // -----------------------------------------------
  async getInstitutionOverview(date: string) {
    const attendanceDate = normalizeDate(date);

    const pipeline = [
      { $match: { date: attendanceDate } },
      {
        $group: {
          _id: '$departmentId',
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ['$status', 'HALF_DAY'] }, 1, 0] } },
          onLeave: { $sum: { $cond: [{ $eq: ['$status', 'ON_LEAVE'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] } },
          wfh: { $sum: { $cond: [{ $eq: ['$status', 'WORK_FROM_HOME'] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: '$department' },
      { $sort: { 'department.name': 1 as 1 | -1 } },
    ];

    const departmentStats = await FacultyAttendance.aggregate(pipeline);

    // Institution totals
    const totals = departmentStats.reduce(
      (acc, dept) => ({
        total: acc.total + dept.total,
        present: acc.present + dept.present,
        absent: acc.absent + dept.absent,
        halfDay: acc.halfDay + dept.halfDay,
        onLeave: acc.onLeave + dept.onLeave,
        late: acc.late + dept.late,
        wfh: acc.wfh + dept.wfh,
      }),
      { total: 0, present: 0, absent: 0, halfDay: 0, onLeave: 0, late: 0, wfh: 0 }
    );

    return {
      date,
      institution: totals,
      departments: departmentStats.map((d) => ({
        departmentId: d._id,
        departmentName: d.department.name,
        departmentCode: d.department.code,
        ...d,
        department: undefined,
        _id: undefined,
      })),
    };
  },
};
