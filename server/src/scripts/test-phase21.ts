// DEVELOPMENT TEST SCRIPT — writes test records; refuses to run against production.
import './dev-seed/requireDevEnvironment.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Faculty } from '../models/Faculty.js';
import { Publication } from '../models/Publication.js';
import { Project } from '../models/Project.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { PhdScholar } from '../models/PhdScholar.js';
import { StudentProject } from '../models/StudentProject.js';
import { FacultyAllocation } from '../models/FacultyAllocation.js';
import { institutionAnalyticsService } from '../services/institution-analytics.service.js';
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

async function runPhase21Tests() {
  console.log('======================================================');
  console.log('PHASE 21: INSTITUTION ANALYTICS TEST SUITE');
  console.log('======================================================\n');

  try {
    await connectDatabase();

    // 0. Locate test actors
    const deanUser = await User.findOne({ role: 'DEAN' });
    const principalUser = await User.findOne({ role: 'PRINCIPAL' });
    const adminUser = await User.findOne({ role: 'ADMIN' });
    const hodUser = await User.findOne({ role: 'HOD' });
    const facultyUser = await User.findOne({ role: 'FACULTY' });

    assert(!!adminUser, 'Admin user found');
    assert(!!deanUser, 'Dean user found');
    assert(!!principalUser, 'Principal user found');
    assert(!!hodUser, 'HOD user found');
    assert(!!facultyUser, 'Faculty user found');

    // 1. Authorization checks
    console.log('\n--- 1. Authorization & Role Validation ---');
    let facultyBlocked = false;
    try {
      institutionAnalyticsService.validateAnalyticsAccess(facultyUser!.role);
    } catch {
      facultyBlocked = true;
    }
    assert(facultyBlocked, 'Regular Faculty role is forbidden from accessing Institution Analytics');

    let adminAllowed = false;
    try {
      institutionAnalyticsService.validateAnalyticsAccess(adminUser!.role);
      adminAllowed = true;
    } catch {
      adminAllowed = false;
    }
    assert(adminAllowed, 'Admin role is authorized for Institution Analytics');

    let deanAllowed = false;
    try {
      institutionAnalyticsService.validateAnalyticsAccess(deanUser!.role);
      deanAllowed = true;
    } catch {
      deanAllowed = false;
    }
    assert(deanAllowed, 'Dean role is authorized for Institution Analytics');

    let hodAllowed = false;
    try {
      institutionAnalyticsService.validateAnalyticsAccess(hodUser!.role);
      hodAllowed = true;
    } catch {
      hodAllowed = false;
    }
    assert(hodAllowed, 'HOD role is authorized for Institution Analytics');

    // 2. Dynamic Filter Options
    console.log('\n--- 2. Dynamic Filter Options Generation ---');
    const filterOptions = await institutionAnalyticsService.getFilterOptions('ADMIN');
    assert(Array.isArray(filterOptions.academicYears), 'Academic years list returned');
    assert(filterOptions.academicYears.length > 0, `Found ${filterOptions.academicYears.length} academic years`);
    assert(Array.isArray(filterOptions.departments), 'Departments list returned');
    assert(filterOptions.departments.length > 0, `Found ${filterOptions.departments.length} departments`);
    assert(Array.isArray(filterOptions.faculty), 'Faculty list returned');
    assert(filterOptions.faculty.length > 0, `Found ${filterOptions.faculty.length} active faculty`);
    assert(Array.isArray(filterOptions.designations), 'Designations list returned');
    assert(filterOptions.activityTypes.length === 5, 'All 5 activity types configured');
    assert(filterOptions.verificationStatuses.length === 5, 'All 5 verification statuses configured');

    // HOD Scoped Filter Options
    const hodDeptId = hodUser!.departmentId?.toString();
    const hodFilterOptions = await institutionAnalyticsService.getFilterOptions('HOD', hodDeptId);
    assert(
      hodFilterOptions.departments.length === 1 && hodFilterOptions.departments[0].id === hodDeptId,
      'HOD filter options are scoped to authorized department'
    );

    // 3. Centralized Analytics Aggregation (All 8 Domains)
    console.log('\n--- 3. Centralized Analytics Aggregation ---');
    const analytics = await institutionAnalyticsService.getInstitutionAnalytics({}, 'ADMIN');

    // Summary KPIs
    assert(typeof analytics.summaryKpis.totalFaculty === 'number', 'Summary KPI: totalFaculty present');
    assert(typeof analytics.summaryKpis.totalPublications === 'number', 'Summary KPI: totalPublications present');
    assert(typeof analytics.summaryKpis.totalResearchFundingSanctioned === 'number', 'Summary KPI: totalResearchFundingSanctioned present');
    assert(typeof analytics.summaryKpis.activeResearchProjects === 'number', 'Summary KPI: activeResearchProjects present');
    assert(typeof analytics.summaryKpis.fdpSttpParticipation === 'number', 'Summary KPI: fdpSttpParticipation present');
    assert(typeof analytics.summaryKpis.conferencePresentations === 'number', 'Summary KPI: conferencePresentations present');
    assert(typeof analytics.summaryKpis.phdScholarsCount === 'number', 'Summary KPI: phdScholarsCount present');
    assert(typeof analytics.summaryKpis.studentProjectsCount === 'number', 'Summary KPI: studentProjectsCount present');
    assert(typeof analytics.summaryKpis.avgWeeklyWorkloadHours === 'number', 'Summary KPI: avgWeeklyWorkloadHours present');

    // 3.1 Publication Trends
    console.log('\n--- 3.1 Publication Trends Domain ---');
    assert(Array.isArray(analytics.publicationTrends.trendsByYear), 'Publication trends by year present');
    assert(Array.isArray(analytics.publicationTrends.byType), 'Publications by type present');
    assert(Array.isArray(analytics.publicationTrends.byIndexing), 'Publications by indexing present');
    assert(Array.isArray(analytics.publicationTrends.byQuartile), 'Publications by quartile present');
    assert(analytics.publicationTrends.total >= analytics.publicationTrends.verified, 'Total publications >= verified publications');

    // 3.2 Research Funding
    console.log('\n--- 3.2 Research Funding Domain ---');
    assert(analytics.researchFunding.totalSanctionedAmount >= 0, 'Research funding sanctioned amount is non-negative');
    assert(analytics.researchFunding.totalReceivedAmount >= 0, 'Research funding received amount is non-negative');
    assert(Array.isArray(analytics.researchFunding.byAgency), 'Research funding by agency breakdown present');
    assert(Array.isArray(analytics.researchFunding.byFundingType), 'Research funding by funding type present');
    assert(Array.isArray(analytics.researchFunding.trendsByYear), 'Research funding trends by year present');

    // 3.3 Project Status
    console.log('\n--- 3.3 Project Status Domain ---');
    assert(Array.isArray(analytics.projectStatus.byStatus), 'Project breakdown by lifecycle status present');
    assert(Array.isArray(analytics.projectStatus.byUtilization), 'Project breakdown by utilization status present');
    assert(analytics.projectStatus.total >= 0, 'Total projects count is non-negative');

    // 3.4 Faculty Development
    console.log('\n--- 3.4 Faculty Development Domain ---');
    assert(typeof analytics.facultyDevelopment.total === 'number', 'Faculty development total present');
    assert(typeof analytics.facultyDevelopment.fdpCount === 'number', 'FDP count present');
    assert(typeof analytics.facultyDevelopment.sttpCount === 'number', 'STTP count present');
    assert(Array.isArray(analytics.facultyDevelopment.trendsByYear), 'Faculty development trends by year present');
    assert(Array.isArray(analytics.facultyDevelopment.byRole), 'Faculty development participation types present');
    assert(Array.isArray(analytics.facultyDevelopment.byMode), 'Faculty development modes present');

    // 3.5 Conference Participation
    console.log('\n--- 3.5 Conference Participation Domain ---');
    assert(typeof analytics.conferenceParticipation.papersPresented === 'number', 'Conference papers presented count present');
    assert(typeof analytics.conferenceParticipation.nationalCount === 'number', 'National conferences count present');
    assert(typeof analytics.conferenceParticipation.internationalCount === 'number', 'International conferences count present');
    assert(Array.isArray(analytics.conferenceParticipation.byMode), 'Conference participation modes present');
    assert(Array.isArray(analytics.conferenceParticipation.trendsByYear), 'Conference trends by year present');

    // 3.6 PhD Progress
    console.log('\n--- 3.6 PhD Scholars Progress Domain ---');
    assert(typeof analytics.phdProgress.total === 'number', 'PhD scholars total count present');
    assert(typeof analytics.phdProgress.avgProgressPercent === 'number', 'PhD scholars avg progress percentage present');
    assert(Array.isArray(analytics.phdProgress.byStage), 'PhD scholars by lifecycle stage present');
    assert(Array.isArray(analytics.phdProgress.byThesisStatus), 'PhD scholars by thesis status present');
    assert(Array.isArray(analytics.phdProgress.byDepartment), 'PhD scholars by department present');

    // 3.7 Student Project Progress
    console.log('\n--- 3.7 Student Projects Domain ---');
    assert(typeof analytics.studentProjectProgress.total === 'number', 'Student projects total count present');
    assert(typeof analytics.studentProjectProgress.totalStudents === 'number', 'Student participants total count present');
    assert(Array.isArray(analytics.studentProjectProgress.byType), 'Student projects by type present');
    assert(Array.isArray(analytics.studentProjectProgress.byStatus), 'Student projects by status present');
    assert(typeof analytics.studentProjectProgress.outcomes.withPublication === 'number', 'Student project outcomes with publication present');

    // 3.8 Workload Distribution
    console.log('\n--- 3.8 Workload Distribution Domain ---');
    assert(typeof analytics.workloadDistribution.totalAllocatedFaculty === 'number', 'Allocated faculty count present');
    assert(typeof analytics.workloadDistribution.averageWeeklyHours === 'number', 'Average weekly hours present');
    assert(typeof analytics.workloadDistribution.overloadedCount === 'number', 'Overloaded faculty count present');
    assert(typeof analytics.workloadDistribution.normalCount === 'number', 'Normal workload faculty count present');
    assert(typeof analytics.workloadDistribution.underloadedCount === 'number', 'Underloaded faculty count present');
    assert(typeof analytics.workloadDistribution.hoursBreakdown.lectureHours === 'number', 'Lecture hours present');
    assert(Array.isArray(analytics.workloadDistribution.byDepartment), 'Workload by department present');
    assert(Array.isArray(analytics.workloadDistribution.byDesignation), 'Workload by designation present');

    // 4. Filtering Tests
    console.log('\n--- 4. Multi-Criteria Filtering ---');
    // 4.1 Filter by Department
    const firstDept = filterOptions.departments[0];
    const deptFiltered = await institutionAnalyticsService.getInstitutionAnalytics({ departmentId: firstDept.id }, 'ADMIN');
    assert(deptFiltered.summaryKpis.totalFaculty >= 0, `Department filter (${firstDept.code}) returned valid metrics`);

    // 4.2 Filter by Academic Year
    const firstYear = filterOptions.academicYears[0];
    const yearFiltered = await institutionAnalyticsService.getInstitutionAnalytics({ academicYear: firstYear }, 'ADMIN');
    assert(yearFiltered.summaryKpis.totalPublications >= 0, `Academic Year filter (${firstYear}) returned valid metrics`);

    // 4.3 Filter by Verification Status = VERIFIED
    const verifiedFiltered = await institutionAnalyticsService.getInstitutionAnalytics({ verificationStatus: 'VERIFIED' }, 'ADMIN');
    assert(
      verifiedFiltered.publicationTrends.submitted === 0 && verifiedFiltered.publicationTrends.rejected === 0,
      'Verified filter correctly excludes unverified/rejected publications'
    );

    // 4.4 Filter by Designation
    if (filterOptions.designations.length > 0) {
      const firstDesig = filterOptions.designations[0];
      const desigFiltered = await institutionAnalyticsService.getInstitutionAnalytics({ designation: firstDesig }, 'ADMIN');
      assert(desigFiltered.summaryKpis.totalFaculty >= 0, `Designation filter (${firstDesig}) returned valid metrics`);
    }

    // 5. Drill-Down Endpoints (Never Dead Numbers!)
    console.log('\n--- 5. Metric Drill-Down Verification ---');
    // 5.1 Publications drill-down
    const pubDrill = await institutionAnalyticsService.getMetricDrillDown({
      metric: 'publications',
      filters: {},
      page: 1,
      limit: 5,
    });
    assert(typeof pubDrill.total === 'number', 'Publications drill-down returns total count');
    assert(Array.isArray(pubDrill.records), 'Publications drill-down returns records array');
    if (pubDrill.records.length > 0) {
      const firstRec = pubDrill.records[0];
      assert(!!firstRec.id && !!firstRec.title, `Record has id and title: "${firstRec.title.substring(0, 30)}..."`);
      assert(Array.isArray(firstRec.metaTags), 'Record has metaTags array for chips/badges');
    }

    // 5.2 Research Funding drill-down
    const fundingDrill = await institutionAnalyticsService.getMetricDrillDown({
      metric: 'researchFunding',
      filters: {},
      page: 1,
      limit: 5,
    });
    assert(typeof fundingDrill.total === 'number', 'Funding drill-down returns total count');
    assert(Array.isArray(fundingDrill.records), 'Funding drill-down returns records array');

    // 5.3 Faculty Development drill-down
    const devDrill = await institutionAnalyticsService.getMetricDrillDown({
      metric: 'facultyDevelopment',
      subType: 'FDP',
      filters: {},
      page: 1,
      limit: 5,
    });
    assert(typeof devDrill.total === 'number', 'Faculty development (FDP) drill-down returns total count');

    // 5.4 Conference Participation drill-down
    const confDrill = await institutionAnalyticsService.getMetricDrillDown({
      metric: 'conferenceParticipation',
      filters: {},
      page: 1,
      limit: 5,
    });
    assert(typeof confDrill.total === 'number', 'Conference participation drill-down returns total count');

    // 5.5 PhD Scholars drill-down
    const phdDrill = await institutionAnalyticsService.getMetricDrillDown({
      metric: 'phdProgress',
      filters: {},
      page: 1,
      limit: 5,
    });
    assert(typeof phdDrill.total === 'number', 'PhD scholars drill-down returns total count');

    // 5.6 Student Projects drill-down
    const spDrill = await institutionAnalyticsService.getMetricDrillDown({
      metric: 'studentProjectProgress',
      filters: {},
      page: 1,
      limit: 5,
    });
    assert(typeof spDrill.total === 'number', 'Student projects drill-down returns total count');

    // 5.7 Workload Distribution drill-down
    const workloadDrill = await institutionAnalyticsService.getMetricDrillDown({
      metric: 'workloadDistribution',
      subType: 'OVERLOADED',
      filters: {},
      page: 1,
      limit: 5,
    });
    assert(typeof workloadDrill.total === 'number', 'Workload (OVERLOADED) drill-down returns total count');

    console.log('\n======================================================');
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('======================================================');

    await disconnectDatabase();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test execution failed with error:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

runPhase21Tests();
