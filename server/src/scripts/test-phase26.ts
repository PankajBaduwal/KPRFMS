// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  REPORT_TYPES,
  type ReportType,
  ACCREDITATION_FRAMEWORKS,
  type AccreditationFramework,
} from '../types/report.js';
import {
  FRAMEWORK_CONFIGS,
  REPORT_DIRECTORY,
  STATUTORY_DISCLAIMER,
  generateReport,
  validateReportAccess,
  exportReportAsCsv,
  exportReportAsExcel,
  exportReportAsPdfHtml,
  getTraceRecordDetail,
  type IRequestingUser,
} from '../services/report.service.js';
import { ROLES } from '../permissions/roles.js';
import { getInstitutionProfile } from '../utils/institution.js';

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

async function runPhase26Tests() {
  console.log('======================================================');
  console.log('PHASE 26: REPORTING AND ACCREDITATION ENGINE TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors & departments
    const adminUser = await User.findOne({ role: ROLES.ADMIN });
    const principalUser = await User.findOne({ role: ROLES.PRINCIPAL });
    const deanUser = await User.findOne({ role: ROLES.DEAN });
    const hodUser = await User.findOne({ role: ROLES.HOD });
    const facultyUser = await User.findOne({ role: ROLES.FACULTY });

    assert(!!adminUser, 'Admin user located');
    assert(!!principalUser, 'Principal user located');
    assert(!!deanUser, 'Dean user located');
    assert(!!hodUser, 'HOD user located');
    assert(!!facultyUser, 'Faculty user located');

    const facultyDoc = await Faculty.findOne({ userId: facultyUser!._id });
    assert(!!facultyDoc, 'Faculty profile document located');

    const testDept = await Department.findOne();
    assert(!!testDept, 'Department record located in database');

    const adminActor: IRequestingUser = {
      userId: adminUser!._id.toString(),
      role: ROLES.ADMIN,
      name: adminUser!.name,
      employeeId: adminUser!.employeeId,
    };

    const principalActor: IRequestingUser = {
      userId: principalUser!._id.toString(),
      role: ROLES.PRINCIPAL,
      name: principalUser!.name,
      employeeId: principalUser!.employeeId,
    };

    const deanActor: IRequestingUser = {
      userId: deanUser!._id.toString(),
      role: ROLES.DEAN,
      name: deanUser!.name,
      employeeId: deanUser!.employeeId,
    };

    const hodActor: IRequestingUser = {
      userId: hodUser!._id.toString(),
      role: ROLES.HOD,
      name: hodUser!.name,
      employeeId: hodUser!.employeeId,
      departmentId: hodUser!.departmentId?.toString() || testDept!._id.toString(),
    };

    const facultyActor: IRequestingUser = {
      userId: facultyUser!._id.toString(),
      role: ROLES.FACULTY,
      name: facultyDoc?.name || facultyUser!.name,
      employeeId: facultyDoc?.employeeId || facultyUser!.employeeId,
      facultyId: facultyDoc!._id.toString(),
      departmentId: facultyDoc!.departmentId?.toString() || testDept!._id.toString(),
    };

    // -------------------------------------------------------------
    // 1. Accreditation Frameworks & Regulatory Metadata
    // -------------------------------------------------------------
    console.log('\n--- 1. Accreditation Frameworks & Configurable Criteria ---');
    assert(Object.keys(FRAMEWORK_CONFIGS).length >= 5, 'At least 5 accreditation frameworks configured');
    assert(!!FRAMEWORK_CONFIGS.NAAC, 'NAAC framework configured with criteria');
    assert(!!FRAMEWORK_CONFIGS.NBA, 'NBA framework configured with criteria');
    assert(!!FRAMEWORK_CONFIGS.NIRF, 'NIRF framework configured with criteria');
    assert(!!FRAMEWORK_CONFIGS.AACSB, 'AACSB framework configured with criteria');
    assert(!!FRAMEWORK_CONFIGS.INTERNAL, 'INTERNAL quality audit framework configured');

    assert(
      FRAMEWORK_CONFIGS.NAAC.mappedCriteria.some((c) => c.criteriaCode === 'CRITERION_2'),
      'NAAC Criterion 2 (Teaching-Learning & Evaluation) mapped'
    );
    assert(
      FRAMEWORK_CONFIGS.NAAC.mappedCriteria.some((c) => c.criteriaCode === 'CRITERION_3'),
      'NAAC Criterion 3 (Research, Innovations & Extension) mapped'
    );
    assert(
      FRAMEWORK_CONFIGS.NBA.mappedCriteria.some((c) => c.criteriaCode === 'CRITERION_5'),
      'NBA Criterion 5 (Faculty Information & Contributions) mapped'
    );
    assert(
      FRAMEWORK_CONFIGS.NIRF.mappedCriteria.some((c) => c.criteriaCode === 'RPC'),
      'NIRF Research & Professional Practice (RPC) metric mapped'
    );

    // -------------------------------------------------------------
    // 2. Mandatory Statutory Compliance Disclaimer
    // -------------------------------------------------------------
    console.log('\n--- 2. Mandatory Statutory Compliance Disclaimer ---');
    assert(
      /not constitute official compliance/i.test(STATUTORY_DISCLAIMER),
      'Statutory disclaimer explicitly disclaims official compliance'
    );
    assert(
      STATUTORY_DISCLAIMER.includes('NAAC') &&
        STATUTORY_DISCLAIMER.includes('NBA') &&
        STATUTORY_DISCLAIMER.includes('NIRF') &&
        STATUTORY_DISCLAIMER.includes('AACSB'),
      'Statutory disclaimer names all major statutory/regulatory accreditation agencies'
    );
    assert(
      FRAMEWORK_CONFIGS.NAAC.statutoryDisclaimer.length > 50,
      'NAAC framework embeds non-removable compliance disclaimer'
    );
    assert(
      FRAMEWORK_CONFIGS.NBA.statutoryDisclaimer.length > 50,
      'NBA framework embeds non-removable compliance disclaimer'
    );

    // -------------------------------------------------------------
    // 3. Authorization & Report-Specific Permissions
    // -------------------------------------------------------------
    console.log('\n--- 3. Authorization & Report-Specific Scoping ---');

    // Faculty scoping: automatically scoped to own facultyId
    const facultyEffective = validateReportAccess(facultyActor, REPORT_TYPES.PUBLICATIONS, {
      reportType: REPORT_TYPES.PUBLICATIONS,
      facultyId: 'arbitrary-id', // trying to query someone else
    });
    assert(
      facultyEffective.facultyId === facultyActor.facultyId,
      'Faculty querying publications is automatically pinned to their own faculty ID'
    );

    // HOD scoping: blocked when attempting to query other departments
    let hodCrossDeptBlocked = false;
    try {
      validateReportAccess(hodActor, REPORT_TYPES.FACULTY_PROFILE, {
        reportType: REPORT_TYPES.FACULTY_PROFILE,
        departmentId: '000000000000000000000001', // alien department
      });
    } catch {
      hodCrossDeptBlocked = true;
    }
    assert(hodCrossDeptBlocked, 'HOD attempting cross-department query is forbidden');

    // Admin & Principal institution-wide authorization
    const adminEffective = validateReportAccess(adminActor, REPORT_TYPES.APPRAISAL, {
      reportType: REPORT_TYPES.APPRAISAL,
    });
    assert(!!adminEffective, 'Admin authorized to generate institutional Appraisal report');

    const principalEffective = validateReportAccess(principalActor, REPORT_TYPES.CONSULTANCY, {
      reportType: REPORT_TYPES.CONSULTANCY,
    });
    assert(!!principalEffective, 'Principal authorized to generate Consultancy report');

    // -------------------------------------------------------------
    // 4. Report Header Mandates
    // -------------------------------------------------------------
    console.log('\n--- 4. Report Header Mandates Verification ---');
    const INSTITUTION_NAME = (await getInstitutionProfile()).name;
    const sampleReport = await generateReport(adminActor, {
      reportType: REPORT_TYPES.FACULTY_PROFILE,
      academicYear: '2024-2025',
    });

    assert(sampleReport.header.institutionName === INSTITUTION_NAME, 'Header: institution name comes from settings');
    assert(!!sampleReport.header.department, 'Header: Department specified');
    assert(sampleReport.header.academicYear === '2024-2025', 'Header: Academic Year specified');
    assert(!!sampleReport.header.generatedDate, 'Header: Generated Date recorded');
    assert(sampleReport.header.generatedBy.name === adminActor.name, 'Header: Generated By user name recorded');
    assert(sampleReport.header.generatedBy.role === ROLES.ADMIN, 'Header: Generated By role recorded');
    assert(sampleReport.header.disclaimer === STATUTORY_DISCLAIMER, 'Header: Mandatory disclaimer attached');

    // -------------------------------------------------------------
    // 5. Verification of All 20 Individual Reports
    // -------------------------------------------------------------
    console.log('\n--- 5. Generating & Verifying All 20 Individual Reports ---');

    const all20ReportTypes: ReportType[] = [
      REPORT_TYPES.FACULTY_PROFILE,
      REPORT_TYPES.QUALIFICATIONS,
      REPORT_TYPES.EXPERIENCE,
      REPORT_TYPES.WORKLOAD,
      REPORT_TYPES.SUBJECT_ALLOCATION,
      REPORT_TYPES.ATTENDANCE,
      REPORT_TYPES.LEAVE,
      REPORT_TYPES.PUBLICATIONS,
      REPORT_TYPES.RESEARCH_PROJECTS,
      REPORT_TYPES.FUNDING,
      REPORT_TYPES.PATENTS,
      REPORT_TYPES.COPYRIGHTS,
      REPORT_TYPES.CONFERENCES,
      REPORT_TYPES.WORKSHOPS,
      REPORT_TYPES.FDP_STTP,
      REPORT_TYPES.MENTORING,
      REPORT_TYPES.STUDENT_PROJECTS,
      REPORT_TYPES.PHD_SCHOLARS,
      REPORT_TYPES.CONSULTANCY,
      REPORT_TYPES.APPRAISAL,
    ];

    assert(all20ReportTypes.length === 20, 'List of required reports is exactly 20');

    for (const rType of all20ReportTypes) {
      const rep = await generateReport(adminActor, {
        reportType: rType,
        framework: ACCREDITATION_FRAMEWORKS.NAAC,
        academicYear: '2024-2025',
      });

      assert(
        !!rep && rep.reportType === rType,
        `Report [${rType}]: Generated successfully with columns (${rep.columns.length}) and metrics (${rep.summary.metrics.length})`
      );
    }

    // -------------------------------------------------------------
    // 6. Source Record Lineage & Traceability
    // -------------------------------------------------------------
    console.log('\n--- 6. Source Record Lineage & Traceability ---');
    const profileReport = await generateReport(adminActor, {
      reportType: REPORT_TYPES.FACULTY_PROFILE,
    });

    assert(profileReport.rows.length > 0, 'Faculty profile report contains rows');
    const firstRow = profileReport.rows[0];
    assert(!!firstRow._trace, 'Row contains _trace lineage object');
    assert(firstRow._trace.sourceCollection === 'faculties', 'Source collection tracked as faculties');
    assert(!!firstRow._trace.sourceRecordId, 'Source record ID tracked');
    assert(!!firstRow._trace.verificationStatus, 'Source verification status tracked');

    // Deep trace inspector lookup
    const inspectedRecord = await getTraceRecordDetail(
      firstRow._trace.sourceCollection,
      firstRow._trace.sourceRecordId,
      adminActor
    );
    assert(!!inspectedRecord, 'Trace inspector retrieves exact source MongoDB document');
    assert(
      (inspectedRecord as any)._id.toString() === firstRow._trace.sourceRecordId,
      'Inspected document ID matches sourceRecordId perfectly'
    );

    // -------------------------------------------------------------
    // 7. Multi-Factor Filters Testing
    // -------------------------------------------------------------
    console.log('\n--- 7. Multi-Factor Filters Testing ---');

    // Verification filter test
    const verifiedOnlyReport = await generateReport(adminActor, {
      reportType: REPORT_TYPES.PUBLICATIONS,
      verification: 'VERIFIED',
    });
    assert(
      verifiedOnlyReport.rows.every((r) => r.status === 'VERIFIED'),
      'Filter: verification="VERIFIED" strictly returns only verified records'
    );

    // Department filter test
    if (testDept) {
      const deptReport = await generateReport(adminActor, {
        reportType: REPORT_TYPES.FACULTY_PROFILE,
        departmentId: testDept._id.toString(),
      });
      assert(
        deptReport.rows.every((r) => r.department === testDept.name),
        `Filter: departmentId successfully filters roster to ${testDept.name}`
      );
    }

    // Faculty filter test
    const facultySelfReport = await generateReport(adminActor, {
      reportType: REPORT_TYPES.FACULTY_PROFILE,
      facultyId: facultyDoc!._id.toString(),
    });
    assert(
      facultySelfReport.rows.length === 1 && facultySelfReport.rows[0].name === facultyDoc!.name,
      'Filter: facultyId restricts report output to single target faculty member'
    );

    // -------------------------------------------------------------
    // 8. Export Engines (CSV, Excel, PDF/HTML)
    // -------------------------------------------------------------
    console.log('\n--- 8. Export Engines Verification ---');

    // 8A. CSV Export
    const csvContent = exportReportAsCsv(profileReport);
    assert(typeof csvContent === 'string' && csvContent.length > 100, 'CSV export generated non-empty string');
    assert(csvContent.includes(INSTITUTION_NAME), 'CSV export includes mandatory institutional header');
    assert(csvContent.includes('MANDATORY NOTICE'), 'CSV export includes mandatory compliance notice');
    assert(csvContent.includes('Source Collection'), 'CSV export includes source collection column');
    assert(csvContent.includes('Source Record ID'), 'CSV export includes source record ID column');

    // 8B. Excel Export (XML Spreadsheet 2003)
    const excelContent = exportReportAsExcel(profileReport);
    assert(typeof excelContent === 'string' && excelContent.length > 100, 'Excel export generated string');
    assert(excelContent.includes('<?xml version="1.0"?>'), 'Excel export uses standard XML Spreadsheet 2003');
    assert(excelContent.includes('Workbook'), 'Excel export contains Workbook element');
    assert(excelContent.includes(INSTITUTION_NAME), 'Excel export contains institutional header');
    assert(excelContent.includes('Source Record ID'), 'Excel export contains traceable source record column');

    // 8C. PDF / High-Fidelity Printable HTML Export
    const pdfHtmlContent = exportReportAsPdfHtml(profileReport);
    assert(typeof pdfHtmlContent === 'string' && pdfHtmlContent.length > 200, 'PDF/HTML export generated HTML string');
    assert(pdfHtmlContent.includes('<!DOCTYPE html>'), 'PDF export is valid HTML5 document');
    assert(pdfHtmlContent.includes('@page {'), 'PDF export includes CSS print media definitions');
    assert(pdfHtmlContent.includes(INSTITUTION_NAME), 'PDF export includes institution title');
    assert(pdfHtmlContent.includes('Statutory Disclaimer:'), 'PDF export prominently includes statutory disclaimer');
    assert(pdfHtmlContent.includes('Source Record Lineage'), 'PDF export includes source record lineage column');

    console.log('\n======================================================');
    console.log(`PHASE 26 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('Test execution failed with error:', error);
    failCount++;
  } finally {
    await disconnectDatabase();
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase26Tests();
