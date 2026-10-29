import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import '../styles/public.css';
import '../styles/public-motion.css';
import { PRODUCT_NAME, PRODUCT_FULL_NAME, PRODUCT_WORDMARK } from '../config/brand';
import { BrandMark } from '../components/BrandMark';
import { useInstitution } from '../hooks/useInstitution';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#roles', label: 'Roles' },
  { href: '#security', label: 'Security' },
];

/** Public shell (home page and public status pages): slim header, content, simple footer. */
export const PublicLayout: React.FC = () => {
  const inst = useInstitution();
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
            <BrandMark size={34} />
            <span className="pub-brand-name">{inst.name || PRODUCT_FULL_NAME}</span>
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
            <BrandMark size={44} className="pub-footer-logo" />
            <p>
              {inst.name || PRODUCT_FULL_NAME}
              {(inst.city || inst.state) && (
                <>
                  <br />
                  {[inst.city, inst.state].filter(Boolean).join(', ')}
                </>
              )}
            </p>
            {(inst.tagline || inst.affiliation) && (
              <p className="pub-footer-muted">{[inst.tagline, inst.affiliation].filter(Boolean).join(' · ')}</p>
            )}
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
              {inst.contactEmail && (
                <li>
                  <a href={`mailto:${inst.contactEmail}`}>{inst.contactEmail}</a>
                </li>
              )}
              {inst.contactPhone && <li>{inst.contactPhone}</li>}
            </ul>
          </div>
        </div>
        <div className="pub-container pub-footer-bottom">
          <span>&copy; {new Date().getFullYear()} {inst.name || PRODUCT_NAME}</span>
          <span className="pub-powered">
            Powered by <img src={PRODUCT_WORDMARK} alt={PRODUCT_NAME} height={20} />
          </span>
        </div>
      </footer>
    </div>
  );
};
