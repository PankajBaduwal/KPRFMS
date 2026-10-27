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
      <div className="inst-picker inst-picker-chosen">
        <div>
          <span className="inst-picker-label">Institution</span>
          <strong>{branding.name || code}</strong>
        </div>
        <button type="button" className="inst-picker-change" onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="inst-picker">
      <label className="inst-picker-label" htmlFor={`${listId}-search`}>
        Find your college or university
      </label>
      <input
        id={`${listId}-search`}
        className="form-control"
        type="search"
        value={search}
        autoFocus
        placeholder="Type a name or city"
        autoComplete="off"
        onChange={(e) => setSearch(e.target.value)}
        aria-controls={listId}
      />
      <ul id={listId} className="inst-picker-results" role="listbox" aria-label="Institutions" aria-busy={isFetching}>
        {isError && <li className="inst-picker-empty">Institutions could not be loaded. Try again.</li>}
        {!isError && !isFetching && results.length === 0 && (
          <li className="inst-picker-empty">No matching institution. Check the spelling or ask your administrator.</li>
        )}
        {results.map((inst) => (
          <li key={inst.code} role="option" aria-selected={inst.code === code}>
            <button type="button" onClick={() => choose(inst)}>
              <span className="inst-picker-name">{inst.name}</span>
              <span className="inst-picker-meta">{[inst.city, inst.state].filter(Boolean).join(', ') || inst.type.toLowerCase()}</span>
            </button>
          </li>
        ))}
      </ul>
      {code && (
        <button type="button" className="inst-picker-change" onClick={() => setEditing(false)}>
          Keep {branding.name || code}
        </button>
      )}
    </div>
  );
};
