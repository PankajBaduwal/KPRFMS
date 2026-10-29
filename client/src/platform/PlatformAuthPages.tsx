import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { platformApi } from './api';
import { PRODUCT_MARK, PRODUCT_NAME } from '../config/brand';
import { formatErrorMessage } from '../utils/errorHandler';
import './platform.css';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

const Shell: React.FC<{ title: string; intro: string; children: React.ReactNode }> = ({ title, intro, children }) => (
  <div className="pc-auth">
    <div className="pc-auth-card">
      <div className="pc-auth-brand">
        <img src={PRODUCT_MARK} alt="" width={30} height={30} />
        <span>
          {PRODUCT_NAME} <em>Platform Administration</em>
        </span>
      </div>
      <h1>{title}</h1>
      <p className="pc-muted">{intro}</p>
      {children}
    </div>
    <p className="pc-auth-foot">
      For FacultyCore operators only. College staff sign in on the <Link to="/login">sign-in page</Link> with an institution account.
    </p>
  </div>
);

export const PlatformActivatePage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!PASSWORD_POLICY.test(password)) return setError('Use at least 12 characters with upper and lower case letters, a number and a symbol.');
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await platformApi.activate(token, password);
      queryClient.removeQueries({ queryKey: ['platform'] });
      navigate('/platform', { replace: true });
    } catch (err) {
      setError(formatErrorMessage(err, 'Activation failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Shell title="Activation link needed" intro="Open the activation link you were given. Links work once and expire after 24 hours.">
        <Link to="/login?as=platform">Go to sign in</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Activate your operator account" intro="Choose a strong password. This link works once.">
      <form onSubmit={submit} className="pc-form" noValidate>
        <label>
          New password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          Confirm password
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <p className="pc-muted pc-small">At least 12 characters, with upper and lower case letters, a number and a symbol.</p>
        {error && <p className="pc-error" role="alert">{error}</p>}
        <button className="pc-btn pc-btn-primary" disabled={busy || !password}>
          {busy ? 'Activating…' : 'Activate and sign in'}
        </button>
      </form>
    </Shell>
  );
};
