import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../styles/public.css';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#roles', label: 'Roles' },
  { href: '#security', label: 'Security' },
];

/** Public shell (home page and public status pages): slim header, content, simple footer. */
export const PublicLayout: React.FC = () => {
  const isHome = useLocation().pathname === ROUTES.HOME;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="public-layout pub">
      <header className="pub-header">
        <div className="pub-container pub-header-inner">
          <Link to={ROUTES.HOME} className="pub-brand" title="KPRIET Faculty Management System">
            <img src="/images/kpriet-logo.png" alt="KPR Institute of Engineering and Technology" />
            <span className="pub-brand-name">Faculty Management System</span>
          </Link>

          {isHome && (
            <nav className={`pub-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Page sections">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}>
                  {n.label}
                </a>
              ))}
            </nav>
          )}

          <div className="pub-header-actions">
            <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-primary pub-btn-sm">
              Sign in
            </Link>
            {isHome && (
              <button
                type="button"
                className="pub-menu-btn"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="public-content">
        <Outlet />
      </main>

      <footer className="pub-footer" role="contentinfo">
        <div className="pub-container pub-footer-grid">
          <div>
            <img className="pub-footer-logo" src="/images/kpriet-logo.png" alt="KPR Institute of Engineering and Technology" />
            <p>
              KPR Institute of Engineering and Technology
              <br />
              Arasur, Coimbatore – 641 407, Tamil Nadu
            </p>
            <p className="pub-footer-muted">Autonomous · Affiliated to Anna University · Approved by AICTE · NAAC &lsquo;A+&rsquo; &amp; NBA accredited</p>
          </div>
          <div>
            <h2>Portal</h2>
            <ul>
              <li>
                <Link to={ROUTES.LOGIN}>Sign in</Link>
              </li>
              <li>
                <Link to={ROUTES.REGISTER}>Register with college email</Link>
              </li>
              <li>
                <a href="#features">Features</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Help</h2>
            <ul>
              <li>
                <a href="mailto:helpdesk@kpriet.ac.in">helpdesk@kpriet.ac.in</a>
              </li>
              <li>IT Services, ext. 4101</li>
            </ul>
          </div>
        </div>
        <div className="pub-container pub-footer-bottom">
          <span>&copy; {new Date().getFullYear()} KPR Institute of Engineering and Technology</span>
          <span>For KPRIET staff only</span>
        </div>
      </footer>
    </div>
  );
};
