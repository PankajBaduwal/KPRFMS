import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { appraisalService, type AppraisalAuditResponse } from '../services/appraisal.service';
import type { IFacultyAppraisal } from '../types/appraisal';
import { AppraisalStatusBadge } from './AppraisalStatusBadge';
import { SkeletonCard } from './Skeleton';

interface Props {
  isOpen: boolean;
  appraisal: IFacultyAppraisal | null;
  onClose: () => void;
}

export const AppraisalAuditModal: React.FC<Props> = ({
  isOpen,
  appraisal,
  onClose,
}) => {
  const [data, setData] = useState<AppraisalAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // Which appraisal `data` belongs to; until it matches, the logs are still loading.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && appraisal) {
      let cancelled = false;
      const appraisalId = appraisal._id;
      setLoading(true);
      appraisalService
        .getAuditHistory(appraisalId)
        .then((res) => { if (!cancelled) setData(res); })
        .catch((err) => console.error('Failed to load audit history', err))
        .finally(() => {
          if (!cancelled) {
            setLoadedFor(appraisalId);
            setLoading(false);
          }
        });
      return () => { cancelled = true; };
    }
  }, [isOpen, appraisal]);

  if (!isOpen || !appraisal) return null;

  const isLoading = loading || loadedFor !== appraisal._id;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Appraisal Audit Trail & History"
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Appraisal Metadata Header Banner */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              Faculty: {appraisal.facultyName} ({appraisal.facultyEmployeeId})
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Department: {appraisal.departmentCode} &bull; Designation: {appraisal.designation}
            </div>
          </div>
          <AppraisalStatusBadge status={appraisal.status} />
        </div>

        {isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading audit logs" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Review History Section */}
            <div>
              <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                Multi-Stage Review Workflow History
              </h4>
              {appraisal.reviewHistory.length === 0 ? (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                  No reviews logged yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {appraisal.reviewHistory.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                            {item.reviewerName}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'var(--color-primary-50)',
                              color: 'var(--color-primary)',
                              border: '1px solid var(--color-primary-100)',
                            }}
                          >
                            {item.reviewerRole}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          {new Date(item.reviewDate).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                        <strong>Decision: </strong> {item.decision}
                        {item.overallScore !== undefined && (
                          <span style={{ marginLeft: '12px', fontWeight: 600, color: 'var(--color-success)' }}>
                            Score: {item.overallScore} / 100
                          </span>
                        )}
                      </div>
                      {item.comments && (
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-surface-hover)',
                            border: '1px solid var(--color-border)',
                            fontStyle: 'italic',
                            marginTop: '6px',
                          }}
                        >
                          "{item.comments}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System Audit Logs */}
            {data && data.auditLogs && data.auditLogs.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                  Immutable System Logs
                </h4>
                <div
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <table className="table-custom">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>User</th>
                        <th>IP / Agent</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.auditLogs.map((log: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                            {log.action}
                          </td>
                          <td>
                            {log.userId?.name || 'System User'}
                          </td>
                          <td style={{ color: 'var(--color-text-muted)' }}>
                            {log.ipAddress}
                          </td>
                          <td style={{ color: 'var(--color-text-muted)' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
