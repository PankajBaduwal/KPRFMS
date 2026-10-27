import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../api/client';
import { setInstitutionCode } from '../lib/institution';
import { ROUTES } from '../constants/routes';

const CODE = /^[a-z0-9]{2,20}$/;

/**
 * Shareable sign-in link for one institution: /i/<code>. Checks the institution exists and is
 * open, selects it, then shows its sign-in page. The selection is only a convenience; the
 * server still checks every sign-in against that institution's own accounts.
 */
export const InstitutionLinkPage: React.FC = () => {
  const { code = '' } = useParams();
  const normalized = code.toLowerCase();
  const [state, setState] = useState<'checking' | 'ok' | 'missing'>(CODE.test(normalized) ? 'checking' : 'missing');

  useEffect(() => {
    if (!CODE.test(normalized)) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/t/${normalized}/public/institution`)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setInstitutionCode(normalized);
          setState('ok');
        } else {
          setState('missing');
        }
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  if (state === 'ok') return <Navigate to={ROUTES.LOGIN} replace />;
  if (state === 'checking') return <p style={{ padding: '3rem', textAlign: 'center' }}>Opening sign-in…</p>;
  return (
    <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Institution not found</h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>This sign-in link is not valid or the institution is not available.</p>
      <Link to={ROUTES.LOGIN}>Find your institution</Link>
    </div>
  );
};
