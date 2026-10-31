import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../styles/public.css';
import '../styles/public-motion.css';
import { PRODUCT_NAME, PRODUCT_FULL_NAME, PRODUCT_TAGLINE, PRODUCT_MARK, PRODUCT_HORIZONTAL, PRODUCT_WORDMARK } from '../config/brand';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#roles', label: 'Roles' },
  { href: '#institutions', label: 'Institutions' },
  { href: '#analytics', label: 'Analytics' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
];

/** Public shell (home page and public status pages): slim header, content, simple footer. */
export const PublicLayout: React.FC = () => {
  const isHome = useLocation().pathname === ROUTES.HOME;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scroll, setScroll] = useState(0);

  // Scroll progress for the bar under the header, shadow once scrolled, back-to-top button
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScroll(max > 0 ? window.scrollY / max : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="public-layout pub">
      <header className={`pub-header ${scroll > 0.005 ? 'is-scrolled' : ''}`}>
        <span className="pub-progress" style={{ transform: `scaleX(${scroll})` }} aria-hidden="true" />
        <div className="pub-container pub-header-inner">
          <Link to={ROUTES.HOME} className="pub-brand" title={PRODUCT_FULL_NAME}>
            <img src={PRODUCT_MARK} alt="" width={34} height={34} />
            <span className="pub-brand-name">{PRODUCT_NAME}</span>
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
            <Link to="/login?demo=true" className="pub-btn pub-btn-ghost pub-btn-sm" style={{ fontWeight: 600 }}>
              <i className="bi bi-compass" style={{ marginRight: '4px' }} />
              Explore Demo
            </Link>
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

      {isHome && (
        <button
          type="button"
          className={`pub-to-top ${scroll > 0.15 ? 'is-shown' : ''}`}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          tabIndex={scroll > 0.15 ? 0 : -1}
        >
          <i className="bi bi-arrow-up" aria-hidden="true" />
        </button>
      )}

      <main className="public-content">
        <Outlet />
      </main>

      <footer className="pub-footer" role="contentinfo">
        <div className="pub-container pub-footer-grid">
          <div>
            <img src={PRODUCT_HORIZONTAL} alt={PRODUCT_NAME} height={40} className="pub-footer-logo" />
            <p>

              {PRODUCT_FULL_NAME}
              <br />
              <span className="pub-footer-muted">{PRODUCT_TAGLINE}</span>
            </p>
          </div>
          <div>
            <h2>Explore</h2>
            <ul>
              <li>
                <Link to="/login?demo=true">Explore Demo Accounts</Link>
              </li>
              <li>
                <a href="#institutions">Supported Colleges</a>
              </li>
              <li>
                <a href="#analytics">Accreditation & Analytics</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Portal</h2>
            <ul>
              <li>
                <Link to={ROUTES.LOGIN}>Institution Sign in</Link>
              </li>
              <li>
                <Link to={ROUTES.REGISTER}>Register Faculty Account</Link>
              </li>
              <li>
                <a href="#features">Platform Features</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Platform</h2>
            <ul>
              <li>
                <Link to="/login?as=platform">Super Admin Console</Link>
              </li>
              <li>
                <a href="#about">About FacultyCore</a>
              </li>
              <li>
                <a href="#contact">Contact Support</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="pub-container pub-footer-bottom">
          <span>&copy; {new Date().getFullYear()} {PRODUCT_NAME}. Complete Academic Management.</span>
          <span className="pub-footer-links">
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginRight: '1rem' }}>
              Multi-Tenant Institutional Architecture
            </span>
            <span className="pub-powered">
              Powered by <img src={PRODUCT_WORDMARK} alt={PRODUCT_NAME} height={20} />
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
};
