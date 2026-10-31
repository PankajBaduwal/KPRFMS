// Extracted from AdminPage.tsx — the "overview" tab.
import { FEATURES } from '../../constants/features';
import { EmptyState } from '../../components/EmptyState';
import React from 'react';
import { type TabType } from './shared';
import type { IAdminOverview } from '../../types/admin';

export interface OverviewTabProps {
  overview: IAdminOverview;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ overview, setActiveTab }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top Quick Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total Accounts
                </div>
                <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#172B45', margin: '0.35rem 0' }}>
                  {overview.metrics.totalUsers}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  <i className="bi bi-check-circle" /> {overview.metrics.activeUsers} active / {overview.metrics.inactiveUsers} inactive
                </div>
              </div>
  
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Departments
                </div>
                <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#2864A5', margin: '0.35rem 0' }}>
                  {overview.metrics.totalDepartments}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {overview.metrics.activeDepartments} operational academic units
                </div>
              </div>
  
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Programs Offered
                </div>
                <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#2864A5', margin: '0.35rem 0' }}>
                  {overview.metrics.totalPrograms}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>UG, PG & Ph.D. degree tracks</div>
              </div>
  
              {FEATURES.TEACHING && (
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Curriculum Subjects
                </div>
                <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#B45309', margin: '0.35rem 0' }}>
                  {overview.metrics.totalSubjects}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total courses across departments</div>
              </div>
              )}
  
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  Security Audit Records
                </div>
                <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#2864A5', margin: '0.35rem 0' }}>
                  {overview.metrics.totalAuditLogs}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>System events & auth traces</div>
              </div>
            </div>
  
            {/* Role Distribution & Institution Card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem 0', color: '#172B45' }}>
                  <i className="bi bi-person-badge-fill me-2 text-primary" />
                  Active Role Distribution
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(overview.metrics.usersByRole || {}).map(([role, count]) => (
                    <div
                      key={role}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 0.875rem',
                        borderRadius: '6px',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>{role}</span>
                      <span
                        style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          backgroundColor: '#DCE8F5',
                          color: '#3730a3',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
  
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem 0', color: '#172B45' }}>
                  <i className="bi bi-buildings-fill me-2 text-indigo" />
                  Institutional Configuration Snapshot
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Institution Name:</span>
                    <span style={{ fontWeight: 600 }}>{overview.settings.institutionName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Institution Code:</span>
                    <span style={{ fontWeight: 600 }}>{overview.settings.shortCode}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Active Academic Year:</span>
                    <span style={{ fontWeight: 600, color: '#2864A5' }}>{overview.settings.currentAcademicYear}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>Active Semester Type:</span>
                    <span style={{ fontWeight: 600 }}>{overview.settings.currentSemesterType} SEMESTER</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Maintenance Mode:</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: overview.settings.maintenanceMode ? '#dc2626' : '#16a34a',
                      }}
                    >
                      {overview.settings.maintenanceMode ? 'ACTIVE (Restricted)' : 'OFF (Normal)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
  
            {/* Recent Audit Logs Strip */}
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.5rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#172B45' }}>
                  <i className="bi bi-clock-history me-2 text-purple" />
                  Recent System Activity
                </h3>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setActiveTab('audit_logs')}
                >
                  View Full Audit Trail &rarr;
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>Time</th>
                      <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>Actor</th>
                      <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                      <th style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentAuditLogs && overview.recentAuditLogs.length > 0 ? (
                      overview.recentAuditLogs.map((log) => (
                        <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.625rem 0.75rem', color: '#64748b' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>
                            {log.userId?.name || 'System / Guest'}
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: '#f1f5f9',
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                              }}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: '0.625rem 0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {log.ipAddress}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ padding: 0 }}>
                          <EmptyState
                            icon="bi-shield-check"
                            title="No recent audit activity"
                            reason="No sign-ins or record changes have been logged yet."
                            nextStep="Recent system activity will be listed here as users work in the portal."
                            compact
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
  );
};
