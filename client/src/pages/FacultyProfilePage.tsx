import React,{ useState,useRef,useEffect } from 'react';
import { useParams,useSearchParams } from 'react-router-dom';
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import { facultyService } from '../services/faculty.service';
import { publicationService } from '../services/publication.service';
import { useAuthStore } from '../stores/authStore';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { FacultyProfileHeader } from '../components/FacultyProfileHeader';
import {
SkeletonCard,
SkeletonStats,ErrorState,Button,
Modal,
Input,
Select,
Alert,QualificationModal,
ExperienceModal,
ReviewRecordModal,
PublicationModal,
ReviewPublicationModal,
ProjectModal,
UpdateProjectStatusModal,
ProjectDocumentModal,
ActivityModal,
ReviewActivityModal,
PatentModal,
CopyrightModal,
ConsultancyModal,
MentoringRecordModal,
InteractionModal,
MentoringDetailModal,
StudentProjectModal,
StudentProjectDetailModal,
PhdScholarModal,
PhdScholarDetailModal,
PhdStageProgressModal
} from '../components';
import { timetableService } from '../services/timetable.service';
import { mentoringService } from '../services/mentoring.service';
import type { StudentMentoring } from '../types/mentoring';
import type { StudentProject } from '../types/student-project';
import type { PhdScholar } from '../types/phd-scholar';
import { ROLES } from '../constants/roles';
import { FEATURES } from '../constants/features';
import { projectService } from '../services/project.service';
import { activityService } from '../services/activity.service';
import { iprService } from '../services/ipr.service';
import type { Qualification,Experience,RecordStatus } from '../types/faculty';
import type { Publication,PublicationVerificationStatus } from '../types/publication';
import type { Project } from '../types/project';
import type { IPatent,ICopyright,IConsultancy } from '../types/ipr';
import type { AcademicActivity,ActivityType,ActivityStatus } from '../types/activity';
import {
ACTIVITY_TYPES
} from '../types/activity';
import { OverviewTab } from './faculty-profile/OverviewTab';
import { AcademicTab } from './faculty-profile/AcademicTab';
import { ReviewQueueTab } from './faculty-profile/ReviewQueueTab';
import { TeachingTab } from './faculty-profile/TeachingTab';
import { ResearchTab } from './faculty-profile/ResearchTab';
import { PublicationsTab } from './faculty-profile/PublicationsTab';
import { ProjectsTab } from './faculty-profile/ProjectsTab';
import { StudentsTab } from './faculty-profile/StudentsTab';
import { PhdTab } from './faculty-profile/PhdTab';
import { ActivitiesTab } from './faculty-profile/ActivitiesTab';
import { WorkloadTab } from './faculty-profile/WorkloadTab';
import { AttendanceTab } from './faculty-profile/AttendanceTab';
import { AppraisalTab } from './faculty-profile/AppraisalTab';
import { DocumentsTab } from './faculty-profile/DocumentsTab';
import { AuditTab } from './faculty-profile/AuditTab';

// Profile tabs that belong to the Teaching module; hidden while it is switched off
const TEACHING_TABS: string[] = FEATURES.TEACHING ? [] : ['teaching', 'workload'];

export const FacultyProfilePage: React.FC = () => {
  const { facultyId } = useParams<{ facultyId?: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const requestedTab = (urlTab === 'qualifications' || urlTab === 'experience') ? 'academic' : urlTab || 'overview';
  const initialTab = TEACHING_TABS.includes(requestedTab) ? 'overview' : requestedTab;

  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    if (urlTab) {
      const target = (urlTab === 'qualifications' || urlTab === 'experience') ? 'academic' : urlTab;
      setActiveTab(TEACHING_TABS.includes(target) ? 'overview' : target);
    }
  }, [urlTab]);
  const [isEditBasicModalOpen, setIsEditBasicModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [statusAlert, setStatusAlert] = useState<string | null>(null);

  // Phase 4 Qualification Modals & States
  const [isAddQualModalOpen, setIsAddQualModalOpen] = useState(false);
  const [isEditQualModalOpen, setIsEditQualModalOpen] = useState(false);
  const [editingQual, setEditingQual] = useState<Qualification | null>(null);

  // Phase 4 Experience Modals & States
  const [isAddExpModalOpen, setIsAddExpModalOpen] = useState(false);
  const [isEditExpModalOpen, setIsEditExpModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | null>(null);

  // Phase 4 Review Modal & State
  const [isReviewRecordModalOpen, setIsReviewRecordModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    type: 'QUALIFICATION' | 'EXPERIENCE';
    facultyId: string;
    recordId: string;
    title: string;
    applicantName?: string;
    currentStatus: RecordStatus | string;
  } | null>(null);

  // Phase 5 Publications Modals & States
  const [isAddPubModalOpen, setIsAddPubModalOpen] = useState(false);
  const [editingPub, setEditingPub] = useState<Publication | null>(null);
  const [reviewingPub, setReviewingPub] = useState<Publication | null>(null);
  const [isReviewPubModalOpen, setIsReviewPubModalOpen] = useState(false);

  // Phase 6 Project Modals & States
  const [isAddProjModalOpen, setIsAddProjModalOpen] = useState(false);
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [statusTargetProj, setStatusTargetProj] = useState<Project | null>(null);
  const [isStatusProjModalOpen, setIsStatusProjModalOpen] = useState(false);
  const [docTargetProj, setDocTargetProj] = useState<Project | null>(null);
  const [isDocProjModalOpen, setIsDocProjModalOpen] = useState(false);

  // Phase 7 Academic Activities Modals & States
  const [isAddActModalOpen, setIsAddActModalOpen] = useState(false);
  const [actModalType, setActModalType] = useState<ActivityType>(ACTIVITY_TYPES.CONFERENCE);
  const [editingAct, setEditingAct] = useState<AcademicActivity | null>(null);
  const [reviewingAct, setReviewingAct] = useState<AcademicActivity | null>(null);
  const [isReviewActModalOpen, setIsReviewActModalOpen] = useState(false);

  // Phase 8 IPR & Consultancy Modals & States
  const [isAddPatentModalOpen, setIsAddPatentModalOpen] = useState(false);
  const [editingPatent, setEditingPatent] = useState<IPatent | null>(null);
  const [isAddCopyrightModalOpen, setIsAddCopyrightModalOpen] = useState(false);
  const [editingCopyright, setEditingCopyright] = useState<ICopyright | null>(null);
  const [isAddConsultancyModalOpen, setIsAddConsultancyModalOpen] = useState(false);
  const [editingConsultancy, setEditingConsultancy] = useState<IConsultancy | null>(null);

  // Phase 9 Student Mentoring Modals & States
  const [isAddMenteeModalOpen, setIsAddMenteeModalOpen] = useState(false);
  const [editingMentee, setEditingMentee] = useState<StudentMentoring | null>(null);
  const [selectedMentee, setSelectedMentee] = useState<StudentMentoring | null>(null);
  const [isMenteeDetailOpen, setIsMenteeDetailOpen] = useState(false);
  const [isMenteeInteractionOpen, setIsMenteeInteractionOpen] = useState(false);
  const [interactionMenteeTarget, setInteractionMenteeTarget] = useState<StudentMentoring | null>(null);

  // Phase 10 Student Project Modals & States
  const [isAddStudentProjModalOpen, setIsAddStudentProjModalOpen] = useState(false);
  const [selectedStudentProj, setSelectedStudentProj] = useState<StudentProject | null>(null);
  const [isStudentProjDetailOpen, setIsStudentProjDetailOpen] = useState(false);

  // Phase 11 PhD Scholar Modals & States
  const [isAddPhdModalOpen, setIsAddPhdModalOpen] = useState(false);
  const [selectedPhdScholar, setSelectedPhdScholar] = useState<PhdScholar | null>(null);
  const [isDetailPhdModalOpen, setIsDetailPhdModalOpen] = useState(false);
  const [isStagePhdModalOpen, setIsStagePhdModalOpen] = useState(false);

  // Form states for basic info edit
  const [basicForm, setBasicForm] = useState({
    contactNumber: '',
    alternateEmail: '',
    emergencyContact: '',
    communicationAddress: '',
  });

  // Fetch faculty profile
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['facultyProfile', facultyId || 'me'],
    queryFn: async () => {
      if (facultyId) {
        return facultyService.getProfileById(facultyId);
      }
      return facultyService.getMyProfile();
    },
  });

  // Phase 14: Real-time Faculty Weekly Timetable
  const { data: facultyTimetable, isLoading: timetableLoading } = useQuery({
    queryKey: ['facultyTimetable', profile?._id],
    queryFn: () => timetableService.getFacultyTimetable(profile!._id),
    enabled: !!profile?._id && (activeTab === 'teaching' || activeTab === 'overview'),
  });

  // Basic Info Update Mutation
  const updateBasicMutation = useMutation({
    mutationFn: (data: Partial<typeof basicForm>) => facultyService.updateBasicInfo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setIsEditBasicModalOpen(false);
      setStatusAlert('Personal contact information updated successfully.');
    },
  });

  // Verification Mutation (HOD, Principal, Admin)
  const verifyMutation = useMutation({
    mutationFn: () =>
      facultyService.verifyProfile(profile!._id, verifyStatus, verifyNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setIsVerifyModalOpen(false);
      setStatusAlert(`Faculty master profile status updated to ${verifyStatus}.`);
    },
  });

  // Phase 4 Qualifications Mutations
  const addQualMutation = useMutation({
    mutationFn: (data: Partial<Qualification>) => facultyService.addQualification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Academic qualification added successfully (Saved as Draft).');
    },
  });

  const updateQualMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Qualification> }) =>
      facultyService.updateQualification(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Academic qualification updated successfully.');
    },
  });

  const deleteQualMutation = useMutation({
    mutationFn: (id: string) => facultyService.deleteQualification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Academic qualification removed from profile.');
    },
  });

  const submitQualMutation = useMutation({
    mutationFn: (id: string) => facultyService.submitQualification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Academic qualification submitted for institutional verification review.');
    },
  });

  // Phase 4 Experience Mutations
  const addExpMutation = useMutation({
    mutationFn: (data: Partial<Experience>) => facultyService.addExperience(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Professional experience added successfully (Saved as Draft).');
    },
  });

  const updateExpMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Experience> }) =>
      facultyService.updateExperience(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Professional experience updated successfully.');
    },
  });

  const deleteExpMutation = useMutation({
    mutationFn: (id: string) => facultyService.deleteExperience(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Professional experience removed from profile.');
    },
  });

  const submitExpMutation = useMutation({
    mutationFn: (id: string) => facultyService.submitExperience(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Professional experience submitted for institutional verification review.');
    },
  });

  // Phase 4 Record Review Mutation (HOD / Leadership)
  const reviewRecordMutation = useMutation({
    mutationFn: async ({
      status,
      remarks,
    }: {
      status: RecordStatus;
      remarks?: string;
    }) => {
      if (!reviewTarget) return;
      if (reviewTarget.type === 'QUALIFICATION') {
        return facultyService.reviewQualification(
          reviewTarget.facultyId,
          reviewTarget.recordId,
          status,
          remarks
        );
      } else {
        return facultyService.reviewExperience(
          reviewTarget.facultyId,
          reviewTarget.recordId,
          status,
          remarks
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setStatusAlert('Verification review decision recorded successfully.');
    },
  });

  const submitPubMutation = useMutation({
    mutationFn: (id: string) => publicationService.submitPublication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Publication submitted for institutional review.');
    },
  });

  const deletePubMutation = useMutation({
    mutationFn: (id: string) => publicationService.deletePublication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Publication record deleted.');
    },
  });

  const reviewPubMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: PublicationVerificationStatus; remarks?: string }) =>
      publicationService.reviewPublication(id, status, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
      setIsReviewPubModalOpen(false);
      setReviewingPub(null);
      setStatusAlert('Publication verification status updated.');
    },
  });

  const submitProjMutation = useMutation({
    mutationFn: (id: string) =>
      projectService.updateProjectStatus(id, {
        status: 'SUBMITTED',
        remarks: 'Submitted by PI from Faculty Profile.',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Project proposal submitted for institutional review.');
    },
  });

  const deleteProjMutation = useMutation({
    mutationFn: (id: string) => projectService.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Project record deleted.');
    },
  });

  const updateProjStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      projectService.updateProjectStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setIsStatusProjModalOpen(false);
      setStatusTargetProj(null);
      setStatusAlert('Project status updated successfully.');
    },
  });

  const submitActMutation = useMutation({
    mutationFn: (id: string) => activityService.submitActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Academic activity submitted for institutional verification.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to submit activity.');
    },
  });

  const deleteActMutation = useMutation({
    mutationFn: (id: string) => activityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Academic activity record deleted.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to delete activity.');
    },
  });

  const reviewActMutation = useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: ActivityStatus; remarks?: string }) =>
      activityService.reviewActivity(id, { status, remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setIsReviewActModalOpen(false);
      setReviewingAct(null);
      setStatusAlert('Academic activity verification status updated.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Verification update failed.');
    },
  });

  // Phase 8 Patent Mutations
  const submitPatentMutation = useMutation({
    mutationFn: (id: string) => iprService.submitPatent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Patent submitted for institutional verification.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to submit patent.');
    },
  });

  const deletePatentMutation = useMutation({
    mutationFn: (id: string) => iprService.deletePatent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Patent record deleted.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to delete patent.');
    },
  });

  // Phase 8 Copyright Mutations
  const submitCopyrightMutation = useMutation({
    mutationFn: (id: string) => iprService.submitCopyright(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Copyright submitted for institutional verification.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to submit copyright.');
    },
  });

  const deleteCopyrightMutation = useMutation({
    mutationFn: (id: string) => iprService.deleteCopyright(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Copyright record deleted.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to delete copyright.');
    },
  });

  // Phase 8 Consultancy Mutations
  const submitConsultancyMutation = useMutation({
    mutationFn: (id: string) => iprService.submitConsultancy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Consultancy project submitted for institutional verification.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to submit consultancy.');
    },
  });

  const deleteConsultancyMutation = useMutation({
    mutationFn: (id: string) => iprService.deleteConsultancy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
      setStatusAlert('Consultancy project record deleted.');
    },
    onError: (err: any) => {
      setStatusAlert(err.response?.data?.message || 'Failed to delete consultancy.');
    },
  });

  const isLeadership =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.PRINCIPAL ||
    user?.role === ROLES.DEAN ||
    user?.role === ROLES.HOD;

  const { data: reviewQueueData } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: () => facultyService.getReviewQueue(),
    enabled: isLeadership,
  });

  const pendingReviewCount =
    (reviewQueueData?.qualifications?.length || 0) + (reviewQueueData?.experiences?.length || 0);

  // Row-level submit / delete actions: one at a time, ref-locked against double-clicks
  const [pendingRowAction, setPendingRowAction] = useState<string | null>(null);
  const rowActionRef = useRef(false);
  const runRowAction = async (key: string, action: () => Promise<unknown>) => {
    if (rowActionRef.current) return;
    rowActionRef.current = true;
    setPendingRowAction(key);
    try {
      await action();
    } catch {
      // Errors are surfaced by the mutation's own handlers
    } finally {
      rowActionRef.current = false;
      setPendingRowAction(null);
    }
  };
  const rowActionProps = (key: string) => ({
    loading: pendingRowAction === key,
    disabled: pendingRowAction !== null && pendingRowAction !== key,
  });

  const saveBasicInfo = useAsyncAction(async () => {
    try {
      await updateBasicMutation.mutateAsync(basicForm);
    } catch (err: any) {
      setStatusAlert(err?.response?.data?.message || err?.message || 'Failed to update contact information.');
    }
  });

  const submitVerification = useAsyncAction(async () => {
    try {
      await verifyMutation.mutateAsync();
    } catch (err: any) {
      setStatusAlert(err?.response?.data?.message || err?.message || 'Failed to update profile verification.');
    }
  });

  if (isLoading) {
    return (
      <div role="status" aria-busy="true" aria-label="Loading faculty profile">
        <SkeletonCard lines={3} className="mb-4" />
        <SkeletonStats count={4} className="mb-4" />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  // Administrative accounts (e.g. ADMIN) may have no faculty master profile; retrying cannot help
  if ((error as { status?: number })?.status === 404) {
    return (
      <ErrorState
        variant="notFound"
        title="No Faculty Profile Linked"
        message="This account does not have a faculty master profile. Faculty profiles are created for faculty members by the administrator."
      />
    );
  }

  if (isError || !profile) {
    return (
      <ErrorState
        title="Unable to Load Faculty Profile"
        message={
          (error as { message?: string })?.message ||
          'You may not have the required institutional authorization to view this profile.'
        }
        onRetry={() => refetch()}
      />
    );
  }

  const isOwner = user?.id === (profile.userId?._id || profile.userId?.toString());
  const canVerify =
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.PRINCIPAL ||
    (user?.role === ROLES.HOD &&
      (user?.departmentId === profile.departmentId?._id?.toString() ||
        user?.departmentId === profile.departmentId?.toString()));



  const openEditBasic = () => {
    setBasicForm({
      contactNumber: profile.basicInfo?.contactNumber || '',
      alternateEmail: profile.basicInfo?.alternateEmail || '',
      emergencyContact: profile.basicInfo?.emergencyContact || '',
      communicationAddress: profile.basicInfo?.communicationAddress || '',
    });
    setIsEditBasicModalOpen(true);
  };

  // Derived Metrics & Calculations for Institutional Overview
  const formatINR = (amt?: number) => {
    if (!amt || amt === 0) return '₹0';
    return '₹' + Number(amt).toLocaleString('en-IN');
  };

  const highestQualification =
    profile.qualifications && profile.qualifications.length > 0
      ? [...profile.qualifications].sort((a, b) => (b.completionYear || 0) - (a.completionYear || 0))[0]
      : null;

  const teachingExpYears =
    profile.totalTeachingExperienceYears ||
    profile.experience
      ?.filter((e) => e.roleType === 'TEACHING')
      .reduce((acc, curr) => acc + (curr.totalYears || 0), 0) ||
    0;
  const industryExpYears =
    profile.totalIndustryExperienceYears ||
    profile.experience
      ?.filter((e) => e.roleType === 'INDUSTRY')
      .reduce((acc, curr) => acc + (curr.totalYears || 0), 0) ||
    0;
  const researchExpYears =
    profile.totalResearchExperienceYears ||
    profile.experience
      ?.filter((e) => e.roleType === 'RESEARCH')
      .reduce((acc, curr) => acc + (curr.totalYears || 0), 0) ||
    0;
  const totalExperienceYears = teachingExpYears + industryExpYears + researchExpYears;

  const activeSubjects = profile.subjectsTaught || [];
  const weeklyTimetableSessions = facultyTimetable?.totalWeeklySlots || profile.timetable?.length || 0;

  const researchInterests = profile.researchInterests || [];
  const totalPatents = profile.patents?.length || 0;
  const grantedPatents = profile.patents?.filter((p) => p.status === 'GRANTED').length || 0;
  const totalCopyrights = profile.copyrights?.length || 0;
  const totalConsultancy = profile.consultancy?.length || 0;
  const consultancyRevenue = profile.consultancy?.reduce((acc, c) => acc + (c.amount || 0), 0) || 0;

  const totalPubs = profile.publications?.length || 0;
  const scopusSciPubs =
    profile.publications?.filter((p) =>
      ['SCOPUS', 'SCI', 'SCIE', 'WEB_OF_SCIENCE'].includes(p.indexing)
    ).length || 0;
  const journalPubs = profile.publications?.filter((p) => p.publicationType === 'JOURNAL').length || 0;
  const confPubs =
    profile.publications?.filter((p) => p.publicationType === 'CONFERENCE').length ||
    (profile.conferences?.length || 0);
  const recentPubs = (profile.publications || []).slice(0, 2);

  const totalFundedProjects = profile.fundedProjects?.length || 0;
  const totalSanctionedAmt = profile.fundedProjects?.reduce((acc, p) => acc + (p.grantAmount || 0), 0) || 0;
  const ongoingProjects = profile.fundedProjects?.filter((p) => p.status === 'ONGOING').length || 0;
  const completedProjects = profile.fundedProjects?.filter((p) => p.status === 'COMPLETED').length || 0;
  const topProject = profile.fundedProjects?.[0];

  const menteesCount =
    profile.studentMentoring?.reduce((acc: number, curr: any) => acc + (curr.studentCount || curr.mentees?.length || 0), 0) ||
    0;
  const batchesMentored =
    profile.studentMentoring?.map((b: any) => b.batch || b.academicYear).filter(Boolean) || [];
  const guidedProjectsCount = profile.studentProjects?.length || 0;
  const ugProjectsCount = profile.studentProjects?.filter((p: any) => p.projectType === 'UG').length || 0;
  const pgProjectsCount = profile.studentProjects?.filter((p: any) => p.projectType === 'PG').length || 0;

  const totalPhdScholars = profile.phdScholars?.length || 0;
  const completedPhdScholars =
    (profile as any).phdScholarMetrics?.completedScholars ??
    profile.phdScholars?.filter((p: any) => p.stage === 'COMPLETED' || p.status === 'AWARDED').length ??
    0;
  const ongoingPhdScholars =
    (profile as any).phdScholarMetrics?.currentScholars ??
    Math.max(0, totalPhdScholars - completedPhdScholars);

  const totalWorkloadHours = profile.workload?.totalWorkloadHours || 0;
  const workloadTheory = profile.workload?.teachingHoursPerWeek || 0;
  const workloadLab = profile.workload?.labHoursPerWeek || 0;
  const workloadProject = profile.workload?.projectHoursPerWeek || 0;
  const workloadAdmin = profile.workload?.adminHoursPerWeek || 0;
  const workloadStatus =
    totalWorkloadHours >= 14 && totalWorkloadHours <= 18
      ? { variant: 'success' as const, text: 'Optimal (Norm: 16 hrs/wk)' }
      : totalWorkloadHours > 18
      ? { variant: 'warning' as const, text: `Overload (+${totalWorkloadHours - 16} hrs)` }
      : totalWorkloadHours > 0
      ? { variant: 'neutral' as const, text: 'Under-allocated (<14 hrs)' }
      : { variant: 'neutral' as const, text: 'Not Scheduled' };

  const pendingQuals =
    profile.qualifications?.filter((q) => q.verificationStatus === 'SUBMITTED' || q.verificationStatus === 'UNDER_REVIEW').length || 0;
  const pendingExp =
    profile.experience?.filter((e) => e.verificationStatus === 'SUBMITTED' || e.verificationStatus === 'UNDER_REVIEW').length || 0;
  const pendingPubs =
    profile.publications?.filter((p) => p.verificationStatus === 'SUBMITTED' || p.verificationStatus === 'UNDER_REVIEW').length || 0;
  const totalPendingVerification = pendingQuals + pendingExp + pendingPubs;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'bi-grid-1x2' },
    { id: 'academic', label: 'Academic', icon: 'bi-mortarboard' },
    { id: 'teaching', label: 'Teaching', icon: 'bi-easel' },
    { id: 'research', label: 'Research', icon: 'bi-lightbulb' },
    { id: 'publications', label: 'Publications', icon: 'bi-journal-bookmark' },
    { id: 'projects', label: 'Projects', icon: 'bi-folder2-open' },
    { id: 'students', label: 'Students', icon: 'bi-people' },
    { id: 'phd', label: 'PhD', icon: 'bi-mortarboard-fill' },
    { id: 'activities', label: 'Activities', icon: 'bi-trophy' },
    { id: 'workload', label: 'Workload', icon: 'bi-clock-history' },
    { id: 'attendance', label: 'Attendance', icon: 'bi-calendar-check' },
    { id: 'leave', label: 'Leave', icon: 'bi-calendar-x' },
    { id: 'appraisal', label: 'Appraisal', icon: 'bi-award' },
    { id: 'documents', label: 'Documents', icon: 'bi-file-earmark-text' },
    { id: 'audit', label: 'Audit', icon: 'bi-shield-check' },
    ...(isLeadership
      ? [
          {
            id: 'review_queue',
            label: `Review Queue ${pendingReviewCount > 0 ? `(${pendingReviewCount})` : ''}`,
            icon: 'bi-check2-square',
          },
        ]
      : []),
  ];

  return (
    <div>
      {statusAlert && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert variant="success" onDismiss={() => setStatusAlert(null)}>
            {statusAlert}
          </Alert>
        </div>
      )}

      {/* Profile Header Card */}
      <FacultyProfileHeader
        profile={profile}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={openEditBasic} icon={<i className="bi bi-pencil" />}>
                Edit Contact Info
              </Button>
            )}
            {canVerify && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsVerifyModalOpen(true)}
                icon={<i className="bi bi-patch-check" />}
              >
                Certify / Verify
              </Button>
            )}
          </div>
        }
      />

      {/* Institutional Tabs Navigation */}
      <div
        className="profile-tabs-nav-bar"
        role="tablist"
        aria-label="Faculty Profile Dossier Sections"
      >
        {tabs.filter((tab) => !TEACHING_TABS.includes(tab.id)).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={`profile-tab-button ${isActive ? 'active' : ''}`}
            >
              <i className={`bi ${tab.icon}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview (9 Institutional Dimensions) */}
      {activeTab === 'overview' && <OverviewTab activeSubjects={activeSubjects} batchesMentored={batchesMentored} completedPhdScholars={completedPhdScholars} completedProjects={completedProjects} confPubs={confPubs} consultancyRevenue={consultancyRevenue} formatINR={formatINR} grantedPatents={grantedPatents} guidedProjectsCount={guidedProjectsCount} highestQualification={highestQualification} industryExpYears={industryExpYears} isLeadership={isLeadership} isOwner={isOwner} journalPubs={journalPubs} menteesCount={menteesCount} ongoingPhdScholars={ongoingPhdScholars} ongoingProjects={ongoingProjects} pendingExp={pendingExp} pendingPubs={pendingPubs} pendingQuals={pendingQuals} pendingReviewCount={pendingReviewCount} pgProjectsCount={pgProjectsCount} profile={profile} recentPubs={recentPubs} researchExpYears={researchExpYears} researchInterests={researchInterests} scopusSciPubs={scopusSciPubs} setActiveTab={setActiveTab} teachingExpYears={teachingExpYears} topProject={topProject} totalConsultancy={totalConsultancy} totalCopyrights={totalCopyrights} totalExperienceYears={totalExperienceYears} totalFundedProjects={totalFundedProjects} totalPatents={totalPatents} totalPendingVerification={totalPendingVerification} totalPhdScholars={totalPhdScholars} totalPubs={totalPubs} totalSanctionedAmt={totalSanctionedAmt} totalWorkloadHours={totalWorkloadHours} ugProjectsCount={ugProjectsCount} weeklyTimetableSessions={weeklyTimetableSessions} workloadAdmin={workloadAdmin} workloadLab={workloadLab} workloadProject={workloadProject} workloadStatus={workloadStatus} workloadTheory={workloadTheory} />}

      {/* Tab 2: Academic & Professional Experience */}
      {activeTab === 'academic' && <AcademicTab canVerify={canVerify} deleteExpMutation={deleteExpMutation} deleteQualMutation={deleteQualMutation} isOwner={isOwner} profile={profile} rowActionProps={rowActionProps} runRowAction={runRowAction} setEditingExp={setEditingExp} setEditingQual={setEditingQual} setIsAddExpModalOpen={setIsAddExpModalOpen} setIsAddQualModalOpen={setIsAddQualModalOpen} setIsEditExpModalOpen={setIsEditExpModalOpen} setIsEditQualModalOpen={setIsEditQualModalOpen} setIsReviewRecordModalOpen={setIsReviewRecordModalOpen} setReviewTarget={setReviewTarget} submitExpMutation={submitExpMutation} submitQualMutation={submitQualMutation} />}

      {/* Tab: Leadership Review Queue */}
      {activeTab === 'review_queue' && isLeadership && <ReviewQueueTab pendingReviewCount={pendingReviewCount} reviewQueueData={reviewQueueData} setIsReviewRecordModalOpen={setIsReviewRecordModalOpen} setReviewTarget={setReviewTarget} />}

      {/* Tab 3: Teaching */}
      {activeTab === 'teaching' && <TeachingTab profile={profile} />}

      {/* Tab 4: Research */}
      {activeTab === 'research' && <ResearchTab deleteConsultancyMutation={deleteConsultancyMutation} deleteCopyrightMutation={deleteCopyrightMutation} deletePatentMutation={deletePatentMutation} deleteProjMutation={deleteProjMutation} isLeadership={isLeadership} isOwner={isOwner} profile={profile} rowActionProps={rowActionProps} runRowAction={runRowAction} setDocTargetProj={setDocTargetProj} setEditingConsultancy={setEditingConsultancy} setEditingCopyright={setEditingCopyright} setEditingPatent={setEditingPatent} setEditingProj={setEditingProj} setIsAddConsultancyModalOpen={setIsAddConsultancyModalOpen} setIsAddCopyrightModalOpen={setIsAddCopyrightModalOpen} setIsAddPatentModalOpen={setIsAddPatentModalOpen} setIsAddProjModalOpen={setIsAddProjModalOpen} setIsDocProjModalOpen={setIsDocProjModalOpen} setIsStatusProjModalOpen={setIsStatusProjModalOpen} setStatusTargetProj={setStatusTargetProj} submitConsultancyMutation={submitConsultancyMutation} submitCopyrightMutation={submitCopyrightMutation} submitPatentMutation={submitPatentMutation} submitProjMutation={submitProjMutation} user={user} />}

      {/* Tab 5: Publications */}
      {activeTab === 'publications' && <PublicationsTab deletePubMutation={deletePubMutation} isLeadership={isLeadership} isOwner={isOwner} profile={profile} rowActionProps={rowActionProps} runRowAction={runRowAction} setEditingPub={setEditingPub} setIsAddPubModalOpen={setIsAddPubModalOpen} setIsReviewPubModalOpen={setIsReviewPubModalOpen} setReviewingPub={setReviewingPub} submitPubMutation={submitPubMutation} />}

      {/* Tab 6: Projects */}
      {activeTab === 'projects' && <ProjectsTab profile={profile} />}

      {/* Tab 7: Students (Phase 9 Student Mentoring & Supervision) */}
      {activeTab === 'students' && <StudentsTab isOwner={isOwner} profile={profile} setEditingMentee={setEditingMentee} setInteractionMenteeTarget={setInteractionMenteeTarget} setIsAddMenteeModalOpen={setIsAddMenteeModalOpen} setIsAddStudentProjModalOpen={setIsAddStudentProjModalOpen} setIsMenteeDetailOpen={setIsMenteeDetailOpen} setIsMenteeInteractionOpen={setIsMenteeInteractionOpen} setIsStudentProjDetailOpen={setIsStudentProjDetailOpen} setSelectedMentee={setSelectedMentee} setSelectedStudentProj={setSelectedStudentProj} />}

      {/* Tab: PhD (Doctoral Supervision & Scholars Directorate) */}
      {activeTab === 'phd' && <PhdTab isOwner={isOwner} profile={profile} setIsAddPhdModalOpen={setIsAddPhdModalOpen} setIsDetailPhdModalOpen={setIsDetailPhdModalOpen} setIsStagePhdModalOpen={setIsStagePhdModalOpen} setSelectedPhdScholar={setSelectedPhdScholar} />}

      {/* Tab 8: Activities (Phase 7 Academic Activities & Professional Development) */}
      {activeTab === 'activities' && <ActivitiesTab deleteActMutation={deleteActMutation} isLeadership={isLeadership} isOwner={isOwner} profile={profile} rowActionProps={rowActionProps} runRowAction={runRowAction} setActModalType={setActModalType} setEditingAct={setEditingAct} setIsAddActModalOpen={setIsAddActModalOpen} setIsReviewActModalOpen={setIsReviewActModalOpen} setReviewingAct={setReviewingAct} submitActMutation={submitActMutation} user={user} />}

      {/* Tab 9: Workload */}
      {activeTab === 'workload' && <WorkloadTab facultyTimetable={facultyTimetable} profile={profile} timetableLoading={timetableLoading} />}

      {/* Tab 10: Attendance */}
      {activeTab === 'attendance' && <AttendanceTab profile={profile} />}

      {/* Tab 11: Leave */}
      {activeTab === 'leave' && (
        <div className="card-custom">
          <h2 className="card-title">Leave balance</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Casual Leave (CL)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.leave?.casualLeaveBalance || 0} Days</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Special Casual Leave</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.leave?.specialCasualLeaveBalance || 0} Days</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Earned Leave (EL)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.leave?.earnedLeaveBalance || 0} Days</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Medical Leave (ML)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.leave?.medicalLeaveBalance || 0} Days</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 12: Appraisal */}
      {activeTab === 'appraisal' && <AppraisalTab profile={profile} />}

      {/* Tab 13: Documents */}
      {activeTab === 'documents' && <DocumentsTab profile={profile} />}

      {/* Tab 14: Audit */}
      {activeTab === 'audit' && <AuditTab profile={profile} />}

      {/* Modal 1: Edit Contact Info */}
      <Modal
        isOpen={isEditBasicModalOpen}
        onClose={() => {
          if (!saveBasicInfo.isPending) setIsEditBasicModalOpen(false);
        }}
        closeOnEscape={!saveBasicInfo.isPending}
        closeOnBackdrop={!saveBasicInfo.isPending}
        title="Edit Personal Contact Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsEditBasicModalOpen(false)}
              disabled={saveBasicInfo.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saveBasicInfo.isPending}
              onClick={() => saveBasicInfo.run()}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Input
            label="Mobile / Contact Number"
            value={basicForm.contactNumber}
            onChange={(e) => setBasicForm({ ...basicForm, contactNumber: e.target.value })}
            placeholder="+91 98421 12345"
          />
          <Input
            label="Alternate Email Address"
            type="email"
            value={basicForm.alternateEmail}
            onChange={(e) => setBasicForm({ ...basicForm, alternateEmail: e.target.value })}
            placeholder="personal.email@gmail.com"
          />
          <Input
            label="Emergency Contact"
            value={basicForm.emergencyContact}
            onChange={(e) => setBasicForm({ ...basicForm, emergencyContact: e.target.value })}
            placeholder="+91 94432 54321 (Spouse / Guardian)"
          />
          <Input
            label="Communication Address"
            value={basicForm.communicationAddress}
            onChange={(e) => setBasicForm({ ...basicForm, communicationAddress: e.target.value })}
            placeholder="Staff Quarters, College Campus"
          />
        </div>
      </Modal>

      {/* Phase 4 Modal: Add Qualification */}
      <QualificationModal
        isOpen={isAddQualModalOpen}
        onClose={() => setIsAddQualModalOpen(false)}
        onSave={async (data) => {
          await addQualMutation.mutateAsync(data);
        }}
      />

      {/* Phase 4 Modal: Edit Qualification */}
      <QualificationModal
        isOpen={isEditQualModalOpen}
        initialData={editingQual}
        onClose={() => {
          setIsEditQualModalOpen(false);
          setEditingQual(null);
        }}
        onSave={async (data) => {
          if (!editingQual?._id) return;
          await updateQualMutation.mutateAsync({ id: editingQual._id, data });
        }}
      />

      {/* Phase 4 Modal: Add Experience */}
      <ExperienceModal
        isOpen={isAddExpModalOpen}
        onClose={() => setIsAddExpModalOpen(false)}
        onSave={async (data) => {
          await addExpMutation.mutateAsync(data);
        }}
      />

      {/* Phase 4 Modal: Edit Experience */}
      <ExperienceModal
        isOpen={isEditExpModalOpen}
        initialData={editingExp}
        onClose={() => {
          setIsEditExpModalOpen(false);
          setEditingExp(null);
        }}
        onSave={async (data) => {
          if (!editingExp?._id) return;
          await updateExpMutation.mutateAsync({ id: editingExp._id, data });
        }}
      />

      {/* Phase 4 Modal: Leadership Record Review */}
      <ReviewRecordModal
        isOpen={isReviewRecordModalOpen}
        target={reviewTarget}
        onClose={() => {
          setIsReviewRecordModalOpen(false);
          setReviewTarget(null);
        }}
        onReview={async (status, remarks) => {
          await reviewRecordMutation.mutateAsync({ status, remarks });
        }}
      />

      {/* Phase 5 Modal: Add/Edit Publication */}
      <PublicationModal
        isOpen={isAddPubModalOpen}
        onClose={() => {
          setIsAddPubModalOpen(false);
          setEditingPub(null);
        }}
        publication={editingPub}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert(editingPub ? 'Publication updated successfully.' : 'New publication recorded.');
        }}
      />

      {/* Phase 5 Modal: Review Publication */}
      <ReviewPublicationModal
        isOpen={isReviewPubModalOpen}
        publication={reviewingPub}
        onClose={() => {
          setIsReviewPubModalOpen(false);
          setReviewingPub(null);
        }}
        onReview={async (status, remarks) => {
          if (!reviewingPub) return;
          await reviewPubMutation.mutateAsync({ id: reviewingPub._id, status, remarks });
        }}
      />

      {/* Phase 6 Modal: Add / Edit Project */}
      <ProjectModal
        isOpen={isAddProjModalOpen}
        project={editingProj}
        onClose={() => {
          setIsAddProjModalOpen(false);
          setEditingProj(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert(editingProj ? 'Project details updated successfully.' : 'Research project proposal created.');
        }}
      />

      {/* Phase 6 Modal: Update Project Status & Sanctions */}
      <UpdateProjectStatusModal
        isOpen={isStatusProjModalOpen}
        project={statusTargetProj}
        onClose={() => {
          setIsStatusProjModalOpen(false);
          setStatusTargetProj(null);
        }}
        onUpdate={async (data) => {
          if (!statusTargetProj) return;
          await updateProjStatusMutation.mutateAsync({ id: statusTargetProj._id, data });
        }}
      />

      {/* Phase 6 Modal: Project Supporting Documents */}
      <ProjectDocumentModal
        isOpen={isDocProjModalOpen}
        project={docTargetProj}
        onClose={() => {
          setIsDocProjModalOpen(false);
          setDocTargetProj(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert('Project document attached successfully.');
        }}
      />

      {/* Phase 7 Modal: Add / Edit Academic Activity */}
      <ActivityModal
        isOpen={isAddActModalOpen}
        activity={editingAct}
        defaultType={actModalType}
        onClose={() => {
          setIsAddActModalOpen(false);
          setEditingAct(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert(editingAct ? 'Activity updated successfully.' : 'Academic activity recorded successfully.');
        }}
      />

      {/* Phase 7 Modal: Review Academic Activity */}
      <ReviewActivityModal
        isOpen={isReviewActModalOpen}
        activity={reviewingAct}
        onClose={() => {
          setIsReviewActModalOpen(false);
          setReviewingAct(null);
        }}
        onReview={async (status, remarks) => {
          if (!reviewingAct) return;
          await reviewActMutation.mutateAsync({ id: reviewingAct._id, status, remarks });
        }}
      />

      {/* Modal 3: Certify / Verify Profile (HOD, Principal, Admin) */}
      <Modal
        isOpen={isVerifyModalOpen}
        onClose={() => {
          if (!submitVerification.isPending) setIsVerifyModalOpen(false);
        }}
        closeOnEscape={!submitVerification.isPending}
        closeOnBackdrop={!submitVerification.isPending}
        title="Verify profile"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsVerifyModalOpen(false)}
              disabled={submitVerification.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={submitVerification.isPending}
              onClick={() => submitVerification.run()}
            >
              Submit Verification
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Select
            label="Verification Decision"
            value={verifyStatus}
            onChange={(e) => setVerifyStatus(e.target.value as 'VERIFIED' | 'REJECTED')}
            options={[
              { value: 'VERIFIED', label: 'VERIFIED — All academic records certified' },
              { value: 'REJECTED', label: 'REJECTED — Incomplete or unverified records' },
            ]}
          />
          <Input
            label="Audit / Reviewer Remarks"
            value={verifyNotes}
            onChange={(e) => setVerifyNotes(e.target.value)}
            placeholder="Certified during annual departmental review..."
          />
        </div>
      </Modal>

      {/* Phase 8 Modal: Patent */}
      <PatentModal
        isOpen={isAddPatentModalOpen}
        patent={editingPatent}
        onClose={() => {
          setIsAddPatentModalOpen(false);
          setEditingPatent(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert(editingPatent ? 'Patent updated successfully.' : 'New patent disclosure recorded.');
        }}
      />

      {/* Phase 8 Modal: Copyright */}
      <CopyrightModal
        isOpen={isAddCopyrightModalOpen}
        copyright={editingCopyright}
        onClose={() => {
          setIsAddCopyrightModalOpen(false);
          setEditingCopyright(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert(editingCopyright ? 'Copyright updated successfully.' : 'New copyright recorded.');
        }}
      />

      {/* Phase 8 Modal: Consultancy */}
      <ConsultancyModal
        isOpen={isAddConsultancyModalOpen}
        consultancy={editingConsultancy}
        onClose={() => {
          setIsAddConsultancyModalOpen(false);
          setEditingConsultancy(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          setStatusAlert(editingConsultancy ? 'Consultancy updated successfully.' : 'New consultancy project recorded.');
        }}
      />

      {/* Phase 9 Modal: Mentee Detail & Interaction History */}
      {isMenteeDetailOpen && selectedMentee && (
        <MentoringDetailModal
          isOpen={isMenteeDetailOpen}
          onClose={() => {
            setIsMenteeDetailOpen(false);
            setSelectedMentee(null);
          }}
          record={selectedMentee}
          onLogInteraction={(rec) => {
            setIsMenteeDetailOpen(false);
            setInteractionMenteeTarget(rec);
            setIsMenteeInteractionOpen(true);
          }}
          onDeleteInteraction={async (recId, intId) => {
            await mentoringService.deleteInteraction(recId, intId);
            queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
            setIsMenteeDetailOpen(false);
            setStatusAlert('Interaction record removed.');
          }}
          canEdit={isOwner}
        />
      )}

      {/* Phase 9 Modal: Add / Edit Mentee */}
      {isAddMenteeModalOpen && (
        <MentoringRecordModal
          isOpen={isAddMenteeModalOpen}
          onClose={() => {
            setIsAddMenteeModalOpen(false);
            setEditingMentee(null);
          }}
          record={editingMentee}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
            setStatusAlert(editingMentee ? 'Mentee record updated.' : 'New student mentee assigned.');
          }}
        />
      )}

      {/* Phase 9 Modal: Log Interaction */}
      {isMenteeInteractionOpen && interactionMenteeTarget && (
        <InteractionModal
          isOpen={isMenteeInteractionOpen}
          onClose={() => {
            setIsMenteeInteractionOpen(false);
            setInteractionMenteeTarget(null);
          }}
          record={interactionMenteeTarget}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
            setStatusAlert('Mentoring session logged successfully.');
          }}
        />
      )}

      {/* Phase 10 Modal: Register Student Project */}
      {isAddStudentProjModalOpen && (
        <StudentProjectModal
          isOpen={isAddStudentProjModalOpen}
          onClose={() => setIsAddStudentProjModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
            setStatusAlert('Student project registered successfully.');
          }}
        />
      )}

      {/* Phase 10 Modal: Project Sheet Detail */}
      {isStudentProjDetailOpen && selectedStudentProj && (
        <StudentProjectDetailModal
          isOpen={isStudentProjDetailOpen}
          onClose={() => {
            setIsStudentProjDetailOpen(false);
            setSelectedStudentProj(null);
          }}
          project={selectedStudentProj}
          canEdit={false}
        />
      )}

      {/* Phase 11 Modal: Register / Edit PhD Scholar */}
      {isAddPhdModalOpen && (
        <PhdScholarModal
          isOpen={isAddPhdModalOpen}
          scholar={selectedPhdScholar}
          onClose={() => {
            setIsAddPhdModalOpen(false);
            setSelectedPhdScholar(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
            setStatusAlert(selectedPhdScholar ? 'PhD scholar updated successfully.' : 'Doctoral scholar registered.');
          }}
        />
      )}

      {/* Phase 11 Modal: PhD Stage Progress */}
      {isStagePhdModalOpen && selectedPhdScholar && (
        <PhdStageProgressModal
          isOpen={isStagePhdModalOpen}
          scholar={selectedPhdScholar}
          onClose={() => {
            setIsStagePhdModalOpen(false);
            setSelectedPhdScholar(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
            setStatusAlert('Doctoral milestone stage updated.');
          }}
        />
      )}

      {/* Phase 11 Modal: PhD Scholar Detail Dossier */}
      {isDetailPhdModalOpen && selectedPhdScholar && (
        <PhdScholarDetailModal
          isOpen={isDetailPhdModalOpen}
          scholar={selectedPhdScholar}
          onClose={() => {
            setIsDetailPhdModalOpen(false);
            setSelectedPhdScholar(null);
          }}
          onEdit={() => {
            setIsDetailPhdModalOpen(false);
            setIsAddPhdModalOpen(true);
          }}
          onAdvanceStage={() => {
            setIsDetailPhdModalOpen(false);
            setIsStagePhdModalOpen(true);
          }}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['facultyProfile'] });
          }}
          canEdit={isOwner}
        />
      )}
    </div>
  );
};
