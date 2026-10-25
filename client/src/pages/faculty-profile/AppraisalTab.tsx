// Extracted from FacultyProfilePage.tsx — the "appraisal" tab.
import { EmptyState, Badge } from '../../components';
import React from 'react';
import type { FacultyProfile } from '../../types/index';

export interface AppraisalTabProps {
  profile: FacultyProfile;
}

export const AppraisalTab: React.FC<AppraisalTabProps> = ({ profile }) => {
  return (
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
  );
};
