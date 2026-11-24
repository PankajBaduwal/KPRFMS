import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { accountService, type TwoFactorSetup } from '../services/account.service';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/authStore';
import { formatErrorMessage } from '../utils/errorHandler';
import { PRODUCT_MARK, PRODUCT_NAME } from '../config/brand';

/**
 * Shown instead of the app to an administrator whose institution requires two-factor sign-in
 * when they have not turned it on yet. The server refuses every other request until they do.
 */
export const ForcedTwoFactorSetup: React.FC = () => {
  const { user, logout, setSessionUser } = useAuthStore();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    accountService
      .beginTwoFactorSetup()
      .then(setSetup)
      .catch((err) => setError(formatErrorMessage(err, 'Two-factor setup could not be started. Please reload the page.')));
  }, []);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setCodes(await accountService.enableTwoFactor(code));
    } catch (err) {
      setError(formatErrorMessage(err, 'That code does not match your authenticator app.'));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      // The session now reports twoFactorSetupRequired: false, which opens the app
      setSessionUser(await authService.getMe());
    } catch (err) {
      setError(formatErrorMessage(err, 'Please reload the page.'));
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'linear-gradient(180deg, #EAF1FA 0%, #F7F9FC 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#fff',
          border: '1px solid #E3EAF3',
          borderRadius: '16px',
          boxShadow: '0 20px 50px -24px rgba(16, 42, 86, 0.35)',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <img src={PRODUCT_MARK} alt="" width={32} height={32} />
          <strong style={{ color: '#102A56' }}>{PRODUCT_NAME}</strong>
        </div>
        <h1 style={{ fontSize: '1.35rem', margin: '0 0 6px', color: '#102A56' }}>Turn on two-factor sign-in</h1>
        <p style={{ margin: '0 0 18px', color: '#5B6B82', fontSize: '0.92rem', lineHeight: 1.55 }}>
          Welcome{user?.name ? `, ${user.name}` : ''}. Your institution requires administrators to sign in with a code from an
          authenticator app (Google Authenticator, Microsoft Authenticator, Authy) as well as their password.
        </p>

        {error && <Alert variant="danger">{error}</Alert>}

        {codes ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Alert variant="warning" title="Save these recovery codes now">
              Each code signs you in once if you lose your phone. They will not be shown again.
            </Alert>
            <ol style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 18px', margin: 0, paddingLeft: '20px' }}>
              {codes.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ol>
            <Button type="button" variant="outline" onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>
              Copy codes
            </Button>
            <Button type="button" loading={busy} onClick={() => void finish()}>
              I have saved them, continue
            </Button>
          </div>
        ) : setup ? (
          <form onSubmit={confirm} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" width={180} height={180} />
            </div>
            <p style={{ margin: 0, color: '#5B6B82', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Scan the QR code in your authenticator app. Can&apos;t scan? Enter this key instead:{' '}
              <code style={{ wordBreak: 'break-all' }}>{setup.secret}</code>
            </p>
            <Input
              label="Code shown in the app"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <Button type="submit" loading={busy} disabled={code.length !== 6}>
              Confirm and continue
            </Button>
            <Button type="button" variant="outline" onClick={() => logout()} disabled={busy}>
              Sign out
            </Button>
          </form>
        ) : (
          !error && <p style={{ color: '#5B6B82' }}>Preparing your QR code…</p>
        )}
      </div>
    </main>
  );
};
