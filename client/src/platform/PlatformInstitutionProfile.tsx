import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi, type InstitutionDetail } from './api';
import { formatErrorMessage } from '../utils/errorHandler';

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
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
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
    onSuccess: (_d, file) => {
      setLogoMsg(file ? 'Logo updated.' : 'Logo removed.');
      refresh();
    },
    onError: (e) => setLogoMsg(formatErrorMessage(e, 'The logo could not be changed.')),
  });

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
        <span className="pc-muted pc-small">Logo (PNG, JPEG or WebP, up to 512 KB)</span>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && logo.mutate(e.target.files[0])} />
        <button type="button" className="pc-btn" disabled={logo.isPending} onClick={() => fileRef.current?.click()}>
          Upload logo
        </button>
        <button type="button" className="pc-btn" disabled={logo.isPending} onClick={() => logo.mutate(null)}>
          Remove
        </button>
        {logoMsg && <span className="pc-small" role="status">{logoMsg}</span>}
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
