import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Input, LoadingState, Modal, PageHeader, useToast } from '../components';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import {
  accountService,
  type ActiveSession,
  type CalendarFeed,
  type TwoFactorSetup,
  type TwoFactorStatus,
} from '../services/account.service';
import { useAuthStore } from '../stores/authStore';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { formatErrorMessage } from '../utils/errorHandler';
import '../styles/account-security.css';

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return 'Active now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const deviceIcon = (device: string) =>
  /Android|iOS/.test(device) ? 'bi-phone' : /API client/.test(device) ? 'bi-terminal' : 'bi-laptop';

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Recovery codes shown once, right after they are created. */
const RecoveryCodes: React.FC<{ codes: string[]; onDone: () => void }> = ({ codes, onDone }) => {
  const { addToast } = useToast();
  return (
    <div className="security-recovery">
      <Alert variant="warning" title="Save these recovery codes now">
        Each code signs you in once if you lose your phone. They will not be shown again.
      </Alert>
      <ol className="security-recovery-grid">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ol>
      <div className="security-actions">
        <Button
          variant="outline"
          size="sm"
          icon={<i className="bi bi-clipboard" />}
          onClick={() => {
            void navigator.clipboard?.writeText(codes.join('\n'));
            addToast('Recovery codes copied', 'success');
          }}
        >
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<i className="bi bi-download" />}
          onClick={() => downloadText('kpriet-fms-recovery-codes.txt', `KPRIET FMS recovery codes\n\n${codes.join('\n')}\n`)}
        >
          Download
        </Button>
        <Button size="sm" onClick={onDone}>
          I have saved them
        </Button>
      </div>
    </div>
  );
};

export const AccountSecurityPage: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const installPrompt = useInstallPrompt();

  const [passwordOpen, setPasswordOpen] = useState(false);

  // Two-factor
  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenCode, setRegenCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);

  // Calendar
  const [calendar, setCalendar] = useState<CalendarFeed | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [recoveryLeftNotice] = useState(() => {
    try {
      const v = sessionStorage.getItem('fms:recovery-codes-left');
      sessionStorage.removeItem('fms:recovery-codes-left');
      return v === null ? null : Number(v);
    } catch {
      return null;
    }
  });

  const load = useCallback(async () => {
    try {
      const [tf, ss, cal] = await Promise.all([
        accountService.twoFactorStatus(),
        accountService.listSessions(),
        accountService.calendarStatus(),
      ]);
      setTwoFactor(tf);
      setSessions(ss);
      setCalendar((prev) => (prev?.url ? prev : cal));
    } catch (err) {
      setLoadError(formatErrorMessage(err, 'Could not load your security settings.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>, onError?: (msg: string) => void) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      const msg = formatErrorMessage(err, 'Something went wrong. Please try again.');
      if (onError) onError(msg);
      else addToast(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  const otherSessions = sessions?.filter((s) => !s.current).length ?? 0;
  const isLeadership = user?.role === 'ADMIN' || user?.role === 'PRINCIPAL' || user?.role === 'DEAN';
  const feedIsLocal = Boolean(calendar?.url && /\/\/(localhost|127\.0\.0\.1)/.test(calendar.url));

  if (loadError) {
    return (
      <div className="security-page">
        <Alert variant="danger" title="Could not load">
          {loadError}
        </Alert>
      </div>
    );
  }
  if (!twoFactor || !sessions || !calendar) return <LoadingState message="Loading security settings..." />;

  return (
    <div className="security-page">
      <PageHeader title="Account & Security" subtitle="Password, two-factor sign-in, signed-in devices and calendar sync." />

      {recoveryLeftNotice !== null && (
        <Alert variant={recoveryLeftNotice <= 2 ? 'warning' : 'info'} title="You signed in with a recovery code">
          {recoveryLeftNotice} recovery code(s) left. Create new ones below if you are running low.
        </Alert>
      )}

      {/* ------------------------------------------------------------------ Password */}
      <section className="security-card">
        <div className="security-card-head">
          <span className="security-card-icon"><i className="bi bi-key" /></span>
          <div>
            <h2>Password</h2>
            <p>Changing your password signs you out on every other device.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ Two-factor */}
      <section className="security-card">
        <div className="security-card-head">
          <span className="security-card-icon"><i className="bi bi-shield-lock" /></span>
          <div>
            <h2>
              Two-factor sign-in{' '}
              {twoFactor.enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}
            </h2>
            <p>
              After your password, enter a 6-digit code from an authenticator app (Google Authenticator, Microsoft
              Authenticator, Authy) on your phone.
            </p>
          </div>
          {!twoFactor.enabled && !setup && (
            <Button
              size="sm"
              loading={busy === 'setup'}
              onClick={() =>
                run('setup', async () => {
                  setTwoFactorError(null);
                  setSetupCode('');
                  setSetup(await accountService.beginTwoFactorSetup());
                })
              }
            >
              Turn on
            </Button>
          )}
        </div>

        {!twoFactor.enabled && !setup && isLeadership && (
          <Alert variant="warning" title="Recommended for your role">
            {user?.role === 'ADMIN' ? 'Administrator' : 'Leadership'} accounts can change records across the whole
            institution. Two-factor sign-in stops someone who learns your password from signing in.
          </Alert>
        )}

        {newCodes && (
          <RecoveryCodes
            codes={newCodes}
            onDone={() => {
              setNewCodes(null);
              void load();
            }}
          />
        )}

        {setup && !newCodes && (
          <div className="security-setup">
            <div className="security-setup-qr">
              <img src={setup.qrCodeDataUrl} alt="QR code for your authenticator app" width={180} height={180} />
            </div>
            <ol className="security-setup-steps">
              <li>Install an authenticator app on your phone.</li>
              <li>In the app, add an account and scan this QR code.</li>
              <li>
                Can&apos;t scan? Enter this key instead: <code className="security-secret">{setup.secret}</code>
              </li>
              <li>
                <form
                  className="security-inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(
                      'enable',
                      async () => {
                        setNewCodes(await accountService.enableTwoFactor(setupCode));
                        setSetup(null);
                        addToast('Two-factor sign-in is now on', 'success');
                      },
                      setTwoFactorError
                    );
                  }}
                >
                  <Input
                    label="Code shown in the app"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
                    error={twoFactorError ?? undefined}
                  />
                  <div className="security-actions">
                    <Button type="submit" size="sm" loading={busy === 'enable'} disabled={setupCode.length !== 6}>
                      Confirm and turn on
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSetup(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </li>
            </ol>
          </div>
        )}

        {twoFactor.enabled && !newCodes && (
          <div className="security-row">
            <span>
              On since {twoFactor.enabledAt ? new Date(twoFactor.enabledAt).toLocaleDateString('en-IN') : '—'} ·{' '}
              <strong>{twoFactor.recoveryCodesLeft}</strong> recovery code(s) left
            </span>
            <div className="security-actions">
              <Button variant="outline" size="sm" onClick={() => { setRegenCode(''); setTwoFactorError(null); setRegenOpen(true); }}>
                New recovery codes
              </Button>
              <Button variant="danger" size="sm" onClick={() => { setDisablePassword(''); setTwoFactorError(null); setDisableOpen(true); }}>
                Turn off
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ Sessions */}
      <section className="security-card">
        <div className="security-card-head">
          <span className="security-card-icon"><i className="bi bi-display" /></span>
          <div>
            <h2>Signed-in devices</h2>
            <p>Sign out anything you don&apos;t recognise, or a shared computer you forgot to sign out of.</p>
          </div>
          {otherSessions > 0 && (
            <Button
              variant="outline"
              size="sm"
              loading={busy === 'others'}
              onClick={() =>
                run('others', async () => {
                  const n = await accountService.revokeOtherSessions();
                  addToast(`Signed out ${n} other device(s)`, 'success');
                  setSessions(await accountService.listSessions());
                })
              }
            >
              Sign out all others
            </Button>
          )}
        </div>
        <ul className="security-sessions">
          {sessions.map((s) => (
            <li key={s.id}>
              <i className={`bi ${deviceIcon(s.device)}`} aria-hidden="true" />
              <div>
                <strong>
                  {s.device} {s.current && <Badge variant="primary">This device</Badge>}
                </strong>
                <span>
                  {timeAgo(s.lastSeenAt)} · signed in {new Date(s.signedInAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {s.ip ? ` · ${s.ip.replace(/^::ffff:/, '')}` : ''}
                </span>
              </div>
              {!s.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busy === s.id}
                  onClick={() =>
                    run(s.id, async () => {
                      await accountService.revokeSession(s.id);
                      setSessions((list) => list?.filter((x) => x.id !== s.id) ?? null);
                      addToast('Device signed out', 'success');
                    })
                  }
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------ Calendar */}
      <section className="security-card" id="calendar">
        <div className="security-card-head">
          <span className="security-card-icon"><i className="bi bi-calendar2-week" /></span>
          <div>
            <h2>
              Calendar sync {calendar.enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}
            </h2>
            <p>
              See your leave (approved and pending) and weekly timetable in Google Calendar, Outlook or your phone&apos;s
              calendar. It updates on its own every few hours.
            </p>
          </div>
          <Button
            size="sm"
            variant={calendar.enabled ? 'outline' : 'primary'}
            loading={busy === 'calendar'}
            onClick={() =>
              run('calendar', async () => {
                setCalendar(await accountService.createCalendarFeed());
              })
            }
          >
            {calendar.enabled ? 'Get a new link' : 'Turn on'}
          </Button>
        </div>

        {calendar.url && (
          <div className="security-calendar">
            <Alert variant="info" title="Your private calendar link">
              Anyone with this link can see your leave and timetable, so don&apos;t share it. It is shown only now;
              use &quot;Get a new link&quot; later if you need it again (the old link then stops working).
            </Alert>
            <div className="security-link-row">
              <input readOnly value={calendar.url} aria-label="Calendar link" onFocus={(e) => e.target.select()} />
              <Button
                size="sm"
                variant="outline"
                icon={<i className="bi bi-clipboard" />}
                onClick={() => {
                  void navigator.clipboard?.writeText(calendar.url!);
                  addToast('Calendar link copied', 'success');
                }}
              >
                Copy
              </Button>
            </div>
            <div className="security-actions">
              <a
                className="btn-secondary-custom btn-sm"
                href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendar.webcalUrl!)}`}
                target="_blank"
                rel="noreferrer"
              >
                <i className="bi bi-google" /> Add to Google Calendar
              </a>
              <a
                className="btn-secondary-custom btn-sm"
                href={`https://outlook.office.com/calendar/0/addfromweb?url=${encodeURIComponent(calendar.url)}&name=${encodeURIComponent('KPRIET FMS')}`}
                target="_blank"
                rel="noreferrer"
              >
                <i className="bi bi-microsoft" /> Add to Outlook
              </a>
              <a className="btn-secondary-custom btn-sm" href={calendar.webcalUrl}>
                <i className="bi bi-apple" /> Apple / phone calendar
              </a>
              <Button
                variant="ghost"
                size="sm"
                loading={busy === 'calendar-off'}
                onClick={() =>
                  run('calendar-off', async () => {
                    await accountService.disableCalendarFeed();
                    setCalendar({ enabled: false });
                    addToast('Calendar sync turned off', 'success');
                  })
                }
              >
                Turn off
              </Button>
            </div>
            {feedIsLocal && (
              <p className="security-note">
                <i className="bi bi-info-circle" /> This link points to your local computer, so Google and Outlook
                cannot reach it yet. It works once the portal is hosted on the college server (set PUBLIC_API_URL).
              </p>
            )}
          </div>
        )}

        {calendar.enabled && !calendar.url && (
          <div className="security-row">
            <span>Your calendar app is subscribed. Lost the link? Get a new one.</span>
            <Button
              variant="ghost"
              size="sm"
              loading={busy === 'calendar-off'}
              onClick={() =>
                run('calendar-off', async () => {
                  await accountService.disableCalendarFeed();
                  setCalendar({ enabled: false });
                  addToast('Calendar sync turned off', 'success');
                })
              }
            >
              Turn off
            </Button>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ Install app */}
      <section className="security-card">
        <div className="security-card-head">
          <span className="security-card-icon"><i className="bi bi-phone" /></span>
          <div>
            <h2>
              Install on your phone {installPrompt.installed && <Badge variant="success">Installed</Badge>}
            </h2>
            <p>Open FMS from your home screen like an app — handy for marking attendance and applying for leave.</p>
          </div>
          {installPrompt.canInstall && (
            <Button size="sm" icon={<i className="bi bi-download" />} onClick={() => void installPrompt.install()}>
              Install app
            </Button>
          )}
        </div>
        {!installPrompt.installed && !installPrompt.canInstall && (
          <p className="security-note">
            {installPrompt.needsManualIosSteps ? (
              <>
                On iPhone/iPad: tap <i className="bi bi-box-arrow-up" /> <strong>Share</strong>, then{' '}
                <strong>Add to Home Screen</strong>.
              </>
            ) : (
              <>
                On Android or desktop Chrome/Edge, open the browser menu and choose <strong>Install app</strong> (or
                <strong> Add to Home screen</strong>). The install button appears here when the browser allows it.
              </>
            )}
          </p>
        )}
      </section>

      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />

      <Modal
        isOpen={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="Turn off two-factor sign-in"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy === 'disable'}
              disabled={!disablePassword}
              onClick={() =>
                run(
                  'disable',
                  async () => {
                    await accountService.disableTwoFactor(disablePassword);
                    setDisableOpen(false);
                    addToast('Two-factor sign-in turned off', 'info');
                    await load();
                  },
                  setTwoFactorError
                )
              }
            >
              Turn off
            </Button>
          </>
        }
      >
        <p>Enter your password to confirm. Your account will be protected by the password only.</p>
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={disablePassword}
          onChange={(e) => setDisablePassword(e.target.value)}
          error={twoFactorError ?? undefined}
        />
      </Modal>

      <Modal
        isOpen={regenOpen}
        onClose={() => setRegenOpen(false)}
        title="Create new recovery codes"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRegenOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={busy === 'regen'}
              disabled={regenCode.length !== 6}
              onClick={() =>
                run(
                  'regen',
                  async () => {
                    setNewCodes(await accountService.regenerateRecoveryCodes(regenCode));
                    setRegenOpen(false);
                  },
                  setTwoFactorError
                )
              }
            >
              Create codes
            </Button>
          </>
        }
      >
        <p>Your old recovery codes will stop working. Enter a code from your authenticator app to continue.</p>
        <Input
          label="Authenticator code"
          inputMode="numeric"
          maxLength={6}
          value={regenCode}
          onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ''))}
          error={twoFactorError ?? undefined}
        />
      </Modal>
    </div>
  );
};
