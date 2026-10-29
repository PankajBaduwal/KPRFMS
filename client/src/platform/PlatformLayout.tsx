import React from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from './api';
import { PRODUCT_MARK, PRODUCT_NAME } from '../config/brand';
import './platform.css';

/** There is one sign-in page for everyone; this selects its Super Admin option. */
export const PLATFORM_SIGN_IN = '/login?as=platform';

/** Shell for the operator console: separate session, separate look from institution portals. */
export const PlatformLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
          <NavLink to="/platform" end className="pc-brand">
            <img src={PRODUCT_MARK} alt="" width={26} height={26} />
            <span>
              {PRODUCT_NAME} <em>Platform Administration</em>
            </span>
          </NavLink>
          <nav className="pc-nav" aria-label="Platform">
            <NavLink to="/platform" end>
              Institutions
            </NavLink>
            <NavLink to="/platform/new">New institution</NavLink>
            <NavLink to="/platform/audit">Audit log</NavLink>
          </nav>
          <div className="pc-user">
            <span title={me.email}>{me.name}</span>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="pc-main">
        <Outlet />
      </main>
    </div>
  );
};
