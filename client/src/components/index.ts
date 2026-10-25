// ============================================================================
// PHASE 31: INSTITUTIONAL UI DESIGN SYSTEM (ALL 27 MANDATED COMPONENTS)
// ============================================================================
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Select } from './Select';
export type { SelectProps, SelectOption, SelectOptionGroup } from './Select';

export { MultiSelect } from './MultiSelect';
export type { MultiSelectProps, MultiSelectOption } from './MultiSelect';

export { DatePicker } from './DatePicker';
export type { DatePickerProps } from './DatePicker';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { Drawer } from './Drawer';
export type { DrawerProps } from './Drawer';

export { Dropdown } from './Dropdown';
export type { DropdownProps, DropdownItem } from './Dropdown';

export { Tabs, TabPanel } from './Tabs';
export type { TabsProps, TabItem, TabPanelProps } from './Tabs';

export { Table } from './Table';
export type { TableProps, TableColumn } from './Table';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Alert } from './Alert';
export type { AlertProps, AlertVariant } from './Alert';

export { Toast, ToastProvider, useToast } from './Toast';

export { Tooltip } from './Tooltip';
export type { TooltipProps, TooltipPosition } from './Tooltip';

export { Breadcrumb } from './Breadcrumb';
export type { BreadcrumbProps, BreadcrumbItem } from './Breadcrumb';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { ErrorState } from './ErrorState';
export type { ErrorStateProps, ErrorVariant } from './ErrorState';

export { ErrorBoundary } from './ErrorBoundary';

export { LoadingState } from './LoadingState';
export type { LoadingStateProps, SpinnerSize } from './LoadingState';

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonStats, PageSkeleton } from './Skeleton';
export type { SkeletonProps, SkeletonVariant } from './Skeleton';

export { ConfirmationDialog } from './ConfirmationDialog';
export type { ConfirmationDialogProps } from './ConfirmationDialog';

export { FileUploader } from './FileUploader';
export type { FileUploaderProps } from './FileUploader';

export { Timeline } from './Timeline';
export type { TimelineProps, TimelineEvent } from './Timeline';

export { Stat } from './Stat';
export type { StatProps, StatTrend } from './Stat';

export { ChartContainer } from './ChartContainer';
export type { ChartContainerProps, ChartLegendItem } from './ChartContainer';

export { Search } from './Search';
export type { SearchProps } from './Search';

export { FilterBar } from './FilterBar';
export type { FilterBarProps } from './FilterBar';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

// ============================================================================
// DOMAIN-SPECIFIC MODALS, BADGES & PANELS
// ============================================================================
export { ProtectedRoute } from './ProtectedRoute';
export { RecordStatusBadge } from './RecordStatusBadge';
export { QualificationModal } from './QualificationModal';
export { ExperienceModal } from './ExperienceModal';
export { ReviewRecordModal } from './ReviewRecordModal';
export { PublicationModal } from './PublicationModal';
export { ReviewPublicationModal } from './ReviewPublicationModal';
export { ProjectModal } from './ProjectModal';
export { UpdateProjectStatusModal } from './UpdateProjectStatusModal';
export { ProjectDocumentModal } from './ProjectDocumentModal';
export { ActivityModal } from './ActivityModal';
export { ReviewActivityModal } from './ReviewActivityModal';
export { ActivityTimeline } from './ActivityTimeline';
export { PatentModal } from './PatentModal';
export { CopyrightModal } from './CopyrightModal';
export { ConsultancyModal } from './ConsultancyModal';
export { ReviewIPRModal } from './ReviewIPRModal';
export { MentoringRecordModal } from './MentoringRecordModal';
export { InteractionModal } from './InteractionModal';
export { MentoringDetailModal } from './MentoringDetailModal';
export { StudentProjectModal } from './StudentProjectModal';
export { ReviewStudentProjectModal } from './ReviewStudentProjectModal';
export { StudentProjectDetailModal } from './StudentProjectDetailModal';
export { PhdScholarModal } from './PhdScholarModal';
export { PhdStageProgressModal } from './PhdStageProgressModal';
export { PhdScholarDetailModal } from './PhdScholarDetailModal';
export { SubjectModal } from './SubjectModal';
export { FacultyAllocationModal } from './FacultyAllocationModal';
export { SubjectDetailModal } from './SubjectDetailModal';
export { WorkloadStatusBadge } from './WorkloadStatusBadge';
export { WorkloadTraceabilityModal } from './WorkloadTraceabilityModal';
export { WorkloadThresholdModal } from './WorkloadThresholdModal';
export { TimetableGrid } from './TimetableGrid';
export { TimetableSlotModal } from './TimetableSlotModal';
export { FacultySubstitutionModal } from './FacultySubstitutionModal';
export {
  AttendanceStatusBadge,
  AttendanceSourceBadge,
  CorrectionStatusBadge,
} from './AttendanceStatusBadge';
export { AttendanceRecordModal } from './AttendanceRecordModal';
export { BulkAttendanceModal } from './BulkAttendanceModal';
export { AttendanceCorrectionModal } from './AttendanceCorrectionModal';
export { ReviewCorrectionModal } from './ReviewCorrectionModal';
export { AttendanceAuditModal } from './AttendanceAuditModal';
export { LockAttendanceModal } from './LockAttendanceModal';
export {
  LeaveStatusBadge,
  LeaveTypeBadge,
  WorkflowStageBadge,
} from './LeaveStatusBadge';
export { ApplyLeaveModal } from './ApplyLeaveModal';
export { ReviewLeaveModal } from './ReviewLeaveModal';
export { CancelLeaveModal } from './CancelLeaveModal';
export { LeaveCalendarView } from './LeaveCalendarView';
export { LeaveAuditModal } from './LeaveAuditModal';
export { AppraisalStatusBadge } from './AppraisalStatusBadge';
export { AppraisalEvidenceModal } from './AppraisalEvidenceModal';
export { AppraisalEvaluationModal } from './AppraisalEvaluationModal';
export { AppraisalCycleConfigModal } from './AppraisalCycleConfigModal';
export { AppraisalAuditModal } from './AppraisalAuditModal';
export { GlobalSearchModal } from './GlobalSearchModal';
export { NotificationDropdown } from './NotificationDropdown';
export { NotificationDetailModal } from './NotificationDetailModal';
export { SaveFeedback } from './SaveFeedback';
export { DocumentPreviewModal } from './DocumentPreviewModal';
export { DocumentUploadModal } from './DocumentUploadModal';
export { OrcidImportModal } from './OrcidImportModal';
export { PasswordChecklist } from './PasswordChecklist';
