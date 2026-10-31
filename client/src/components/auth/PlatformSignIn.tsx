import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input, Alert } from '../index';
import { platformApi } from '../../platform/api';
import { formatErrorMessage } from '../../utils/errorHandler';
import { PRODUCT_NAME } from '../../config/brand';

export type AccountType = 'institution' | 'platform';

/**
 * The account-type choice on the shared sign-in page. It only picks which sign-in form is shown:
 * the server decides who is a FacultyCore Super Admin (separate account store, separate session).
 */
export const AccountTypeSwitch: React.FC<{ value: AccountType; onChange: (v: AccountType) => void }> = ({ value, onChange }) => {
  const options: Array<[AccountType, string]> = [
    ['institution', 'Institution account'],
    ['platform', `${PRODUCT_NAME} Super Admin`],
  ];
  return (
    <div className="login-account-switch" role="radiogroup" aria-label="Account type">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={value === key ? 'is-on' : ''}
          onClick={() => onChange(key)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              onChange(key === 'institution' ? 'platform' : 'institution');
            }
          }}
          tabIndex={value === key ? 0 : -1}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export interface PlatformSignInFormProps {
  from?: string;
  initialEmail?: string;
  initialPassword?: string;
}

/** Platform (Super Admin) sign-in. No institution is chosen: the console is above all institutions. */
export const PlatformSignInForm: React.FC<PlatformSignInFormProps> = ({
  from,
  initialEmail = '',
  initialPassword = '',
}) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
    if (initialPassword) setPassword(initialPassword);
  }, [initialEmail, initialPassword]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await platformApi.login(email.trim(), password);
      queryClient.removeQueries({ queryKey: ['platform'] });
      // Only console pages are valid destinations after a platform sign-in
      const dest = from && from.startsWith('/platform') && !from.startsWith('/platform/login') ? from : '/platform';
      window.location.href = dest;
    } catch (err) {
      setError(formatErrorMessage(err, 'Sign-in failed. Please verify your Super Admin credentials.'));
      setBusy(false);
    }
  };

  return (
    <form className="login-form" noValidate onSubmit={submit} aria-label={`${PRODUCT_NAME} Super Admin sign-in`}>
      {error && (
        <div style={{ marginBottom: '0.75rem' }}>
          <Alert variant="danger" title="Authentication Failed" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      <Input
        label="Super Admin Email"
        type="email"
        autoComplete="username"
        placeholder="superadmin@facultycore.test"
        prefixIcon={<i className="bi bi-envelope" aria-hidden="true" />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Master Password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="••••••••••••"
        prefixIcon={<i className="bi bi-shield-lock" aria-hidden="true" />}
        suffixAction={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            className="login-eye-btn"
          >
            <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
          </button>
        }
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" className="login-submit-btn" disabled={busy || !email.trim() || !password}>
        {busy ? (
          <>
            <span className="spinner spinner-sm" aria-hidden="true" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
            <span>Sign in to Platform Administration</span>
          </>
        )}
      </button>
      <p className="login-help">
        For {PRODUCT_NAME} Platform Operators. College faculty and administrators switch to <strong>Institution account</strong> above.
      </p>
    </form>
  );
};

