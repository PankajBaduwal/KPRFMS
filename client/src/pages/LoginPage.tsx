import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Input, Alert, Badge, Modal } from '../components';
import { useAuthStore } from '../stores/authStore';
import { ROUTES } from '../constants/routes';
import { DEV_SEED_ACCOUNTS, SHOW_DEV_SEED_HELPERS } from '../dev/devSeedAccounts';
import { useAsyncAction } from '../hooks/useAsyncAction';
import '../styles/login.css';

const REMEMBERED_ID_KEY = 'kpriet_fms_remembered_id';

const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Email or Employee ID is required')
    .trim(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [activationModalOpen, setActivationModalOpen] = useState(false);

  const from = (location.state as { from?: { pathname: string }; sessionExpired?: boolean })?.from?.pathname || ROUTES.PORTAL;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Check for session expired triggers from location state, URL params, or window event
  useEffect(() => {
    const isStateExpired = Boolean((location.state as { sessionExpired?: boolean })?.sessionExpired);
    const isParamExpired = searchParams.get('reason') === 'session_expired';
    if (isStateExpired || isParamExpired) {
      setSessionExpired(true);
    }

    const handleSessionExpiredEvent = () => {
      setSessionExpired(true);
    };

    window.addEventListener('fms:session-expired', handleSessionExpiredEvent);
    return () => {
      window.removeEventListener('fms:session-expired', handleSessionExpiredEvent);
    };
  }, [location.state, searchParams]);

  // Restore remembered identifier if present
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(REMEMBERED_ID_KEY);
      if (savedId) {
        setValue('identifier', savedId);
        setRememberMe(true);
      }
    } catch {
      // Storage unavailable, ignore
    }
  }, [setValue]);

  // Ref-locked sign-in action to prevent duplicate submissions
  const signIn = useAsyncAction(async (data: LoginFormData) => {
    setErrorMessage(null);
    try {
      if (rememberMe) {
        try {
          localStorage.setItem(REMEMBERED_ID_KEY, data.identifier.trim());
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem(REMEMBERED_ID_KEY);
        } catch {
          // ignore
        }
      }

      await login(data);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setErrorMessage((err as { message: string }).message);
      } else {
        setErrorMessage('Unable to sign in. Please verify your institutional credentials and try again.');
      }
    }
  });

  const setDevSeedCredentials = (id: string, pass: string) => {
    setValue('identifier', id);
    setValue('password', pass);
  };

  return (
    <div className="login-page-container">
      <div className="login-split-layout">
        {/* ========================================================
            LEFT SIDE — INSTITUTIONAL BRAND & ARCHITECTURE
            ======================================================== */}
        <div className="login-brand-panel" role="region" aria-label="Institutional Overview">
          <div className="login-brand-header">
            <div className="login-institution-badge" style={{ padding: '6px 14px', background: '#FFFFFF', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <img
                src="/images/kpriet-favicon.png"
                alt="KPRIET Seal"
                style={{ width: '22px', height: '22px', objectFit: 'contain' }}
              />
              <span style={{ color: 'var(--color-primary, #1B345F)', fontWeight: 700 }}>KPR Institute of Engineering and Technology</span>
            </div>

            <h1 className="login-brand-title">
              Faculty Management System
            </h1>

            <div className="login-brand-statement">
              One Connected Platform for Faculty, Academic, Research and Institutional Management.
            </div>

            <p className="login-brand-desc">
              Access your faculty records, academic responsibilities, research activities, workload, approvals and institutional services through a single secure platform.
            </p>
          </div>

          {/* Layered Connected Product Architecture Visualization */}
          <div className="login-visual-card">
            <div className="login-visual-top">
              <span>Connected Institutional Ecosystem</span>
              <Badge variant="primary">AY 2026-2027</Badge>
            </div>

            <div className="login-visual-grid">
              <div className="login-visual-item">
                <i className="bi bi-person-badge" aria-hidden="true" />
                <span>Faculty Profile</span>
              </div>
              <div className="login-visual-item">
                <i className="bi bi-mortarboard" aria-hidden="true" />
                <span>Academic Records</span>
              </div>
              <div className="login-visual-item">
                <i className="bi bi-journal-text" aria-hidden="true" />
                <span>Research &amp; IPR</span>
              </div>
              <div className="login-visual-item">
                <i className="bi bi-calendar3-week" aria-hidden="true" />
                <span>Workload &amp; Timetable</span>
              </div>
              <div className="login-visual-item" style={{ gridColumn: 'span 2' }}>
                <i className="bi bi-patch-check" aria-hidden="true" />
                <span>Multi-Tier Verification &amp; Statutory Approvals</span>
              </div>
            </div>
          </div>

          {/* Institutional Highlights */}
          <div className="login-highlights-section">
            <div className="login-highlights-label">
              Integrated Institutional Capabilities
            </div>
            <div className="login-highlights-grid">
              <div className="login-highlight-badge">
                <i className="bi bi-mortarboard" aria-hidden="true" />
                <span>Academic Management</span>
              </div>
              <div className="login-highlight-badge">
                <i className="bi bi-person-lines-fill" aria-hidden="true" />
                <span>Faculty Records</span>
              </div>
              <div className="login-highlight-badge">
                <i className="bi bi-lightbulb" aria-hidden="true" />
                <span>Research &amp; Innovation</span>
              </div>
              <div className="login-highlight-badge">
                <i className="bi bi-calendar3-week" aria-hidden="true" />
                <span>Workload &amp; Timetable</span>
              </div>
              <div className="login-highlight-badge">
                <i className="bi bi-graph-up-arrow" aria-hidden="true" />
                <span>Performance &amp; Appraisal</span>
              </div>
              <div className="login-highlight-badge">
                <i className="bi bi-file-earmark-check" aria-hidden="true" />
                <span>Reports &amp; Accreditation</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT SIDE — LOGIN AUTHENTICATION PANEL
            ======================================================== */}
        <div className="login-auth-panel" role="region" aria-label="Sign In Panel">
          <div className="login-panel-header">
            <div className="login-panel-logo" style={{ marginBottom: '1.25rem' }}>
              <Link to={ROUTES.HOME} style={{ textDecoration: 'none', display: 'inline-block' }}>
                <img
                  src="/images/kpriet-logo.png"
                  alt="KPR Institute of Engineering and Technology"
                  style={{
                    height: '46px',
                    maxWidth: '220px',
                    objectFit: 'contain',
                  }}
                />
              </Link>
            </div>

            <h2 className="login-panel-title">Welcome back</h2>
            <p className="login-panel-desc">
              Sign in to continue to the Faculty Management System.
            </p>
          </div>

          {/* Session Expired Alert */}
          {sessionExpired && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert
                variant="warning"
                title="Session Expired"
                onDismiss={() => setSessionExpired(false)}
              >
                Your institutional session has expired due to inactivity. Please sign in again to continue your work.
              </Alert>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div style={{ marginBottom: '1rem' }}>
              <Alert
                variant="danger"
                title="Authentication Failed"
                onDismiss={() => setErrorMessage(null)}
              >
                {errorMessage}
              </Alert>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit((data) => signIn.run(data))} noValidate className="login-form">
            <Input
              label="Institutional Email / Employee ID"
              type="text"
              placeholder="e.g. employee.name@kpriet.ac.in or EMP1024"
              autoComplete="username"
              prefixIcon={<i className="bi bi-person-badge" aria-hidden="true" />}
              error={errors.identifier?.message}
              {...register('identifier')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              autoComplete="current-password"
              prefixIcon={<i className="bi bi-shield-lock" aria-hidden="true" />}
              suffixAction={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                </button>
              }
              error={errors.password?.message}
              {...register('password')}
            />

            {/* Utilities: Remember Me & Forgot Password */}
            <div className="login-utilities-row">
              <label className="login-remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: 'var(--color-primary, #2563EB)' }}
                />
                <span>Remember ID on this device</span>
              </label>

              <button
                type="button"
                className="login-forgot-btn"
                onClick={() => setForgotModalOpen(true)}
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || signIn.isPending}
              className="login-submit-btn"
            >
              {isSubmitting || signIn.isPending ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Security & Access Statement */}
          <div className="login-security-notice">
            <i className="bi bi-shield-lock-fill" aria-hidden="true" />
            <div className="login-security-text">
              <strong>Authorized institutional access only.</strong> Your access and permissions are automatically governed according to your assigned institutional role.
            </div>
          </div>

          {/* Account Activation & Support Links */}
          <div className="login-support-links">
            <button
              type="button"
              className="login-support-link"
              onClick={() => setActivationModalOpen(true)}
            >
              Account Activation Policy
            </button>
            <button
              type="button"
              className="login-support-link"
              onClick={() => setForgotModalOpen(true)}
            >
              Need IT Support?
            </button>
          </div>

          {/* DEVELOPMENT SEED ACCOUNTS — Rendered only in local vite dev mode */}
          {SHOW_DEV_SEED_HELPERS && (
            <details
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px dashed var(--color-border)',
                fontSize: '0.75rem',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Badge variant="warning">DEV ONLY</Badge>
                <span>Quick-fill test accounts (Development mode only)</span>
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.75rem' }}>
                {DEV_SEED_ACCOUNTS.map((account) => (
                  <div
                    key={account.employeeId}
                    onClick={() => setDevSeedCredentials(account.employeeId, account.password)}
                    style={{
                      cursor: 'pointer',
                      padding: '6px 10px',
                      background: 'var(--color-background)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    title={`Click to fill ${account.employeeId}`}
                  >
                    <span><strong>{account.employeeId}</strong> ({account.label})</span>
                    <Badge variant={account.role === 'ADMIN' ? 'primary' : account.role === 'PRINCIPAL' ? 'warning' : 'neutral'}>
                      {account.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Forgot Password Institutional Modal */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Institutional Credential Recovery"
        size="md"
        footer={
          <button
            type="button"
            className="btn-primary-custom btn-sm"
            onClick={() => setForgotModalOpen(false)}
          >
            Acknowledge &amp; Close
          </button>
        }
      >
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
          <p style={{ marginBottom: 'var(--space-3)' }}>
            Faculty Management System accounts are managed under strict institutional security policies. For password reset or credential recovery:
          </p>

          <div
            style={{
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
              1. Contact Central IT Services
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
              Submit a credential reset request from your registered institutional email or in-person at the IT Center (Admin Block, 2nd Floor).
            </p>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text)' }}>
              <strong>Email:</strong> helpdesk@kpriet.ac.in &bull; <strong>Extension:</strong> 4101
            </div>
          </div>

          <div
            style={{
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
            }}
          >
            <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)', color: 'var(--color-primary)' }}>
              2. Departmental Administrator Verification
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', margin: 0, color: 'var(--color-text-secondary)' }}>
              Your Department Head (HOD) or Dean Office can initiate a temporary password reset through the administrative console upon identity confirmation.
            </p>
          </div>
        </div>
      </Modal>

      {/* Account Activation Institutional Modal */}
      <Modal
        isOpen={activationModalOpen}
        onClose={() => setActivationModalOpen(false)}
        title="Faculty Account Activation"
        size="md"
        footer={
          <button
            type="button"
            className="btn-primary-custom btn-sm"
            onClick={() => setActivationModalOpen(false)}
          >
            Understood
          </button>
        }
      >
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
          <p style={{ marginBottom: 'var(--space-3)' }}>
            All faculty member accounts are provisioned systematically by the Institution during official appointment:
          </p>

          <ol style={{ paddingLeft: 'var(--space-5)', marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            <li>
              <strong>HR Provisioning:</strong> Your Employee ID is generated upon submission of verified credentials to Human Resources.
            </li>
            <li>
              <strong>FMS Account Setup:</strong> The System Administrator links your departmental affiliation, designation, and official email.
            </li>
            <li>
              <strong>Temporary Password:</strong> An initial authentication password is sent to your personal email address registered with HR.
            </li>
            <li>
              <strong>First Login:</strong> Upon initial sign-in, you will be prompted to update your password and configure secondary verification details.
            </li>
          </ol>

          <div
            style={{
              background: 'var(--color-primary-50)',
              border: '1px solid var(--color-primary-100)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-info)',
            }}
          >
            <i className="bi bi-info-circle me-1" aria-hidden="true" />
            If you have joined recently and have not received your employee ID, please consult the Office of the Dean of Academic Affairs.
          </div>
        </div>
      </Modal>
    </div>
  );
};
