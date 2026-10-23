import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

export const AuthLayout: React.FC = () => {
  return (
    <div
      className="auth-layout"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FAFCFE',
        backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      {/* 1. Institutional Statutory Top Bar (Identical to PublicLayout) */}
      <div
        style={{
          background: 'var(--color-primary-dark, #163A5C)',
          color: '#D4E4F2',
          fontSize: '11px',
          padding: '6px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="bi bi-mortarboard-fill text-white" aria-hidden="true" />
          <span><strong>KPR Institute of Engineering and Technology</strong> (Autonomous) &bull; Affiliated to Anna University &bull; NAAC &apos;A+&apos; &amp; NBA Accredited</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span><i className="bi bi-envelope me-1" aria-hidden="true" />helpdesk@kpriet.ac.in</span>
          <span><i className="bi bi-telephone me-1" aria-hidden="true" />Ext. 4101</span>
        </div>
      </div>

      {/* 2. Main Institutional Navigation Header (Identical Brand Treatment) */}
      <header
        className="auth-header"
        style={{
          height: '68px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid var(--color-border, #E5E7EB)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <Link
          to={ROUTES.HOME}
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
          title="Return to Institutional Portal Home"
        >
          <img
            src="/images/kpriet-logo.png"
            alt="KPR Institute of Engineering and Technology"
            style={{
              height: '42px',
              maxWidth: '220px',
              objectFit: 'contain',
            }}
          />
          <div className="auth-header-title" style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary, #1B345F)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
              Faculty Management System
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Institutional Security &amp; Access
            </div>
          </div>
        </Link>

        {/* Action Button: Return to Institution Overview */}
        <Link
          to={ROUTES.HOME}
          className="btn-outline-custom btn-sm"
          style={{
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          <i className="bi bi-house-door" aria-hidden="true" />
          <span className="auth-home-label">Institution Home</span>
        </Link>
      </header>

      {/* 3. Main Authentication Content Viewport */}
      <main className="auth-content" style={{ flex: 1, padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Outlet />

        {/* Institutional Regulatory & Security Compliance Footer */}
        <footer className="auth-footer" style={{ maxWidth: '820px', marginTop: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #4B5563)', marginBottom: '4px' }}>
            &copy; {new Date().getFullYear()} KPR Institute of Engineering and Technology. All rights reserved.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted, #4B5563)', marginBottom: '4px' }}>
            Official Institutional Portal &bull; Unauthorized access or misuse is strictly prohibited under institutional cybersecurity policy.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted, #4B5563)', margin: 0 }}>
            Need IT Support? Contact{' '}
            <a href="mailto:helpdesk@kpriet.ac.in" style={{ color: 'var(--color-primary, #2563EB)', textDecoration: 'underline' }}>
              helpdesk@kpriet.ac.in
            </a>{' '}
            or Intercom Ext. 4101
          </p>
        </footer>
      </main>
    </div>
  );
};
