// Extracted from FacultyProfilePage.tsx — the "attendance" tab.
import { EmptyState } from '../../components';
import React from 'react';
import type { FacultyProfile } from '../../types/index';

export interface AttendanceTabProps {
  profile: FacultyProfile;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({ profile }) => {
  return (
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
  );
};
