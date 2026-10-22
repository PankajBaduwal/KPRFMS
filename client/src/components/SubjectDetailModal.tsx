import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import type { Subject } from '../types/subject';

interface SubjectDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null;
  onAllocate?: () => void;
  onEdit?: () => void;
  canManage?: boolean;
}

export const SubjectDetailModal: React.FC<SubjectDetailModalProps> = ({
  isOpen,
  onClose,
  subject,
  onAllocate,
  onEdit,
  canManage = false,
}) => {
  if (!subject) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Academic Subject Specification & Faculty Rosters"
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Header Block */}
        <div
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="badge badge-primary">{subject.subjectCode}</span>
                <span className="badge badge-outline">Semester {subject.semester}</span>
                <span className="badge badge-neutral">Batch {subject.batch}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  AY: {subject.academicYear}
                </span>
              </div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                {subject.subjectName}
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                {subject.program} &bull; {subject.department}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {canManage && onAllocate && (
                <Button variant="outline" onClick={onAllocate}>
                  <i className="bi bi-person-plus" style={{ marginRight: '6px' }} /> Allocate Faculty
                </Button>
              )}
              {canManage && onEdit && (
                <Button variant="primary" onClick={onEdit}>
                  <i className="bi bi-pencil" style={{ marginRight: '6px' }} /> Edit Subject
                </Button>
              )}
            </div>
          </div>

          {/* Curricular Metrics Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 'var(--space-2)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ textAlign: 'center', padding: '6px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Credits</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{subject.credits}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Lecture (L)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{subject.lectureHours} hrs</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tutorial (T)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{subject.tutorialHours} hrs</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Practical (P)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{subject.practicalHours} hrs</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px', background: 'var(--color-primary-50)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>Total Contact</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{subject.totalContactHours} hrs/wk</div>
            </div>
          </div>
        </div>

        {/* Syllabus / Description */}
        {subject.description && (
          <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
              Subject Scope & Syllabus Units
            </h4>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {subject.description}
            </p>
          </div>
        )}

        {/* Assigned Faculty Allocations Roster */}
        <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-secondary)', fontWeight: 600, margin: 0 }}>
              Assigned Faculty Teaching Roster ({subject.allocations?.length || 0})
            </h4>
            {subject.syllabusUrl && (
              <a
                href={subject.syllabusUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'underline' }}
              >
                View Syllabus Document ↗
              </a>
            )}
          </div>

          {subject.allocations && subject.allocations.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-custom" style={{ width: '100%', fontSize: 'var(--font-size-xs)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-primary)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '6px 10px' }}>Faculty Member</th>
                    <th style={{ padding: '6px 10px' }}>Section</th>
                    <th style={{ padding: '6px 10px' }}>Load (L-T-P)</th>
                    <th style={{ padding: '6px 10px' }}>Total Weekly</th>
                    <th style={{ padding: '6px 10px' }}>Role / Responsibilities</th>
                  </tr>
                </thead>
                <tbody>
                  {subject.allocations.map((alloc: any) => (
                    <tr key={alloc._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{alloc.facultyName}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span className="badge badge-neutral">Sec {alloc.section}</span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        {alloc.lectureHours}L + {alloc.tutorialHours}T + {alloc.practicalHours}P
                      </td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {alloc.totalHours || (alloc.lectureHours + alloc.tutorialHours + alloc.practicalHours)} hrs
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {alloc.coordinatorResponsibility && (
                            <span className="badge badge-warning" style={{ fontSize: '10px' }}>Course Coord</span>
                          )}
                          {alloc.labResponsibility && (
                            <span className="badge badge-info" style={{ fontSize: '10px' }}>Lab In-Charge</span>
                          )}
                          {!alloc.coordinatorResponsibility && !alloc.labResponsibility && (
                            <span style={{ color: 'var(--color-text-muted)' }}>Instructor</span>
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
              icon="bi-person-workspace"
              title={`No faculty allocated to ${subject.subjectCode} for ${subject.academicYear}`}
              reason="No instructor has been assigned to teach this subject yet."
              nextStep={
                canManage && onAllocate
                  ? undefined
                  : 'Faculty allocations made by your HOD will appear here.'
              }
              action={
                canManage && onAllocate ? (
                  <Button variant="outline" size="sm" onClick={onAllocate}>
                    <i className="bi bi-person-plus" style={{ marginRight: '6px' }} /> Allocate Faculty
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
