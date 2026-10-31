// Extracted from AdminPage.tsx — the "audit_logs" tab.
import { EmptyState } from '../../components/EmptyState';
import { Pagination } from '../../components/Pagination';
import React from 'react';
import type { IAdminAuditLog } from '../../types/admin';

export interface AuditLogsTabProps {
  auditActionFilter: string;
  auditLogs: IAdminAuditLog[];
  auditPage: number;
  auditSearch: string;
  auditTotalPages: number;
  auditViewMode: "table" | "timeline";
  setAuditActionFilter: React.Dispatch<React.SetStateAction<string>>;
  setAuditPage: React.Dispatch<React.SetStateAction<number>>;
  setAuditSearch: React.Dispatch<React.SetStateAction<string>>;
  setAuditViewMode: React.Dispatch<React.SetStateAction<"table" | "timeline">>;
}

export const AuditLogsTab: React.FC<AuditLogsTabProps> = ({ auditActionFilter, auditLogs, auditPage, auditSearch, auditTotalPages, auditViewMode, setAuditActionFilter, setAuditPage, setAuditSearch, setAuditViewMode }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Filters & View Switcher Bar */}
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search audit trail by actor, action or record..."
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  style={{ maxWidth: '300px' }}
                />
  
                <select
                  className="form-select form-select-sm"
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  style={{ width: 'auto' }}
                >
                  <option value="">All Action Types</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="USER_CREATED">USER_CREATED</option>
                  <option value="USER_UPDATED">USER_UPDATED</option>
                  <option value="PASSWORD_RESET">PASSWORD_RESET</option>
                  <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
                  <option value="MASTER_CREATED">MASTER_CREATED</option>
                  <option value="MASTER_UPDATED">MASTER_UPDATED</option>
                  <option value="SUBJECT_CREATED">SUBJECT_CREATED</option>
                  <option value="DEPARTMENT_CREATED">DEPARTMENT_CREATED</option>
                </select>
  
                {/* View Switcher: Table vs Timeline */}
                <div className="btn-group btn-group-sm" role="group">
                  <button
                    type="button"
                    className={`btn ${auditViewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setAuditViewMode('table')}
                    title="Table View"
                  >
                    <i className="bi bi-table me-1" /> Table
                  </button>
                  <button
                    type="button"
                    className={`btn ${auditViewMode === 'timeline' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setAuditViewMode('timeline')}
                    title="Timeline View"
                  >
                    <i className="bi bi-clock-history me-1" /> Timeline
                  </button>
                </div>
              </div>
  
              <a
                href="/portal/audit-logs"
                className="btn btn-outline-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <i className="bi bi-shield-check" />
                Full Audit Console &rarr;
              </a>
            </div>
  
            {/* Audit Logs Content */}
            {auditViewMode === 'table' ? (
              /* Table View */
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Timestamp</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Actor</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Module</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Record / Target</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Client IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log) => {
                          const moduleName =
                            (log.details?.module as string) ||
                            (log.action.includes('_') ? log.action.split('_')[0] : 'SECURITY');
                          const recordIdentifier =
                            (log.details?.recordId as string) ||
                            (log.details?.targetId as string) ||
                            (log.details?.employeeId as string) ||
                            (log.details?.email as string) ||
                            `REC-${log._id.slice(-6).toUpperCase()}`;
  
                          return (
                            <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {log.userId ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: '#DCE8F5',
                                        color: '#4338ca',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {log.userId.name ? log.userId.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#172B45' }}>{log.userId.name}</div>
                                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                        {log.userId.employeeId} &bull; {log.userId.role}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>
                                    Anonymous / System Service
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '4px',
                                    backgroundColor: '#DCE8F5',
                                    color: '#3730a3',
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                    fontSize: '0.72rem',
                                  }}
                                >
                                  {log.action}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span className="badge bg-light text-dark border" style={{ fontSize: '0.72rem' }}>
                                  {moduleName}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#334155' }}>
                                {recordIdentifier}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    backgroundColor: '#EAF6EF',
                                    color: '#1E7A4C',
                                  }}
                                >
                                  RECORDED
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#64748b', fontSize: '0.78rem' }}>
                                {log.ipAddress || '127.0.0.1'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ padding: 0 }}>
                            {auditSearch.trim() || auditActionFilter ? (
                              <EmptyState
                                icon="bi-funnel"
                                title="No audit events match your filters"
                                reason="No audit records match the current search or action filter."
                                nextStep="Clear the search box or select all actions to see every event."
                                compact
                              />
                            ) : (
                              <EmptyState
                                icon="bi-shield-check"
                                title="No audit events recorded yet"
                                reason="No sign-ins, record changes or approval actions have been logged so far."
                                nextStep="System activity will be recorded here automatically as users work in the portal."
                                compact
                              />
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
  
                {/* Pagination */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '0.75rem 1rem',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <Pagination
                    currentPage={auditPage}
                    totalPages={auditTotalPages}
                    onPageChange={setAuditPage}
                  />
                </div>
              </div>
            ) : (
              /* Timeline View */
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '1.5rem',
                }}
              >
                {auditLogs.length === 0 ? (
                  <EmptyState
                    icon="bi-clock-history"
                    title="No timeline events recorded"
                    reason="No audit activity matches the current criteria."
                    compact
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {auditLogs.map((log) => {
                      const moduleName =
                        (log.details?.module as string) ||
                        (log.action.includes('_') ? log.action.split('_')[0] : 'SECURITY');
                      const recordIdentifier =
                        (log.details?.recordId as string) ||
                        (log.details?.targetId as string) ||
                        (log.details?.employeeId as string) ||
                        `REC-${log._id.slice(-6).toUpperCase()}`;
  
                      return (
                        <div
                          key={log._id}
                          style={{
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'flex-start',
                            borderLeft: '3px solid #6366f1',
                            paddingLeft: '1rem',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  backgroundColor: '#DCE8F5',
                                  color: '#3730a3',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {log.action}
                              </span>
                              <span className="badge bg-light text-dark border" style={{ fontSize: '0.72rem' }}>
                                {moduleName}
                              </span>
                              <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.7rem' }}>
                                RECORDED
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}>
                                <i className="bi bi-clock me-1" />
                                {new Date(log.createdAt).toLocaleString()}
                              </span>
                            </div>
  
                            <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#334155' }}>
                              <strong>Actor:</strong>{' '}
                              {log.userId ? `${log.userId.name} (${log.userId.employeeId} - ${log.userId.role})` : 'System Service'}
                              {' • '}
                              <strong>Target:</strong> <span style={{ fontFamily: 'monospace' }}>{recordIdentifier}</span>
                              {' • '}
                              <strong>IP:</strong> <span style={{ fontFamily: 'monospace' }}>{log.ipAddress || '127.0.0.1'}</span>
                            </div>
  
                            {log.details && Object.keys(log.details).length > 0 && (
                              <div
                                style={{
                                  marginTop: '0.4rem',
                                  padding: '0.5rem 0.75rem',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '6px',
                                  border: '1px solid #f1f5f9',
                                  fontSize: '0.75rem',
                                  fontFamily: 'monospace',
                                  color: '#475569',
                                  overflowX: 'auto',
                                }}
                              >
                                {JSON.stringify(log.details)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
  
                    {/* Pagination */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      <Pagination
                        currentPage={auditPage}
                        totalPages={auditTotalPages}
                        onPageChange={setAuditPage}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
  );
};
