import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';
import { apiGet } from '../api/client';
import { AnimatedNumber, usePrefersReducedMotion } from '../components/charts';

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
    icon: 'bi-person',
    points: ['Keep your profile and research up to date', 'Apply for leave and see where it stands', 'Submit your appraisal with evidence attached'],
  },
  {
    key: 'hod',
    title: 'Head of Department',
    icon: 'bi-people',
    points: ['Verify submissions from your department', 'Watch attendance and pending items', 'Review appraisals before they go to the Dean'],
  },
  {
    key: 'leadership',
    title: 'Dean & Principal',
    icon: 'bi-bank',
    points: ['Compare departments on research and activities', 'Give final approvals and appraisal sign-off', 'Draft accreditation text from live data'],
  },
  {
    key: 'admin',
    title: 'Administrator',
    icon: 'bi-gear',
    points: ['Manage users, departments and the academic calendar', 'Import faculty lists from Excel', 'Audit every sign-in, change and approval'],
  },
];

const SECURITY = [
  { icon: 'bi-person-lock', title: 'Role-based access', text: 'Everyone sees only what their role and department allow.' },
  { icon: 'bi-phone', title: 'Two-step sign-in', text: 'Optional authenticator codes, and a list of signed-in devices you can sign out.' },
  { icon: 'bi-folder-check', title: 'Private documents', text: 'Certificates and evidence are stored privately and checked on every download.' },
  { icon: 'bi-clock-history', title: 'Full audit trail', text: 'Every sign-in, change and approval is recorded with who and when.' },
];

/** Illustrative status cards floating over the portal preview (UI examples, not live data). */
const FLOATING_CARDS = [
  { icon: 'bi-patch-check-fill', tone: 'green', title: 'Publication verified', text: 'Approved by your HOD', pos: 'tl' },
  { icon: 'bi-calendar2-check-fill', tone: 'blue', title: 'Leave approved', text: 'Casual leave · 2 days', pos: 'br' },
  { icon: 'bi-bell-fill', tone: 'amber', title: 'Appraisal due', text: 'Self-appraisal opens today', pos: 'bl' },
];

/** True once the element has scrolled into view (stays true). */
function useInView<T extends HTMLElement>(margin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return { ref, inView };
}

/** Sets --mx/--my on the element so CSS can draw a glow that follows the cursor. */
function trackPointer(e: React.PointerEvent<HTMLElement>) {
  const target = (e.target as HTMLElement).closest<HTMLElement>('[data-spotlight]');
  if (!target) return;
  const r = target.getBoundingClientRect();
  target.style.setProperty('--mx', `${e.clientX - r.left}px`);
  target.style.setProperty('--my', `${e.clientY - r.top}px`);
}

const Section: React.FC<{ id: string; eyebrow: string; title: string; intro?: string; tone?: 'white' | 'tint'; children: React.ReactNode }> = ({
  id,
  eyebrow,
  title,
  intro,
  tone = 'white',
  children,
}) => {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <section id={id} className={`pub-section pub-section-${tone}`} aria-labelledby={`${id}-title`}>
      <div ref={ref} className={`pub-container pub-reveal ${inView ? 'is-visible' : ''}`}>
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

/** Headline whose words rise into place one after another. */
const RevealHeading: React.FC<{ text: string }> = ({ text }) => (
  <h1 className="pub-hero-title" aria-label={text}>
    {text.split(' ').map((word, i) => (
      <React.Fragment key={i}>
        <span className="pub-word" aria-hidden="true">
          <span style={{ animationDelay: `${120 + i * 55}ms` }}>{word}</span>
        </span>{' '}
      </React.Fragment>
    ))}
  </h1>
);

const LiveStats: React.FC = () => {
  const { ref, inView } = useInView<HTMLDivElement>('0px');
  const [stats, setStats] = useState<{ faculty: number; departments: number; publications: number; activities: number } | null>(null);
  useEffect(() => {
    apiGet<{ faculty: number; departments: number; publications: number; activities: number }>('/public/overview')
      .then((r) => setStats(r.data))
      .catch(() => setStats(null));
  }, []);
  if (!stats) return <div ref={ref} />;
  const items = [
    { value: stats.faculty, label: 'Faculty members' },
    { value: stats.departments, label: 'Departments' },
    { value: stats.publications, label: 'Verified publications' },
    { value: stats.activities, label: 'Verified FDPs & events' },
  ];
  return (
    <div ref={ref} className={`pub-stats ${inView ? 'is-visible' : ''}`}>
      {items.map((s, i) => (
        <div key={s.label} className="pub-stat" style={{ transitionDelay: `${i * 80}ms` }}>
          <strong>{inView ? <AnimatedNumber value={s.value} duration={1200} /> : 0}</strong>
          <span>{s.label}</span>
        </div>
      ))}
      <span className="pub-stats-live">
        <span className="pub-live-dot" /> Live from FMS
      </span>
    </div>
  );
};

export const HomePage: React.FC = () => {
  const reducedMotion = usePrefersReducedMotion();
  const [activeRole, setActiveRole] = useState(0);
  const role = ROLES[activeRole];
  const visualRef = useRef<HTMLDivElement>(null);
  const steps = useInView<HTMLOListElement>();
  const features = useInView<HTMLDivElement>();
  const security = useInView<HTMLDivElement>();

  // Hero preview tilts gently toward the cursor
  const onHeroMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reducedMotion || e.pointerType !== 'mouse' || !visualRef.current) return;
    const r = visualRef.current.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / r.width;
    const y = (e.clientY - (r.top + r.height / 2)) / r.height;
    visualRef.current.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
    visualRef.current.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
  };
  const onHeroLeave = () => {
    visualRef.current?.style.setProperty('--ry', '-4deg');
    visualRef.current?.style.setProperty('--rx', '1deg');
  };

  return (
    <div className="pub-home">
      {/* Hero */}
      <section className="pub-hero" onPointerMove={onHeroMove} onPointerLeave={onHeroLeave}>
        <div className="pub-hero-bg" aria-hidden="true">
          <span className="pub-blob pub-blob-a" />
          <span className="pub-blob pub-blob-b" />
          <span className="pub-blob pub-blob-c" />
          <span className="pub-grid" />
        </div>
        <div className="pub-container pub-hero-grid">
          <div className="pub-hero-copy">
            <span className="pub-hero-badge">
              <img src="/images/kpriet-emblem.png" alt="" width={20} height={20} />
              KPR Institute of Engineering and Technology
            </span>
            <RevealHeading text="Faculty records, research and approvals in one place" />
            <p className="pub-hero-lead">
              The Faculty Management System replaces scattered forms and spreadsheets. Faculty keep their profile and research up to date,
              HODs verify it online, and the same records feed appraisals and accreditation reports.
            </p>
            <div className="pub-hero-actions">
              <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-primary pub-btn-shine">
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

          <div className="pub-hero-visual" ref={visualRef} aria-hidden="true">
            <div className="pub-browser">
              <div className="pub-browser-bar">
                <span />
                <span />
                <span />
                <div className="pub-browser-url">
                  <i className="bi bi-lock-fill" /> fms.kpriet.ac.in/portal
                </div>
              </div>
              <img src="/images/portal-preview.jpg" alt="" width={1200} height={925} />
              <span className="pub-browser-glare" />
            </div>
            {FLOATING_CARDS.map((c, i) => (
              <div key={c.title} className={`pub-float pub-float-${c.pos}`} style={{ animationDelay: `${700 + i * 260}ms, ${i * 1.3}s` }}>
                <span className={`pub-float-icon tone-${c.tone}`}>
                  <i className={`bi ${c.icon}`} />
                </span>
                <span>
                  <strong>{c.title}</strong>
                  <small>{c.text}</small>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pub-container">
          <LiveStats />
        </div>
      </section>

      <Section
        id="features"
        eyebrow="Features"
        title="Everything a faculty member's year involves"
        intro="From the first day's profile to the annual appraisal, each part uses the same verified records."
      >
        <div ref={features.ref} className={`pub-feature-grid ${features.inView ? 'is-visible' : ''}`} onPointerMove={trackPointer}>
          {MODULES.map((m, i) => (
            <article key={m.title} className="pub-feature" data-spotlight style={{ ['--i' as string]: i }}>
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
        <ol ref={steps.ref} className={`pub-steps ${steps.inView ? 'is-visible' : ''}`}>
          <span className="pub-steps-line" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="pub-step" style={{ ['--i' as string]: i }}>
              <span className="pub-step-num">0{i + 1}</span>
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
          <div className="pub-role-tabs" role="tablist" aria-label="Roles" style={{ ['--active' as string]: activeRole }}>
            <span className="pub-role-indicator" aria-hidden="true" />
            {ROLES.map((r, i) => (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={i === activeRole}
                className={i === activeRole ? 'is-active' : ''}
                onClick={() => setActiveRole(i)}
                onMouseEnter={() => !reducedMotion && setActiveRole(i)}
              >
                <i className={`bi ${r.icon}`} aria-hidden="true" />
                {r.title}
              </button>
            ))}
          </div>
          <div className="pub-role-panel" role="tabpanel" key={role.key}>
            <span className="pub-role-panel-icon">
              <i className={`bi ${role.icon}`} aria-hidden="true" />
            </span>
            <h3>{role.title}</h3>
            <ul>
              {role.points.map((p, i) => (
                <li key={p} style={{ animationDelay: `${80 + i * 70}ms` }}>
                  <i className="bi bi-check2" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
            <Link to={ROUTES.LOGIN} className="pub-role-link">
              Sign in as {role.title.toLowerCase().startsWith('head') ? 'HOD' : role.title.split(' ')[0]}
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
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
        <div ref={security.ref} className={`pub-security-grid ${security.inView ? 'is-visible' : ''}`} onPointerMove={trackPointer}>
          {SECURITY.map((s, i) => (
            <article key={s.title} className="pub-security" data-spotlight style={{ ['--i' as string]: i }}>
              <span className="pub-security-icon">
                <i className={`bi ${s.icon}`} aria-hidden="true" />
              </span>
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
        <span className="pub-cta-sheen" aria-hidden="true" />
        <div className="pub-container pub-cta-inner">
          <div>
            <h2>Ready to get started?</h2>
            <p>Sign in with your college account, or register if you have just joined KPRIET.</p>
          </div>
          <div className="pub-hero-actions">
            <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-light pub-btn-shine">
              Sign in
              <i className="bi bi-arrow-right" aria-hidden="true" />
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
