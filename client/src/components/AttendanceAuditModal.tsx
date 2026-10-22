import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { SkeletonCard } from './Skeleton';
import { EmptyState } from './EmptyState';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceAuditLog } from '../types/attendance';
import { ShieldCheck, Clock } from 'lucide-react';

interface AttendanceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceId: string | null;
}

export const AttendanceAuditModal: React.FC<AttendanceAuditModalProps> = ({
  isOpen,
  onClose,
  attendanceId,
}) => {
  const [logs, setLogs] = useState<AttendanceAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  // Id whose audit trail has finished loading; until it matches, show the skeleton (never a premature empty state)
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (attendanceId && isOpen) {
      setLoading(true);
      attendanceService
        .getAuditHistory(attendanceId)
        .then((res) => setLogs(res || []))
        .catch(() => setLogs([]))
        .finally(() => {
          setLoading(false);
          setLoadedId(attendanceId);
        });
    }
  }, [attendanceId, isOpen]);

  const showSkeleton = loading || (!!attendanceId && loadedId !== attendanceId);

  const getActionBadge = (action: string) => {
    let color = '#3b82f6';
    let label = action.replace('ATTENDANCE_', '');

    if (action.includes('RECORDED')) color = '#10b981';
    if (action.includes('UPDATED')) color = '#f59e0b';
    if (action.includes('LOCKED')) color = '#ef4444';
    if (action.includes('APPROVED')) color = '#10b981';
    if (action.includes('REJECTED')) color = '#ef4444';
    if (action.includes('REQUESTED')) color = '#8b5cf6';

    return (
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: `${color}20`,
          color,
          border: `1px solid ${color}40`,
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Attendance Audit History">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          <ShieldCheck size={18} color="#3b82f6" />
          <span>
            Every attendance entry, update, lock, and correction approval creates an immutable audit log record.
          </span>
        </div>

        {showSkeleton ? (
          <div role="status" aria-busy="true" aria-label="Fetching audit trail" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            compact
            title="No audit history for this attendance entry"
            reason="No updates, locks or approved corrections have been logged for this entry yet."
            nextStep="Each future change to this entry will be recorded here."
            icon="bi-clock-history"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
            {logs.map((log) => (
              <div
                key={log._id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.03))',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getActionBadge(log.action)}
                    <span style={{ fontWeight: 600 }}>{log.userId?.name || 'System / Authorized User'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '11px' }}>
                    <Clock size={12} />
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>

                {log.details && (
                  <pre
                    style={{
                      margin: 0,
                      marginTop: '4px',
                      padding: '8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      fontSize: '11px',
                      overflowX: 'auto',
                      fontFamily: 'monospace',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}

                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  IP: {log.ipAddress}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
