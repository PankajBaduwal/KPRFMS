import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../styles/login.css';
import '../styles/login-motion.css';
import { PRODUCT_NAME, PRODUCT_FULL_NAME } from '../config/brand';
import { BrandMark } from '../components/BrandMark';
import { useInstitution } from '../hooks/useInstitution';

/** Shell for sign in, register and reset password: slim header, centred content, one-line footer. */
export const AuthLayout: React.FC = () => {
  const inst = useInstitution();
  return (
    <div className="auth-shell auth-layout">
      <header className="auth-topbar">
        <Link to={ROUTES.HOME} className="auth-topbar-brand" title="Back to home">
          <BrandMark size={34} />
          <span className="auth-topbar-name">{inst.name || PRODUCT_FULL_NAME}</span>
        </Link>
        <Link to={ROUTES.HOME} className="auth-topbar-link">
          <i className="bi bi-arrow-left" aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </header>

      <main className="auth-main">
        <Outlet />
        <p className="auth-footer-line">
          &copy; {new Date().getFullYear()} {inst.name || PRODUCT_NAME} · {PRODUCT_FULL_NAME}
          {inst.contactEmail && (
            <>
              {' · '}
              <a href={`mailto:${inst.contactEmail}`}>{inst.contactEmail}</a>
            </>
          )}
        </p>
      </main>
    </div>
  );
};
