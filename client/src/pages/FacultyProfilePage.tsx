import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '../services/faculty.service';
import { publicationService } from '../services/publication.service';
import { useAuthStore } from '../stores/authStore';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { FacultyProfileHeader } from '../components/FacultyProfileHeader';
import {
  SkeletonCard,
  SkeletonStats,
  SkeletonTable,
  ErrorState,
  EmptyState,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  Alert,
  RecordStatusBadge,
  QualificationModal,
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
  PhdStageProgressModal,
  TimetableGrid,
} from '../components';
import { timetableService } from '../services/timetable.service';
import { mentoringService } from '../services/mentoring.service';
import type { StudentMentoring } from '../types/mentoring';
import { MENTORING_STATUS_BADGES } from '../types/mentoring';
import type { StudentProject } from '../types/student-project';
import { 
  STUDENT_PROJECT_STATUS_CONFIG, 
  STUDENT_PROJECT_TYPE_LABELS,
} from '../types/student-project';
import type { PhdScholar, PhdStage, ThesisStatus } from '../types/phd-scholar';
import {
  PHD_STAGES,
  PHD_STAGE_BADGES,
  THESIS_STATUS_LABELS,
} from '../types/phd-scholar';
import { ROLES } from '../constants/roles';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';

// Profile tabs that belong to the Teaching module; hidden while it is switched off
const TEACHING_TABS: string[] = FEATURES.TEACHING ? [] : ['teaching', 'workload'];
import { projectService } from '../services/project.service';
import { activityService } from '../services/activity.service';
import { iprService } from '../services/ipr.service';
import type { Qualification, Experience, RecordStatus } from '../types/faculty';
import type { Publication, PublicationVerificationStatus } from '../types/publication';
import type { Project, ProjectStatus } from '../types/project';
import type { IPatent, ICopyright, IConsultancy } from '../types/ipr';
import {
  PATENT_STATUS_LABELS,
  PATENT_STATUS_BADGES,
  CONSULTANCY_STATUS_LABELS,
  CONSULTANCY_STATUS_BADGES,
  VERIFICATION_STATUS_BADGES,
} from '../types/ipr';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_VARIANTS } from '../types/project';
import type { AcademicActivity, ActivityType, ActivityStatus } from '../types/activity';
import {
  ACTIVITY_TYPES,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_BADGE_VARIANTS,
} from '../types/activity';

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
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Question 1: Who is this faculty? */}
          <div className="card-custom">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--color-border)',
                paddingBottom: 'var(--space-3)',
              }}
            >
              <div>
                <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="bi bi-person-badge text-primary" />
                  <span>Faculty Identity & Academic Pedigree</span>
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Core appointment credentials, academic background, institutional tenure, and contact coordinates.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('academic')}
                  icon={<i className="bi bi-arrow-right" />}
                >
                  View Academic Dossier
                </Button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--space-4)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div>
                  <span className="text-secondary">Highest Qualification:</span>{' '}
                  <strong style={{ color: 'var(--color-text)' }}>
                    {highestQualification
                      ? `${highestQualification.degree}${highestQualification.specialization ? ` in ${highestQualification.specialization}` : ''} (${highestQualification.institution}, ${highestQualification.completionYear})`
                      : 'Not Registered'}
                  </strong>
                </div>
                <div>
                  <span className="text-secondary">Cadre & Designation:</span>{' '}
                  <strong>
                    {profile.employment?.cadre || profile.designation} &bull; {profile.designation}
                  </strong>
                </div>
                <div>
                  <span className="text-secondary">Total Experience:</span>{' '}
                  <strong>
                    {totalExperienceYears > 0 ? `${totalExperienceYears.toFixed(1)} years` : '—'}
                  </strong>{' '}
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    (Teaching: {teachingExpYears.toFixed(1)}y | Industry: {industryExpYears.toFixed(1)}y | Research: {researchExpYears.toFixed(1)}y)
                  </span>
                </div>
                <div>
                  <span className="text-secondary">Date of Joining:</span>{' '}
                  <strong>
                    {profile.employment?.joiningDate
                      ? new Date(profile.employment.joiningDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div>
                  <span className="text-secondary">Institutional Status:</span>{' '}
                  <Badge variant="neutral">{profile.employment?.employmentType || 'REGULAR'}</Badge>{' '}
                  <Badge variant={profile.employment?.probationStatus === 'CONFIRMED' ? 'success' : 'warning'}>
                    {profile.employment?.probationStatus || 'CONFIRMED'}
                  </Badge>
                </div>
                <div>
                  <span className="text-secondary">Employee & Biometric ID:</span>{' '}
                  <strong>
                    {profile.employeeId}{' '}
                    {profile.employment?.biometricId ? `• Bio: ${profile.employment.biometricId}` : ''}
                  </strong>
                </div>
                <div>
                  <span className="text-secondary">Direct Contact:</span>{' '}
                  <a
                    href={`mailto:${profile.userId?.email}`}
                    style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                  >
                    {profile.userId?.email}
                  </a>{' '}
                  {profile.basicInfo?.contactNumber ? `• ${profile.basicInfo.contactNumber}` : ''}
                </div>
                <div>
                  <span className="text-secondary">Communication Address:</span>{' '}
                  <span style={{ color: 'var(--color-text)' }}>
                    {profile.basicInfo?.communicationAddress ||
                      profile.basicInfo?.permanentAddress ||
                      'Campus Staff Quarters, Coimbatore'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 8-Dimensional University ERP Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            {/* Question 2: What do they teach? */}
            {FEATURES.TEACHING && (
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-easel text-primary" />
                    <span>What Do They Teach?</span>
                  </h3>
                  <Badge variant="primary">{activeSubjects.length} Courses</Badge>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    Active Curriculum & Weekly Slots:{' '}
                    <strong style={{ color: 'var(--color-text)' }}>
                      {weeklyTimetableSessions} Scheduled Sessions/wk
                    </strong>
                  </div>

                  {activeSubjects.length === 0 ? (
                    <EmptyState
                      compact
                      icon="bi-easel"
                      title="No courses allocated for the current term"
                      reason="No subject allocations have been recorded for this faculty member this term."
                      nextStep="Course allocations made by the department will appear here."
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activeSubjects.slice(0, 3).map((sub, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 8px',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          <div>
                            <strong style={{ color: 'var(--color-text)' }}>{sub.subjectCode}</strong>: {sub.subjectName}
                          </div>
                          <Badge variant="neutral">{sub.degreeProgram || 'COURSE'}</Badge>
                        </div>
                      ))}
                      {activeSubjects.length > 3 && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                          +{activeSubjects.length - 3} more subjects
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('teaching')}
                  icon={<i className="bi bi-arrow-right" />}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Open Teaching & Timetable
                </Button>
              </div>
            </div>
            )}

            {/* Question 3: What have they researched? */}
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-lightbulb text-warning" />
                    <span>What Have They Researched?</span>
                  </h3>
                  <Badge variant="warning">{totalPatents + totalCopyrights} IPR</Badge>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Research Thrust Areas:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-3)' }}>
                    {researchInterests.length > 0 ? (
                      researchInterests.slice(0, 4).map((interest, idx) => (
                        <Badge key={idx} variant="primary">
                          {interest}
                        </Badge>
                      ))
                    ) : (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        No research areas listed on this profile yet.
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                    <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Patents</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{totalPatents}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-success)' }}>{grantedPatents} Granted</div>
                    </div>
                    <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Consultancy</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{totalConsultancy}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-primary)' }}>{formatINR(consultancyRevenue)}</div>
                    </div>
                    <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Copyrights</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{totalCopyrights}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Registered</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('research')}
                  icon={<i className="bi bi-arrow-right" />}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Explore Research & IPR
                </Button>
              </div>
            </div>

            {/* Question 4: Publications? */}
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-journal-bookmark text-info" />
                    <span>Publications Portfolio</span>
                  </h3>
                  <Badge variant="info">{totalPubs} Published</Badge>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                    <div style={{ padding: '6px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-info)' }}>Scopus/SCI</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{scopusSciPubs}</div>
                    </div>
                    <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Journals</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{journalPubs}</div>
                    </div>
                    <div style={{ padding: '6px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Conferences</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>{confPubs}</div>
                    </div>
                  </div>

                  {recentPubs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {recentPubs.map((pub, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '6px 8px',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--font-size-xs)',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'var(--color-text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {pub.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {pub.journalOrConference || 'Scholarly Journal'} &bull;{' '}
                            {pub.academicYear || (pub.publicationDate ? new Date(pub.publicationDate).getFullYear() : '—')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      compact
                      icon="bi-journal-bookmark"
                      title="No publications recorded"
                      reason="No publications have been added to this profile yet."
                      nextStep={isOwner ? 'Add publications from the Publications tab.' : 'Publications added by this faculty member will appear here.'}
                    />
                  )}
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('publications')}
                  icon={<i className="bi bi-arrow-right" />}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  View All Publications
                </Button>
              </div>
            </div>

            {/* Question 5: Projects? */}
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-folder2-open text-primary" />
                    <span>Sponsored Projects & Grants</span>
                  </h3>
                  <Badge variant="primary">{totalFundedProjects} Grants</Badge>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      background: 'rgba(16, 185, 129, 0.08)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid #10b981',
                      marginBottom: 'var(--space-3)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                      Total Sanctioned Grant Value
                    </div>
                    <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {formatINR(totalSanctionedAmt)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {ongoingProjects} Ongoing &bull; {completedProjects} Completed
                    </div>
                  </div>

                  {topProject ? (
                    <div
                      style={{
                        padding: '6px 8px',
                        background: 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {topProject.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        Agency: <strong>{topProject.fundingAgency}</strong> &bull; Role: <strong>{topProject.role}</strong> &bull; {formatINR(topProject.grantAmount)}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      compact
                      icon="bi-folder2-open"
                      title="No funded research projects recorded"
                      reason="No sponsored projects or grants have been added to this profile yet."
                      nextStep={isOwner ? 'Submit a project proposal from the Research tab.' : 'Projects submitted by this faculty member will appear here.'}
                    />
                  )}
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('projects')}
                  icon={<i className="bi bi-arrow-right" />}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Manage Projects & Grants
                </Button>
              </div>
            </div>

            {/* Question 6: Students mentored? */}
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-people text-primary" />
                    <span>Students Mentored & Projects</span>
                  </h3>
                  <Badge variant="neutral">{menteesCount} Mentees</Badge>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Mentees Assigned</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{menteesCount}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {batchesMentored.length > 0 ? batchesMentored.slice(0, 2).join(', ') : 'No batches recorded'}
                      </div>
                    </div>
                    <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Student Projects</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{guidedProjectsCount}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {ugProjectsCount} UG &bull; {pgProjectsCount} PG
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Counseling sessions, academic mentoring logs, and capstone student project supervision records.
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('students')}
                  icon={<i className="bi bi-arrow-right" />}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Open Mentoring & Projects
                </Button>
              </div>
            </div>

            {/* Question 7: PhD scholars? */}
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-mortarboard-fill text-danger" />
                    <span>Doctoral Supervision (PhD)</span>
                  </h3>
                  <Badge variant="neutral">{totalPhdScholars} Scholars</Badge>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: '#4338ca' }}>Ongoing Scholars</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{ongoingPhdScholars}</div>
                    </div>
                    <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '11px', color: '#047857' }}>Doctorates Awarded</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>{completedPhdScholars}</div>
                    </div>
                  </div>

                  {profile.phdScholars && profile.phdScholars.length > 0 ? (
                    <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        {(profile.phdScholars[0] as any).scholarName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {(profile.phdScholars[0] as any).title || (profile.phdScholars[0] as any).researchTitle}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      compact
                      icon="bi-mortarboard"
                      title="No PhD scholars under supervision"
                      reason="No doctoral scholars have been registered under this faculty member yet."
                      nextStep={isOwner ? 'Register scholars from the PhD tab.' : 'Scholars registered by this supervisor will appear here.'}
                    />
                  )}
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('phd')}
                  icon={<i className="bi bi-arrow-right" />}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Open PhD Directorate Dossier
                </Button>
              </div>
            </div>

            {/* Question 8: Current workload? */}
            {FEATURES.TEACHING && (
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-clock-history text-primary" />
                    <span>Current Workload & Norms</span>
                  </h3>
                  <Badge variant={workloadStatus.variant}>{workloadStatus.text}</Badge>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {totalWorkloadHours}
                    </span>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      hours / week (Institutional Norm: 16 hrs)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
                    <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Theory</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadTheory}h</div>
                    </div>
                    <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Lab</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadLab}h</div>
                    </div>
                    <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Project</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadProject}h</div>
                    </div>
                    <div style={{ padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Admin</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{workloadAdmin}h</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('workload')}
                  icon={<i className="bi bi-arrow-right" />}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Analyze Workload Balance
                </Button>
              </div>
            </div>
            )}

            {/* Question 9: Pending verification? */}
            <div className="card-custom" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="bi bi-shield-check text-success" />
                    <span>Pending Verification?</span>
                  </h3>
                  <RecordStatusBadge status={profile.verificationStatus} />
                </div>

                <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="text-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>Master Profile Status: </span>
                    <strong style={{ fontSize: 'var(--font-size-xs)' }}>
                      {profile.verificationStatus === 'VERIFIED'
                        ? 'Institutional certified'
                        : profile.verificationStatus === 'REJECTED'
                        ? 'Corrections requested'
                        : 'Under institutional review'}
                    </strong>
                  </div>

                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      background: totalPendingVerification > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${totalPendingVerification > 0 ? '#f59e0b' : '#10b981'}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: totalPendingVerification > 0 ? '#b45309' : '#047857',
                      }}
                    >
                      {totalPendingVerification > 0
                        ? `${totalPendingVerification} Record(s) Pending Institutional Review`
                        : 'All Records Certified & Up to Date'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {totalPendingVerification > 0
                        ? `${pendingQuals} quals, ${pendingExp} experiences, ${pendingPubs} publications awaiting approval.`
                        : 'No pending approvals across qualifications, experience, and research.'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                {isLeadership ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('review_queue')}
                    icon={<i className="bi bi-check2-square" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Open Leadership Review Queue ({pendingReviewCount})
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('academic')}
                    icon={<i className="bi bi-arrow-right" />}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Review Document Records
                  </Button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 2: Academic & Professional Experience */}
      {activeTab === 'academic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Section 1: Educational Qualifications */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>Educational Qualifications</h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Institutional degrees, specializations, grade classifications, and verified academic credentials.
                </div>
              </div>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setIsAddQualModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                  Add Qualification
                </Button>
              )}
            </div>

            {(!profile.qualifications || profile.qualifications.length === 0) ? (
              <EmptyState
                compact
                icon="bi-mortarboard"
                title="No educational qualifications recorded"
                reason="No degrees or academic credentials have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button variant="primary" size="sm" onClick={() => setIsAddQualModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                      Add Qualification
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Qualifications added by this faculty member will appear here after submission.'}
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Degree & Specialization</th>
                      <th>Institution & University</th>
                      <th>Location</th>
                      <th>Period</th>
                      <th>Score / Grade</th>
                      <th>Document</th>
                      <th>Verification Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.qualifications.map((q, idx) => {
                      const isDraftOrReturned = q.verificationStatus === 'DRAFT' || q.verificationStatus === 'RETURNED_FOR_CORRECTION';
                      return (
                        <tr key={q._id || idx}>
                          <td>
                            <strong>{q.degree}</strong>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                              {q.specialization}
                            </div>
                          </td>
                          <td>
                            <div>{q.institution}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                              {q.university}
                            </div>
                          </td>
                          <td>{q.location || '—'}</td>
                          <td>
                            {q.startYear ? `${q.startYear} – ${q.completionYear}` : q.completionYear}
                          </td>
                          <td>
                            <div>{q.cgpa ? `${q.cgpa} CGPA` : q.percentage ? `${q.percentage}%` : q.percentageOrCgpa || '—'}</div>
                            {q.classOrGrade && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                {q.classOrGrade}
                              </div>
                            )}
                          </td>
                          <td>
                            {q.certificateUrl ? (
                              <a
                                href={q.certificateUrl.startsWith('http') ? q.certificateUrl : `http://localhost:5000${q.certificateUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem',
                                  color: 'var(--color-primary)',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                }}
                              >
                                <i className="bi bi-file-earmark-pdf" />
                                {q.certificateFileName || 'View Certificate'}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                            )}
                          </td>
                          <td>
                            <RecordStatusBadge status={q.verificationStatus} />
                            {q.verificationRemarks && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                                <i className="bi bi-info-circle me-1" />
                                {q.verificationRemarks}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                              {isOwner && isDraftOrReturned && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => runRowAction(`submitQual:${q._id!}`, () => submitQualMutation.mutateAsync(q._id!))}
                                    {...rowActionProps(`submitQual:${q._id!}`)}
                                    title="Submit for HOD Verification"
                                  >
                                    <i className="bi bi-send" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingQual(q);
                                      setIsEditQualModalOpen(true);
                                    }}
                                    title="Edit Qualification"
                                  >
                                    <i className="bi bi-pencil" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => {
                                      if (window.confirm(`Delete ${q.degree} qualification?`)) {
                                        runRowAction(`deleteQual:${q._id!}`, () => deleteQualMutation.mutateAsync(q._id!));
                                      }
                                    }}
                                    {...rowActionProps(`deleteQual:${q._id!}`)}
                                    title="Delete Record"
                                  >
                                    <i className="bi bi-trash" />
                                  </Button>
                                </>
                              )}

                              {canVerify && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setReviewTarget({
                                      type: 'QUALIFICATION',
                                      facultyId: profile._id,
                                      recordId: q._id!,
                                      title: `${q.degree} (${q.specialization})`,
                                      applicantName: profile.name,
                                      currentStatus: q.verificationStatus,
                                    });
                                    setIsReviewRecordModalOpen(true);
                                  }}
                                  icon={<i className="bi bi-patch-check" />}
                                >
                                  Review
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Professional Experience with Calculations */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>Professional Experience</h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Teaching, industrial engineering, and research appointments with institutional verification.
                </div>
              </div>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={() => setIsAddExpModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                  Add Experience
                </Button>
              )}
            </div>

            {/* Experience Overview Calculations */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-primary)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Teaching Experience
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                  {profile.totalTeachingExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-info)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Industry Experience
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-info)', marginTop: '2px' }}>
                  {profile.totalIndustryExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-warning)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Research Experience
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-warning)', marginTop: '2px' }}>
                  {profile.totalResearchExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                </div>
              </div>

              <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-success)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Cumulative
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px' }}>
                  {profile.totalOverallExperienceYears ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Years</span>
                </div>
              </div>
            </div>

            {(!profile.experience || profile.experience.length === 0) ? (
              <EmptyState
                compact
                icon="bi-briefcase"
                title="No professional experience recorded"
                reason="No teaching, industry or research appointments have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button variant="primary" size="sm" onClick={() => setIsAddExpModalOpen(true)} icon={<i className="bi bi-plus-lg" />}>
                      Add Experience
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Experience records added by this faculty member will appear here after submission.'}
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Designation & Organization</th>
                      <th>Role & Employment</th>
                      <th>Dates</th>
                      <th>Duration</th>
                      <th>Responsibilities</th>
                      <th>Document</th>
                      <th>Verification Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.experience.map((e, idx) => {
                      const isDraftOrReturned = e.verificationStatus === 'DRAFT' || e.verificationStatus === 'RETURNED_FOR_CORRECTION';
                      return (
                        <tr key={e._id || idx}>
                          <td>
                            <strong>{e.designation}</strong>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                              {e.organization}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <Badge variant={e.roleType === 'TEACHING' ? 'primary' : e.roleType === 'INDUSTRY' ? 'info' : 'warning'}>
                                {e.roleType}
                              </Badge>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                {e.employmentType.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.8125rem' }}>
                              {new Date(e.startDate).toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              to {e.isCurrent ? 'Present' : e.endDate ? new Date(e.endDate).toLocaleDateString() : '—'}
                            </div>
                          </td>
                          <td>
                            <strong>{e.totalYears || 0}y {e.totalMonths || 0}m</strong>
                          </td>
                          <td style={{ maxWidth: '240px', fontSize: '0.8125rem' }}>
                            {e.responsibilities || '—'}
                          </td>
                          <td>
                            {e.experienceDocumentUrl ? (
                              <a
                                href={e.experienceDocumentUrl.startsWith('http') ? e.experienceDocumentUrl : `http://localhost:5000${e.experienceDocumentUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem',
                                  color: 'var(--color-primary)',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                }}
                              >
                                <i className="bi bi-file-earmark-check" />
                                {e.experienceDocumentFileName || 'View Document'}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                            )}
                          </td>
                          <td>
                            <RecordStatusBadge status={e.verificationStatus} />
                            {e.verificationRemarks && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                                <i className="bi bi-info-circle me-1" />
                                {e.verificationRemarks}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                              {isOwner && isDraftOrReturned && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => runRowAction(`submitExp:${e._id!}`, () => submitExpMutation.mutateAsync(e._id!))}
                                    {...rowActionProps(`submitExp:${e._id!}`)}
                                    title="Submit for HOD Verification"
                                  >
                                    <i className="bi bi-send" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingExp(e);
                                      setIsEditExpModalOpen(true);
                                    }}
                                    title="Edit Experience"
                                  >
                                    <i className="bi bi-pencil" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => {
                                      if (window.confirm(`Delete experience at ${e.organization}?`)) {
                                        runRowAction(`deleteExp:${e._id!}`, () => deleteExpMutation.mutateAsync(e._id!));
                                      }
                                    }}
                                    {...rowActionProps(`deleteExp:${e._id!}`)}
                                    title="Delete Record"
                                  >
                                    <i className="bi bi-trash" />
                                  </Button>
                                </>
                              )}

                              {canVerify && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setReviewTarget({
                                      type: 'EXPERIENCE',
                                      facultyId: profile._id,
                                      recordId: e._id!,
                                      title: `${e.designation} at ${e.organization}`,
                                      applicantName: profile.name,
                                      currentStatus: e.verificationStatus,
                                    });
                                    setIsReviewRecordModalOpen(true);
                                  }}
                                  icon={<i className="bi bi-patch-check" />}
                                >
                                  Review
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Professional Certifications */}
          <div className="card-custom">
            <h2 className="card-title">Professional Certifications</h2>
            <div className="table-responsive">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Certification Title</th>
                    <th>Issuing Organization</th>
                    <th>Issue Date</th>
                    <th>Credential ID</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.certifications?.map((c, idx) => (
                    <tr key={idx}>
                      <td><strong>{c.title}</strong></td>
                      <td>{c.issuingOrganization}</td>
                      <td>{new Date(c.issueDate).toLocaleDateString()}</td>
                      <td><code>{c.credentialId || '—'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Skills & Proficiencies */}
          <div className="card-custom">
            <h2 className="card-title">Skills & Proficiencies</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {profile.skills?.map((s, idx) => (
                <Badge key={idx} variant="neutral">
                  {s.name} ({s.proficiency})
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Leadership Review Queue */}
      {activeTab === 'review_queue' && isLeadership && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <i className="bi bi-check2-square me-2" style={{ color: 'var(--color-primary)' }} />
                  Department Verification Review Queue
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Pending academic qualifications and experience records submitted by faculty members awaiting your authorization.
                </div>
              </div>
              <Badge variant="primary">
                {pendingReviewCount} Pending Items
              </Badge>
            </div>

            {/* Pending Qualifications Queue */}
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }}>
              Pending Qualifications ({reviewQueueData?.qualifications?.length || 0})
            </h3>
            {(!reviewQueueData?.qualifications || reviewQueueData.qualifications.length === 0) ? (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <EmptyState
                  compact
                  icon="bi-patch-check"
                  title="No qualifications awaiting review"
                  reason="All submitted qualifications have been reviewed, or none have been submitted yet."
                  nextStep="Qualifications submitted by faculty in your scope will appear here for verification."
                />
              </div>
            ) : (
              <div className="table-responsive" style={{ marginBottom: 'var(--space-5)' }}>
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Faculty Member</th>
                      <th>Department</th>
                      <th>Degree & Specialization</th>
                      <th>Institution & University</th>
                      <th>Period & Score</th>
                      <th>Document</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewQueueData.qualifications.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.facultyName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {item.employeeId}
                          </div>
                        </td>
                        <td>{item.departmentName}</td>
                        <td>
                          <strong>{item.qualification.degree}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {item.qualification.specialization}
                          </div>
                        </td>
                        <td>{item.qualification.institution}, {item.qualification.university}</td>
                        <td>
                          {item.qualification.completionYear} &bull; {item.qualification.cgpa ? `${item.qualification.cgpa} CGPA` : item.qualification.percentage ? `${item.qualification.percentage}%` : '—'}
                        </td>
                        <td>
                          {item.qualification.certificateUrl ? (
                            <a
                              href={item.qualification.certificateUrl.startsWith('http') ? item.qualification.certificateUrl : `http://localhost:5000${item.qualification.certificateUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.8125rem' }}
                            >
                              <i className="bi bi-file-earmark-pdf me-1" />
                              View
                            </a>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                          )}
                        </td>
                        <td>
                          <RecordStatusBadge status={item.qualification.verificationStatus} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setReviewTarget({
                                type: 'QUALIFICATION',
                                facultyId: item.facultyId,
                                recordId: item.qualification._id!,
                                title: `${item.qualification.degree} (${item.qualification.specialization})`,
                                applicantName: item.facultyName,
                                currentStatus: item.qualification.verificationStatus,
                              });
                              setIsReviewRecordModalOpen(true);
                            }}
                            icon={<i className="bi bi-patch-check" />}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pending Experiences Queue */}
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }}>
              Pending Professional Experience ({reviewQueueData?.experiences?.length || 0})
            </h3>
            {(!reviewQueueData?.experiences || reviewQueueData.experiences.length === 0) ? (
              <EmptyState
                compact
                icon="bi-patch-check"
                title="No experience records awaiting review"
                reason="All submitted experience records have been reviewed, or none have been submitted yet."
                nextStep="Experience records submitted by faculty in your scope will appear here for verification."
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Faculty Member</th>
                      <th>Department</th>
                      <th>Designation & Org</th>
                      <th>Domain & Type</th>
                      <th>Duration</th>
                      <th>Document</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewQueueData.experiences.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{item.facultyName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {item.employeeId}
                          </div>
                        </td>
                        <td>{item.departmentName}</td>
                        <td>
                          <strong>{item.experience.designation}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            {item.experience.organization}
                          </div>
                        </td>
                        <td>
                          <Badge variant="neutral">{item.experience.roleType}</Badge>
                        </td>
                        <td>{item.experience.totalYears || 0}y {item.experience.totalMonths || 0}m</td>
                        <td>
                          {item.experience.experienceDocumentUrl ? (
                            <a
                              href={item.experience.experienceDocumentUrl.startsWith('http') ? item.experience.experienceDocumentUrl : `http://localhost:5000${item.experience.experienceDocumentUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.8125rem' }}
                            >
                              <i className="bi bi-file-earmark-check me-1" />
                              View
                            </a>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No file</span>
                          )}
                        </td>
                        <td>
                          <RecordStatusBadge status={item.experience.verificationStatus} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setReviewTarget({
                                type: 'EXPERIENCE',
                                facultyId: item.facultyId,
                                recordId: item.experience._id!,
                                title: `${item.experience.designation} at ${item.experience.organization}`,
                                applicantName: item.facultyName,
                                currentStatus: item.experience.verificationStatus,
                              });
                              setIsReviewRecordModalOpen(true);
                            }}
                            icon={<i className="bi bi-patch-check" />}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Teaching */}
      {activeTab === 'teaching' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card-custom">
            <h2 className="card-title">Subjects Taught</h2>
            {(!profile.subjectsTaught || profile.subjectsTaught.length === 0) ? (
              <EmptyState
                compact
                icon="bi-book"
                title="No subjects taught recorded"
                reason="No subjects have been recorded against this faculty member yet."
                nextStep="Subjects will appear here once they are recorded for this faculty member."
              />
            ) : (
            <div className="table-responsive">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject Title</th>
                    <th>Program</th>
                    <th>Academic Year & Semester</th>
                    <th>Student Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.subjectsTaught?.map((sub, idx) => (
                    <tr key={idx}>
                      <td><code>{sub.subjectCode}</code></td>
                      <td><strong>{sub.subjectName}</strong></td>
                      <td>{sub.degreeProgram}</td>
                      <td>{sub.academicYear} &bull; {sub.semester}</td>
                      <td>
                        {sub.feedbackRating ? (
                          <Badge variant="success">{sub.feedbackRating} / 5.0</Badge>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          <div className="card-custom">
            <h2 className="card-title">Academic Responsibilities</h2>
            {(!profile.academicResponsibilities || profile.academicResponsibilities.length === 0) ? (
              <EmptyState
                compact
                icon="bi-diagram-3"
                title="No academic responsibilities recorded"
                reason="No departmental or institutional responsibilities have been recorded for this faculty member yet."
                nextStep="Responsibilities will appear here once they are recorded for this faculty member."
              />
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {profile.academicResponsibilities?.map((resp, idx) => (
                <div key={idx} style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 600 }}>{resp.responsibility}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {resp.academicYear} &bull; <Badge variant="neutral">{resp.level}</Badge>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Research */}
      {activeTab === 'research' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Section 16: Patents */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <i className="bi bi-lightbulb me-2" style={{ color: 'var(--color-primary)' }} />
                  Patents & Intellectual Property Disclosures
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  National and international patent disclosures, published specifications, and granted intellectual property.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Link to={ROUTES.IPR_CONSULTANCY} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                  <i className="bi bi-box-arrow-up-right me-1" /> Institutional IPR Repository
                </Link>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingPatent(null);
                      setIsAddPatentModalOpen(true);
                    }}
                    icon={<i className="bi bi-plus-lg" />}
                  >
                    Add Patent
                  </Button>
                )}
              </div>
            </div>

            {(!profile.patents || profile.patents.length === 0) ? (
              <EmptyState
                compact
                icon="bi-lightbulb"
                title="No patents recorded"
                reason="No patent filings, publications or grants have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingPatent(null);
                        setIsAddPatentModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Patent
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Patents recorded by this faculty member will appear here.'}
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Title & Application</th>
                      <th>Inventors</th>
                      <th>Dates</th>
                      <th>Status & Jurisdiction</th>
                      <th>Document</th>
                      <th>Verification</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.patents as any[]).map((pat, idx) => {
                      const isDraftOrReturned = pat.verificationStatus === 'DRAFT' || pat.verificationStatus === 'RETURNED_FOR_CORRECTION';
                      return (
                        <tr key={pat._id || idx}>
                          <td style={{ maxWidth: '280px' }}>
                            <div style={{ fontWeight: 600 }}>{pat.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              App No: <code>{pat.applicationNumber}</code>
                              {pat.patentNumber && <span> &bull; Patent: <strong>{pat.patentNumber}</strong></span>}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8125rem', maxWidth: '180px' }}>
                            {Array.isArray(pat.inventors) ? pat.inventors.join(', ') : pat.inventors || '—'}
                          </td>
                          <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            <div>Filed: {pat.filingDate ? new Date(pat.filingDate).toLocaleDateString() : '—'}</div>
                            {pat.grantDate && (
                              <div style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                                Granted: {new Date(pat.grantDate).toLocaleDateString()}
                              </div>
                            )}
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>AY: {pat.academicYear || '—'}</div>
                          </td>
                          <td>
                            <Badge variant={PATENT_STATUS_BADGES[pat.status as keyof typeof PATENT_STATUS_BADGES] || 'neutral'}>
                              {PATENT_STATUS_LABELS[pat.status as keyof typeof PATENT_STATUS_LABELS] || pat.status}
                            </Badge>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {pat.jurisdiction || 'Indian'}
                            </div>
                          </td>
                          <td>
                            {pat.documentUrl ? (
                              <a
                                href={pat.documentUrl.startsWith('http') ? pat.documentUrl : `http://localhost:5000${pat.documentUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}
                              >
                                <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />View File
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>None</span>
                            )}
                          </td>
                          <td>
                            <Badge variant={VERIFICATION_STATUS_BADGES[pat.verificationStatus] || 'neutral'}>
                              {pat.verificationStatus ? pat.verificationStatus.replace(/_/g, ' ') : 'VERIFIED'}
                            </Badge>
                            {pat.reviewRemarks && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                {pat.reviewRemarks}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              {isOwner && isDraftOrReturned && pat._id && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => runRowAction(`submitPatent:${pat._id}`, () => submitPatentMutation.mutateAsync(pat._id))}
                                    {...rowActionProps(`submitPatent:${pat._id}`)}
                                  >
                                    Submit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-danger"
                                    onClick={() => {
                                      if (window.confirm(`Delete patent "${pat.title}"?`)) {
                                        runRowAction(`deletePatent:${pat._id}`, () => deletePatentMutation.mutateAsync(pat._id));
                                      }
                                    }}
                                    {...rowActionProps(`deletePatent:${pat._id}`)}
                                  >
                                    <i className="bi bi-trash" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 17: Copyrights */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <i className="bi bi-c-circle me-2" style={{ color: 'var(--color-primary)' }} />
                  Copyright Registrations
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Registered software code, algorithms, teaching courseware manuals, and intellectual datasets.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingCopyright(null);
                      setIsAddCopyrightModalOpen(true);
                    }}
                    icon={<i className="bi bi-plus-lg" />}
                  >
                    Add Copyright
                  </Button>
                )}
              </div>
            </div>

            {(!profile.copyrights || profile.copyrights.length === 0) ? (
              <EmptyState
                compact
                icon="bi-c-circle"
                title="No copyrights recorded"
                reason="No copyright registrations have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingCopyright(null);
                        setIsAddCopyrightModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Copyright
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Copyrights recorded by this faculty member will appear here.'}
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Title & Registration No</th>
                      <th>Applicants</th>
                      <th>Category</th>
                      <th>Registration Date</th>
                      <th>Document</th>
                      <th>Verification</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.copyrights as any[]).map((cp, idx) => {
                      const isDraftOrReturned = cp.verificationStatus === 'DRAFT' || cp.verificationStatus === 'RETURNED_FOR_CORRECTION';
                      return (
                        <tr key={cp._id || idx}>
                          <td style={{ maxWidth: '280px' }}>
                            <div style={{ fontWeight: 600 }}>{cp.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              Reg No: <code>{cp.registrationNumber}</code>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8125rem', maxWidth: '180px' }}>
                            {Array.isArray(cp.applicants) ? cp.applicants.join(', ') : cp.applicants || '—'}
                          </td>
                          <td>
                            <Badge variant="primary">{cp.category || 'Software'}</Badge>
                          </td>
                          <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            <div>{cp.registrationDate ? new Date(cp.registrationDate).toLocaleDateString() : '—'}</div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>AY: {cp.academicYear || '—'}</div>
                          </td>
                          <td>
                            {cp.documentUrl ? (
                              <a
                                href={cp.documentUrl.startsWith('http') ? cp.documentUrl : `http://localhost:5000${cp.documentUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}
                              >
                                <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />View File
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>None</span>
                            )}
                          </td>
                          <td>
                            <Badge variant={VERIFICATION_STATUS_BADGES[cp.verificationStatus] || 'neutral'}>
                              {cp.verificationStatus ? cp.verificationStatus.replace(/_/g, ' ') : 'VERIFIED'}
                            </Badge>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              {isOwner && isDraftOrReturned && cp._id && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => runRowAction(`submitCopyright:${cp._id}`, () => submitCopyrightMutation.mutateAsync(cp._id))}
                                    {...rowActionProps(`submitCopyright:${cp._id}`)}
                                  >
                                    Submit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-danger"
                                    onClick={() => {
                                      if (window.confirm(`Delete copyright "${cp.title}"?`)) {
                                        runRowAction(`deleteCopyright:${cp._id}`, () => deleteCopyrightMutation.mutateAsync(cp._id));
                                      }
                                    }}
                                    {...rowActionProps(`deleteCopyright:${cp._id}`)}
                                  >
                                    <i className="bi bi-trash" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <i className="bi bi-cash-coin me-2" style={{ color: 'var(--color-primary)' }} />
                  Funded Research Projects & Grants
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Government sponsored research, national agency grants, and industry-funded R&D projects.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Link to={ROUTES.PROJECTS} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                  <i className="bi bi-box-arrow-up-right me-1" /> Institutional Grants
                </Link>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingProj(null);
                      setIsAddProjModalOpen(true);
                    }}
                    icon={<i className="bi bi-plus-lg" />}
                  >
                    New Project Proposal
                  </Button>
                )}
              </div>
            </div>

            {(!profile.fundedProjects || profile.fundedProjects.length === 0) ? (
              <EmptyState
                compact
                icon="bi-folder-x"
                title="No research projects recorded"
                reason="No sponsored or funded research proposals have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingProj(null);
                        setIsAddProjModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      New Project Proposal
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Research projects submitted by this faculty member will appear here.'}
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Project Title & Team</th>
                      <th>Funding Agency & Category</th>
                      <th>Grant Amount</th>
                      <th>Academic Year</th>
                      <th>Documents</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.fundedProjects.map((proj: any, idx: number) => {
                      const isDraftOrIdea = proj.status === 'DRAFT' || proj.status === 'IDEA';
                      const canEdit = (isOwner && isDraftOrIdea) || user?.role === 'ADMIN';
                      const canUpdateStatus = isLeadership;

                      const amountDisplay =
                        proj.sanctionedAmount > 0
                          ? `₹${proj.sanctionedAmount.toLocaleString()}`
                          : proj.grantAmount
                          ? `₹${proj.grantAmount.toLocaleString()}`
                          : `₹${(proj.requestedAmount || 0).toLocaleString()} (Req)`;

                      return (
                        <tr key={proj._id || idx}>
                          <td style={{ maxWidth: '320px' }}>
                            <strong style={{ color: 'var(--color-text)', lineHeight: 1.4, display: 'block' }}>
                              {proj.title}
                            </strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              PI: {proj.piName || 'Faculty Member'}
                              {proj.sanctionNumber && (
                                <span style={{ color: 'var(--color-primary)', display: 'block' }}>
                                  Sanction No: {proj.sanctionNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                              {proj.fundingAgency}
                            </div>
                            <div style={{ marginTop: '2px' }}>
                              <Badge variant={proj.fundingType === 'Government' ? 'primary' : proj.fundingType === 'Industry' ? 'info' : 'neutral'}>
                                {proj.fundingType || proj.role || 'Government'}
                              </Badge>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: proj.sanctionedAmount > 0 ? 'var(--color-primary)' : 'var(--color-text)' }}>
                              {amountDisplay}
                            </strong>
                            {proj.receivedAmount > 0 && (
                              <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '1px' }}>
                                Recv: ₹{proj.receivedAmount.toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td>
                            <strong>{proj.academicYear || proj.sanctionYear || '—'}</strong>
                            {proj.durationMonths && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                {proj.durationMonths} Months
                              </div>
                            )}
                          </td>
                          <td>
                            {proj.documents && proj.documents.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {proj.documents.map((doc: any, dIdx: number) => (
                                  <a
                                    key={dIdx}
                                    href={doc.fileUrl?.startsWith('http') ? doc.fileUrl : `http://localhost:5000${doc.fileUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      fontSize: '0.75rem',
                                      color: 'var(--color-primary)',
                                      textDecoration: 'underline',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <i className="bi bi-file-earmark-pdf text-danger" />
                                    {doc.title || 'Document'}
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>No files</span>
                            )}
                          </td>
                          <td>
                            <Badge variant={PROJECT_STATUS_BADGE_VARIANTS[proj.status as ProjectStatus] || 'neutral'}>
                              {PROJECT_STATUS_LABELS[proj.status as ProjectStatus] || proj.status}
                            </Badge>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                              {isOwner && isDraftOrIdea && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => runRowAction(`submitProj:${proj._id}`, () => submitProjMutation.mutateAsync(proj._id))}
                                  {...rowActionProps(`submitProj:${proj._id}`)}
                                  title="Submit Proposal to Funding Agency"
                                >
                                  <i className="bi bi-send" />
                                </Button>
                              )}

                              {canUpdateStatus && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setStatusTargetProj(proj);
                                    setIsStatusProjModalOpen(true);
                                  }}
                                  title="Update Status / Sanction Order"
                                >
                                  Status
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDocTargetProj(proj);
                                  setIsDocProjModalOpen(true);
                                }}
                                title="Attach Document"
                              >
                                <i className="bi bi-paperclip" />
                              </Button>

                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingProj(proj);
                                    setIsAddProjModalOpen(true);
                                  }}
                                  title="Edit Project"
                                >
                                  <i className="bi bi-pencil" />
                                </Button>
                              )}

                              {isOwner && isDraftOrIdea && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-danger"
                                  onClick={() => {
                                    if (window.confirm(`Delete project "${proj.title}"?`)) {
                                      runRowAction(`deleteProj:${proj._id}`, () => deleteProjMutation.mutateAsync(proj._id));
                                    }
                                  }}
                                  {...rowActionProps(`deleteProj:${proj._id}`)}
                                  title="Delete Project"
                                >
                                  <i className="bi bi-trash" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 18: Consultancy */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <i className="bi bi-briefcase me-2" style={{ color: 'var(--color-primary)' }} />
                  Industry Consultancy & Advisory Engagements
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Commercial consulting assignments, corporate advisory services, and industry technical solutions.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Link to={ROUTES.IPR_CONSULTANCY} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                  <i className="bi bi-box-arrow-up-right me-1" /> Institutional Consultancy Repository
                </Link>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingConsultancy(null);
                      setIsAddConsultancyModalOpen(true);
                    }}
                    icon={<i className="bi bi-plus-lg" />}
                  >
                    Add Consultancy
                  </Button>
                )}
              </div>
            </div>

            {(!profile.consultancy || profile.consultancy.length === 0) ? (
              <EmptyState
                compact
                icon="bi-briefcase"
                title="No consultancy assignments recorded"
                reason="No industry or institutional consultancy work has been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingConsultancy(null);
                        setIsAddConsultancyModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Consultancy
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Consultancy assignments recorded by this faculty member will appear here.'}
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Client Organization & Title</th>
                      <th>Role</th>
                      <th>Value (INR)</th>
                      <th>Duration & Timeline</th>
                      <th>Status</th>
                      <th>Agreement</th>
                      <th>Verification</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.consultancy as any[]).map((con, idx) => {
                      const isDraftOrReturned = con.verificationStatus === 'DRAFT' || con.verificationStatus === 'RETURNED_FOR_CORRECTION';
                      const formattedValue = con.value !== undefined
                        ? `₹${con.value.toLocaleString('en-IN')}`
                        : con.amount !== undefined
                        ? `₹${con.amount.toLocaleString('en-IN')}`
                        : '—';
                      return (
                        <tr key={con._id || idx}>
                          <td style={{ maxWidth: '280px' }}>
                            <div style={{ fontWeight: 600 }}>{con.projectTitle || con.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              Client: <strong>{con.organization || con.clientName}</strong>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            {con.role || 'Principal Consultant'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong style={{ color: 'var(--color-success)' }}>{formattedValue}</strong>
                          </td>
                          <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            <div>{con.duration || '—'}</div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                              {con.startDate ? new Date(con.startDate).toLocaleDateString() : '—'}
                              {con.endDate && ` to ${new Date(con.endDate).toLocaleDateString()}`}
                            </div>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>AY: {con.academicYear || '—'}</div>
                          </td>
                          <td>
                            <Badge variant={CONSULTANCY_STATUS_BADGES[con.status as keyof typeof CONSULTANCY_STATUS_BADGES] || 'neutral'}>
                              {CONSULTANCY_STATUS_LABELS[con.status as keyof typeof CONSULTANCY_STATUS_LABELS] || con.status}
                            </Badge>
                          </td>
                          <td>
                            {con.agreementUrl ? (
                              <a
                                href={con.agreementUrl.startsWith('http') ? con.agreementUrl : `http://localhost:5000${con.agreementUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}
                              >
                                <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />Agreement
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>None</span>
                            )}
                          </td>
                          <td>
                            <Badge variant={VERIFICATION_STATUS_BADGES[con.verificationStatus] || 'neutral'}>
                              {con.verificationStatus ? con.verificationStatus.replace(/_/g, ' ') : 'VERIFIED'}
                            </Badge>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              {isOwner && isDraftOrReturned && con._id && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => runRowAction(`submitConsultancy:${con._id}`, () => submitConsultancyMutation.mutateAsync(con._id))}
                                    {...rowActionProps(`submitConsultancy:${con._id}`)}
                                  >
                                    Submit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-danger"
                                    onClick={() => {
                                      if (window.confirm(`Delete consultancy "${con.projectTitle || con.title}"?`)) {
                                        runRowAction(`deleteConsultancy:${con._id}`, () => deleteConsultancyMutation.mutateAsync(con._id));
                                      }
                                    }}
                                    {...rowActionProps(`deleteConsultancy:${con._id}`)}
                                  >
                                    <i className="bi bi-trash" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Publications */}
      {activeTab === 'publications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  <i className="bi bi-journal-bookmark me-2" style={{ color: 'var(--color-primary)' }} />
                  Publications & Research Contributions
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Peer-reviewed journal articles, conference papers, books, and verified scholarly works.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Link to={ROUTES.PUBLICATIONS} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                  <i className="bi bi-box-arrow-up-right me-1" /> Institutional Repository
                </Link>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingPub(null);
                      setIsAddPubModalOpen(true);
                    }}
                    icon={<i className="bi bi-plus-lg" />}
                  >
                    Add Publication
                  </Button>
                )}
              </div>
            </div>

            {(!profile.publications || profile.publications.length === 0) ? (
              <EmptyState
                compact
                icon="bi-journal-x"
                title="No publications recorded"
                reason="No journal articles, conference papers or book chapters have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditingPub(null);
                        setIsAddPubModalOpen(true);
                      }}
                      icon={<i className="bi bi-plus-lg" />}
                    >
                      Add Publication
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Publications submitted by this faculty member will appear here.'}
              />
            ) : (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Title & Details</th>
                      <th>Venue & Type</th>
                      <th>Indexing & Citations</th>
                      <th>Academic Year</th>
                      <th>Document</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.publications.map((pub: any, idx: number) => {
                      const isDraftOrReturned =
                        pub.verificationStatus === 'DRAFT' ||
                        pub.verificationStatus === 'RETURNED_FOR_CORRECTION';
                      const canReviewItem =
                        isLeadership &&
                        (pub.verificationStatus === 'SUBMITTED' ||
                          pub.verificationStatus === 'UNDER_REVIEW');

                      return (
                        <tr key={pub._id || idx}>
                          <td style={{ maxWidth: '340px' }}>
                            <strong style={{ color: 'var(--color-text)', lineHeight: 1.4, display: 'block' }}>
                              {pub.title}
                            </strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              Position: {pub.authorPosition?.replace('_', ' ') || 'Author'}
                              {pub.correspondingAuthor && ' • Corresponding'}
                            </div>
                            {pub.doi && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '1px' }}>
                                DOI: {pub.doi}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                              {pub.journalOrConference || pub.journalName}
                            </div>
                            <div style={{ marginTop: '2px', display: 'flex', gap: '4px' }}>
                              <Badge variant="neutral">{pub.publicationType}</Badge>
                              {pub.publisher && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  ({pub.publisher})
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              <Badge variant={pub.indexing === 'SCOPUS' || pub.indexing === 'SCI' ? 'primary' : 'neutral'}>
                                {pub.indexing || pub.indexedIn || 'None'}
                              </Badge>
                              {pub.quartile && pub.quartile !== 'NA' && (
                                <Badge variant="success">{pub.quartile}</Badge>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                              {pub.impactFactor !== undefined && `IF: ${pub.impactFactor} • `}
                              Citations: {pub.citationCount ?? pub.citations ?? 0}
                            </div>
                          </td>
                          <td>
                            <strong>{pub.academicYear || pub.year || '—'}</strong>
                          </td>
                          <td>
                            {pub.pdfUrl ? (
                              <a
                                href={pub.pdfUrl.startsWith('http') ? pub.pdfUrl : `http://localhost:5000${pub.pdfUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem',
                                  color: 'var(--color-primary)',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                }}
                              >
                                <i className="bi bi-file-earmark-pdf text-danger" />
                                {pub.pdfFileName || 'View PDF'}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>No PDF</span>
                            )}
                          </td>
                          <td>
                            <RecordStatusBadge status={pub.verificationStatus || 'VERIFIED'} />
                            {pub.verificationRemarks && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '2px' }}>
                                <i className="bi bi-info-circle me-1" />
                                {pub.verificationRemarks}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                              {isOwner && isDraftOrReturned && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => runRowAction(`submitPub:${pub._id}`, () => submitPubMutation.mutateAsync(pub._id))}
                                    {...rowActionProps(`submitPub:${pub._id}`)}
                                    title="Submit for Institutional Review"
                                  >
                                    <i className="bi bi-send" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingPub(pub);
                                      setIsAddPubModalOpen(true);
                                    }}
                                    title="Edit Publication"
                                  >
                                    <i className="bi bi-pencil" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => {
                                      if (window.confirm(`Delete publication "${pub.title}"?`)) {
                                        runRowAction(`deletePub:${pub._id}`, () => deletePubMutation.mutateAsync(pub._id));
                                      }
                                    }}
                                    {...rowActionProps(`deletePub:${pub._id}`)}
                                    title="Delete Publication"
                                  >
                                    <i className="bi bi-trash" />
                                  </Button>
                                </>
                              )}

                              {canReviewItem && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setReviewingPub(pub);
                                    setIsReviewPubModalOpen(true);
                                  }}
                                  title="Review Publication"
                                >
                                  <i className="bi bi-patch-check" /> Review
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Projects */}
      {activeTab === 'projects' && (
        <div className="card-custom">
          <h2 className="card-title">Student Projects Guided</h2>
          {(!profile.studentProjects || profile.studentProjects.length === 0) ? (
            <EmptyState
              compact
              icon="bi-folder2"
              title="No guided student projects recorded"
              reason="No student projects have been linked to this faculty member as guide yet."
              nextStep="Student projects registered with this faculty member as guide will appear here."
            />
          ) : (
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Project Title</th>
                  <th>Level</th>
                  <th>Academic Year</th>
                  <th>Students</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {profile.studentProjects?.map((sp, idx) => (
                  <tr key={idx}>
                    <td><strong>{sp.title}</strong></td>
                    <td><Badge variant="neutral">{sp.projectType}</Badge></td>
                    <td>{sp.academicYear}</td>
                    <td>{sp.students?.join(', ')}</td>
                    <td><span style={{ fontSize: '0.8125rem' }}>{sp.outcome || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 7: Students (Phase 9 Student Mentoring & Supervision) */}
      {activeTab === 'students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Mentoring Metrics Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                <i className="bi bi-people" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Total Mentored
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).mentoringMetrics?.totalStudentsMentored ?? profile.studentMentoring?.length ?? 0}
                </div>
              </div>
            </div>

            <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                <i className="bi bi-person-check" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Active Mentees
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                  {(profile as any).mentoringMetrics?.activeStudents ?? 0}
                </div>
              </div>
            </div>

            <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                <i className="bi bi-mortarboard" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Completed Mentoring
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).mentoringMetrics?.completedMentoring ?? 0}
                </div>
              </div>
            </div>

            <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                }}
              >
                <i className="bi bi-calendar3" />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Academic Years
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  {(profile as any).mentoringMetrics?.studentsByAcademicYear?.map((y: any) => `${y.academicYear} (${y.count})`).join(', ') || 'Current'}
                </div>
              </div>
            </div>
          </div>

          {/* Student Mentoring Table */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Assigned Student Mentees ({profile.studentMentoring?.length || 0})
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Detailed record of student advisement, career guidance, attendance intervention, and session histories.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<i className="bi bi-person-plus" />}
                    onClick={() => {
                      setEditingMentee(null);
                      setIsAddMenteeModalOpen(true);
                    }}
                  >
                    Assign Mentee
                  </Button>
                )}
                <Link to={ROUTES.MENTORING} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm" icon={<i className="bi bi-arrow-up-right-square" />}>
                    Open Mentoring Hub
                  </Button>
                </Link>
              </div>
            </div>

            {(!profile.studentMentoring || profile.studentMentoring.length === 0) ? (
              <EmptyState
                compact
                icon="bi-people"
                title="No mentees assigned"
                reason="No students have been assigned to this faculty member for mentoring yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<i className="bi bi-person-plus" />}
                      onClick={() => {
                        setEditingMentee(null);
                        setIsAddMenteeModalOpen(true);
                      }}
                    >
                      Assign Mentee
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Mentees assigned to this faculty member will appear here.'}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Student Name & Reg No</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Batch & Section</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Mentor Role</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Year</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Sessions</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.studentMentoring as any[]).map((mentee: any) => {
                      const sessionCount = mentee.interactionRecords?.length || 0;
                      return (
                        <tr key={mentee._id || mentee.registerNumber} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                              {mentee.studentName || mentee.batch}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                              {mentee.registerNumber || `${mentee.studentCount || 0} Students`}
                            </div>
                          </td>

                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <div>{mentee.batch}</div>
                            {mentee.section && (
                              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                Sec {mentee.section}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            {mentee.mentorRole || 'Faculty Mentor'}
                          </td>

                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <Badge variant="neutral">{mentee.academicYear}</Badge>
                          </td>

                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <Badge variant={MENTORING_STATUS_BADGES[mentee.status as keyof typeof MENTORING_STATUS_BADGES] || 'neutral'}>
                              {mentee.status || 'ACTIVE'}
                            </Badge>
                          </td>

                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMentee(mentee);
                                setIsMenteeDetailOpen(true);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: sessionCount > 0 ? 'var(--color-primary-light)' : 'transparent',
                                color: sessionCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                border: '1px solid',
                                borderColor: sessionCount > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                                borderRadius: 'var(--radius-full)',
                                padding: '2px 8px',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <i className="bi bi-chat-dots" />
                              {sessionCount} Session{sessionCount !== 1 ? 's' : ''}
                            </button>
                          </td>

                          <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedMentee(mentee);
                                  setIsMenteeDetailOpen(true);
                                }}
                                title="View History & Record"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-primary)',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <i className="bi bi-eye" />
                              </button>

                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInteractionMenteeTarget(mentee);
                                    setIsMenteeInteractionOpen(true);
                                  }}
                                  title="Log Mentoring Session"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--color-success)',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <i className="bi bi-chat-plus" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 22: Student Projects Guided / Supervised */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Guided Projects
                  </span>
                  <span>Student Projects Supervised ({profile.studentProjects?.length || 0})</span>
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Capstones, mini-projects, UG/PG research thesis, industry collaborations, patents & student publications.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<i className="bi bi-folder-plus" />}
                    onClick={() => setIsAddStudentProjModalOpen(true)}
                  >
                    Register Project
                  </Button>
                )}
                <Link to={ROUTES.STUDENT_PROJECTS} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm" icon={<i className="bi bi-arrow-up-right-square" />}>
                    Open Project Hub
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quick Metrics for Guided Projects */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #10b981' }}>
                <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>Completed</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).studentProjectMetrics?.completed ?? 0}
                </div>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>Ongoing</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).studentProjectMetrics?.ongoing ?? 0}
                </div>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b' }}>
                <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>Submitted</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).studentProjectMetrics?.submitted ?? 0}
                </div>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(147, 51, 234, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #9333ea' }}>
                <div style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 600, textTransform: 'uppercase' }}>Under Review</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).studentProjectMetrics?.underReview ?? 0}
                </div>
              </div>
            </div>

            {(!profile.studentProjects || profile.studentProjects.length === 0) ? (
              <EmptyState
                compact
                icon="bi-folder2"
                title="No guided student projects recorded"
                reason="No student projects list this faculty member as guide or co-guide yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<i className="bi bi-folder-plus" />}
                      onClick={() => setIsAddStudentProjModalOpen(true)}
                    >
                      Register Project
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Student projects guided by this faculty member will appear here.'}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Project Title</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Type</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Batch & Sec</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Team</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Outcomes</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.studentProjects as any[]).map((proj: any) => {
                      const cfg = STUDENT_PROJECT_STATUS_CONFIG[proj.status as keyof typeof STUDENT_PROJECT_STATUS_CONFIG] || {
                        label: proj.status,
                        badgeClass: 'badge-outline',
                      };
                      return (
                        <tr key={proj._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: '220px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{proj.projectTitle}</div>
                            {proj.documentUrl && (
                              <a
                                href={`http://localhost:5000${proj.documentUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '11px', color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                <i className="bi bi-paperclip" /> Report
                              </a>
                            )}
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                            <Badge variant="neutral">{STUDENT_PROJECT_TYPE_LABELS[proj.projectType as keyof typeof STUDENT_PROJECT_TYPE_LABELS] || proj.projectType}</Badge>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                            <div>{proj.batch}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Sec {proj.section}</div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <div style={{ fontWeight: 600 }}>{proj.teamMembers?.length || 0} Students</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {proj.teamMembers?.[0]}{proj.teamMembers?.length > 1 ? ` +${proj.teamMembers.length - 1}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {proj.publication?.hasPublication && <span title="Publication"><i className="bi bi-journal-check" style={{ color: '#10b981' }} /></span>}
                              {proj.patent?.hasPatent && <span title="Patent"><i className="bi bi-award" style={{ color: '#3b82f6' }} /></span>}
                              {proj.industryCollaboration?.hasCollaboration && <span title="Industry"><i className="bi bi-building" style={{ color: '#8b5cf6' }} /></span>}
                              {!proj.publication?.hasPublication && !proj.patent?.hasPatent && !proj.industryCollaboration?.hasCollaboration && <span style={{ color: '#94a3b8' }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <span className={`badge ${cfg.badgeClass}`}>{cfg.label}</span>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentProj(proj);
                                setIsStudentProjDetailOpen(true);
                              }}
                              title="View Project Sheet"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--color-primary)',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              <i className="bi bi-eye" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: PhD (Doctoral Supervision & Scholars Directorate) */}
      {activeTab === 'phd' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* PhD Scholars Supervised (Phase 11) */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#fdf2f8', color: '#be185d', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                    Doctoral Directorate
                  </span>
                  <span>Doctoral Research Scholars Supervised ({profile.phdScholars?.length || 0})</span>
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Doctoral milestones from registration to defense, indexed scholar publications and dissertation monitoring.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<i className="bi bi-person-plus-fill" />}
                    onClick={() => {
                      setSelectedPhdScholar(null);
                      setIsAddPhdModalOpen(true);
                    }}
                  >
                    Register Scholar
                  </Button>
                )}
                <Link to={ROUTES.PHD_SCHOLARS} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" size="sm" icon={<i className="bi bi-arrow-up-right-square" />}>
                    Open PhD Portal
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quick Metrics for Doctoral Guidance */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #6366f1' }}>
                <div style={{ fontSize: '11px', color: '#4338ca', fontWeight: 600, textTransform: 'uppercase' }}>Current Scholars</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).phdScholarMetrics?.currentScholars ?? 0}
                </div>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #10b981' }}>
                <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>Doctorates Awarded</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).phdScholarMetrics?.completedScholars ?? 0}
                </div>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(168, 85, 247, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #a855f7' }}>
                <div style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 600, textTransform: 'uppercase' }}>Publications</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).phdScholarMetrics?.totalPublications ?? 0}
                </div>
              </div>
              <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f59e0b' }}>
                <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>Cohort Progress</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {(profile as any).phdScholarMetrics?.averageProgress ?? 0}%
                </div>
              </div>
            </div>

            {(!profile.phdScholars || profile.phdScholars.length === 0) ? (
              <EmptyState
                compact
                icon="bi-mortarboard"
                title="No PhD scholars registered"
                reason="No doctoral scholars have been registered under this supervisor yet."
                action={
                  isOwner ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<i className="bi bi-person-plus-fill" />}
                      onClick={() => {
                        setSelectedPhdScholar(null);
                        setIsAddPhdModalOpen(true);
                      }}
                    >
                      Register Scholar
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Scholars registered under this supervisor will appear here.'}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-custom" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Scholar & ID</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Research Title & Area</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Stage & Progress</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Thesis Status</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Expected Completion</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Pubs</th>
                      <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile.phdScholars as any[]).map((phd: any) => {
                      const badge = PHD_STAGE_BADGES[phd.stage as PhdStage] || {
                        label: phd.stage,
                        badgeClass: 'badge-neutral',
                      };
                      return (
                        <tr key={phd._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: '200px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{phd.scholarName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {phd.scholarId} &bull; Reg: {phd.registrationNumber}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {phd.university}
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: '240px' }}>
                            <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{phd.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-primary)', marginTop: '2px' }}>
                              {phd.researchArea}
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', minWidth: '150px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span className={`badge ${badge.badgeClass}`}>{badge.label}</span>
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>{phd.progress}%</span>
                            </div>
                            <div style={{ width: '100%', background: 'var(--color-border)', height: '5px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${phd.progress}%`,
                                  height: '100%',
                                  background: phd.stage === PHD_STAGES.COMPLETED ? 'var(--color-success)' : 'var(--color-primary)',
                                  borderRadius: '3px',
                                }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                            <Badge variant="neutral">{THESIS_STATUS_LABELS[phd.thesisStatus as ThesisStatus] || phd.thesisStatus}</Badge>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                            <div>{phd.expectedCompletion ? new Date(phd.expectedCompletion).toLocaleDateString() : '—'}</div>
                            {phd.actualCompletion && (
                              <div style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>
                                Awarded: {new Date(phd.actualCompletion).toLocaleDateString()}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <span className="badge badge-indigo">{phd.publications?.length || 0}</span>
                          </td>
                          <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPhdScholar(phd);
                                  setIsDetailPhdModalOpen(true);
                                }}
                                title="View Doctoral Dossier"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-primary)',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <i className="bi bi-eye" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPhdScholar(phd);
                                  setIsStagePhdModalOpen(true);
                                }}
                                title="Advance Stage Milestone"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-warning)',
                                  padding: '4px 6px',
                                  cursor: 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <i className="bi bi-arrow-up-right-circle" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 8: Activities (Phase 7 Academic Activities & Professional Development) */}
      {activeTab === 'activities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Header & Quick Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              background: 'var(--color-bg-primary)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                Academic Activities & Continuing Professional Development
              </h2>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Conferences, Workshops, Seminars, Faculty Development Programs (FDP), and STTP certifications
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Link to={ROUTES.ACTIVITIES} style={{ textDecoration: 'none' }}>
                <Button variant="outline" size="sm">
                  Full Activities Portal & Timeline ↗
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingAct(null);
                  setActModalType(ACTIVITY_TYPES.CONFERENCE);
                  setIsAddActModalOpen(true);
                }}
              >
                + Record Activity
              </Button>
            </div>
          </div>

          {/* 1. Conferences Section */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                  Conferences
                </span>
                <span>International & National Conferences</span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingAct(null);
                  setActModalType(ACTIVITY_TYPES.CONFERENCE);
                  setIsAddActModalOpen(true);
                }}
              >
                + Add Conference
              </Button>
            </div>

            {((profile as any).conferences?.length || 0) === 0 ? (
              <EmptyState
                compact
                icon="bi-mic"
                title="No conferences recorded"
                reason="No conference presentations or participations have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingAct(null);
                        setActModalType(ACTIVITY_TYPES.CONFERENCE);
                        setIsAddActModalOpen(true);
                      }}
                    >
                      + Add Conference
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Conferences recorded by this faculty member will appear here.'}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Conference Title</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Organizer & Location</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Presentation Details</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Certificate</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile as any).conferences?.map((c: any) => (
                      <tr key={c._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, maxWidth: '240px' }}>
                          <div>{c.title}</div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>AY: {c.academicYear}</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', maxWidth: '180px' }}>
                          <div>{c.organizer}</div>
                          <div>{c.location || c.country || '-'}</div>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {c.date ? new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: '220px' }}>
                          {c.paperPresented ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}><i className="bi bi-star-fill text-warning me-1" aria-hidden="true" />{c.presentationTitle}</div>
                              {c.associatedPublication && (
                                <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>DOI: {c.associatedPublication}</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-secondary)' }}>Participant ({c.participationType || 'Attended'})</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {c.certificateUrl ? (
                            <a href={c.certificateUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                              Certificate ↗
                            </a>
                          ) : (
                            <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[c.status as ActivityStatus] || 'default'}>
                            {ACTIVITY_STATUS_LABELS[c.status as ActivityStatus] || c.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                            {(c.status === 'DRAFT' || c.status === 'RETURNED_FOR_CORRECTION') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => runRowAction(`submitAct:${c._id}`, () => submitActMutation.mutateAsync(c._id))}
                                {...rowActionProps(`submitAct:${c._id}`)}
                              >
                                Submit
                              </Button>
                            )}
                            {isLeadership && (c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setReviewingAct(c);
                                  setIsReviewActModalOpen(true);
                                }}
                              >
                                Review
                              </Button>
                            )}
                            {(c.status === 'DRAFT' || c.status === 'RETURNED_FOR_CORRECTION' || user?.role === ROLES.ADMIN) && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Delete activity "${c.title}"?`)) {
                                    runRowAction(`deleteAct:${c._id}`, () => deleteActMutation.mutateAsync(c._id));
                                  }
                                }}
                                {...rowActionProps(`deleteAct:${c._id}`)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. Workshops & Seminars Section */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                  Workshops & Seminars
                </span>
                <span>Workshops & Technical Seminars</span>
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAct(null);
                    setActModalType(ACTIVITY_TYPES.WORKSHOP);
                    setIsAddActModalOpen(true);
                  }}
                >
                  + Add Workshop
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAct(null);
                    setActModalType(ACTIVITY_TYPES.SEMINAR);
                    setIsAddActModalOpen(true);
                  }}
                >
                  + Add Seminar
                </Button>
              </div>
            </div>

            {[...((profile as any).workshops || []), ...((profile as any).seminars || [])].length === 0 ? (
              <EmptyState
                compact
                icon="bi-easel2"
                title="No workshops or seminars recorded"
                reason="No workshops or technical seminars have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingAct(null);
                        setActModalType(ACTIVITY_TYPES.WORKSHOP);
                        setIsAddActModalOpen(true);
                      }}
                    >
                      + Add Workshop
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'Workshops and seminars recorded by this faculty member will appear here.'}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Classification</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Title / Topic</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Organizer & Venue</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date & Duration</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Role / Participation</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Certificate</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...((profile as any).workshops || []), ...((profile as any).seminars || [])].map((w: any) => (
                      <tr key={w._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: w.activityType === 'SEMINAR' ? '#fef3c7' : '#e0f2fe',
                              color: w.activityType === 'SEMINAR' ? '#92400e' : '#0369a1',
                            }}
                          >
                            {w.activityType}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, maxWidth: '240px' }}>
                          <div>{w.title}</div>
                          {w.topic && <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Topic: {w.topic}</div>}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', maxWidth: '180px' }}>
                          <div>{w.organizer}</div>
                          <div>{w.location || '-'}</div>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <div>{w.date ? new Date(w.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
                          {w.duration && <div style={{ color: 'var(--color-text-secondary)' }}>{w.duration}</div>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {w.role || w.participationType || 'Participant'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {w.certificateUrl ? (
                            <a href={w.certificateUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                              Certificate ↗
                            </a>
                          ) : (
                            <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[w.status as ActivityStatus] || 'default'}>
                            {ACTIVITY_STATUS_LABELS[w.status as ActivityStatus] || w.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                            {(w.status === 'DRAFT' || w.status === 'RETURNED_FOR_CORRECTION') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => runRowAction(`submitAct:${w._id}`, () => submitActMutation.mutateAsync(w._id))}
                                {...rowActionProps(`submitAct:${w._id}`)}
                              >
                                Submit
                              </Button>
                            )}
                            {isLeadership && (w.status === 'SUBMITTED' || w.status === 'UNDER_REVIEW') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setReviewingAct(w);
                                  setIsReviewActModalOpen(true);
                                }}
                              >
                                Review
                              </Button>
                            )}
                            {(w.status === 'DRAFT' || w.status === 'RETURNED_FOR_CORRECTION' || user?.role === ROLES.ADMIN) && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Delete activity "${w.title}"?`)) {
                                    runRowAction(`deleteAct:${w._id}`, () => deleteActMutation.mutateAsync(w._id));
                                  }
                                }}
                                {...rowActionProps(`deleteAct:${w._id}`)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. FDP & STTP Section */}
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#ccfbf1', color: '#0f766e', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                  FDP & STTP
                </span>
                <span>Faculty Development Programs & Short Term Training Programs</span>
              </h3>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAct(null);
                    setActModalType(ACTIVITY_TYPES.FDP);
                    setIsAddActModalOpen(true);
                  }}
                >
                  + Add FDP
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAct(null);
                    setActModalType(ACTIVITY_TYPES.STTP);
                    setIsAddActModalOpen(true);
                  }}
                >
                  + Add STTP
                </Button>
              </div>
            </div>

            {[...((profile as any).fdp || []), ...((profile as any).sttp || [])].length === 0 ? (
              <EmptyState
                compact
                icon="bi-award"
                title="No FDP or STTP programmes recorded"
                reason="No faculty development or short-term training programmes have been added to this profile yet."
                action={
                  isOwner ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingAct(null);
                        setActModalType(ACTIVITY_TYPES.FDP);
                        setIsAddActModalOpen(true);
                      }}
                    >
                      + Add FDP
                    </Button>
                  ) : undefined
                }
                nextStep={isOwner ? undefined : 'FDP and STTP programmes recorded by this faculty member will appear here.'}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Program Name</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Organizer & Mode</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Duration & Dates</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Certificate</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...((profile as any).fdp || []), ...((profile as any).sttp || [])].map((f: any) => (
                      <tr key={f._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: f.activityType === 'STTP' ? '#fce7f3' : '#ccfbf1',
                              color: f.activityType === 'STTP' ? '#9d174d' : '#0f766e',
                            }}
                          >
                            {f.activityType}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, maxWidth: '280px' }}>
                          <div>{f.title}</div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>AY: {f.academicYear}</div>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', maxWidth: '180px' }}>
                          <div>{f.organizer}</div>
                          <div>Mode: {f.mode || 'Offline'}</div>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <div>{f.duration || '1 Week'}</div>
                          {f.startDate && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                              {new Date(f.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              {f.endDate && ` - ${new Date(f.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {f.certificateUrl ? (
                            <a href={f.certificateUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
                              Certificate ↗
                            </a>
                          ) : (
                            <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[f.status as ActivityStatus] || 'default'}>
                            {ACTIVITY_STATUS_LABELS[f.status as ActivityStatus] || f.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                            {(f.status === 'DRAFT' || f.status === 'RETURNED_FOR_CORRECTION') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => runRowAction(`submitAct:${f._id}`, () => submitActMutation.mutateAsync(f._id))}
                                {...rowActionProps(`submitAct:${f._id}`)}
                              >
                                Submit
                              </Button>
                            )}
                            {isLeadership && (f.status === 'SUBMITTED' || f.status === 'UNDER_REVIEW') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setReviewingAct(f);
                                  setIsReviewActModalOpen(true);
                                }}
                              >
                                Review
                              </Button>
                            )}
                            {(f.status === 'DRAFT' || f.status === 'RETURNED_FOR_CORRECTION' || user?.role === ROLES.ADMIN) && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Delete activity "${f.title}"?`)) {
                                    runRowAction(`deleteAct:${f._id}`, () => deleteActMutation.mutateAsync(f._id));
                                  }
                                }}
                                {...rowActionProps(`deleteAct:${f._id}`)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. Awards & Professional Society Memberships */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
            <div className="card-custom">
              <h3 className="card-title">Awards & Honors</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {profile.awards?.map((a, idx) => (
                  <div key={idx} style={{ padding: 'var(--space-3)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontWeight: 600 }}>{a.title} ({a.year})</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {a.awardingBody}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-custom">
              <h3 className="card-title">Professional Society Memberships</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {profile.professionalMemberships?.map((pm, idx) => (
                  <Badge key={idx} variant="primary">
                    {pm.organization} &bull; {pm.membershipType} ({pm.membershipId})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 9: Workload */}
      {activeTab === 'workload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Weekly Institutional Workload</h2>
              <Link
                to="/portal/workload"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <i className="bi bi-speedometer2" /> Workload Analytics &amp; Traceability &rarr;
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Theory Teaching</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.teachingHoursPerWeek || 0} hrs/wk</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Laboratory</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.labHoursPerWeek || 0} hrs/wk</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Student Projects</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.projectHoursPerWeek || 0} hrs/wk</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Administrative</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.workload?.adminHoursPerWeek || 0} hrs/wk</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>Total Workload</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{profile.workload?.totalWorkloadHours || 0} hrs/wk</div>
              </div>
            </div>
          </div>

          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Official Subject Allocations</h2>
              <Badge variant="primary">
                {((profile as any).subjectAllocations?.length || 0)} Course{((profile as any).subjectAllocations?.length || 0) === 1 ? '' : 's'} Allocated
              </Badge>
            </div>
            {((profile as any).subjectAllocations && (profile as any).subjectAllocations.length > 0) ? (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Sem & Sec</th>
                      <th>Academic Year</th>
                      <th>Hours (L-T-P)</th>
                      <th>Weekly Hours</th>
                      <th>Role & Responsibilities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile as any).subjectAllocations.map((alloc: any, idx: number) => (
                      <tr key={alloc._id || idx}>
                        <td>
                          <strong>{alloc.subject?.subjectCode || '—'}</strong>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            {alloc.subject?.subjectName}
                          </div>
                        </td>
                        <td>Sem {alloc.semester} • Sec {alloc.section}</td>
                        <td>{alloc.academicYear}</td>
                        <td>
                          <span style={{ fontFamily: 'monospace' }}>
                            {alloc.lectureHours}L + {alloc.tutorialHours}T + {alloc.practicalHours}P
                          </span>
                        </td>
                        <td>
                          <Badge variant="primary">{alloc.totalHours} hrs/wk</Badge>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {alloc.coordinatorResponsibility && (
                              <Badge variant="warning">
                                <i className="bi bi-star-fill" style={{ fontSize: '10px', marginRight: '4px' }} />
                                {alloc.coordinatorRole || 'Coordinator'}
                              </Badge>
                            )}
                            {alloc.labResponsibility && (
                              <Badge variant="info">
                                <i className="bi bi-cpu" style={{ fontSize: '10px', marginRight: '4px' }} />
                                Lab {alloc.labBatch ? `(${alloc.labBatch})` : ''}
                              </Badge>
                            )}
                            {!alloc.coordinatorResponsibility && !alloc.labResponsibility && (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Theory Faculty</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                compact
                icon="bi-journal-text"
                title="No subject allocations recorded"
                reason="No official subject allocations have been assigned to this faculty member yet."
                nextStep="Allocations made by the department will appear here."
              />
            )}
          </div>

          <div className="card-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>Weekly Teaching Timetable & Schedule</h2>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  Interactive live academic timetable with real-time room and period allocations.
                </p>
              </div>
              <Link to={ROUTES.TIMETABLE} style={{ textDecoration: 'none' }}>
                <Button variant="outline" size="sm" icon={<i className="bi bi-calendar3" />}>
                  Open Full Timetable Module
                </Button>
              </Link>
            </div>

            {timetableLoading ? (
              <div style={{ marginTop: 'var(--space-3)' }} role="status" aria-busy="true" aria-label="Loading timetable">
                <SkeletonTable rows={5} columns={5} />
              </div>
            ) : facultyTimetable && (facultyTimetable.totalWeeklySlots > 0 || facultyTimetable.activeSubstitutions?.length > 0) ? (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <TimetableGrid
                  slots={Object.values(facultyTimetable.weeklyGrid).flat()}
                  activeSubstitutions={facultyTimetable.activeSubstitutions}
                  canEdit={false}
                />
              </div>
            ) : profile.timetable && profile.timetable.length > 0 ? (
              <div className="table-responsive">
                <table className="table-custom">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Period</th>
                      <th>Time Slot</th>
                      <th>Subject</th>
                      <th>Room / Hall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.timetable?.map((tt, idx) => (
                      <tr key={idx}>
                        <td><strong>{tt.dayOfWeek}</strong></td>
                        <td>Period {tt.periodNumber}</td>
                        <td>{tt.timeSlot}</td>
                        <td><code>{tt.subjectCode}</code></td>
                        <td>{tt.roomNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                compact
                icon="bi-calendar-x"
                title="No timetable slots assigned"
                reason="No weekly periods have been scheduled for this faculty member yet."
                nextStep="Slots will appear here once the department timetable is published."
              />
            )}
          </div>
        </div>
      )}

      {/* Tab 10: Attendance */}
      {activeTab === 'attendance' && (
        <div className="card-custom">
          <h2 className="card-title">Semester Attendance Summary</h2>
          {(!profile.attendance || !profile.attendance.totalWorkingDays) ? (
            <EmptyState
              compact
              icon="bi-calendar-check"
              title="No attendance summary recorded"
              reason="Attendance has not been recorded for this faculty member this semester yet."
              nextStep="The semester summary will appear here once attendance is recorded."
            />
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Total Working Days</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.attendance.totalWorkingDays}</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Days Present</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>{profile.attendance.presentDays ?? 0}</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>On-Duty (OD) Days</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>{profile.attendance.onDutyDays ?? 0}</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-success-bg)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>Attendance Percentage</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>{profile.attendance.attendancePercentage ?? 0}%</div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Tab 11: Leave */}
      {activeTab === 'leave' && (
        <div className="card-custom">
          <h2 className="card-title">Available Institutional Leave Balances</h2>
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
      {activeTab === 'appraisal' && (
        <div className="card-custom">
          <h2 className="card-title">Annual Performance Appraisal History</h2>
          {(!profile.appraisal || profile.appraisal.length === 0) ? (
            <EmptyState
              compact
              icon="bi-clipboard-data"
              title="No appraisal records"
              reason="No annual performance appraisals have been recorded for this faculty member yet."
              nextStep="Appraisals will appear here once a review cycle is completed."
            />
          ) : (
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Academic Year</th>
                  <th>Appraisal Score</th>
                  <th>Approval Status</th>
                  <th>Reviewer Comments</th>
                </tr>
              </thead>
              <tbody>
                {profile.appraisal?.map((app, idx) => (
                  <tr key={idx}>
                    <td><strong>{app.academicYear}</strong></td>
                    <td><strong style={{ color: 'var(--color-primary)' }}>{app.score} / 100</strong></td>
                    <td><Badge variant={app.appraisalStatus === 'FINALIZED' ? 'success' : 'primary'}>{app.appraisalStatus}</Badge></td>
                    <td><span style={{ fontSize: '0.8125rem' }}>{app.reviewerNotes || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 13: Documents */}
      {activeTab === 'documents' && (
        <div className="card-custom">
          <h2 className="card-title">Supporting Institutional Documents</h2>
          {(!profile.supportingDocuments || profile.supportingDocuments.length === 0) ? (
            <EmptyState
              compact
              icon="bi-file-earmark"
              title="No supporting documents uploaded"
              reason="No institutional documents have been attached to this profile yet."
              nextStep="Certificates uploaded with qualification, experience and research records are listed in their own tabs."
            />
          ) : (
          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Document Title</th>
                  <th>Type</th>
                  <th>Uploaded Date</th>
                  <th>Verification</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {profile.supportingDocuments?.map((doc, idx) => (
                  <tr key={idx}>
                    <td><strong>{doc.title}</strong></td>
                    <td><Badge variant="neutral">{doc.documentType}</Badge></td>
                    <td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                    <td>
                      <Badge variant={doc.isVerified ? 'success' : 'warning'}>
                        {doc.isVerified ? 'Verified' : 'Pending'}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" icon={<i className="bi bi-download" />}>
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Tab 14: Audit */}
      {activeTab === 'audit' && (
        <div className="card-custom">
          <h2 className="card-title">Profile Governance & Verification Certification</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: '0.875rem' }}>
            <div>
              <span className="text-secondary">Current Verification Status:</span>{' '}
              <Badge variant={profile.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>
                {profile.verificationStatus}
              </Badge>
            </div>
            {profile.verifiedAt && (
              <div>
                <span className="text-secondary">Verified On:</span>{' '}
                <strong>{new Date(profile.verifiedAt).toLocaleString()}</strong>
              </div>
            )}
            {profile.verificationNotes && (
              <div>
                <span className="text-secondary">Certification Remarks:</span>
                <p style={{ margin: '4px 0 0', padding: 'var(--space-3)', background: 'var(--color-background)', borderRadius: 'var(--radius-sm)' }}>
                  {profile.verificationNotes}
                </p>
              </div>
            )}
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
              Master profile record initialized and linked with secure institutional employee identity ({profile.employeeId}).
            </div>
          </div>
        </div>
      )}

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
            placeholder="Staff Quarters, KPRIET Campus"
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
        title="Institutional Profile Verification"
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
