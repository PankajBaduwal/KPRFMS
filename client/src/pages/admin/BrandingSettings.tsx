import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/admin.service';
import { useInstitution } from '../../hooks/useInstitution';
import { formatErrorMessage } from '../../utils/errorHandler';
import { PRODUCT_NAME } from '../../config/brand';
import type { IAdminInstitutionSettings } from '../../types/admin';

/** Server keys of the modules an institution may switch off (see InstitutionSettings.OPTIONAL_MODULES). */
const MODULES: Array<[string, string]> = [
  ['ipr', 'Patents, copyrights and consultancy'],
  ['mentoring', 'Student mentoring'],
  ['studentProjects', 'Student projects'],
  ['phdScholars', 'PhD scholars'],
  ['timetable', 'Timetable'],
  ['attendance', 'Attendance'],
  ['leave', 'Leave'],
  ['appraisal', 'Appraisal (PBAS)'],
  ['calendar', 'Calendar sync'],
  ['ai', 'AI assistant'],
];

const timezones = (): string[] => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['Asia/Kolkata', 'UTC'];
  }
};

interface Props {
  settingsForm: Partial<IAdminInstitutionSettings>;
  setSettingsForm: React.Dispatch<React.SetStateAction<Partial<IAdminInstitutionSettings>>>;
}

/** Logo, accent colour, timezone, email domains and enabled modules (saved with the rest of Settings, except the logo). */
export const BrandingSettings: React.FC<Props> = ({ settingsForm, setSettingsForm }) => {
  const inst = useInstitution();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const modules = settingsForm.enabledModules ?? MODULES.map(([k]) => k);
  const accent = settingsForm.accentColor || '#1B924B';

  const refreshBranding = () => queryClient.invalidateQueries({ queryKey: ['institution-branding'] });
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminService.uploadLogo(file);
      await refreshBranding();
      setMessage({ ok: true, text: 'Logo updated.' });
    } catch (e) {
      setMessage({ ok: false, text: formatErrorMessage(e, 'The logo could not be uploaded.') });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await adminService.removeLogo();
      await refreshBranding();
      setMessage({ ok: true, text: 'Logo removed.' });
    } catch (e) {
      setMessage({ ok: false, text: formatErrorMessage(e, 'The logo could not be removed.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.35rem', color: '#0f172a' }}>
        <i className="bi bi-palette me-2 text-primary" />
        Branding, timezone and modules
      </h3>
      <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1.1rem' }}>
        Your institution's name and logo appear on the sign-in page, navigation, printed reports and dossiers. {PRODUCT_NAME} stays the product name.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        <div>
          <label className="form-label font-semibold text-sm">Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 64, height: 64, border: '1px solid #e2e8f0', borderRadius: 8, display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
              {inst.logoUrl ? <img src={inst.logoUrl} alt={`${inst.name} logo`} style={{ maxWidth: 56, maxHeight: 56, objectFit: 'contain' }} /> : <i className="bi bi-image text-muted" aria-hidden="true" />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? 'Working…' : inst.logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {inst.logoUrl && (
                <button type="button" className="btn btn-sm btn-link text-danger p-0" disabled={busy} onClick={remove}>
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>PNG, JPEG or WebP, up to 512 KB, 32–4000 px. Saved immediately.</small>
          {message && (
            <div role={message.ok ? 'status' : 'alert'} style={{ fontSize: '0.78rem', marginTop: 4, color: message.ok ? '#1e7a47' : '#b42318' }}>
              {message.text}
            </div>
          )}
        </div>

        <div>
          <label className="form-label font-semibold text-sm" htmlFor="accentColor">Accent colour</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input id="accentColor" type="color" value={accent} onChange={(e) => setSettingsForm({ ...settingsForm, accentColor: e.target.value })} style={{ width: 44, height: 34, border: '1px solid #e2e8f0', borderRadius: 6, padding: 2 }} />
            <input
              className="form-control form-control-sm"
              value={accent}
              maxLength={7}
              pattern="#[0-9a-fA-F]{6}"
              onChange={(e) => setSettingsForm({ ...settingsForm, accentColor: e.target.value })}
              aria-label="Accent colour hex value"
            />
          </div>
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Used for highlights in navigation, the sign-in page and printed reports.</small>
        </div>

        <div>
          <label className="form-label font-semibold text-sm" htmlFor="timezone">Timezone</label>
          <select id="timezone" className="form-select form-select-sm" value={settingsForm.timezone || 'Asia/Kolkata'} onChange={(e) => setSettingsForm({ ...settingsForm, timezone: e.target.value })}>
            {timezones().map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Times on generated reports are shown in this timezone.</small>
        </div>

        <div>
          <label className="form-label font-semibold text-sm">Official email domains</label>
          <div style={{ fontSize: '0.85rem' }}>{inst.emailDomains.length ? inst.emailDomains.join(', ') : '—'}</div>
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Accounts must use these domains. They are part of your {PRODUCT_NAME} registration; ask support to change them.</small>
        </div>
      </div>

      <fieldset style={{ marginTop: '1.25rem' }}>
        <legend className="form-label font-semibold text-sm" style={{ fontSize: '0.875rem' }}>Enabled modules</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem 1rem' }}>
          {MODULES.map(([key, label]) => (
            <div key={key} className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id={`module-${key}`}
                checked={modules.includes(key)}
                onChange={(e) => setSettingsForm({ ...settingsForm, enabledModules: e.target.checked ? [...modules, key] : modules.filter((m) => m !== key) })}
              />
              <label className="form-check-label text-sm" htmlFor={`module-${key}`}>{label}</label>
            </div>
          ))}
        </div>
        <small className="text-muted" style={{ fontSize: '0.72rem' }}>
          A switched-off module disappears from the menu and its data can't be opened until it is switched on again. Nothing is deleted.
        </small>
      </fieldset>
    </div>
  );
};
