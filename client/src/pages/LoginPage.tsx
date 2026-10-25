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
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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

  // Shake the card briefly when sign-in fails
  useEffect(() => {
    if (!errorMessage) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 500);
    return () => clearTimeout(t);
  }, [errorMessage]);

  /** Show a short "Signed in" confirmation on the button, then open the portal. */
  const finishSignIn = () => {
    setSignedIn(true);
    setTimeout(() => navigate(from, { replace: true }), 450);
  };

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
      finishSignIn();
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
      finishSignIn();
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
        <aside className="login-brand-panel" aria-label="About the Faculty Management System">
          <span className="login-aurora login-aurora-a" aria-hidden="true" />
          <span className="login-aurora login-aurora-b" aria-hidden="true" />
          <div className="login-brand-top">
            <div className="login-brand-mark">
              <img src="/images/kpriet-emblem.png" alt="" width={28} height={28} />
              <span>KPR Institute of Engineering and Technology</span>
            </div>
            <h1 className="login-brand-title">Faculty Management System</h1>
            <p className="login-brand-desc">
              Your profile, research, leave, attendance and appraisals in one place.
            </p>
            <ul className="login-brand-points">
              <li>
                <i className="bi bi-check2-circle" aria-hidden="true" />
                <span>Add a record once; your HOD verifies it online</span>
              </li>
              <li>
                <i className="bi bi-check2-circle" aria-hidden="true" />
                <span>Apply for leave and follow each approval step</span>
              </li>
              <li>
                <i className="bi bi-check2-circle" aria-hidden="true" />
                <span>Verified data flows into NAAC and NBA reports</span>
              </li>
            </ul>
          </div>
          <p className="login-brand-foot">Autonomous · Affiliated to Anna University · NAAC &lsquo;A+&rsquo; &amp; NBA accredited</p>
        </aside>

        {/* ========================================================
            RIGHT SIDE — LOGIN AUTHENTICATION PANEL
            ======================================================== */}
        <div className={`login-auth-panel ${shake ? 'is-shaking' : ''}`} role="region" aria-label="Sign In Panel">
          <div className="login-panel-header">
            <h2 className="login-panel-title">{challengeToken ? 'Two-step verification' : 'Sign in'}</h2>
            <p className="login-panel-desc">
              {challengeToken
                ? useRecoveryCode
                  ? 'Enter one of the recovery codes you saved when you turned on two-factor sign-in.'
                  : 'Open your authenticator app and enter the 6-digit code for KPRIET FMS.'
                : 'Use your college email or employee ID.'}
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
                className={`login-submit-btn ${signedIn ? 'is-success' : ''}`}
                disabled={signedIn || verifyCode.isPending || (useRecoveryCode ? twoFactorCode.length < 8 : twoFactorCode.length !== 6)}
              >
                {signedIn ? (
                  <>
                    <i className="bi bi-check2-circle" aria-hidden="true" />
                    <span>Signed in</span>
                  </>
                ) : verifyCode.isPending ? (
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
              label="Email or employee ID"
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
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || signIn.isPending || signedIn}
              className={`login-submit-btn ${signedIn ? 'is-success' : ''}`}
            >
              {signedIn ? (
                <>
                  <i className="bi bi-check2-circle" aria-hidden="true" />
                  <span>Signed in</span>
                </>
              ) : isSubmitting || signIn.isPending ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>

          <div className="login-register-cta">
            New faculty member?{' '}
            <Link to={ROUTES.REGISTER}>Register with your college email</Link>
          </div>

          <p className="login-help">
            Trouble signing in? Email <a href="mailto:helpdesk@kpriet.ac.in">helpdesk@kpriet.ac.in</a> or call ext. 4101.
          </p>

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

    </div>
  );
};
