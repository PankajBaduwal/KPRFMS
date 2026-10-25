// Extracted from FacultyProfilePage.tsx — the "teaching" tab.
import { EmptyState, Badge } from '../../components';
import React from 'react';
import type { FacultyProfile } from '../../types/index';

export interface TeachingTabProps {
  profile: FacultyProfile;
}

export const TeachingTab: React.FC<TeachingTabProps> = ({ profile }) => {
  return (
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
  );
};
