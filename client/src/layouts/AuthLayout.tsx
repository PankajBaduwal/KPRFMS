import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../styles/login.css';
import '../styles/login-motion.css';

/** Shell for sign in, register and reset password: slim header, centred content, one-line footer. */
export const AuthLayout: React.FC = () => {
  return (
    <div className="auth-shell auth-layout">
      <header className="auth-topbar">
        <Link to={ROUTES.HOME} className="auth-topbar-brand" title="Back to home">
          <img src="/images/kpriet-logo.png" alt="KPR Institute of Engineering and Technology" />
          <span className="auth-topbar-name">Faculty Management System</span>
        </Link>
        <Link to={ROUTES.HOME} className="auth-topbar-link">
          <i className="bi bi-arrow-left" aria-hidden="true" />
          <span>Back to home</span>
        </Link>
      </header>

      <main className="auth-main">
        <Outlet />
        <p className="auth-footer-line">
          &copy; {new Date().getFullYear()} KPR Institute of Engineering and Technology · For KPRIET staff only ·{' '}
          <a href="mailto:helpdesk@kpriet.ac.in">helpdesk@kpriet.ac.in</a>
        </p>
      </main>
    </div>
  );
};
