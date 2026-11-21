import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi, type InstitutionDetail } from './api';
import { formatErrorMessage } from '../utils/errorHandler';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 512 * 1024;

const TYPES: Array<[InstitutionDetail['type'], string]> = [
  ['COLLEGE', 'College'],
  ['UNIVERSITY', 'University'],
  ['OTHER', 'Other institution'],
];

/**
 * The Super Admin's view of an institution's identity: name, type, address, contact, email
 * domains and logo. Saving updates the registry and the institution's own settings.
 */
export const InstitutionProfileEditor: React.FC<{ inst: InstitutionDetail; onClose: () => void }> = ({ inst, onClose }) => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    name: inst.name,
    type: inst.type,
    address: inst.address,
    city: inst.city,
    state: inst.state,
    contactEmail: inst.contactEmail,
    contactPhone: inst.contactPhone,
    domains: inst.officialEmailDomains.join(', '),
  });
  const [error, setError] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState(inst.logoUrl ?? '');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['platform'] });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () =>
      platformApi.updateProfile(inst.code, {
        name: f.name.trim(),
        type: f.type,
        address: f.address.trim(),
        city: f.city.trim(),
        state: f.state.trim(),
        contactEmail: f.contactEmail.trim(),
        contactPhone: f.contactPhone.trim(),
        officialEmailDomains: f.domains.split(/[\s,]+/).map((d) => d.replace(/^@/, '').trim().toLowerCase()).filter(Boolean),
      }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e) => setError(formatErrorMessage(e, 'The institution could not be updated.')),
  });
  const logo = useMutation({
    mutationFn: (file: File | null) => (file ? platformApi.uploadLogo(inst.code, file) : platformApi.removeLogo(inst.code)),
    onSuccess: (d, file) => {
      setLogoUrl(file ? d?.logoUrl ?? '' : '');
      setLogoMsg({ ok: true, text: file ? 'Logo updated. It now shows on the college’s sign-in page, navigation and reports.' : 'Logo removed.' });
      refresh();
    },
    onError: (e) => setLogoMsg({ ok: false, text: formatErrorMessage(e, 'The logo could not be changed.') }),
    onSettled: () => {
      if (fileRef.current) fileRef.current.value = '';
    },
  });
  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setLogoMsg({ ok: false, text: 'Choose a PNG, JPEG or WebP image.' });
    if (file.size > LOGO_MAX_BYTES) return setLogoMsg({ ok: false, text: `That file is ${Math.ceil(file.size / 1024)} KB; the logo can be at most 512 KB.` });
    setLogoMsg(null);
    logo.mutate(file);
  };

  return (
    <div className="pc-profile-edit">
      <div className="pc-form-grid">
        <label className="span-2">
          Official name
          <input value={f.name} onChange={set('name')} maxLength={160} />
        </label>
        <label>
          Type
          <select value={f.type} onChange={set('type')}>
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          Official email domains
          <input value={f.domains} onChange={set('domains')} placeholder="college.edu, college.ac.in" />
        </label>
        <label className="span-2">
          Address
          <input value={f.address} onChange={set('address')} maxLength={300} />
        </label>
        <label>
          City
          <input value={f.city} onChange={set('city')} maxLength={80} />
        </label>
        <label>
          State
          <input value={f.state} onChange={set('state')} maxLength={80} />
        </label>
        <label>
          Contact email
          <input type="email" value={f.contactEmail} onChange={set('contactEmail')} />
        </label>
        <label>
          Contact phone
          <input value={f.contactPhone} onChange={set('contactPhone')} maxLength={30} />
        </label>
      </div>
      <div className="pc-logo-row">
        <div className="pc-logo-preview" aria-hidden={!logoUrl}>
          {logoUrl ? <img src={logoUrl} alt={`${inst.name} logo`} /> : <i className="bi bi-image" aria-hidden="true" />}
        </div>
        <div className="pc-logo-info">
          <strong className="pc-small">College logo</strong>
          <span className="pc-muted pc-small">PNG, JPEG or WebP, up to 512 KB. Saved as soon as you choose a file. The college admin can also change it under Settings.</span>
          {logoMsg && (
            <span className={`pc-small ${logoMsg.ok ? 'pc-ok' : 'pc-error'}`} role={logoMsg.ok ? 'status' : 'alert'}>
              {logoMsg.text}
            </span>
          )}
        </div>
        <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} hidden onChange={(e) => pickLogo(e.target.files?.[0])} />
        <div className="pc-logo-actions">
          <button type="button" className="pc-btn" disabled={logo.isPending} onClick={() => fileRef.current?.click()}>
            <i className="bi bi-upload" aria-hidden="true" /> {logo.isPending ? 'Working…' : logoUrl ? 'Replace logo' : 'Upload logo'}
          </button>
          {logoUrl && (
            <button type="button" className="pc-btn" disabled={logo.isPending} onClick={() => window.confirm(`Remove the logo of ${inst.name}?`) && logo.mutate(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="pc-error" role="alert">{error}</p>}
      <div className="pc-actions">
        <button type="button" className="pc-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="pc-btn pc-btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};
