// Extracted from FacultyProfilePage.tsx — the "audit" tab.
import { Badge } from '../../components';
import React from 'react';
import type { FacultyProfile } from '../../types/index';

export interface AuditTabProps {
  profile: FacultyProfile;
}

export const AuditTab: React.FC<AuditTabProps> = ({ profile }) => {
  return (
    <div className="card-custom">
            <h2 className="card-title">Profile verification</h2>
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
  );
};
