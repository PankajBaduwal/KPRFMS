import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { SkeletonCard } from './Skeleton';
import { EmptyState } from './EmptyState';
import { leaveService } from '../services/leave.service';
import type { LeaveAuditLog } from '../types/leave';
import { ShieldCheck, Clock } from 'lucide-react';

interface LeaveAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaveId: string | null;
}

export const LeaveAuditModal: React.FC<LeaveAuditModalProps> = ({
  isOpen,
  onClose,
  leaveId,
}) => {
  const [logs, setLogs] = useState<LeaveAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  // Which leave the current `logs` belong to; until it matches, the trail is still loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (leaveId && isOpen) {
      let cancelled = false;
      setLoading(true);
      leaveService
        .getAuditHistory(leaveId)
        .then((res) => { if (!cancelled) setLogs(res || []); })
        .catch(() => { if (!cancelled) setLogs([]); })
        .finally(() => {
          if (!cancelled) {
            setLoadedFor(leaveId);
            setLoading(false);
          }
        });
      return () => { cancelled = true; };
    }
  }, [leaveId, isOpen]);

  const isLoading = loading || (!!leaveId && loadedFor !== leaveId);

  const getActionBadge = (action: string) => {
    let color = '#3b82f6';
    let label = action.replace('LEAVE_', '');

    if (action.includes('APPLIED')) color = '#3b82f6';
    if (action.includes('RECOMMENDED')) color = '#8b5cf6';
    if (action.includes('APPROVED')) color = '#10b981';
    if (action.includes('REJECTED')) color = '#ef4444';
    if (action.includes('CANCELLED')) color = '#94a3b8';

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
    <Modal isOpen={isOpen} onClose={onClose} title="Leave Application Audit Trail">
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
            Institutional compliance record: all leave submissions, workflow transitions, and cancellation actions are logged immutably.
          </span>
        </div>

        {isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading audit trail" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
            <SkeletonCard lines={1} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit entries for this leave application"
            reason="No submission, review or cancellation actions have been logged for this application yet."
            nextStep="Each action taken on this application will be recorded here with its timestamp."
            icon="bi-clock-history"
            compact
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
