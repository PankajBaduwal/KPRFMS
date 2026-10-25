import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';

export const PublicLayout: React.FC = () => {
  const location = useLocation();
  const isHomePage = location.pathname === ROUTES.HOME;

  return (
    <div className="public-layout">
      {/* 1. Institutional Statutory Top Bar */}
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

      {/* 2. Main Public Navigation Header */}
      <header
        className="public-header"
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
          title="KPRIET Faculty Management System"
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
          <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary, #1B345F)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
              Faculty Management System
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              Institutional ERP Portal
            </div>
          </div>
        </Link>

        {/* Anchor Navigation (Visible on Home) */}
        {isHomePage && (
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
            }}
            aria-label="Home Navigation"
            className="d-none d-md-flex"
          >
            <a href="#overview" style={{ color: 'var(--color-text, #1F2937)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Overview
            </a>
            <a href="#records" style={{ color: 'var(--color-text, #1F2937)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Faculty Records
            </a>
            {FEATURES.TEACHING && (
              <a href="#teaching" style={{ color: 'var(--color-text, #1F2937)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
                Teaching &amp; Workload
              </a>
            )}
            <a href="#research" style={{ color: 'var(--color-text, #1F2937)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Research &amp; IPR
            </a>
            <a href="#roles" style={{ color: 'var(--color-text, #1F2937)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Roles
            </a>
            <a href="#governance" style={{ color: 'var(--color-text, #1F2937)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              Governance
            </a>
          </nav>
        )}

        {/* Action Button: Sign In to Portal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            to={ROUTES.LOGIN}
            className="btn-primary-custom"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 'var(--radius-md, 6px)',
            }}
          >
            <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
            <span>Portal Sign In</span>
          </Link>
        </div>
      </header>

      {/* 3. Main Outlet */}
      <main className="public-content">
        <Outlet />
      </main>

      {/* 4. Institutional Comprehensive ERP Footer */}
      <footer
        style={{
          backgroundColor: '#0F253B',
          color: '#CBD5E1',
          padding: '4rem 1.5rem 2rem 1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        role="contentinfo"
      >
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '3rem',
              marginBottom: '3rem',
            }}
          >
            {/* Column 1: Institution Brand & Address */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <div style={{ backgroundColor: '#FFFFFF', padding: '4px 8px', borderRadius: '4px', display: 'inline-flex' }}>
                  <img
                    src="/images/kpriet-logo.png"
                    alt="KPRIET"
                    style={{ height: '30px', maxWidth: '160px', objectFit: 'contain' }}
                  />
                </div>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.04em' }}>
                  ERP
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: '#94A3B8', marginBottom: '1rem' }}>
                KPR Institute of Engineering and Technology<br />
                Arasur, Coimbatore &ndash; 641 407<br />
                Tamil Nadu, India
              </p>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                Autonomous Institution &bull; Affiliated to Anna University &bull; Approved by AICTE &bull; Accredited by NAAC &apos;A+&apos; &amp; NBA
              </div>
            </div>

            {/* Column 2: Core Platform Modules */}
            <div>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                Platform Modules
              </h5>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Faculty Profile &amp; Directory</Link></li>
                {FEATURES.TEACHING && (
                  <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Teaching &amp; Workload Management</Link></li>
                )}
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Research, Publications &amp; Patents</Link></li>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Student Mentoring &amp; Projects</Link></li>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Multi-Tier Approval Queue</Link></li>
              </ul>
            </div>

            {/* Column 3: Institutional Governance */}
            <div>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                Institutional Governance
              </h5>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>NAAC &amp; NBA Compliance Dossiers</Link></li>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>NIRF Institutional Data Verification</Link></li>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Annual Appraisal Scoring (API)</Link></li>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>System Audit Logs &amp; Integrity</Link></li>
                <li><Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Department Benchmarking</Link></li>
              </ul>
            </div>

            {/* Column 4: Helpdesk & Security */}
            <div>
              <h5 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                Support &amp; Security
              </h5>
              <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Central IT Services &amp; ERP Support Desk<br />
                Admin Block, 2nd Floor
              </p>
              <div style={{ fontSize: '0.8125rem', color: '#94A3B8', marginBottom: '1rem' }}>
                Email: <a href="mailto:helpdesk@kpriet.ac.in" style={{ color: '#60A5FA', textDecoration: 'none' }}>helpdesk@kpriet.ac.in</a><br />
                Phone: +91 422 2635600 (Ext. 4101)
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#4ADE80', background: 'rgba(74, 222, 128, 0.1)', padding: '4px 10px', borderRadius: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ADE80' }} />
                <span>Secure connection</span>
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Telemetry Bar */}
          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '11.5px',
              color: '#64748B',
            }}
          >
            <div>
              &copy; {new Date().getFullYear()} KPR Institute of Engineering and Technology. All Rights Reserved.
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span>Faculty Management ERP v2.4</span>
              <span>&bull;</span>
              <span>Autonomous Academic Framework</span>
              <span>&bull;</span>
              <Link to={ROUTES.LOGIN} style={{ color: '#94A3B8', textDecoration: 'none' }}>Authorized Access Only</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
