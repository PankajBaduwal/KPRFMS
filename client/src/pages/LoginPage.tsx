import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Input, Alert, Modal } from '../components';
import { useAuthStore } from '../stores/authStore';
import { ROUTES } from '../constants/routes';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { authService, isTwoFactorChallenge } from '../services/auth.service';
import '../styles/login.css';
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_MARK, PORTAL_NAME } from '../config/brand';
import { AccountTypeSwitch, PlatformSignInForm, type AccountType } from '../components/auth/PlatformSignIn';
import { InstitutionPicker } from '../components/InstitutionPicker';
import { institutionStorageKey, useInstitutionCode } from '../lib/institution';
import { useInstitution } from '../hooks/useInstitution';
import { DemoAccountsExplorer } from '../components/auth/DemoAccountsExplorer';

// The remembered ID belongs to the institution it was used in
const rememberedIdKey = () => institutionStorageKey('remembered_id');

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
  const [searchParams, setSearchParams] = useSearchParams();
  // One sign-in page for everyone: the account type only chooses which form is shown
  const accountType: AccountType = searchParams.get('as') === 'platform' ? 'platform' : 'institution';
  const isPlatform = accountType === 'platform';
  const setAccountType = (t: AccountType) => {
    const next = new URLSearchParams(searchParams);
    if (t === 'platform') next.set('as', 'platform');
    else next.delete('as');
    setSearchParams(next, { replace: true, state: location.state });
  };
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
  const [showDemoModal, setShowDemoModal] = useState<boolean>(() => searchParams.get('demo') === 'true');
  // Demo sign-in is switched off on the server unless DEMO_LOGIN_ENABLED=true; hide it when unavailable
  const [demoAvailable, setDemoAvailable] = useState(false);
  useEffect(() => {
    let live = true;
    authService.getDemoAccounts().then(() => live && setDemoAvailable(true)).catch(() => live && setDemoAvailable(false));
    return () => {
      live = false;
    };
  }, []);
  const [platformEmail, setPlatformEmail] = useState('');
  const [platformPassword, setPlatformPassword] = useState('');

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

  // Restore the identifier remembered for the chosen institution
  const institution = useInstitutionCode();
  const branding = useInstitution();
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(rememberedIdKey());
      setValue('identifier', savedId || '');
      setRememberMe(Boolean(savedId));
    } catch {
      // Storage unavailable, ignore
    }
  }, [setValue, institution]);

  // Ref-locked sign-in action to prevent duplicate submissions
  const signIn = useAsyncAction(async (data: LoginFormData) => {
    setErrorMessage(null);
    try {
      if (rememberMe) {
        try {
          localStorage.setItem(rememberedIdKey(), data.identifier.trim());
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem(rememberedIdKey());
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

  return (
    <div className="login-page-container">
      <div className="login-split-layout">
        {/* ========================================================
            LEFT SIDE — INSTITUTIONAL SHOWCASE & BRAND PANEL
            ======================================================== */}
        <aside className="login-brand-panel" aria-label="About the Faculty Management System">
          <span className="login-aurora login-aurora-a" aria-hidden="true" />
          <span className="login-aurora login-aurora-b" aria-hidden="true" />
          
          <div className="login-brand-top">
            <div className="login-brand-header-badge">
              <div className="login-brand-logo-pill">
                <img src={PRODUCT_MARK} alt="" width={24} height={24} />
                <span className="login-brand-product-title">{PRODUCT_NAME}</span>
              </div>
              <span className="login-enterprise-badge">Enterprise ERP</span>
            </div>

            {isPlatform ? (
              <div className="login-brand-heading-block">
                <h1 className="login-brand-title">Platform Administration</h1>
                <p className="login-brand-desc">
                  Unified governance console for institutional provisioning, tenant isolation, and health telemetry.
                </p>
              </div>
            ) : (
              <div className="login-brand-heading-block">
                <h1 className="login-brand-title">{PORTAL_NAME}</h1>
                <p className="login-brand-desc">
                  Comprehensive academic ERP: faculty profiles, workload, research dossiers, and multi-tier institutional appraisals.
                </p>
              </div>
            )}

            {/* Feature Highlights Grid */}
            <div className="login-features-list" hidden={isPlatform}>
              <div className="login-feature-card">
                <div className="login-feature-icon">
                  <i className="bi bi-mortarboard" aria-hidden="true" />
                </div>
                <div className="login-feature-text">
                  <strong>Master Academic Dossier</strong>
                  <span>Teaching workload, publications, patents, consultancy & research in one verified record.</span>
                </div>
              </div>

              <div className="login-feature-card">
                <div className="login-feature-icon">
                  <i className="bi bi-diagram-3" aria-hidden="true" />
                </div>
                <div className="login-feature-text">
                  <strong>Multi-Tier Workflow</strong>
                  <span>Transparent HOD verification, Dean oversight, and Principal approvals with audit trails.</span>
                </div>
              </div>

              <div className="login-feature-card">
                <div className="login-feature-icon">
                  <i className="bi bi-award" aria-hidden="true" />
                </div>
                <div className="login-feature-text">
                  <strong>Accreditation Ready</strong>
                  <span>Automated metric aggregation for NAAC Criterion III and NBA evaluative compliance.</span>
                </div>
              </div>
            </div>

            {demoAvailable && (
              <div className="login-demo-launcher-box">
                <div className="login-demo-launcher-info">
                  <i className="bi bi-stars" />
                  <div>
                    <strong>Demonstration Mode Active</strong>
                    <span>Test sample profiles across all roles</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="login-brand-demo-btn"
                  onClick={() => setShowDemoModal(true)}
                >
                  <i className="bi bi-compass-fill" /> Explore Sample Accounts
                </button>
              </div>
            )}
          </div>

          <div className="login-brand-footer-row">
            <span className="login-security-tag">
              <i className="bi bi-shield-check" aria-hidden="true" /> Multi-Tenant · ISO-Compliant · AES-256 Encrypted
            </span>
            <span className="login-tagline-text">{PRODUCT_TAGLINE}</span>
          </div>
        </aside>

        {/* ========================================================
            RIGHT SIDE — AUTHENTICATION REGION
            ======================================================== */}
        <div className={`login-auth-panel ${shake ? 'is-shaking' : ''}`} role="region" aria-label="Sign In Panel">
          <div className="login-panel-header">
            <div className="login-title-row">
              <h2 className="login-panel-title">
                {challengeToken ? 'Two-step verification' : 'Welcome back'}
              </h2>
              <span className="login-portal-tag">
                {isPlatform ? 'Platform Mode' : 'Institutional Portal'}
              </span>
            </div>

            <p className="login-panel-desc">
              {challengeToken
                ? useRecoveryCode
                  ? 'Enter one of your saved recovery codes to authenticate.'
                  : `Enter the 6-digit verification code from your authenticator app.`
                : isPlatform
                  ? 'Sign in to the global FacultyCore management console.'
                  : 'Select your institution and sign in with your credentials.'}
            </p>

            {!challengeToken && (
              <AccountTypeSwitch value={accountType} onChange={setAccountType} />
            )}
          </div>

          {branding.maintenanceMode && !challengeToken && !isPlatform && (
            <div style={{ marginBottom: '1.25rem' }}>
              <Alert variant="warning" title="Institution Under Maintenance">
                {branding.name || 'This institution'} is currently undergoing maintenance. Only designated administrators can sign in.
              </Alert>
            </div>
          )}

          {sessionExpired && (
            <div style={{ marginBottom: '1.25rem' }}>
              <Alert
                variant="warning"
                title="Session Expired"
                onDismiss={() => setSessionExpired(false)}
              >
                Your session has expired due to inactivity. Please sign in again.
              </Alert>
            </div>
          )}

          {errorMessage && !isPlatform && (
            <div style={{ marginBottom: '1.25rem' }}>
              <Alert
                variant="danger"
                title="Authentication Failed"
                onDismiss={() => setErrorMessage(null)}
              >
                {errorMessage}
              </Alert>
            </div>
          )}

          {/* 2FA Verification Form */}
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
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-check" aria-hidden="true" />
                    <span>Verify & Continue</span>
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
                  {useRecoveryCode ? 'Use authenticator app code' : 'Lost your phone? Use a recovery code'}
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

          {/* Institutional Picker */}
          {!challengeToken && !isPlatform && <InstitutionPicker />}

          {/* Super Admin Form */}
          {isPlatform && !challengeToken && (
            <PlatformSignInForm
              from={from}
              initialEmail={platformEmail}
              initialPassword={platformPassword}
            />
          )}

          {/* Institutional Credentials Form */}
          {!challengeToken && !isPlatform && (
            <form
              onSubmit={handleSubmit((data) => signIn.run(data))}
              noValidate
              className="login-form"
            >
              <div className="login-form-fields">
                <Input
                  label="Email or Employee ID"
                  type="text"
                  placeholder="name@college.edu or EMP001"
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
                      className="login-eye-btn"
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                    </button>
                  }
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="login-utilities-row">
                <label className="login-remember-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="login-remember-checkbox"
                  />
                  <span>Remember my ID</span>
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
                    <span>Signed in successfully</span>
                  </>
                ) : isSubmitting || signIn.isPending ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                    <span>Sign In to Portal</span>
                  </>
                )}
              </button>
            </form>
          )}

          {!isPlatform && !challengeToken && (
            <div className="login-panel-footer">
              <div className="login-register-prompt">
                <span>New faculty member?</span>{' '}
                <Link to={ROUTES.REGISTER} className="login-register-link">
                  Register with institutional email <i className="bi bi-arrow-right" />
                </Link>
              </div>

              {demoAvailable && (
                <div className="login-compact-demo-banner">
                  <span className="demo-banner-label">
                    <i className="bi bi-stars" /> Demonstration Mode:
                  </span>
                  <button
                    type="button"
                    className="demo-banner-btn"
                    onClick={() => setShowDemoModal(true)}
                  >
                    Quick-test with sample roles (Admin, Dean, HOD, Faculty) <i className="bi bi-chevron-right" />
                  </button>
                </div>
              )}

              <p className="login-support-note">
                <i className="bi bi-question-circle" /> Need help signing in? Contact your institution's IT administrator.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
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
                placeholder="e.g. name@college.edu or EMP1024"
                prefixIcon={<i className="bi bi-envelope" aria-hidden="true" />}
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
                error={forgotError ?? undefined}
              />
            </form>
          )}
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 'var(--space-3) 0 0' }}>
            No access to your college email? Contact IT services or your HOD. An
            administrator can reset the password from the admin console.
          </p>
        </div>
      </Modal>

      {/* Demo Accounts Explorer Modal */}
      {demoAvailable && showDemoModal && (
        <div className="demo-modal-overlay" onClick={() => setShowDemoModal(false)}>
          <div className="demo-modal-container" onClick={(e) => e.stopPropagation()}>
            <DemoAccountsExplorer
              isModal
              onClose={() => setShowDemoModal(false)}
              onFillCredentials={(email, role) => {
                if (role === 'PLATFORM_SUPER_ADMIN') {
                  setAccountType('platform');
                  setPlatformEmail(email);
                  setPlatformPassword('');
                  setShowDemoModal(false);
                } else {
                  setAccountType('institution');
                  setValue('identifier', email);
                  const defaultPass: Record<string, string> = {
                    ADMIN: 'Admin@12345',
                    PRINCIPAL: 'Principal@12345',
                    DEAN: 'Dean@12345',
                    HOD: 'Hod@12345',
                    FACULTY: 'Faculty@12345',
                  };
                  setValue('password', defaultPass[role] || 'Faculty@12345');
                  setShowDemoModal(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
