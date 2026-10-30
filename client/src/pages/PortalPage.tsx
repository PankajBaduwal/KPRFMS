import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Badge, Button, Alert, SkeletonStats, SkeletonCard, ErrorState } from '../components';
import { ROLE_LABELS } from '../constants/roles';
import {
  dashboardService,
  type AnyDashboardData,
  type FacultyDashboardData,
  type HodDashboardData,
  type DeanDashboardData,
  type PrincipalDashboardData,
  type AdminDashboardData,
} from '../services/dashboard.service';
import { FacultyDashboardView } from '../components/dashboard/FacultyDashboardView';
import { HodDashboardView } from '../components/dashboard/HodDashboardView';
import { DeanDashboardView } from '../components/dashboard/DeanDashboardView';
import { PrincipalDashboardView } from '../components/dashboard/PrincipalDashboardView';
import { AdminDashboardView } from '../components/dashboard/AdminDashboardView';
import { apiClient } from '../api/client';

export const PortalPage: React.FC = () => {
  const { user } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined);
  const [dashboardData, setDashboardData] = useState<AnyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // RBAC Console testing state
  const [showRbacConsole, setShowRbacConsole] = useState(false);
  const [testResult, setTestResult] = useState<{ endpoint: string; status: number; message: string; ok: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadDashboard = useCallback(async (role?: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await dashboardService.getDashboard(role);
      setDashboardData(data);
    } catch (err: any) {
      if (!silent) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard data');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboard(selectedRole);
    }
  }, [user, selectedRole, loadDashboard]);

  // Automatic background refresh every 30s + window visibility change
  useEffect(() => {
    if (!user) return;

    // Periodic silent refresh
    const interval = setInterval(() => {
      loadDashboard(selectedRole, true);
    }, 30000);

    // Immediate re-validation on window focus / tab visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDashboard(selectedRole, true);
      }
    };

    // Immediate re-validation on cross-module mutation events
    const handleRecordsUpdated = () => {
      loadDashboard(selectedRole, true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('fms:records-updated', handleRecordsUpdated);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('fms:records-updated', handleRecordsUpdated);
    };
  }, [user, selectedRole, loadDashboard]);

  if (!user) return null;

  const isLeadership = ['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user.role);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'primary';
      case 'PRINCIPAL': return 'warning';
      case 'DEAN': return 'info';
      case 'HOD': return 'success';
      default: return 'neutral';
    }
  };

  const testEndpoint = async (endpoint: string, label: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.get(endpoint);
      setTestResult({
        endpoint: label,
        status: res.status,
        message: res.data.message || 'Access granted by backend middleware',
        ok: true,
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && 'message' in err) {
        const errorObj = err as { status: number; message: string };
        setTestResult({
          endpoint: label,
          status: errorObj.status,
          message: errorObj.message,
          ok: false,
        });
      } else {
        setTestResult({
          endpoint: label,
          status: 500,
          message: 'Request failed',
          ok: false,
        });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Profile & Role Overview Card (faculty and HODs see their own identity header in the dashboard) */}
      {!((user.role === 'FACULTY' || user.role === 'HOD') && !isLeadership) && (
      <div className="card-custom" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>
                {user.name}
              </h1>
              <Badge variant={getRoleBadgeVariant(user.role)}>
                {ROLE_LABELS[user.role] || user.role}
              </Badge>
              <Badge variant="success">{user.status}</Badge>
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
              <span>{user.designation || 'Faculty Member'}</span> &bull; <span>Emp ID: <strong>{user.employeeId}</strong></span> &bull; <span>{user.email}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* Leadership Role Switcher to preview any role view */}
            {isLeadership && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface-secondary, rgba(0,0,0,0.03))', padding: '3px 6px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', paddingLeft: 4 }}>
                  Preview:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRole(undefined)}
                  className={`btn btn-sm ${!selectedRole ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                >
                  My Role ({user.role})
                </button>
                {user.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => setSelectedRole('ADMIN')}
                    className={`btn btn-sm ${selectedRole === 'ADMIN' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                  >
                    Admin
                  </button>
                )}
                {['ADMIN', 'PRINCIPAL'].includes(user.role) && (
                  <button
                    type="button"
                    onClick={() => setSelectedRole('PRINCIPAL')}
                    className={`btn btn-sm ${selectedRole === 'PRINCIPAL' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                  >
                    Principal
                  </button>
                )}
                {['ADMIN', 'PRINCIPAL', 'DEAN'].includes(user.role) && (
                  <button
                    type="button"
                    onClick={() => setSelectedRole('DEAN')}
                    className={`btn btn-sm ${selectedRole === 'DEAN' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                  >
                    Dean
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRole('HOD')}
                  className={`btn btn-sm ${selectedRole === 'HOD' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                >
                  HOD
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('FACULTY')}
                  className={`btn btn-sm ${selectedRole === 'FACULTY' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                >
                  Faculty
                </button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboard(selectedRole)}
              disabled={loading}
              title="Refresh Dashboard Data"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} role="status" aria-busy="true" aria-label="Loading dashboard telemetry">
          <SkeletonStats count={4} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
          <SkeletonCard lines={5} />
        </div>
      ) : error ? (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <ErrorState
            title="Unable to load institutional telemetry"
            message={error}
            onRetry={() => loadDashboard(selectedRole)}
            retryText="Retry Telemetry"
          />
        </div>
      ) : dashboardData ? (
        <>
          {dashboardData.role === 'FACULTY' && (
            <FacultyDashboardView data={dashboardData as FacultyDashboardData} />
          )}
          {dashboardData.role === 'HOD' && (
            <HodDashboardView data={dashboardData as HodDashboardData} />
          )}
          {dashboardData.role === 'DEAN' && (
            <DeanDashboardView data={dashboardData as DeanDashboardData} />
          )}
          {dashboardData.role === 'PRINCIPAL' && (
            <PrincipalDashboardView data={dashboardData as PrincipalDashboardData} />
          )}
          {dashboardData.role === 'ADMIN' && (
            <AdminDashboardView data={dashboardData as AdminDashboardData} />
          )}
        </>
      ) : null}

      {/* Permission diagnostics: developers only (dev builds, admin role) */}
      {import.meta.env.DEV && user.role === 'ADMIN' && (
      <div style={{ marginTop: 'var(--space-8)' }}>
        <button
          type="button"
          onClick={() => setShowRbacConsole(!showRbacConsole)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 0,
            marginBottom: 'var(--space-2)',
          }}
        >
          <i className={`bi bi-chevron-${showRbacConsole ? 'up' : 'down'}`} />
          {showRbacConsole ? 'Hide' : 'Show'} permission diagnostics (developer)
        </button>

        {showRbacConsole && (
          <div className="card-custom" style={{ background: 'var(--color-surface-secondary, rgba(0,0,0,0.02))' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Live Backend RBAC Enforcement Diagnostics
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Test whether the backend middleware independently enforces authorization for your role (<strong>{user.role}</strong>).
            </p>

            {testResult && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <Alert variant={testResult.ok ? 'success' : 'danger'} onDismiss={() => setTestResult(null)}>
                  <strong>{testResult.endpoint}</strong> (HTTP {testResult.status}): {testResult.message}
                </Alert>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                onClick={() => testEndpoint('/api/admin/overview', 'GET /api/admin/overview')}
              >
                Test Admin API (Requires ADMIN)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                onClick={() => testEndpoint('/api/principal-console/metrics', 'GET /api/principal-console/metrics')}
              >
                Test Principal API (Requires PRINCIPAL/ADMIN)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                onClick={() => testEndpoint('/api/dean-console/metrics', 'GET /api/dean-console/metrics')}
              >
                Test Dean API (Requires DEAN/PRINCIPAL/ADMIN)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                onClick={() => testEndpoint('/api/hod-console/overview', 'GET /api/hod-console/overview')}
              >
                Test HOD API (Requires HOD/DEAN/PRINCIPAL/ADMIN)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={testing}
                onClick={() => testEndpoint('/api/timetable/my-timetable', 'GET /api/timetable/my-timetable')}
              >
                Test Faculty API (Requires Authenticated Faculty)
              </Button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
