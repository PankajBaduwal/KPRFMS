// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import mongoose, { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Subject } from '../models/Subject.js';
import { TimetableSlot } from '../models/TimetableSlot.js';
import { FacultySubstitution } from '../models/FacultySubstitution.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { timetableService } from '../services/timetable.service.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

async function runPhase14Tests() {
  console.log('======================================================');
  console.log('PHASE 14: TIMETABLE MANAGEMENT TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const adminUser = await User.findOne({ email: 'admin@kpriet.ac.in' });
    const hodUser = await User.findOne({ email: 'hod.cse@kpriet.ac.in' });
    const facultyUser = await User.findOne({ email: 'faculty.cse@kpriet.ac.in' });
    const cseDept = await Department.findOne({ code: 'CSE' });
    const facultyProfile = await Faculty.findOne({ userId: facultyUser?._id });

    // Find or create a second faculty for substitution testing
    let secondFaculty = await Faculty.findOne({
      _id: { $ne: facultyProfile?._id },
      departmentId: cseDept?._id,
    });

    if (!secondFaculty) {
      secondFaculty = await Faculty.create({
        name: 'Dr. S. Priya',
        employeeId: 'EMP005',
        designation: 'Associate Professor',
        departmentId: cseDept!._id,
        verificationStatus: 'VERIFIED',
        employment: {
          cadre: 'Associate Professor',
          employmentType: 'REGULAR',
          probationStatus: 'CONFIRMED',
          joiningDate: new Date('2021-06-01'),
        },
      });
    }

    assert(!!adminUser, 'Admin user exists');
    assert(!!hodUser, 'HOD user exists');
    assert(!!facultyProfile, 'Faculty profile 1 exists (Dr. A. Karthik)');
    assert(!!secondFaculty, 'Faculty profile 2 exists for substitution testing');
    assert(!!cseDept, 'CSE Department exists');

    // Clean up test timetable data
    await TimetableSlot.deleteMany({ remarks: 'PHASE14_TEST' });
    await FacultySubstitution.deleteMany({ reason: 'Attending IEEE Conference in Bengaluru' });

    // Find a test subject
    let subject = await Subject.findOne({ departmentId: cseDept!._id });
    if (!subject) {
      subject = await Subject.create({
        subjectCode: 'CS3501',
        subjectName: 'Compiler Design',
        department: 'Computer Science and Engineering',
        departmentId: cseDept!._id,
        program: 'B.E. Computer Science and Engineering',
        semester: 5,
        academicYear: '2024-2025',
        credits: 4,
        lectureHours: 3,
        tutorialHours: 1,
        practicalHours: 0,
        totalContactHours: 4,
        section: 'A',
        batch: '2022-2026',
      });
    }

    const hodReqUser = {
      id: hodUser!._id.toString(),
      userId: hodUser!._id.toString(),
      role: 'HOD',
      departmentId: cseDept!._id.toString(),
      name: 'Dr. HOD CSE',
    };

    console.log('\n--- 1. Timetable Slot Creation & Validation ---');

    // 1.1 Create Timetable Slot
    const slot1 = await timetableService.createSlot(
      {
        academicYear: '2024-2025',
        semester: 5,
        departmentId: cseDept!._id.toString(),
        day: 'MONDAY',
        period: 2,
        room: 'LH-101',
        subjectId: subject!._id.toString(),
        section: 'A',
        facultyId: facultyProfile!._id.toString(),
        remarks: 'PHASE14_TEST',
      },
      hodReqUser,
      { ipAddress: '127.0.0.1', userAgent: 'Phase14-Test-Agent' }
    );

    assert(slot1.room === 'LH-101', 'Timetable slot created in room LH-101');
    assert(slot1.period === 2, 'Period set to 2');
    assert(slot1.timeSlot === '09:50 - 10:40', 'Standard period timing auto-calculated (09:50 - 10:40)');
    assert(slot1.facultyName === facultyProfile!.name, 'Faculty name correctly assigned');

    // Verify audit log for slot creation
    const slotCreateAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.TIMETABLE_SLOT_CREATED,
      'details.slotId': slot1._id,
    });
    assert(!!slotCreateAudit, 'Audit log created for TIMETABLE_SLOT_CREATED');

    console.log('\n--- 2. Conflict Detection Engine ---');

    // 2.1 Faculty Conflict: same faculty, same day, same period, different room/section
    let facultyConflictCaught = false;
    try {
      await timetableService.createSlot(
        {
          academicYear: '2024-2025',
          semester: 5,
          departmentId: cseDept!._id.toString(),
          day: 'MONDAY',
          period: 2, // Conflict: Dr. Karthik already has MONDAY Period 2 in LH-101!
          room: 'LH-102',
          subjectId: subject!._id.toString(),
          section: 'B',
          facultyId: facultyProfile!._id.toString(),
          remarks: 'PHASE14_TEST',
        },
        hodReqUser
      );
    } catch (err: any) {
      facultyConflictCaught = err.statusCode === 409 && err.message.includes('Faculty Conflict');
    }
    assert(facultyConflictCaught, 'Faculty Conflict correctly detected and prevented (Faculty cannot be in 2 classes at once)');

    // 2.2 Room Conflict: different faculty, same day, same period, same room LH-101
    let roomConflictCaught = false;
    try {
      await timetableService.createSlot(
        {
          academicYear: '2024-2025',
          semester: 5,
          departmentId: cseDept!._id.toString(),
          day: 'MONDAY',
          period: 2, // Conflict: LH-101 is already booked!
          room: 'LH-101',
          subjectId: subject!._id.toString(),
          section: 'B',
          facultyId: secondFaculty._id.toString(),
          remarks: 'PHASE14_TEST',
        },
        hodReqUser
      );
    } catch (err: any) {
      roomConflictCaught = err.statusCode === 409 && err.message.includes('Room Conflict');
    }
    assert(roomConflictCaught, 'Room Conflict correctly detected and prevented (Room cannot host 2 classes simultaneously)');

    // 2.3 Section Conflict: same semester, same section A, different faculty & room at same day & period
    let sectionConflictCaught = false;
    try {
      await timetableService.createSlot(
        {
          academicYear: '2024-2025',
          semester: 5,
          departmentId: cseDept!._id.toString(),
          day: 'MONDAY',
          period: 2, // Conflict: Sem 5 Sec A already has CS3501 at MONDAY Period 2!
          room: 'LH-103',
          subjectId: subject!._id.toString(),
          section: 'A',
          facultyId: secondFaculty._id.toString(),
          remarks: 'PHASE14_TEST',
        },
        hodReqUser
      );
    } catch (err: any) {
      sectionConflictCaught = err.statusCode === 409 && err.message.includes('Section Conflict');
    }
    assert(sectionConflictCaught, 'Section Conflict correctly detected and prevented (Section cannot have 2 classes simultaneously)');

    // 2.4 Update slot without conflict
    const updatedSlot = await timetableService.updateSlot(
      slot1._id.toString(),
      { room: 'LH-104' },
      hodReqUser,
      { ipAddress: '127.0.0.1', userAgent: 'Phase14-Test-Agent' }
    );
    assert(updatedSlot.room === 'LH-104', 'Timetable slot room updated to LH-104');

    const updateAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.TIMETABLE_SLOT_UPDATED,
      'details.slotId': slot1._id,
    });
    assert(!!updateAudit, 'Audit log created for TIMETABLE_SLOT_UPDATED');

    console.log('\n--- 3. Faculty Substitution Management ---');

    // 3.1 Record substitution on a specific date (e.g. 2024-10-07 is a Monday)
    const testSubDate = '2024-10-07';
    const substitution = await timetableService.createSubstitution(
      {
        timetableSlotId: slot1._id.toString(),
        originalFacultyId: facultyProfile!._id.toString(),
        substituteFacultyId: secondFaculty._id.toString(),
        date: testSubDate,
        period: 2,
        room: 'LH-104',
        subjectId: subject!._id.toString(),
        section: 'A',
        semester: 5,
        academicYear: '2024-2025',
        reason: 'Attending IEEE Conference in Bengaluru',
      },
      hodReqUser,
      { ipAddress: '127.0.0.1', userAgent: 'Phase14-Test-Agent' }
    );

    assert(substitution.status === 'APPROVED', 'Faculty substitution created with APPROVED status');
    assert(substitution.substituteFacultyName === secondFaculty.name, 'Substitute faculty correctly assigned');

    // Historical integrity assertion: base timetable slot is NOT modified!
    const baseSlotCheck = await TimetableSlot.findById(slot1._id);
    assert(
      baseSlotCheck?.facultyId.toString() === facultyProfile!._id.toString(),
      'Historical timetable slot remains unmodified (original faculty preserved in base schedule)'
    );

    // Verify audit log for substitution creation
    const subCreateAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.FACULTY_SUBSTITUTION_CREATED,
      'details.substitutionId': substitution._id,
    });
    assert(!!subCreateAudit, 'Audit log created for FACULTY_SUBSTITUTION_CREATED');

    // 3.2 Duplicate substitution conflict check
    let subConflictCaught = false;
    try {
      await timetableService.createSubstitution(
        {
          originalFacultyId: facultyProfile!._id.toString(),
          substituteFacultyId: secondFaculty._id.toString(),
          date: testSubDate,
          period: 2, // Conflict: secondFaculty is already substituting on 2024-10-07 Period 2!
          room: 'LH-201',
          subjectId: subject!._id.toString(),
          section: 'B',
          semester: 5,
          academicYear: '2024-2025',
          reason: 'Another reason',
        },
        hodReqUser
      );
    } catch (err: any) {
      subConflictCaught = err.statusCode === 409 && err.message.includes('Substitute Conflict');
    }
    assert(subConflictCaught, 'Substitute faculty conflict detected and prevented on same date & period');

    console.log('\n--- 4. Timetable Views & Role Access ---');

    // 4.1 Faculty Timetable View (with live substitution overlays!)
    const facultyTimetable = await timetableService.getFacultyTimetable(
      facultyProfile!._id.toString(),
      '2024-2025',
      testSubDate
    );

    assert(facultyTimetable.totalWeeklySlots > 0, 'Faculty weekly timetable returned');
    assert(facultyTimetable.weeklyGrid.MONDAY.length > 0, 'Monday schedule contains teaching slot');
    assert(facultyTimetable.activeSubstitutions.length > 0, 'Dated substitution active for faculty on target date');
    assert(
      facultyTimetable.activeSubstitutions[0].isSubstitutedOut === true,
      'Faculty identified as substituted out on target date'
    );

    // Check substitute faculty view: should identify as covering class!
    const subTimetable = await timetableService.getFacultyTimetable(
      secondFaculty._id.toString(),
      '2024-2025',
      testSubDate
    );
    assert(
      subTimetable.activeSubstitutions[0]?.isCovering === true,
      'Substitute faculty identified as covering class on target date'
    );

    // 4.2 Department Timetable View (HOD)
    const deptTimetable = await timetableService.getDepartmentTimetable(
      cseDept!._id.toString(),
      '2024-2025',
      5,
      'A'
    );

    assert(deptTimetable.totalSlots > 0, 'Department timetable returned');
    assert(deptTimetable.sectionsFound.includes('A'), 'Section A present in department schedule');
    assert(deptTimetable.weeklyGrid.MONDAY[2].length > 0, 'Weekly grid maps Monday Period 2 slot');

    // 4.3 Dean Institutional Timetable & Room Occupancy
    const instTimetable = await timetableService.getInstitutionalTimetable('2024-2025');
    assert(instTimetable.summary.totalSlots > 0, 'Institutional timetable returned total slots');
    assert(instTimetable.rooms.includes('LH-104'), 'LH-104 present in institutional rooms list');
    assert(
      instTimetable.roomOccupancyMatrix['LH-104']['MONDAY'][2] !== null,
      'Room occupancy matrix tracks LH-104 on MONDAY Period 2'
    );

    // 4.4 Cancel Substitution
    await timetableService.cancelSubstitution(substitution._id.toString(), hodReqUser);
    const cancelledSub = await FacultySubstitution.findById(substitution._id);
    assert(cancelledSub?.status === 'CANCELLED', 'Faculty substitution status updated to CANCELLED');

    const cancelAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.FACULTY_SUBSTITUTION_CANCELLED,
      'details.substitutionId': substitution._id,
    });
    assert(!!cancelAudit, 'Audit log created for FACULTY_SUBSTITUTION_CANCELLED');

    // Clean up test slot
    await timetableService.deleteSlot(slot1._id.toString(), hodReqUser);
    const deleteAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.TIMETABLE_SLOT_DELETED,
      'details.slotId': slot1._id,
    });
    assert(!!deleteAudit, 'Audit log created for TIMETABLE_SLOT_DELETED');

    console.log('\n======================================================');
    console.log(`PHASE 14 TESTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during test execution:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

runPhase14Tests();
