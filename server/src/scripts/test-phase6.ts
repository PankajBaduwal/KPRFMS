// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import {
  Project,
  PROJECT_STATUS,
  FUNDING_TYPES,
  UTILIZATION_STATUS,
} from '../models/Project.js';
import { AuditLog, AUDIT_ACTIONS } from '../models/AuditLog.js';
import { projectService } from '../services/project.service.js';
import { ROLES } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runPhase6Tests() {
  console.log('--- STARTING PHASE 6 RESEARCH PROJECTS & FUNDING AUTOMATED TEST SUITE ---');

  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const facultyUser = await User.findOne({ email: 'faculty.cse@college.edu' });
  const hodUser = await User.findOne({ email: 'hod.cse@college.edu' });
  const principalUser = await User.findOne({ email: 'principal@college.edu' });
  const adminUser = await User.findOne({ email: 'admin@college.edu' });

  if (!facultyUser || !hodUser || !principalUser || !adminUser) {
    console.error('Test users not found! Ensure database is seeded.');
    process.exit(1);
  }

  let eceDept = await Department.findOne({ code: 'ECE' });
  if (!eceDept) {
    eceDept = await Department.create({
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
    });
  }

  let eceHod = await User.findOne({ email: 'hod.ece@college.edu' });
  if (!eceHod) {
    eceHod = await User.create({
      employeeId: 'EMP009',
      name: 'Dr. ECE HOD',
      email: 'hod.ece@college.edu',
      phone: '+91 9876543219',
      passwordHash: 'dummyhash',
      role: ROLES.HOD,
      departmentId: eceDept._id,
      designation: 'Professor & Head',
      status: 'ACTIVE',
    });
  }

  const facultyProfile = await Faculty.findOne({ userId: facultyUser._id });
  if (!facultyProfile) {
    console.error('Faculty profile not found for faculty.cse@college.edu');
    process.exit(1);
  }

  const mockFacultyUser: AuthenticatedUser = {
    id: facultyUser._id.toString(),
    email: facultyUser.email,
    role: facultyUser.role as any,
    departmentId: facultyUser.departmentId!.toString(),
    name: facultyUser.name,
    employeeId: facultyUser.employeeId,
    status: 'ACTIVE',
  };

  const mockHodUser: AuthenticatedUser = {
    id: hodUser._id.toString(),
    email: hodUser.email,
    role: hodUser.role as any,
    departmentId: hodUser.departmentId!.toString(),
    name: hodUser.name,
    employeeId: hodUser.employeeId,
    status: 'ACTIVE',
  };

  const mockEceHodUser: AuthenticatedUser = {
    id: eceHod._id.toString(),
    email: eceHod.email,
    role: eceHod.role as any,
    departmentId: eceDept._id.toString(),
    name: eceHod.name,
    employeeId: eceHod.employeeId,
    status: 'ACTIVE',
  };

  const mockAdminUser: AuthenticatedUser = {
    id: adminUser._id.toString(),
    email: adminUser.email,
    role: adminUser.role as any,
    departmentId: adminUser.departmentId?.toString(),
    name: adminUser.name,
    employeeId: adminUser.employeeId,
    status: 'ACTIVE',
  };

  // Clean test projects collection
  await Project.deleteMany({});

  // ========================================================
  // TEST SUITE 1: PROJECT CREATION & INITIAL STATUS
  // ========================================================
  console.log('\n--- 1. Project Creation & Initial Lifecycle ---');
  let proj1Id: string;
  {
    const proj1 = await projectService.createProject(mockFacultyUser, {
      title: 'AI-Driven Smart Grid Fault Detection and Autonomous Self-Healing',
      coInvestigators: [
        {
          name: 'Dr. V. Seetha',
          institution: 'Demo Institute of Technology',
          role: 'Co-PI',
        },
      ],
      fundingAgency: 'DST-SERB',
      fundingType: FUNDING_TYPES.GOVERNMENT,
      proposalNumber: 'DST/EE/2023/8921',
      requestedAmount: 3500000,
      sanctionedAmount: 0,
      receivedAmount: 0,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'),
      durationMonths: 36,
      academicYear: '2023-2024',
      status: PROJECT_STATUS.DRAFT,
      utilizationStatus: UTILIZATION_STATUS.NOT_STARTED,
      documents: [],
      remarks: 'Initial proposal submission to Core Research Grant',
    });

    proj1Id = proj1._id.toString();
    assert(!!proj1._id, 'Project created successfully');
    assert(proj1.status === PROJECT_STATUS.DRAFT, 'Initial status is DRAFT');
    assert(proj1.requestedAmount === 3500000, 'Requested amount recorded accurately (35,00,000)');
    assert(proj1.fundingAgency === 'DST-SERB', 'Funding agency stored accurately');
    assert(proj1.piName === mockFacultyUser.name, 'PI name linked to faculty creator');

    // Faculty updates project while in DRAFT
    const updatedDraft = await projectService.updateProject(mockFacultyUser, proj1Id, {
      requestedAmount: 3800000,
      remarks: 'Updated budget to cover GPU workstation requirements',
    });
    assert(updatedDraft.requestedAmount === 3800000, 'Project successfully updated in DRAFT state');
  }

  // ========================================================
  // TEST SUITE 2: WORKFLOW TRANSITIONS & PERMISSION ENFORCEMENT
  // ========================================================
  console.log('\n--- 2. Project Workflow & Permission Guardrails ---');
  {
    // Faculty transitions DRAFT -> SUBMITTED
    const submittedProj = await projectService.updateProjectStatus(mockFacultyUser, proj1Id, {
      status: PROJECT_STATUS.SUBMITTED,
    });
    assert(submittedProj.status === PROJECT_STATUS.SUBMITTED, 'Project transitioned to SUBMITTED');
    assert(!!submittedProj.submissionDate, 'Submission date recorded upon submission');

    // Faculty attempts to directly SANCTION (Must fail with 403 error)
    let facultyDirectSanctionBlocked = false;
    try {
      await projectService.updateProjectStatus(mockFacultyUser, proj1Id, {
        status: PROJECT_STATUS.SANCTIONED,
        sanctionedAmount: 3800000,
      });
    } catch {
      facultyDirectSanctionBlocked = true;
    }
    assert(facultyDirectSanctionBlocked, 'Faculty blocked from self-sanctioning project proposals');

    // ECE HOD attempts to update CSE Project (Must fail - cross-department isolation)
    let crossDeptBlocked = false;
    try {
      await projectService.updateProjectStatus(mockEceHodUser, proj1Id, {
        status: PROJECT_STATUS.UNDER_REVIEW,
      });
    } catch {
      crossDeptBlocked = true;
    }
    assert(crossDeptBlocked, 'ECE HOD forbidden from updating CSE project (cross-department isolation)');

    // Authorized CSE HOD transitions SUBMITTED -> UNDER_REVIEW
    const underReviewProj = await projectService.updateProjectStatus(mockHodUser, proj1Id, {
      status: PROJECT_STATUS.UNDER_REVIEW,
      remarks: 'Proposal reviewed by Department Research Committee; forwarded to agency.',
    });
    assert(underReviewProj.status === PROJECT_STATUS.UNDER_REVIEW, 'Project transitioned to UNDER_REVIEW');

    // HOD records SANCTIONED details
    const sanctionedProj = await projectService.updateProjectStatus(mockHodUser, proj1Id, {
      status: PROJECT_STATUS.SANCTIONED,
      sanctionNumber: 'SERB/CRG/2024/001429',
      sanctionedAmount: 3650000,
      receivedAmount: 1800000,
      approvalDate: new Date('2024-03-15'),
      utilizationStatus: UTILIZATION_STATUS.PARTIALLY_UTILIZED,
      remarks: 'Grant sanctioned! First installment of 18 Lakhs credited.',
    });
    assert(sanctionedProj.status === PROJECT_STATUS.SANCTIONED, 'Project transitioned to SANCTIONED');
    assert(sanctionedProj.sanctionedAmount === 3650000, 'Sanctioned amount recorded (36,50,000)');
    assert(sanctionedProj.receivedAmount === 1800000, 'Received amount recorded (18,00,000)');
    assert(sanctionedProj.sanctionNumber === 'SERB/CRG/2024/001429', 'Sanction number saved accurately');

    // Transition to ONGOING
    const ongoingProj = await projectService.updateProjectStatus(mockHodUser, proj1Id, {
      status: PROJECT_STATUS.ONGOING,
    });
    assert(ongoingProj.status === PROJECT_STATUS.ONGOING, 'Project transitioned to ONGOING');

    // Immutability: Faculty blocked from modifying or deleting ONGOING project
    let facultyEditOngoingBlocked = false;
    try {
      await projectService.updateProject(mockFacultyUser, proj1Id, {
        title: 'Unauthorized Modification of Ongoing Project Title',
      });
    } catch {
      facultyEditOngoingBlocked = true;
    }
    assert(facultyEditOngoingBlocked, 'Faculty blocked from modifying ongoing/sanctioned project');

    let facultyDeleteOngoingBlocked = false;
    try {
      await projectService.deleteProject(mockFacultyUser, proj1Id);
    } catch {
      facultyDeleteOngoingBlocked = true;
    }
    assert(facultyDeleteOngoingBlocked, 'Faculty blocked from deleting ongoing/sanctioned project');

    // Attach Document
    const projWithDoc = await projectService.addProjectDocument(mockFacultyUser, proj1Id, {
      title: 'DST SERB Sanction Letter PDF',
      documentType: 'SANCTION_ORDER',
      fileUrl: '/uploads/serb_sanction_order.pdf',
      fileName: 'serb_sanction_order.pdf',
    });
    assert(projWithDoc.documents.length === 1, 'Project document successfully uploaded and linked');
    assert(projWithDoc.documents[0].documentType === 'SANCTION_ORDER', 'Document classified as SANCTION_ORDER');
  }

  // ========================================================
  // TEST SUITE 3: MULTIPLE PROJECT PROPOSALS & FUNDING TYPES
  // ========================================================
  console.log('\n--- 3. Multiple Project Proposals & Status Presets ---');
  let proj2Id: string;
  let proj3Id: string;
  let proj4Id: string;
  {
    // Project 2: Industry Project (Sanctioned & Completed)
    const proj2 = await projectService.createProject(mockFacultyUser, {
      title: 'Autonomous Mobile Robot Fleet Coordination in Smart Warehouses',
      coInvestigators: [],
      fundingAgency: 'Tata Consultancy Services (TCS)',
      fundingType: FUNDING_TYPES.INDUSTRY,
      projectNumber: 'TCS/R&I/2023/11',
      sanctionNumber: 'TCS-PO-98442',
      requestedAmount: 1200000,
      sanctionedAmount: 1200000,
      receivedAmount: 1200000,
      academicYear: '2023-2024',
      status: PROJECT_STATUS.SANCTIONED,
      utilizationStatus: UTILIZATION_STATUS.FULLY_UTILIZED,
      remarks: 'Industry consultancy and research grant',
    });
    proj2Id = proj2._id.toString();

    // Transition Project 2 to COMPLETED
    const completedProj2 = await projectService.updateProjectStatus(mockHodUser, proj2Id, {
      status: PROJECT_STATUS.COMPLETED,
      completionDate: new Date('2024-04-30'),
      utilizationStatus: UTILIZATION_STATUS.AUDITED,
      remarks: 'Project deliverables submitted and signed off by TCS.',
    });
    assert(completedProj2.status === PROJECT_STATUS.COMPLETED, 'Project 2 transitioned to COMPLETED');
    assert(completedProj2.utilizationStatus === UTILIZATION_STATUS.AUDITED, 'Utilization status set to AUDITED');

    // Project 3: Institutional Seed Grant (Submitted / Under Review)
    const proj3 = await projectService.createProject(mockFacultyUser, {
      title: 'Edge Computing Node Prototyping for Agricultural IoT',
      fundingAgency: 'Institute Research Seed Fund',
      fundingType: FUNDING_TYPES.INSTITUTIONAL,
      proposalNumber: 'DIT/SEED/2024/04',
      requestedAmount: 250000,
      sanctionedAmount: 0,
      receivedAmount: 0,
      academicYear: '2024-2025',
      status: PROJECT_STATUS.SUBMITTED,
      utilizationStatus: UTILIZATION_STATUS.NOT_STARTED,
    });
    proj3Id = proj3._id.toString();
    assert(proj3.status === PROJECT_STATUS.SUBMITTED, 'Project 3 created as SUBMITTED seed grant');

    // Project 4: Rejected Project
    const proj4 = await projectService.createProject(mockFacultyUser, {
      title: 'Unfeasibility Study on Superluminal Optical Communication',
      fundingAgency: 'AICTE-RPS',
      fundingType: FUNDING_TYPES.GOVERNMENT,
      requestedAmount: 1500000,
      academicYear: '2022-2023',
      status: PROJECT_STATUS.SUBMITTED,
      utilizationStatus: UTILIZATION_STATUS.NOT_STARTED,
    });
    proj4Id = proj4._id.toString();
    const rejectedProj4 = await projectService.updateProjectStatus(mockHodUser, proj4Id, {
      status: PROJECT_STATUS.REJECTED,
      remarks: 'Scientific proposal lacks technological feasibility; rejected by agency.',
    });
    assert(rejectedProj4.status === PROJECT_STATUS.REJECTED, 'Project 4 marked as REJECTED');
  }

  // ========================================================
  // TEST SUITE 4: SEARCH, FILTER PRESETS & PAGINATION
  // ========================================================
  console.log('\n--- 4. Search, Filtering Presets & Pagination ---');
  {
    // Search by title keyword
    const searchRes = await projectService.getProjects(mockHodUser, {
      page: 1,
      limit: 10,
      search: 'Self-Healing',
    });
    assert(searchRes.projects.length === 1 && searchRes.projects[0]._id.toString() === proj1Id, 'Search by keyword found target project');

    // Filter preset: SANCTIONED / ONGOING
    const ongoingRes = await projectService.getProjects(mockHodUser, {
      page: 1,
      limit: 10,
      status: PROJECT_STATUS.ONGOING,
    });
    assert(ongoingRes.projects.length === 1 && ongoingRes.projects[0].status === 'ONGOING', 'Status view ONGOING returned 1 item');

    // Filter preset: COMPLETED
    const completedRes = await projectService.getProjects(mockHodUser, {
      page: 1,
      limit: 10,
      status: PROJECT_STATUS.COMPLETED,
    });
    assert(completedRes.projects.length === 1 && completedRes.projects[0].status === 'COMPLETED', 'Status view COMPLETED returned 1 item');

    // Filter preset: REJECTED
    const rejectedRes = await projectService.getProjects(mockHodUser, {
      page: 1,
      limit: 10,
      status: PROJECT_STATUS.REJECTED,
    });
    assert(rejectedRes.projects.length === 1 && rejectedRes.projects[0].status === 'REJECTED', 'Status view REJECTED returned 1 item');

    // Academic Year filter: '2023-2024'
    const yearRes = await projectService.getProjects(mockHodUser, {
      page: 1,
      limit: 10,
      academicYear: '2023-2024',
    });
    assert(yearRes.total === 2, 'Academic year filter returned 2 projects for 2023-2024');

    // Funding Type filter: 'Industry'
    const industryRes = await projectService.getProjects(mockHodUser, {
      page: 1,
      limit: 10,
      fundingType: FUNDING_TYPES.INDUSTRY,
    });
    assert(industryRes.projects.length === 1 && industryRes.projects[0].fundingType === 'Industry', 'Funding type filter returned Industry project');

    // Pagination test (limit: 1)
    const page1 = await projectService.getProjects(mockHodUser, { page: 1, limit: 1 });
    const page2 = await projectService.getProjects(mockHodUser, { page: 2, limit: 1 });
    assert(page1.projects.length === 1 && page2.projects.length === 1, 'Pagination respects limit 1');
    assert(page1.projects[0]._id.toString() !== page2.projects[0]._id.toString(), 'Distinct projects returned on page 1 vs page 2');
    assert(page1.totalPages === 4, 'Total pages calculated accurately (4)');
  }

  // ========================================================
  // TEST SUITE 5: FINANCIAL ANALYTICS & BREAKDOWNS
  // ========================================================
  console.log('\n--- 5. Financial Analytics & Aggregations ---');
  {
    const analytics = await projectService.getProjectAnalytics(mockHodUser);

    // Total Requested: Proj1 (38,00,000) + Proj2 (12,00,000) + Proj3 (2,50,000) + Proj4 (15,00,000) = 67,50,000
    assert(analytics.totalRequested === 6750000, 'Total requested amount matches aggregation (67,50,000)', `got: ${analytics.totalRequested}`);

    // Total Sanctioned: Only Proj1 (36,50,000) + Proj2 (12,00,000) = 48,50,000 (Rejected and Submitted are NOT sanctioned)
    assert(analytics.totalSanctioned === 4850000, 'Total sanctioned amount correctly aggregated from active grants (48,50,000)', `got: ${analytics.totalSanctioned}`);

    // Total Received: Proj1 (18,00,000) + Proj2 (12,00,000) = 30,00,000
    assert(analytics.totalReceived === 3000000, 'Total received amount accurately computed (30,00,000)', `got: ${analytics.totalReceived}`);

    // Total Projects
    assert(analytics.totalProjects === 4, 'Total project count is 4');

    // Funding by agency
    const serbAgency = analytics.fundingByAgency.find((a) => a.agency === 'DST-SERB');
    assert(!!serbAgency && serbAgency.totalSanctioned === 3650000, 'Funding by agency correctly calculated for DST-SERB');

    const tcsAgency = analytics.fundingByAgency.find((a) => a.agency.includes('Tata'));
    assert(!!tcsAgency && tcsAgency.totalSanctioned === 1200000, 'Funding by agency correctly calculated for TCS');

    // Funding by Academic Year
    const year2324 = analytics.fundingByAcademicYear.find((y) => y.academicYear === '2023-2024');
    assert(!!year2324 && year2324.totalSanctioned === 4850000, 'Funding by academic year correctly aggregated for 2023-2024');

    // Project Status counts
    assert(analytics.projectStatusCounts.ONGOING === 1, 'Status count ONGOING is 1');
    assert(analytics.projectStatusCounts.COMPLETED === 1, 'Status count COMPLETED is 1');
    assert(analytics.projectStatusCounts.SUBMITTED === 1, 'Status count SUBMITTED is 1');
    assert(analytics.projectStatusCounts.REJECTED === 1, 'Status count REJECTED is 1');
  }

  // ========================================================
  // TEST SUITE 6: AUDIT TRAIL LOGGING
  // ========================================================
  console.log('\n--- 6. Audit Trail Logging Verification ---');
  {
    const createdLog = await AuditLog.findOne({ action: AUDIT_ACTIONS.PROJECT_CREATED });
    assert(!!createdLog, 'Audit log recorded for PROJECT_CREATED');

    const sanctionedLog = await AuditLog.findOne({ action: AUDIT_ACTIONS.PROJECT_SANCTIONED });
    assert(!!sanctionedLog, 'Audit log recorded for PROJECT_SANCTIONED');

    const statusLog = await AuditLog.findOne({ action: AUDIT_ACTIONS.PROJECT_STATUS_CHANGED });
    assert(!!statusLog, 'Audit log recorded for PROJECT_STATUS_CHANGED');

    const docLog = await AuditLog.findOne({ action: AUDIT_ACTIONS.DOCUMENT_UPLOADED });
    assert(!!docLog, 'Audit log recorded for DOCUMENT_UPLOADED');
  }

  console.log('\n========================================');
  console.log('PHASE 6 TEST SUMMARY:');
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log('========================================\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runPhase6Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
