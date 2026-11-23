import React from 'react';
import { Outlet, Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../styles/login.css';
import { PRODUCT_NAME, PRODUCT_TAGLINE, PRODUCT_MARK, DEVELOPER_NAME, DEVELOPER_URL } from '../config/brand';

/** Shell for sign in, register and reset password: slim header, centred content, one-line footer. */
export const AuthLayout: React.FC = () => {
  const platform = useSearchParams()[0].get('as') === 'platform';
  return (
    <div className={`auth-shell auth-layout${platform ? ' is-platform' : ''}`}>
      <header className="auth-topbar">
        <Link to={ROUTES.HOME} className="auth-topbar-brand" title="Back to home">
          <img src={PRODUCT_MARK} alt="" width={34} height={34} />
          <span className="auth-topbar-name">{PRODUCT_NAME}</span>
        </Link>
        <Link to={ROUTES.HOME} className="auth-topbar-link">
          <i className="bi bi-arrow-left" aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </header>

      <main className="auth-main">
        <Outlet />
        <p className="auth-footer-line">
          &copy; {new Date().getFullYear()} {PRODUCT_NAME} · {PRODUCT_TAGLINE}
          <br />
          Developed by <a href={DEVELOPER_URL} target="_blank" rel="noopener noreferrer" className="dev-credit-link">{DEVELOPER_NAME}</a>
        </p>
      </main>
    </div>
  );
};

