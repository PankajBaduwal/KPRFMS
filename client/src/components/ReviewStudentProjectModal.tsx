import '../styles/legacy-utilities.css';
import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import type { 
  StudentProject, 
  StudentProjectStatus, 
} from '../types/student-project';
import { 
  STUDENT_PROJECT_STATUS_CONFIG 
} from '../types/student-project';

interface ReviewStudentProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudentProject | null;
  onUpdateStatus: (id: string, status: StudentProjectStatus, remarks?: string) => Promise<void>;
  userRole?: string;
}

export const ReviewStudentProjectModal: React.FC<ReviewStudentProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateStatus,
  userRole,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<StudentProjectStatus>(
    project?.status || 'PROPOSED'
  );
  const [remarks, setRemarks] = useState(project?.remarks || '');
  const [submitting, setSubmitting] = useState(false);
  // Synchronous lock so a double click or repeated Enter never submits twice.
  const submitLockRef = React.useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when project changes
  React.useEffect(() => {
    if (project) {
      setSelectedStatus(project.status);
      setRemarks(project.remarks || '');
      setError(null);
    }
  }, [project]);

  if (!project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      setSubmitting(true);
      setError(null);
      await onUpdateStatus(project._id, selectedStatus, remarks);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update status');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const statusOptions: StudentProjectStatus[] = [
    'PROPOSED',
    'APPROVED',
    'ONGOING',
    'SUBMITTED',
    'UNDER_REVIEW',
    'COMPLETED',
  ];

  const currentCfg = STUDENT_PROJECT_STATUS_CONFIG[project.status] || {
    label: project.status,
    badgeClass: 'badge-outline',
  };

  return (
    <Modal
      className="tw-legacy"
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title="Review & Update Project Status"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="alert alert-danger py-2 px-3 text-sm flex items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Project Overview
          </p>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {project.projectTitle}
          </h4>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
            <span><strong>Batch:</strong> {project.batch} ({project.section})</span>
            <span>•</span>
            <span><strong>Type:</strong> {project.projectType}</span>
            <span>•</span>
            <span><strong>Guide:</strong> {project.guideName || project.guide}</span>
          </div>
          <div className="mt-2 text-xs flex items-center gap-2">
            <span className="text-slate-500">Current Status:</span>
            <span className={`badge ${currentCfg.badgeClass}`}>
              {currentCfg.label}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            New Status <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((st) => {
              const cfg = STUDENT_PROJECT_STATUS_CONFIG[st];
              const isSelected = selectedStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`badge text-[10px] py-0.5 px-1.5 ${cfg.badgeClass}`}>
                      {cfg.label}
                    </span>
                  </span>
                  {isSelected && (
                    <i className="bi bi-check-circle-fill text-indigo-600 dark:text-indigo-400 text-sm" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {userRole === 'HOD' || userRole === 'ADMIN'
              ? 'As HOD/Admin, you can approve, review, or mark student projects completed.'
              : 'As Guide Faculty, you can submit and update progress on your assigned projects.'}
          </p>
        </div>

        <div>
          <label htmlFor="review-student-project-remarks" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Review Remarks & Comments
          </label>
          <textarea
            id="review-student-project-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="Add comments on progress, milestones achieved, evaluation scores, or conditions for approval..."
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={selectedStatus === project.status}
            loading={submitting}
          >
            {submitting ? 'Updating...' : 'Confirm Status Update'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
