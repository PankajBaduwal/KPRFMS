import { Types } from 'mongoose';
import {
  TimetableSlot,
  type ITimetableSlot,
  DAYS_OF_WEEK,
  STANDARD_PERIOD_TIMES,
} from '../models/TimetableSlot.js';
import {
  FacultySubstitution,
  type IFacultySubstitution,
} from '../models/FacultySubstitution.js';
import { Faculty } from '../models/Faculty.js';
import { Subject } from '../models/Subject.js';
import { Department } from '../models/Department.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../utils/AppError.js';
import type {
  CreateTimetableSlotInput,
  UpdateTimetableSlotInput,
  CreateSubstitutionInput,
  TimetableFilterQuery,
  SubstitutionFilterQuery,
} from '../validators/timetable.validator.js';

interface RequestUser {
  id?: string;
  userId?: string;
  role: string;
  departmentId?: string;
  name?: string;
}

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: string[];
  conflictType?: 'FACULTY' | 'ROOM' | 'SECTION';
  conflictingSlot?: any;
}

export const timetableService = {
  // ==========================================
  // CONFLICT DETECTION FOUNDATION
  // ==========================================

  async checkSlotConflicts(
    data: {
      academicYear: string;
      day: string;
      period: number;
      room: string;
      section: string;
      semester: number;
      departmentId: string | Types.ObjectId;
      facultyId: string | Types.ObjectId;
    },
    excludeSlotId?: string
  ): Promise<ConflictCheckResult> {
    const conflicts: string[] = [];
    let conflictType: 'FACULTY' | 'ROOM' | 'SECTION' | undefined;
    let conflictingSlot: any = null;

    const baseFilter: any = {
      academicYear: data.academicYear,
      day: data.day,
      period: data.period,
      status: 'ACTIVE',
    };

    if (excludeSlotId && Types.ObjectId.isValid(excludeSlotId)) {
      baseFilter._id = { $ne: new Types.ObjectId(excludeSlotId) };
    }

    // 1. Faculty Conflict: Is the faculty already teaching in another class/room at this day & period?
    const facultySlot = await TimetableSlot.findOne({
      ...baseFilter,
      facultyId: new Types.ObjectId(data.facultyId),
    }).populate('subjectId', 'subjectCode subjectName');

    if (facultySlot) {
      conflictType = 'FACULTY';
      conflictingSlot = facultySlot;
      conflicts.push(
        `Faculty Conflict: Faculty ${facultySlot.facultyName} is already scheduled on ${data.day} Period ${data.period} for ${facultySlot.subjectCode} (Sec ${facultySlot.section}, Room ${facultySlot.room}).`
      );
      return { hasConflict: true, conflicts, conflictType, conflictingSlot };
    }

    // 2. Room Conflict: Is this room already booked by another class at this day & period?
    const roomSlot = await TimetableSlot.findOne({
      ...baseFilter,
      room: data.room.trim().toUpperCase(),
    }).populate('subjectId', 'subjectCode subjectName');

    if (roomSlot) {
      conflictType = 'ROOM';
      conflictingSlot = roomSlot;
      conflicts.push(
        `Room Conflict: Room ${data.room.trim().toUpperCase()} is already occupied on ${data.day} Period ${data.period} by ${roomSlot.subjectCode} (Sec ${roomSlot.section}, Faculty: ${roomSlot.facultyName}).`
      );
      return { hasConflict: true, conflicts, conflictType, conflictingSlot };
    }

    // 3. Section Conflict: Does this section already have another class at this day & period?
    const sectionSlot = await TimetableSlot.findOne({
      ...baseFilter,
      departmentId: new Types.ObjectId(data.departmentId),
      semester: data.semester,
      section: data.section.trim().toUpperCase(),
    }).populate('subjectId', 'subjectCode subjectName');

    if (sectionSlot) {
      conflictType = 'SECTION';
      conflictingSlot = sectionSlot;
      conflicts.push(
        `Section Conflict: Semester ${data.semester} Section ${data.section.trim().toUpperCase()} already has a class scheduled on ${data.day} Period ${data.period} (${sectionSlot.subjectCode}, Room ${sectionSlot.room}, Faculty: ${sectionSlot.facultyName}).`
      );
      return { hasConflict: true, conflicts, conflictType, conflictingSlot };
    }

    return { hasConflict: false, conflicts: [] };
  },

  async checkSubstitutionConflicts(data: {
    substituteFacultyId: string | Types.ObjectId;
    date: string | Date;
    period: number;
    academicYear: string;
  }): Promise<{ hasConflict: boolean; conflicts: string[] }> {
    const conflicts: string[] = [];
    const dateObj = new Date(data.date);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayOfWeek = dayNames[dateObj.getUTCDay()];

    // 1. Check if substitute faculty has an active substitution already on this date & period
    const startOfDay = new Date(dateObj);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existingSub = await FacultySubstitution.findOne({
      substituteFacultyId: new Types.ObjectId(data.substituteFacultyId),
      date: { $gte: startOfDay, $lte: endOfDay },
      period: data.period,
      status: 'APPROVED',
    });

    if (existingSub) {
      conflicts.push(
        `Substitute Conflict: ${existingSub.substituteFacultyName} is already assigned to substitute on this date Period ${data.period} for ${existingSub.subjectCode} (Sec ${existingSub.section}).`
      );
      return { hasConflict: true, conflicts };
    }

    // 2. Check if substitute faculty already has a regular timetable class on this day of week & period
    if (dayOfWeek !== 'SUNDAY') {
      const regularSlot: any = await (TimetableSlot as any).findOne({
        facultyId: new Types.ObjectId(data.substituteFacultyId),
        day: dayOfWeek,
        period: data.period,
        academicYear: data.academicYear,
        status: 'ACTIVE',
      });

      if (regularSlot) {
        // Verify if regular slot itself was substituted out by someone else on this date
        const slotSubstitutedOut = await FacultySubstitution.findOne({
          originalFacultyId: new Types.ObjectId(data.substituteFacultyId),
          date: { $gte: startOfDay, $lte: endOfDay },
          period: data.period,
          status: 'APPROVED',
        });

        if (!slotSubstitutedOut) {
          conflicts.push(
            `Substitute Conflict: Faculty ${regularSlot.facultyName} already has a regular scheduled class on ${dayOfWeek} Period ${data.period} (${regularSlot.subjectCode}, Sec ${regularSlot.section}, Room ${regularSlot.room}).`
          );
          return { hasConflict: true, conflicts };
        }
      }
    }

    return { hasConflict: false, conflicts: [] };
  },

  // ==========================================
  // TIMETABLE SLOT CRUD
  // ==========================================

  async createSlot(
    data: CreateTimetableSlotInput,
    user: RequestUser,
    meta?: RequestMeta
  ): Promise<ITimetableSlot> {
    const allowedRoles = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'];
    if (!allowedRoles.includes(user.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can configure timetable slots');
    }

    // Department restrictions for HOD
    if (user.role === 'HOD' && user.departmentId) {
      if (user.departmentId !== data.departmentId) {
        throw AppError.forbidden('HOD can only configure timetable slots for their own department');
      }
    }

    // Validate foreign entities
    const department = await Department.findById(data.departmentId);
    if (!department) throw AppError.notFound('Department not found');

    const subject = await Subject.findById(data.subjectId);
    if (!subject) throw AppError.notFound('Subject not found');

    const faculty = await Faculty.findById(data.facultyId);
    if (!faculty) throw AppError.notFound('Faculty member not found');

    // Run conflict detection
    const conflictResult = await this.checkSlotConflicts({
      academicYear: data.academicYear,
      day: data.day,
      period: data.period,
      room: data.room,
      section: data.section,
      semester: data.semester,
      departmentId: department._id,
      facultyId: faculty._id,
    });

    if (conflictResult.hasConflict) {
      throw AppError.conflict(conflictResult.conflicts.join(' '));
    }

    const timeSlot = data.timeSlot || STANDARD_PERIOD_TIMES[data.period] || '09:00 - 09:50';

    const slot = await TimetableSlot.create({
      academicYear: data.academicYear,
      semester: data.semester,
      department: department.name,
      departmentId: department._id,
      day: data.day,
      period: data.period,
      timeSlot,
      room: data.room.trim().toUpperCase(),
      subjectId: subject._id,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      section: data.section.trim().toUpperCase(),
      facultyId: faculty._id,
      facultyName: faculty.name,
      facultyUserId: faculty.userId,
      status: 'ACTIVE',
      remarks: data.remarks,
      createdBy: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
    });

    // Audit Log
    await AuditLog.create({
      userId: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      action: AUDIT_ACTIONS.TIMETABLE_SLOT_CREATED,
      details: {
        slotId: slot._id,
        day: slot.day,
        period: slot.period,
        room: slot.room,
        subjectCode: slot.subjectCode,
        section: slot.section,
        facultyName: slot.facultyName,
        academicYear: slot.academicYear,
      },
      ipAddress: meta?.ipAddress || 'unknown',
      userAgent: meta?.userAgent || 'unknown',
    });

    return slot;
  },

  async updateSlot(
    id: string,
    data: UpdateTimetableSlotInput,
    user: RequestUser,
    meta?: RequestMeta
  ): Promise<ITimetableSlot> {
    if (!Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Slot ID');

    const allowedRoles = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'];
    if (!allowedRoles.includes(user.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can update timetable slots');
    }

    const slot = await TimetableSlot.findById(id);
    if (!slot) throw AppError.notFound('Timetable slot not found');

    if (user.role === 'HOD' && user.departmentId) {
      if (user.departmentId !== slot.departmentId.toString()) {
        throw AppError.forbidden('HOD can only update timetable slots for their own department');
      }
    }

    // Prepare merged fields for conflict checking
    const mergedAcademicYear = data.academicYear || slot.academicYear;
    const mergedDay = data.day || slot.day;
    const mergedPeriod = data.period !== undefined ? data.period : slot.period;
    const mergedRoom = data.room || slot.room;
    const mergedSection = data.section || slot.section;
    const mergedSemester = data.semester !== undefined ? data.semester : slot.semester;
    const mergedDepartmentId = data.departmentId || slot.departmentId;
    const mergedFacultyId = data.facultyId || slot.facultyId;

    const conflictResult = await this.checkSlotConflicts(
      {
        academicYear: mergedAcademicYear,
        day: mergedDay,
        period: mergedPeriod,
        room: mergedRoom,
        section: mergedSection,
        semester: mergedSemester,
        departmentId: mergedDepartmentId,
        facultyId: mergedFacultyId,
      },
      slot._id.toString()
    );

    if (conflictResult.hasConflict) {
      throw AppError.conflict(conflictResult.conflicts.join(' '));
    }

    // Apply updates
    if (data.academicYear) slot.academicYear = data.academicYear;
    if (data.semester !== undefined) slot.semester = data.semester;
    if (data.day) slot.day = data.day;
    if (data.period !== undefined) {
      slot.period = data.period;
      slot.timeSlot = STANDARD_PERIOD_TIMES[data.period] || slot.timeSlot;
    }
    if (data.timeSlot) slot.timeSlot = data.timeSlot;
    if (data.room) slot.room = data.room.trim().toUpperCase();
    if (data.section) slot.section = data.section.trim().toUpperCase();
    if (data.remarks !== undefined) slot.remarks = data.remarks;

    if (data.subjectId && data.subjectId !== slot.subjectId.toString()) {
      const subject = await Subject.findById(data.subjectId);
      if (subject) {
        slot.subjectId = subject._id;
        slot.subjectCode = subject.subjectCode;
        slot.subjectName = subject.subjectName;
      }
    }

    if (data.facultyId && data.facultyId !== slot.facultyId.toString()) {
      const faculty = await Faculty.findById(data.facultyId);
      if (faculty) {
        slot.facultyId = faculty._id;
        slot.facultyName = faculty.name;
        slot.facultyUserId = faculty.userId;
      }
    }

    await slot.save();

    await AuditLog.create({
      userId: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      action: AUDIT_ACTIONS.TIMETABLE_SLOT_UPDATED,
      details: {
        slotId: slot._id,
        day: slot.day,
        period: slot.period,
        room: slot.room,
        subjectCode: slot.subjectCode,
        section: slot.section,
        facultyName: slot.facultyName,
      },
      ipAddress: meta?.ipAddress || 'unknown',
      userAgent: meta?.userAgent || 'unknown',
    });

    return slot;
  },

  async deleteSlot(
    id: string,
    user: RequestUser,
    meta?: RequestMeta
  ): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Slot ID');

    const allowedRoles = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN'];
    if (!allowedRoles.includes(user.role)) {
      throw AppError.forbidden('Only HOD, Dean, Principal, or Admin can delete timetable slots');
    }

    const slot = await TimetableSlot.findById(id);
    if (!slot) throw AppError.notFound('Timetable slot not found');

    if (user.role === 'HOD' && user.departmentId) {
      if (user.departmentId !== slot.departmentId.toString()) {
        throw AppError.forbidden('HOD can only delete timetable slots for their own department');
      }
    }

    await TimetableSlot.findByIdAndDelete(id);

    await AuditLog.create({
      userId: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      action: AUDIT_ACTIONS.TIMETABLE_SLOT_DELETED,
      details: {
        slotId: slot._id,
        day: slot.day,
        period: slot.period,
        room: slot.room,
        subjectCode: slot.subjectCode,
        section: slot.section,
        facultyName: slot.facultyName,
      },
      ipAddress: meta?.ipAddress || 'unknown',
      userAgent: meta?.userAgent || 'unknown',
    });

    return { message: 'Timetable slot deleted successfully' };
  },

  // ==========================================
  // TIMETABLE VIEWS
  // ==========================================

  // 1. Faculty Timetable View
  async getFacultyTimetable(
    facultyIdOrProfileId: string,
    academicYear: string,
    dateStr?: string
  ): Promise<{
    faculty: { _id: string; name: string; employeeId: string; designation: string; department: string };
    academicYear: string;
    date?: string;
    weeklyGrid: Record<string, any[]>;
    totalWeeklySlots: number;
    activeSubstitutions: any[];
  }> {
    let faculty = await Faculty.findById(facultyIdOrProfileId).populate('departmentId', 'name code');
    if (!faculty) {
      faculty = await Faculty.findOne({
        $or: [
          { userId: Types.ObjectId.isValid(facultyIdOrProfileId) ? new Types.ObjectId(facultyIdOrProfileId) : undefined },
          { employeeId: facultyIdOrProfileId },
        ],
      }).populate('departmentId', 'name code');
    }

    if (!faculty) throw AppError.notFound('Faculty profile not found');

    const slots = await TimetableSlot.find({
      facultyId: faculty._id,
      academicYear,
      status: 'ACTIVE',
    })
      .populate('subjectId', 'credits totalContactHours')
      .sort({ period: 1 });

    // Build day-wise structure
    const weeklyGrid: Record<string, any[]> = {
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
    };

    slots.forEach((s) => {
      if (weeklyGrid[s.day]) {
        weeklyGrid[s.day].push(s);
      }
    });

    // Check for substitutions on specific date if provided
    let activeSubstitutions: any[] = [];
    if (dateStr) {
      const targetDate = new Date(dateStr);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      // Substitutions where this faculty is substituted out or acting as substitute
      const subs = await FacultySubstitution.find({
        $or: [
          { originalFacultyId: faculty._id },
          { substituteFacultyId: faculty._id },
        ],
        date: { $gte: startOfDay, $lte: endOfDay },
        status: 'APPROVED',
      });

      activeSubstitutions = subs.map((sub) => ({
        ...sub.toObject(),
        isCovering: sub.substituteFacultyId.toString() === faculty!._id.toString(),
        isSubstitutedOut: sub.originalFacultyId.toString() === faculty!._id.toString(),
      }));
    }

    const deptDoc: any = faculty.departmentId;

    return {
      faculty: {
        _id: faculty._id.toString(),
        name: faculty.name,
        employeeId: faculty.employeeId,
        designation: faculty.designation,
        department: deptDoc?.name || 'Department',
      },
      academicYear,
      date: dateStr,
      weeklyGrid,
      totalWeeklySlots: slots.length,
      activeSubstitutions,
    };
  },

  // 2. Department Timetable View (HOD / Section Matrix)
  async getDepartmentTimetable(
    departmentId: string,
    academicYear: string,
    semester?: number,
    section?: string
  ): Promise<{
    department: { _id: string; name: string; code: string };
    academicYear: string;
    semester?: number;
    section?: string;
    slots: ITimetableSlot[];
    weeklyGrid: Record<string, Record<number, any[]>>;
    totalSlots: number;
    sectionsFound: string[];
  }> {
    if (!Types.ObjectId.isValid(departmentId)) throw AppError.badRequest('Invalid department ID');

    const department = await Department.findById(departmentId);
    if (!department) throw AppError.notFound('Department not found');

    const query: any = {
      departmentId: department._id,
      academicYear,
      status: 'ACTIVE',
    };

    if (semester) query.semester = semester;
    if (section) query.section = section.trim().toUpperCase();

    const slots = await TimetableSlot.find(query)
      .populate('subjectId', 'subjectCode subjectName credits')
      .populate('facultyId', 'name employeeId designation')
      .sort({ day: 1, period: 1 });

    const sectionsFound = Array.from(new Set(slots.map((s) => s.section))).sort();

    // Group by Day -> Period -> Slots
    const weeklyGrid: Record<string, Record<number, any[]>> = {};
    DAYS_OF_WEEK.forEach((d) => {
      weeklyGrid[d] = {};
      for (let p = 1; p <= 8; p++) {
        weeklyGrid[d][p] = [];
      }
    });

    slots.forEach((s) => {
      if (weeklyGrid[s.day] && weeklyGrid[s.day][s.period]) {
        weeklyGrid[s.day][s.period].push(s);
      }
    });

    return {
      department: {
        _id: department._id.toString(),
        name: department.name,
        code: department.code,
      },
      academicYear,
      semester,
      section,
      slots,
      weeklyGrid,
      totalSlots: slots.length,
      sectionsFound,
    };
  },

  // 3. Dean Institutional Timetable & Room Occupancy
  async getInstitutionalTimetable(
    academicYear: string,
    query?: { day?: string; room?: string; departmentId?: string }
  ): Promise<{
    academicYear: string;
    summary: {
      totalSlots: number;
      distinctRoomsUsed: number;
      activeFacultyScheduled: number;
      departmentsCount: number;
    };
    rooms: string[];
    roomOccupancyMatrix: Record<string, Record<string, Record<number, any | null>>>;
    slots: ITimetableSlot[];
  }> {
    const filter: any = {
      academicYear,
      status: 'ACTIVE',
    };

    if (query?.day) filter.day = query.day;
    if (query?.room) filter.room = query.room.trim().toUpperCase();
    if (query?.departmentId && Types.ObjectId.isValid(query.departmentId)) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }

    const slots = await TimetableSlot.find(filter)
      .populate('departmentId', 'name code')
      .sort({ room: 1, day: 1, period: 1 });

    const rooms = Array.from(new Set(slots.map((s) => s.room))).sort();
    const distinctFaculty = new Set(slots.map((s) => s.facultyId.toString()));
    const distinctDepts = new Set(slots.map((s) => s.departmentId.toString()));

    // Room Occupancy Matrix: [Room][Day][Period] => Slot
    const roomOccupancyMatrix: Record<string, Record<string, Record<number, any | null>>> = {};

    rooms.forEach((rm) => {
      roomOccupancyMatrix[rm] = {};
      DAYS_OF_WEEK.forEach((d) => {
        roomOccupancyMatrix[rm][d] = {};
        for (let p = 1; p <= 8; p++) {
          roomOccupancyMatrix[rm][d][p] = null;
        }
      });
    });

    slots.forEach((s) => {
      if (roomOccupancyMatrix[s.room] && roomOccupancyMatrix[s.room][s.day]) {
        roomOccupancyMatrix[s.room][s.day][s.period] = s;
      }
    });

    return {
      academicYear,
      summary: {
        totalSlots: slots.length,
        distinctRoomsUsed: rooms.length,
        activeFacultyScheduled: distinctFaculty.size,
        departmentsCount: distinctDepts.size,
      },
      rooms,
      roomOccupancyMatrix,
      slots,
    };
  },

  // ==========================================
  // FACULTY SUBSTITUTION MANAGEMENT
  // ==========================================

  async createSubstitution(
    data: CreateSubstitutionInput,
    user: RequestUser,
    meta?: RequestMeta
  ): Promise<IFacultySubstitution> {
    const allowedRoles = ['ADMIN', 'HOD', 'PRINCIPAL', 'DEAN', 'FACULTY'];
    if (!allowedRoles.includes(user.role)) {
      throw AppError.forbidden('Unauthorized to record faculty substitution');
    }

    if (data.originalFacultyId === data.substituteFacultyId) {
      throw AppError.badRequest('Substitute faculty must be different from original faculty');
    }

    const origFaculty = await Faculty.findById(data.originalFacultyId);
    if (!origFaculty) throw AppError.notFound('Original faculty member not found');

    const subFaculty = await Faculty.findById(data.substituteFacultyId);
    if (!subFaculty) throw AppError.notFound('Substitute faculty member not found');

    const subject = await Subject.findById(data.subjectId);
    if (!subject) throw AppError.notFound('Subject not found');

    // Run conflict detection for substitute faculty
    const conflictResult = await this.checkSubstitutionConflicts({
      substituteFacultyId: subFaculty._id,
      date: data.date,
      period: data.period,
      academicYear: data.academicYear,
    });

    if (conflictResult.hasConflict) {
      throw AppError.conflict(conflictResult.conflicts.join(' '));
    }

    const dateObj = new Date(data.date);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dayName = dayNames[dateObj.getUTCDay()];
    const timeSlot = data.timeSlot || STANDARD_PERIOD_TIMES[data.period] || '09:00 - 09:50';

    // Do not modify the original timetable slot record! Create substitution record
    const substitution = await FacultySubstitution.create({
      timetableSlotId: data.timetableSlotId && Types.ObjectId.isValid(data.timetableSlotId)
        ? new Types.ObjectId(data.timetableSlotId)
        : undefined,
      originalFacultyId: origFaculty._id,
      originalFacultyName: origFaculty.name,
      originalFacultyUserId: origFaculty.userId,
      substituteFacultyId: subFaculty._id,
      substituteFacultyName: subFaculty.name,
      substituteFacultyUserId: subFaculty.userId,
      date: dateObj,
      day: dayName,
      period: data.period,
      timeSlot,
      room: data.room.trim().toUpperCase(),
      subjectId: subject._id,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      section: data.section.trim().toUpperCase(),
      semester: data.semester,
      academicYear: data.academicYear,
      reason: data.reason.trim(),
      status: 'APPROVED',
      createdBy: new Types.ObjectId(user.id || user.userId),
      createdByName: user.name || 'Academic Administrator',
      timestamp: new Date(),
    });

    // Audit log
    await AuditLog.create({
      userId: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      action: AUDIT_ACTIONS.FACULTY_SUBSTITUTION_CREATED,
      details: {
        substitutionId: substitution._id,
        date: data.date,
        period: data.period,
        originalFaculty: origFaculty.name,
        substituteFaculty: subFaculty.name,
        subjectCode: subject.subjectCode,
        section: data.section,
        reason: data.reason,
      },
      ipAddress: meta?.ipAddress || 'unknown',
      userAgent: meta?.userAgent || 'unknown',
    });

    // Notify substitute faculty of assignment
    if (subFaculty.userId) {
      await notificationService.notifyTimetableChange({
        recipientId: subFaculty.userId.toString(),
        senderId: user.id || user.userId,
        message: `You have been assigned as substitute for ${origFaculty.name} on ${data.date} (Period ${data.period}) for ${subject.subjectCode}.`,
        relatedEntityId: substitution._id.toString(),
      });
    }

    return substitution;
  },

  async cancelSubstitution(
    id: string,
    user: RequestUser,
    meta?: RequestMeta
  ): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid Substitution ID');

    const sub = await FacultySubstitution.findById(id);
    if (!sub) throw AppError.notFound('Substitution record not found');

    sub.status = 'CANCELLED';
    await sub.save();

    await AuditLog.create({
      userId: user.id || user.userId ? new Types.ObjectId(user.id || user.userId) : undefined,
      action: AUDIT_ACTIONS.FACULTY_SUBSTITUTION_CANCELLED,
      details: {
        substitutionId: sub._id,
        originalFaculty: sub.originalFacultyName,
        substituteFaculty: sub.substituteFacultyName,
        date: sub.date,
        period: sub.period,
      },
      ipAddress: meta?.ipAddress || 'unknown',
      userAgent: meta?.userAgent || 'unknown',
    });

    return { message: 'Faculty substitution cancelled successfully' };
  },

  async getSubstitutions(query?: SubstitutionFilterQuery): Promise<IFacultySubstitution[]> {
    const filter: any = {};
    if (query?.academicYear) filter.academicYear = query.academicYear;
    if (query?.status) filter.status = query.status;

    if (query?.date) {
      const targetDate = new Date(query.date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (query?.originalFacultyId && Types.ObjectId.isValid(query.originalFacultyId)) {
      filter.originalFacultyId = new Types.ObjectId(query.originalFacultyId);
    }
    if (query?.substituteFacultyId && Types.ObjectId.isValid(query.substituteFacultyId)) {
      filter.substituteFacultyId = new Types.ObjectId(query.substituteFacultyId);
    }

    return FacultySubstitution.find(filter).sort({ date: -1, period: 1 });
  },

  async getTimetableSlots(query?: TimetableFilterQuery): Promise<ITimetableSlot[]> {
    const filter: any = { status: query?.status || 'ACTIVE' };
    if (query?.academicYear) filter.academicYear = query.academicYear;
    if (query?.semester) filter.semester = query.semester;
    if (query?.departmentId && Types.ObjectId.isValid(query.departmentId)) {
      filter.departmentId = new Types.ObjectId(query.departmentId);
    }
    if (query?.section) filter.section = query.section.trim().toUpperCase();
    if (query?.day) filter.day = query.day;
    if (query?.period) filter.period = query.period;
    if (query?.room) filter.room = query.room.trim().toUpperCase();
    if (query?.facultyId && Types.ObjectId.isValid(query.facultyId)) {
      filter.facultyId = new Types.ObjectId(query.facultyId);
    }

    return TimetableSlot.find(filter)
      .populate('departmentId', 'name code')
      .populate('subjectId', 'subjectCode subjectName credits')
      .populate('facultyId', 'name employeeId designation')
      .sort({ day: 1, period: 1 });
  },
};
