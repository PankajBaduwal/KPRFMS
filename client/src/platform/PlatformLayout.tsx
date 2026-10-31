import React, { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from './api';
import { PRODUCT_MARK, PRODUCT_NAME } from '../config/brand';
import './platform.css';

/** There is one sign-in page for everyone; this selects its Super Admin option. */
export const PLATFORM_SIGN_IN = '/login?as=platform';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: 'Platform',
    items: [
      { to: '/platform', label: 'Overview', icon: 'bi-grid-1x2-fill', end: true },
      { to: '/platform/institutions', label: 'Institutions', icon: 'bi-bank2' },
      { to: '/platform/users', label: 'User management', icon: 'bi-people-fill' },
      { to: '/platform/onboarding', label: 'Onboarding', icon: 'bi-check2-circle' },
      { to: '/platform/invitations', label: 'Invitations', icon: 'bi-envelope-paper-fill' },
    ],
  },
  {
    group: 'Infrastructure',
    items: [
      { to: '/platform/databases', label: 'Tenant databases', icon: 'bi-database-fill' },
      { to: '/platform/backups', label: 'Backups & recovery', icon: 'bi-shield-shaded' },
      { to: '/platform/health', label: 'System health', icon: 'bi-heart-pulse-fill' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { to: '/platform/settings', label: 'Platform settings', icon: 'bi-sliders' },
      { to: '/platform/security', label: 'Security & access', icon: 'bi-shield-lock-fill' },
      { to: '/platform/audit', label: 'Audit logs', icon: 'bi-clock-history' },
    ],
  },
];

/** Shell for the operator console: separate session, separate look from institution portals. */
export const PlatformLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: me, isLoading, isError } = useQuery({
    queryKey: ['platform', 'me'],
    queryFn: platformApi.me,
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="pc-loading">
        <span className="spinner spinner-lg" aria-hidden="true" />
        <span>Authenticating platform operator session…</span>
      </div>
    );
  }

  // The shared sign-in page, with the Super Admin option selected; return here afterwards
  if (isError || !me) {
    return <Navigate to={PLATFORM_SIGN_IN} replace state={{ from: { pathname: location.pathname } }} />;
  }

  const signOut = async () => {
    await platformApi.logout().catch(() => undefined);
    queryClient.removeQueries({ queryKey: ['platform'] });
    navigate(PLATFORM_SIGN_IN, { replace: true });
  };

  const initials = me.name
    ? me.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SA';

  return (
    <div className="pc">
      <header className="pc-top">
        <div className="pc-top-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              className="pc-menu-btn"
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <i className="bi bi-list" />
            </button>
            <NavLink to="/platform" end className="pc-brand">
              <span className="pc-brand-logo">
                <img src={PRODUCT_MARK} alt="FacultyCore" />
              </span>
              <span>
                {PRODUCT_NAME} <em>Platform Control</em>
              </span>
            </NavLink>
            <span className="pc-env-badge">Super Admin</span>
          </div>

          <div className="pc-user">
            <NavLink to="/platform/new" className="pc-top-btn pc-top-btn--primary">
              <i className="bi bi-plus-lg" />
              <span>New institution</span>
            </NavLink>

            <div className="pc-user-profile" title={me.email}>
              <div className="pc-avatar-badge">{initials}</div>
              <div className="pc-user-info">
                <span className="pc-user-name">{me.name}</span>
                <span className="pc-user-role">Super Admin</span>
              </div>
            </div>

            <button type="button" className="pc-top-btn" onClick={signOut} title="Sign out of Platform Control Centre">
              <i className="bi bi-box-arrow-right" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="pc-shell">
        <aside className={`pc-side ${menuOpen ? 'is-open' : ''}`} aria-label="Platform navigation">
          {NAV.map((g) => (
            <nav key={g.group} aria-label={g.group}>
              <div className="pc-side-group">
                <span>{g.group}</span>
              </div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setMenuOpen(false)}>
                  <i className={`bi ${i.icon}`} aria-hidden="true" />
                  <span>{i.label}</span>
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
