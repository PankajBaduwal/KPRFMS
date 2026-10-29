import React from 'react';
import { Outlet, Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../styles/login.css';
import '../styles/login-motion.css';
import { PRODUCT_NAME, PRODUCT_FULL_NAME, PRODUCT_TAGLINE, PRODUCT_MARK } from '../config/brand';
import { BrandMark } from '../components/BrandMark';
import { useInstitution } from '../hooks/useInstitution';

/** Shell for sign in, register and reset password: slim header, centred content, one-line footer. */
export const AuthLayout: React.FC = () => {
  const inst = useInstitution();
  // Super Admin sign-in is above every institution: FacultyCore identity only
  const platform = useSearchParams()[0].get('as') === 'platform';
  return (
    <div className={`auth-shell auth-layout${platform ? ' is-platform' : ''}`}>
      <header className="auth-topbar">
        <Link to={ROUTES.HOME} className="auth-topbar-brand" title="Back to home">
          {platform ? <img src={PRODUCT_MARK} alt="" width={34} height={34} /> : <BrandMark size={34} />}
          <span className="auth-topbar-name">{platform ? PRODUCT_NAME : inst.name || PRODUCT_FULL_NAME}</span>
        </Link>
        <Link to={ROUTES.HOME} className="auth-topbar-link">
          <i className="bi bi-arrow-left" aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </header>

      <main className="auth-main">
        <Outlet />
        <p className="auth-footer-line">
          &copy; {new Date().getFullYear()} {platform ? `${PRODUCT_NAME} · ${PRODUCT_TAGLINE}` : `${inst.name || PRODUCT_NAME} · ${PRODUCT_FULL_NAME}`}
          {!platform && inst.contactEmail && (
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
