import React, { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from './api';
import { PRODUCT_MARK, PRODUCT_NAME } from '../config/brand';
import './platform.css';

/** There is one sign-in page for everyone; this selects its Super Admin option. */
export const PLATFORM_SIGN_IN = '/login?as=platform';

const NAV: Array<{ group: string; items: Array<{ to: string; label: string; end?: boolean }> }> = [
  {
    group: 'Platform',
    items: [
      { to: '/platform', label: 'Overview', end: true },
      { to: '/platform/institutions', label: 'Institutions' },
      { to: '/platform/users', label: 'User management' },
      { to: '/platform/onboarding', label: 'Onboarding' },
      { to: '/platform/invitations', label: 'Invitations' },
    ],
  },
  {
    group: 'Infrastructure',
    items: [
      { to: '/platform/databases', label: 'Tenant databases' },
      { to: '/platform/backups', label: 'Backups & recovery' },
      { to: '/platform/health', label: 'System health' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/platform/settings', label: 'Platform settings' },
      { to: '/platform/security', label: 'Security & access' },
      { to: '/platform/audit', label: 'Audit logs' },
    ],
  },
];

/** Shell for the operator console: separate session, separate look from institution portals. */
export const PlatformLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: me, isLoading, isError } = useQuery({ queryKey: ['platform', 'me'], queryFn: platformApi.me, retry: false, staleTime: 60_000 });

  if (isLoading) return <div className="pc-loading">Checking platform session…</div>;
  // The shared sign-in page, with the Super Admin option selected; return here afterwards
  if (isError || !me) return <Navigate to={PLATFORM_SIGN_IN} replace state={{ from: { pathname: location.pathname } }} />;

  const signOut = async () => {
    await platformApi.logout().catch(() => undefined);
    queryClient.removeQueries({ queryKey: ['platform'] });
    navigate(PLATFORM_SIGN_IN, { replace: true });
  };

  return (
    <div className="pc">
      <header className="pc-top">
        <div className="pc-top-inner">
          <button type="button" className="pc-menu-btn" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            ☰
          </button>
          <NavLink to="/platform" end className="pc-brand">
            <img src={PRODUCT_MARK} alt="" width={26} height={26} />
            <span>
              {PRODUCT_NAME} <em>Platform Control Centre</em>
            </span>
          </NavLink>
          <div className="pc-user">
            <NavLink to="/platform/new" className="pc-btn pc-btn-primary pc-new">
              New institution
            </NavLink>
            <span title={me.email}>{me.name}</span>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="pc-shell">
        <aside className={`pc-side ${menuOpen ? 'is-open' : ''}`} aria-label="Platform navigation">
          {NAV.map((g) => (
            <nav key={g.group} aria-label={g.group}>
              <div className="pc-side-group">{g.group}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setMenuOpen(false)}>
                  {i.label}
                </NavLink>
              ))}
            </nav>
          ))}
        </aside>
        <main className="pc-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
