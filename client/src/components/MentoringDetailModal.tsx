import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { EmptyState } from './EmptyState';
import type { StudentMentoring } from '../types/mentoring';
import {
  MENTORING_STATUS_BADGES,
  INTERACTION_TYPE_BADGES,
} from '../types/mentoring';
import { fileUrl } from '../utils/fileUrl';

interface MentoringDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: StudentMentoring | null;
  onLogInteraction: (record: StudentMentoring) => void;
  onDeleteInteraction: (recordId: string, interactionId: string) => void;
  canEdit?: boolean;
  /** Id of the interaction whose delete request is in flight (disables all delete buttons). */
  deletingInteractionId?: string | null;
}

export const MentoringDetailModal: React.FC<MentoringDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onLogInteraction,
  onDeleteInteraction,
  canEdit = true,
  deletingInteractionId = null,
}) => {
  if (!record) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Mentoring Record: ${record.studentName}`}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Student Profile Card */}
        <div
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                {record.studentName}
              </h3>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px' }}>
                Reg No: {record.registerNumber}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <Badge variant={MENTORING_STATUS_BADGES[record.status] || 'neutral'}>
                {record.status}
              </Badge>
              <Badge variant="neutral">
                {record.academicYear}
              </Badge>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <div>
              <span className="text-secondary">Department:</span>{' '}
              <strong>{record.department}</strong>
            </div>
            <div>
              <span className="text-secondary">Batch & Section:</span>{' '}
              <strong>{record.batch} (Sec {record.section})</strong>
            </div>
            <div>
              <span className="text-secondary">Mentor Role:</span>{' '}
              <strong>{record.mentorRole}</strong>
            </div>
            <div>
              <span className="text-secondary">Mentoring Period:</span>{' '}
              <strong>
                {record.startDate ? new Date(record.startDate).toLocaleDateString() : '—'} to{' '}
                {record.endDate ? new Date(record.endDate).toLocaleDateString() : 'Present'}
              </strong>
            </div>
          </div>

          {record.evidence && (
            <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--color-border)' }}>
              <a
                href={record.evidence}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <i className="bi bi-file-earmark-pdf" />
                View Official Mentoring / Approval Form
              </a>
            </div>
          )}
        </div>

        {/* Mentoring Overview / Advisory Areas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
          {record.academicConcerns && (
            <div style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-primary)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                <i className="bi bi-book me-1" /> Academic Concerns
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                {record.academicConcerns}
              </div>
            </div>
          )}

          {record.careerGuidance && (
            <div style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-primary)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                <i className="bi bi-compass me-1" /> Career Guidance
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                {record.careerGuidance}
              </div>
            </div>
          )}

          {record.attendanceIntervention && (
            <div style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-primary)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                <i className="bi bi-calendar-check me-1" /> Attendance Intervention
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                {record.attendanceIntervention}
              </div>
            </div>
          )}

          {record.projectGuidance && (
            <div style={{ padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-primary)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                <i className="bi bi-lightbulb me-1" /> Project Guidance
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                {record.projectGuidance}
              </div>
            </div>
          )}
        </div>

        {record.remarks && (
          <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Remarks: </span>
            {record.remarks}
          </div>
        )}

        {/* Interaction History Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700 }}>
                Interaction History ({record.interactionRecords?.length || 0} Sessions)
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Chronological record of mentoring discussions, action plans, and outcomes.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                icon={<i className="bi bi-plus-circle" />}
                onClick={() => onLogInteraction(record)}
              >
                Log Session
              </Button>
            )}
          </div>

          {(!record.interactionRecords || record.interactionRecords.length === 0) ? (
            <EmptyState
              compact
              icon="bi-chat-left-dots"
              title={`No interaction sessions logged for ${record.studentName}`}
              reason="No counselling, guidance or review sessions have been recorded for this mentee yet."
              nextStep={canEdit ? undefined : 'Sessions logged by the mentor will appear here.'}
              action={
                canEdit ? (
                  <Button variant="outline" size="sm" onClick={() => onLogInteraction(record)}>
                    Log First Session
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {record.interactionRecords
                .slice()
                .sort((a, b) => new Date(b.interactionDate).getTime() - new Date(a.interactionDate).getTime())
                .map((session, idx) => (
                  <div
                    key={session._id || idx}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-primary)',
                      padding: 'var(--space-4)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                          <i className="bi bi-calendar3 me-1 text-primary" />
                          {new Date(session.interactionDate).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <Badge variant={INTERACTION_TYPE_BADGES[session.interactionType] || 'neutral'}>
                          {session.interactionType}
                        </Badge>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {session.nextMeetingDate && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                            <i className="bi bi-alarm me-1" />
                            Next: {new Date(session.nextMeetingDate).toLocaleDateString()}
                          </span>
                        )}
                        {canEdit && session._id && (
                          <button
                            type="button"
                            onClick={() => {
                              if (deletingInteractionId) return;
                              if (window.confirm('Delete this interaction session?')) {
                                onDeleteInteraction(record._id, session._id!);
                              }
                            }}
                            disabled={!!deletingInteractionId}
                            aria-busy={deletingInteractionId === session._id}
                            title={deletingInteractionId === session._id ? 'Deleting session...' : 'Delete session'}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--color-danger)',
                              cursor: deletingInteractionId ? 'not-allowed' : 'pointer',
                              opacity: deletingInteractionId && deletingInteractionId !== session._id ? 0.5 : 1,
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {deletingInteractionId === session._id ? (
                              <span className="spinner spinner-sm" aria-hidden="true" />
                            ) : (
                              <i className="bi bi-trash" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                      <div>
                        <strong style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                          DISCUSSION POINTS:
                        </strong>
                        <div style={{ marginTop: '2px', color: 'var(--color-text)' }}>
                          {session.discussionPoints}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--color-border)' }}>
                        <div>
                          <strong style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                            ACTION PLAN:
                          </strong>
                          <div style={{ marginTop: '2px', color: 'var(--color-text)' }}>
                            {session.actionPlan}
                          </div>
                        </div>

                        <div>
                          <strong style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                            OUTCOME:
                          </strong>
                          <div style={{ marginTop: '2px', color: 'var(--color-text)' }}>
                            {session.outcome}
                          </div>
                        </div>
                      </div>

                      {session.evidenceUrl && (
                        <div style={{ marginTop: 'var(--space-1)' }}>
                          <a
                            href={fileUrl(session.evidenceUrl)}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              color: 'var(--color-primary)',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-paperclip" />
                            Session Evidence / Notes
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
