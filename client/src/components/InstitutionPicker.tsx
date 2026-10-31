import React, { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { setInstitutionCode, useInstitutionCode } from '../lib/institution';
import { useInstitution } from '../hooks/useInstitution';

interface InstitutionOption {
  code: string;
  name: string;
  type: string;
  city: string;
  state: string;
  logoUrl: string;
}

/** Institution finder (platform endpoint, outside any institution). */
async function findInstitutions(search: string): Promise<InstitutionOption[]> {
  const res = await apiClient.get('/platform/institutions', {
    params: { search: search || undefined },
  });
  return res.data.data;
}

/**
 * "Which institution?" step for sign-in and registration. Choosing one only selects whose
 * sign-in page to use; credentials are checked against that institution's own accounts.
 */
export const InstitutionPicker: React.FC<{ onChange?: () => void }> = ({ onChange }) => {
  const code = useInstitutionCode();
  const branding = useInstitution();
  const [editing, setEditing] = useState(!code);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!code) setEditing(true);
  }, [code]);

  const { data: results = [], isFetching, isError } = useQuery({
    queryKey: ['institution-finder', debounced],
    queryFn: () => findInstitutions(debounced),
    enabled: editing,
    staleTime: 60_000,
  });

  const choose = (inst: InstitutionOption) => {
    setInstitutionCode(inst.code);
    setEditing(false);
    setSearch('');
    onChange?.();
  };

  if (code && !editing) {
    return (
      <div className="inst-picker-chosen-card">
        <div className="inst-picker-chosen-left">
          <div className="inst-picker-icon-badge">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="inst-picker-logo-img" />
            ) : (
              <i className="bi bi-buildings" aria-hidden="true" />
            )}
          </div>
          <div className="inst-picker-chosen-info">
            <div className="inst-picker-chosen-meta">
              <span className="inst-picker-tag">Active Institution</span>
              <span className="inst-picker-live-dot" title="Connected" />
            </div>
            <strong className="inst-picker-chosen-name">{branding.name || code}</strong>
            {(branding.city || branding.state) && (
              <span className="inst-picker-chosen-location">
                <i className="bi bi-geo-alt" aria-hidden="true" /> {[branding.city, branding.state].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="inst-picker-switch-btn"
          onClick={() => setEditing(true)}
          title="Switch to another institution"
        >
          <i className="bi bi-arrow-left-right" aria-hidden="true" />
          <span>Change</span>
        </button>
      </div>
    );
  }

  return (
    <div className="inst-picker-search-container">
      <div className="inst-picker-header-row">
        <label className="inst-picker-label" htmlFor={`${listId}-search`}>
          <i className="bi bi-search" aria-hidden="true" /> Select Your College or University
        </label>
        {code && (
          <button
            type="button"
            className="inst-picker-cancel-btn"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        )}
      </div>

      <div className="inst-picker-input-wrap">
        <i className="bi bi-buildings inst-picker-input-icon" aria-hidden="true" />
        <input
          id={`${listId}-search`}
          className="inst-picker-input"
          type="search"
          value={search}
          autoFocus
          placeholder="Search by college name, code, or city..."
          autoComplete="off"
          onChange={(e) => setSearch(e.target.value)}
          aria-controls={listId}
        />
        {search && (
          <button
            type="button"
            className="inst-picker-clear-search"
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            <i className="bi bi-x-circle-fill" />
          </button>
        )}
      </div>

      <ul id={listId} className="inst-picker-results" role="listbox" aria-label="Institutions" aria-busy={isFetching}>
        {isError && (
          <li className="inst-picker-empty">
            <i className="bi bi-exclamation-triangle" /> Institutions could not be loaded. Try again.
          </li>
        )}
        {!isError && !isFetching && results.length === 0 && (
          <li className="inst-picker-empty">
            <i className="bi bi-info-circle" /> No matching institution found. Check the spelling or ask your administrator.
          </li>
        )}
        {results.map((inst) => (
          <li key={inst.code} role="option" aria-selected={inst.code === code}>
            <button
              type="button"
              className={`inst-picker-result-btn ${inst.code === code ? 'is-active' : ''}`}
              onClick={() => choose(inst)}
            >
              <div className="inst-result-icon">
                <i className="bi bi-mortarboard" />
              </div>
              <div className="inst-result-content">
                <span className="inst-picker-name">{inst.name}</span>
                <span className="inst-picker-meta">
                  {[inst.city, inst.state].filter(Boolean).join(', ') || inst.type.toLowerCase()}
                </span>
              </div>
              {inst.code === code && (
                <span className="inst-result-badge">Selected</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {code && (
        <button type="button" className="inst-picker-keep-btn" onClick={() => setEditing(false)}>
          <i className="bi bi-arrow-left" /> Keep {branding.name || code}
        </button>
      )}
    </div>
  );
};
