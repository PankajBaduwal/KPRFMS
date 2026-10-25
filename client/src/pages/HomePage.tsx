import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';

const MODULES = [
  {
    icon: 'bi-person-vcard',
    title: 'Faculty profile',
    text: 'Qualifications, experience and documents in one verified record that follows you through your career.',
  },
  {
    icon: 'bi-journal-text',
    title: 'Research & IPR',
    text: 'Publications, funded projects, patents, copyrights and consultancy. Fill a paper from its DOI or ORCID in seconds.',
  },
  {
    icon: 'bi-calendar-check',
    title: 'Attendance & leave',
    text: 'Daily attendance, correction requests and leave applications with balances and approval tracking.',
  },
  {
    icon: 'bi-award',
    title: 'Appraisals',
    text: 'Annual self-appraisal with evidence, reviewed by the HOD, Dean and Principal in turn.',
  },
  {
    icon: 'bi-check2-square',
    title: 'Approvals',
    text: 'One queue for everything waiting on you, with comments, returns for correction and a full history.',
  },
  {
    icon: 'bi-file-earmark-bar-graph',
    title: 'Reports & accreditation',
    text: 'NAAC, NBA and NIRF reports built from verified records instead of spreadsheets collected by email.',
  },
  ...(FEATURES.TEACHING
    ? [{ icon: 'bi-speedometer2', title: 'Teaching & workload', text: 'Subjects, allocations, timetable and substitutions.' }]
    : []),
];

const STEPS = [
  { icon: 'bi-pencil-square', title: 'Add a record', text: 'Enter a publication, activity or leave request and attach the proof.' },
  { icon: 'bi-shield-check', title: 'HOD verifies', text: 'Your HOD checks it against the proof, approves it or returns it with a comment.' },
  { icon: 'bi-graph-up', title: 'Ready everywhere', text: 'Verified records appear in your profile, appraisal and the accreditation reports.' },
];

const ROLES = [
  {
    key: 'faculty',
    title: 'Faculty',
    points: ['Keep your profile and research up to date', 'Apply for leave and see where it stands', 'Submit your appraisal with evidence attached'],
  },
  {
    key: 'hod',
    title: 'Head of Department',
    points: ['Verify submissions from your department', 'Watch attendance and pending items', 'Review appraisals before they go to the Dean'],
  },
  {
    key: 'leadership',
    title: 'Dean & Principal',
    points: ['Compare departments on research and activities', 'Give final approvals and appraisal sign-off', 'Draft accreditation text from live data'],
  },
  {
    key: 'admin',
    title: 'Administrator',
    points: ['Manage users, departments and the academic calendar', 'Import faculty lists from Excel', 'Audit every sign-in, change and approval'],
  },
];

const SECURITY = [
  { icon: 'bi-person-lock', title: 'Role-based access', text: 'Everyone sees only what their role and department allow.' },
  { icon: 'bi-phone', title: 'Two-step sign-in', text: 'Optional authenticator codes, and a list of signed-in devices you can sign out.' },
  { icon: 'bi-folder-check', title: 'Private documents', text: 'Certificates and evidence are stored privately and checked on every download.' },
  { icon: 'bi-clock-history', title: 'Full audit trail', text: 'Every sign-in, change and approval is recorded with who and when.' },
];

/** Adds `is-visible` to sections as they scroll into view (one gentle fade per section). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, className: visible ? 'pub-reveal is-visible' : 'pub-reveal' };
}

const Section: React.FC<{ id: string; eyebrow: string; title: string; intro?: string; tone?: 'white' | 'tint'; children: React.ReactNode }> = ({
  id,
  eyebrow,
  title,
  intro,
  tone = 'white',
  children,
}) => {
  const reveal = useReveal<HTMLDivElement>();
  return (
    <section id={id} className={`pub-section pub-section-${tone}`} aria-labelledby={`${id}-title`}>
      <div ref={reveal.ref} className={`pub-container ${reveal.className}`}>
        <div className="pub-section-head">
          <span className="pub-eyebrow">{eyebrow}</span>
          <h2 id={`${id}-title`}>{title}</h2>
          {intro && <p>{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
};

export const HomePage: React.FC = () => {
  const [activeRole, setActiveRole] = useState(ROLES[0].key);
  const role = ROLES.find((r) => r.key === activeRole) ?? ROLES[0];

  return (
    <div className="pub-home">
      {/* Hero */}
      <section className="pub-hero">
        <div className="pub-container pub-hero-grid">
          <div className="pub-hero-copy">
            <span className="pub-hero-badge">
              <img src="/images/kpriet-emblem.png" alt="" width={20} height={20} />
              KPR Institute of Engineering and Technology
            </span>
            <h1>Faculty records, research and approvals in one place</h1>
            <p className="pub-hero-lead">
              The Faculty Management System replaces scattered forms and spreadsheets. Faculty keep their profile and research up to date,
              HODs verify it online, and the same records feed appraisals and accreditation reports.
            </p>
            <div className="pub-hero-actions">
              <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-primary">
                Sign in
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
              <Link to={ROUTES.REGISTER} className="pub-btn pub-btn-ghost">
                New faculty? Register
              </Link>
            </div>
            <p className="pub-hero-note">
              <i className="bi bi-info-circle" aria-hidden="true" /> Sign in with your college email or employee ID.
            </p>
          </div>

          <div className="pub-hero-visual" aria-hidden="true">
            <div className="pub-browser">
              <div className="pub-browser-bar">
                <span />
                <span />
                <span />
                <div className="pub-browser-url">fms.kpriet.ac.in/portal</div>
              </div>
              <img src="/images/portal-preview.jpg" alt="" width={1200} height={925} />
            </div>
          </div>
        </div>
      </section>

      <Section
        id="features"
        eyebrow="Features"
        title="Everything a faculty member's year involves"
        intro="From the first day's profile to the annual appraisal, each part uses the same verified records."
      >
        <div className="pub-feature-grid">
          {MODULES.map((m) => (
            <article key={m.title} className="pub-feature">
              <span className="pub-feature-icon">
                <i className={`bi ${m.icon}`} aria-hidden="true" />
              </span>
              <h3>{m.title}</h3>
              <p>{m.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        id="how-it-works"
        tone="tint"
        eyebrow="How it works"
        title="Enter it once, verified once, used everywhere"
        intro="No more collecting the same details for every report."
      >
        <ol className="pub-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="pub-step">
              <span className="pub-step-num">{i + 1}</span>
              <span className="pub-step-icon">
                <i className={`bi ${s.icon}`} aria-hidden="true" />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="roles" eyebrow="Roles" title="Made for each person's part of the work">
        <div className="pub-roles">
          <div className="pub-role-tabs" role="tablist" aria-label="Roles">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={r.key === activeRole}
                className={r.key === activeRole ? 'is-active' : ''}
                onClick={() => setActiveRole(r.key)}
              >
                {r.title}
              </button>
            ))}
          </div>
          <div className="pub-role-panel" role="tabpanel" key={role.key}>
            <h3>{role.title}</h3>
            <ul>
              {role.points.map((p) => (
                <li key={p}>
                  <i className="bi bi-check2" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        id="security"
        tone="tint"
        eyebrow="Security"
        title="Built for staff records"
        intro="Faculty data stays inside KPRIET and every action is accountable."
      >
        <div className="pub-security-grid">
          {SECURITY.map((s) => (
            <article key={s.title} className="pub-security">
              <i className={`bi ${s.icon}`} aria-hidden="true" />
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Closing call to action */}
      <section className="pub-cta">
        <div className="pub-container pub-cta-inner">
          <div>
            <h2>Ready to get started?</h2>
            <p>Sign in with your college account, or register if you have just joined KPRIET.</p>
          </div>
          <div className="pub-hero-actions">
            <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-light">
              Sign in
            </Link>
            <Link to={ROUTES.REGISTER} className="pub-btn pub-btn-outline-light">
              Register
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
