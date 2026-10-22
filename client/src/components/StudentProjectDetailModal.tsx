import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import type { StudentProject } from '../types/student-project';
import { 
  STUDENT_PROJECT_STATUS_CONFIG, 
  STUDENT_PROJECT_TYPE_LABELS 
} from '../types/student-project';

interface StudentProjectDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: StudentProject | null;
  onEdit?: () => void;
  onReview?: () => void;
  canEdit?: boolean;
}

export const StudentProjectDetailModal: React.FC<StudentProjectDetailModalProps> = ({
  isOpen,
  onClose,
  project,
  onEdit,
  onReview,
  canEdit = false,
}) => {
  if (!project) return null;

  const statusCfg = STUDENT_PROJECT_STATUS_CONFIG[project.status] || {
    label: project.status,
    badgeClass: 'badge-outline',
  };

  const typeLabel = STUDENT_PROJECT_TYPE_LABELS[project.projectType] || project.projectType;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const docUrl = project.documentUrl || project.document;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Project Sheet"
      size="lg"
    >
      <div className="space-y-6">
        {/* Header Block */}
        <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 max-w-xl">
              <span className={`badge ${statusCfg.badgeClass} mb-1 inline-flex items-center gap-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {statusCfg.label}
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {project.projectTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Department of {project.department} • Batch {project.batch} ({project.section}) • {typeLabel}
              </p>
            </div>
            <div className="flex gap-2">
              {onReview && (
                <Button variant="outline" size="sm" onClick={onReview}>
                  <i className="bi bi-arrow-repeat mr-1" /> Status
                </Button>
              )}
              {canEdit && onEdit && (
                <Button variant="primary" size="sm" onClick={onEdit}>
                  <i className="bi bi-pencil mr-1" /> Edit
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Faculty Guides Box */}
          <div className="bg-white dark:bg-slate-800/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="bi bi-person-badge text-indigo-500" />
              Faculty Guidance
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              <div className="py-1.5 flex justify-between">
                <span className="text-slate-500">Project Guide:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {project.guideName || project.guide}
                </span>
              </div>
              {project.coGuide && (
                <div className="py-1.5 flex justify-between">
                  <span className="text-slate-500">Co-Guide:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {project.coGuide}
                  </span>
                </div>
              )}
              <div className="py-1.5 flex justify-between">
                <span className="text-slate-500">Academic Year:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {project.academicYear || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline & Dates Box */}
          <div className="bg-white dark:bg-slate-800/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="bi bi-calendar-event text-indigo-500" />
              Project Timeline
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              <div className="py-1.5 flex justify-between">
                <span className="text-slate-500">Start Date:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(project.startDate)}
                </span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-slate-500">Submission Date:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(project.submissionDate)}
                </span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-slate-500">Team Size:</span>
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  {project.teamMembers.length} Student{project.teamMembers.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Members Roster */}
        <div className="bg-white dark:bg-slate-800/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
          <h4 className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <i className="bi bi-people text-indigo-500" />
            Student Team Members & Register Numbers
          </h4>
          {project.teamMembers.length === 0 ? (
            <EmptyState
              compact
              icon="bi-people"
              title="No team members listed for this project"
              reason="Student names and register numbers have not been added yet."
              nextStep={canEdit && onEdit ? 'Use Edit to add the student team.' : undefined}
            />
          ) : (
          <div className="sp-roster-grid">
            {project.teamMembers.map((member, idx) => {
              const regNo = project.registerNumbers[idx] || 'N/A';
              return (
                <div key={idx} className="sp-roster-item">
                  <span className="sp-team-avatar" aria-hidden="true">{idx + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="sp-team-lead" style={{ maxWidth: 'none' }}>{member}</div>
                    <div className="sp-muted" style={{ fontFamily: 'monospace' }}>{regNo}</div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Research Outcomes & Industry Collaboration */}
        <div className="bg-white dark:bg-slate-800/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-3">
          <h4 className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <i className="bi bi-award text-amber-500" />
            Project Outcomes & Industry Tie-up
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Publication */}
            <div className={`p-3 rounded-lg border text-xs ${
              project.publication
                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                <i className={`bi ${project.publication ? 'bi-check-circle-fill text-emerald-600' : 'bi-dash-circle'}`} />
                <span>Publication</span>
              </div>
              {project.publication ? (
                <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200">{project.publication}</p>
              ) : (
                <p className="text-[11px]">No publication filed</p>
              )}
            </div>

            {/* Patent */}
            <div className={`p-3 rounded-lg border text-xs ${
              project.patent
                ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                <i className={`bi ${project.patent ? 'bi-check-circle-fill text-blue-600' : 'bi-dash-circle'}`} />
                <span>Patent / IPR</span>
              </div>
              {project.patent ? (
                <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200">{project.patent}</p>
              ) : (
                <p className="text-[11px]">No patent filed</p>
              )}
            </div>

            {/* Industry Collaboration */}
            <div className={`p-3 rounded-lg border text-xs ${
              project.industryCollaboration
                ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
            }`}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                <i className={`bi ${project.industryCollaboration ? 'bi-check-circle-fill text-purple-600' : 'bi-dash-circle'}`} />
                <span>Industry Collaboration</span>
              </div>
              {project.industryCollaboration ? (
                <p className="text-[11px] font-medium text-slate-800 dark:text-slate-200">{project.industryCollaboration}</p>
              ) : (
                <p className="text-[11px]">No industry sponsor</p>
              )}
            </div>
          </div>
        </div>

        {/* Documents & Remarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Attached Document */}
          <div className="bg-white dark:bg-slate-800/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="bi bi-file-earmark-pdf text-rose-500" />
              Project Report & Document
            </h4>
            {docUrl ? (
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <i className="bi bi-file-earmark-arrow-down text-lg text-indigo-600 dark:text-indigo-400" />
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {project.documentName || 'Project_Report.pdf'}
                  </span>
                </div>
                <a
                  href={`http://localhost:5000${docUrl.startsWith('/') ? docUrl : `/${docUrl}`}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 inline-flex items-center gap-1"
                >
                  <i className="bi bi-download" /> Download
                </a>
              </div>
            ) : (
              <EmptyState
                compact
                icon="bi-file-earmark"
                title="No project report uploaded"
                reason="No project document or synopsis has been attached to this project yet."
                nextStep={
                  canEdit && onEdit
                    ? 'Use Edit to attach the project report or synopsis.'
                    : 'The guide faculty can attach the report when it is ready.'
                }
              />
            )}
          </div>

          {/* Remarks */}
          <div className="bg-white dark:bg-slate-800/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-2">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <i className="bi bi-chat-left-quote text-slate-500" />
              Review Remarks & Feedback
            </h4>
            {project.remarks || project.reviewRemarks ? (
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {project.remarks || project.reviewRemarks}
              </p>
            ) : (
              <EmptyState
                compact
                icon="bi-chat-left-quote"
                title="No review remarks recorded"
                reason="This project has not received review feedback yet."
                nextStep="Remarks added during project review will appear here."
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
