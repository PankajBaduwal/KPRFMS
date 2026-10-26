import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Input } from '../components';
import { PasswordChecklist } from '../components/PasswordChecklist';
import { PASSWORD_POLICY } from '../utils/passwordPolicy';
import { authService } from '../services/auth.service';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { ROUTES } from '../constants/routes';
import '../styles/login.css';
import { PRODUCT_FULL_NAME } from '../config/brand';
import { BrandMark } from '../components/BrandMark';

/** Landing page for emailed links: "Forgot password" and "Set my password" for new accounts. */
export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const valid = PASSWORD_POLICY.test(password) && password === confirmPassword;

  const submit = useAsyncAction(async () => {
    setError(null);
    try {
      setDone(await authService.resetPassword(token, password));
    } catch (err: any) {
      setError(err?.message || 'Could not set the password. Try again.');
    }
  });

  return (
    <div className="login-page-container">
      <div className="login-auth-panel reset-password-panel">
        <div className="login-panel-header">
          <div className="login-panel-logo" style={{ marginBottom: '1.25rem' }}>
            <Link to={ROUTES.HOME} style={{ display: 'inline-block' }}>
              <BrandMark size={46} />
            </Link>
          </div>
          <h2 className="login-panel-title">{done ? 'Password updated' : 'Choose a new password'}</h2>
          <p className="login-panel-desc">
            {done ? 'You can now sign in with your new password.' : `For your ${PRODUCT_FULL_NAME} account.`}
          </p>
        </div>

        {!token && !done && (
          <Alert variant="warning" title="This link is incomplete">
            Open the link from your email again, or request a new one from the sign-in page.
          </Alert>
        )}

        {error && (
          <div style={{ marginBottom: '1rem' }}>
            <Alert variant="danger" title="Could not update the password" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        {done ? (
          <>
            <Alert variant="success" title="All set">
              {done} Every device that was signed in to this account has been signed out.
            </Alert>
            <Link to={ROUTES.LOGIN} className="login-submit-btn" style={{ textDecoration: 'none', marginTop: '1rem' }}>
              <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
              <span>Go to sign in</span>
            </Link>
          </>
        ) : (
          token && (
            <form
              className="login-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) submit.run();
              }}
            >
              <Input
                label="New password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                prefixIcon={<i className="bi bi-lock" aria-hidden="true" />}
                suffixAction={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="register-password-toggle"
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                  </button>
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="Confirm new password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                prefixIcon={<i className="bi bi-lock" aria-hidden="true" />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <PasswordChecklist password={password} confirmPassword={confirmPassword} />
              <button type="submit" className="login-submit-btn" disabled={!valid || submit.isPending}>
                {submit.isPending ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle" aria-hidden="true" />
                    <span>Save password</span>
                  </>
                )}
              </button>
            </form>
          )
        )}

        <p className="register-footer">
          Remembered it? <Link to={ROUTES.LOGIN}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};
