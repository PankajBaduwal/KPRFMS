import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Input, Alert, Badge, Modal } from '../components';
import { useAuthStore } from '../stores/authStore';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';
import { DEV_SEED_ACCOUNTS, SHOW_DEV_SEED_HELPERS } from '../dev/devSeedAccounts';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { authService, isTwoFactorChallenge } from '../services/auth.service';
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
  const { login, loginTwoFactor } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotSent, setForgotSent] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string }; sessionExpired?: boolean })?.from?.pathname || ROUTES.PORTAL;

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
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

      const result = await login(data);
      if (isTwoFactorChallenge(result)) {
        setChallengeToken(result.challengeToken);
        setTwoFactorCode('');
        return;
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        setErrorMessage((err as { message: string }).message);
      } else {
        setErrorMessage('Unable to sign in. Please verify your institutional credentials and try again.');
      }
    }
  });

  const verifyCode = useAsyncAction(async () => {
    setErrorMessage(null);
    try {
      const user = await loginTwoFactor(challengeToken!, twoFactorCode);
      if (user.recoveryCodesLeft !== undefined) {
        try {
          sessionStorage.setItem('fms:recovery-codes-left', String(user.recoveryCodesLeft));
        } catch {
          // ignore
        }
      }
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'That code could not be verified.';
      setErrorMessage(message);
      if (/expired/i.test(message)) setChallengeToken(null);
    }
  });

  const requestReset = useAsyncAction(async () => {
    setForgotError(null);
    try {
      setForgotSent(await authService.forgotPassword(forgotIdentifier.trim()));
    } catch (err: unknown) {
      setForgotError((err as { message?: string })?.message || 'Could not send the reset link. Try again.');
    }
  });

  const openForgot = () => {
    setForgotSent(null);
    setForgotError(null);
    setForgotIdentifier((getValues('identifier') || '').trim());
    setForgotModalOpen(true);
  };

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
        <div className="login-brand-panel" role="region" aria-label="Overview">
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
              Access your faculty records, academic responsibilities, research activities, {FEATURES.TEACHING ? 'workload, ' : ''}approvals and institutional services through a single secure platform.
            </p>
          </div>

          {/* Layered Connected Product Architecture Visualization */}
          <div className="login-visual-card">
            <div className="login-visual-top">
              <span>Everything in one place</span>
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
                <span>{FEATURES.TEACHING ? 'Workload & Timetable' : 'Attendance & Leave'}</span>
              </div>
              <div className="login-visual-item" style={{ gridColumn: 'span 2' }}>
                <i className="bi bi-patch-check" aria-hidden="true" />
                <span>Verification &amp; approvals</span>
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
                <span>{FEATURES.TEACHING ? 'Workload & Timetable' : 'Attendance & Leave'}</span>
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

            <h2 className="login-panel-title">{challengeToken ? 'Two-step verification' : 'Welcome back'}</h2>
            <p className="login-panel-desc">
              {challengeToken
                ? useRecoveryCode
                  ? 'Enter one of the recovery codes you saved when you turned on two-factor sign-in.'
                  : 'Open your authenticator app and enter the 6-digit code for KPRIET FMS.'
                : 'Sign in to continue to the Faculty Management System.'}
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

          {challengeToken && (
            <form
              className="login-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                verifyCode.run();
              }}
            >
              <Input
                label={useRecoveryCode ? 'Recovery code' : 'Authentication code'}
                type="text"
                inputMode={useRecoveryCode ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                autoFocus
                maxLength={useRecoveryCode ? 12 : 6}
                placeholder={useRecoveryCode ? 'XXXX-XXXX' : '123456'}
                prefixIcon={<i className={useRecoveryCode ? 'bi bi-key' : 'bi bi-phone'} aria-hidden="true" />}
                value={twoFactorCode}
                onChange={(e) =>
                  setTwoFactorCode(useRecoveryCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))
                }
                style={{ letterSpacing: '0.3em', fontWeight: 600 }}
              />
              <button
                type="submit"
                className="login-submit-btn"
                disabled={verifyCode.isPending || (useRecoveryCode ? twoFactorCode.length < 8 : twoFactorCode.length !== 6)}
              >
                {verifyCode.isPending ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-check" aria-hidden="true" />
                    <span>Verify and sign in</span>
                  </>
                )}
              </button>
              <div className="login-utilities-row">
                <button
                  type="button"
                  className="login-forgot-btn"
                  onClick={() => {
                    setUseRecoveryCode((v) => !v);
                    setTwoFactorCode('');
                  }}
                >
                  {useRecoveryCode ? 'Use authenticator app instead' : 'Lost your phone? Use a recovery code'}
                </button>
                <button
                  type="button"
                  className="login-forgot-btn"
                  onClick={() => {
                    setChallengeToken(null);
                    setErrorMessage(null);
                  }}
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {/* Authentication Form */}
          <form
            onSubmit={handleSubmit((data) => signIn.run(data))}
            noValidate
            className="login-form"
            style={challengeToken ? { display: 'none' } : undefined}
          >
            <Input
              label="College email or employee ID"
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
                onClick={openForgot}
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

          <div className="login-register-cta">
            New faculty member?{' '}
            <Link to={ROUTES.REGISTER}>Register with your college email</Link>
          </div>

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
              onClick={openForgot}
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

      {/* Forgot Password: emailed reset link */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Reset your password"
        size="md"
        footer={
          forgotSent ? (
            <button type="button" className="btn-primary-custom btn-sm" onClick={() => setForgotModalOpen(false)}>
              Back to sign in
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary-custom btn-sm" onClick={() => setForgotModalOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                form="forgot-password-form"
                className="btn-primary-custom btn-sm"
                disabled={requestReset.isPending || forgotIdentifier.trim().length < 3}
              >
                {requestReset.isPending ? 'Sending...' : 'Email me a reset link'}
              </button>
            </>
          )
        }
      >
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
          {forgotSent ? (
            <Alert variant="success" title="Check your college email">
              {forgotSent} The link expires in 30 minutes. Check the spam folder if it does not arrive in a few minutes.
            </Alert>
          ) : (
            <form
              id="forgot-password-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                requestReset.run();
              }}
            >
              <p style={{ marginBottom: 'var(--space-3)' }}>
                Enter your college email or employee ID. We will email a link to choose a new password to the address on
                your account.
              </p>
              <Input
                label="College email / Employee ID"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="e.g. employee.name@kpriet.ac.in or EMP1024"
                prefixIcon={<i className="bi bi-envelope" aria-hidden="true" />}
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                error={forgotError ?? undefined}
              />
            </form>
          )}
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 'var(--space-3) 0 0' }}>
            No access to your college email? Contact IT Services (helpdesk@kpriet.ac.in, ext. 4101) or your HOD. An
            administrator can reset the password from the admin console.
          </p>
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
            New faculty can <Link to={ROUTES.REGISTER}>register with their college email</Link>; the account becomes
            active once an administrator approves it. Accounts can also be provisioned by the Institution during official
            appointment:
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
