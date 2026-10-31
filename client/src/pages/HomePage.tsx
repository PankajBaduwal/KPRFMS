import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { AnimatedNumber, usePrefersReducedMotion } from '../components/charts';
import { PRODUCT_NAME, PRODUCT_MARK } from '../config/brand';

/** Core Platform Capabilities matching implemented features */
const PLATFORM_CAPABILITIES = [
  {
    icon: 'bi-person-vcard',
    title: 'Faculty Profile Management',
    text: 'Comprehensive academic qualifications, career history, documents, and verified institutional service records in one unified dossier.',
  },
  {
    icon: 'bi-journal-richtext',
    title: 'Research & Publications',
    text: 'Scopus, WoS, and SCI-indexed journal papers, conference proceedings, patents, copyrights, consultancy, and research grants with DOI autofill.',
  },
  {
    icon: 'bi-calendar-range',
    title: 'Teaching & Workload',
    text: 'Semester subject allocations, lecture slots, laboratory sessions, weekly workload balance, and class substitution tracking.',
  },
  {
    icon: 'bi-award',
    title: 'Faculty Performance Appraisal',
    text: 'Annual performance self-appraisals with attached evidence, multi-tier evaluation by HOD, Dean, and Principal with score benchmarks.',
  },
  {
    icon: 'bi-calendar2-check',
    title: 'Attendance & Leave Management',
    text: 'Biometric and daily attendance logging, duty leaves, casual and medical leaves with automated entitlement balance tracking.',
  },
  {
    icon: 'bi-people',
    title: 'Student Mentoring & Guidance',
    text: 'Batch-wise mentee allocations, academic counseling logs, student project supervision, and Ph.D. scholar research tracking.',
  },
  {
    icon: 'bi-mortarboard',
    title: 'Professional Development',
    text: 'FDPs, workshops, STTPs, industrial training, certifications, and guest lectures with evidence upload and verification.',
  },
  {
    icon: 'bi-diagram-3',
    title: 'Department Management',
    text: 'Departmental rosters, workload distribution, subject assignments, faculty allocations, and real-time operational status for HODs.',
  },
  {
    icon: 'bi-graph-up-arrow',
    title: 'Institutional Analytics',
    text: 'Executive metrics comparing departmental publications, funded grants, student pass rates, and staff appraisals across academic years.',
  },
  {
    icon: 'bi-file-earmark-check',
    title: 'NAAC & NBA Reporting',
    text: 'Pre-formatted criterion reports and compliance data tables exported directly from verified institutional databases.',
  },
];

/** Role-based management details */
const ROLE_DETAILS = [
  {
    key: 'faculty',
    title: 'Faculty Member',
    badge: 'Teaching & Research',
    icon: 'bi-person-workspace',
    summary: 'Manage your teaching, research portfolio, leave applications, and annual appraisals in one place.',
    capabilities: [
      'Maintain an updated academic profile with degrees and certifications',
      'Log publications with DOI lookup, upload proofs, and track HOD approvals',
      'Apply for casual, duty, and medical leaves with live balance counters',
      'Complete annual self-appraisals and track review progression',
      'Record student mentoring meetings and supervise final-year projects',
    ],
    demoRole: 'FACULTY',
  },
  {
    key: 'hod',
    title: 'Head of Department',
    badge: 'Departmental Leadership',
    icon: 'bi-person-badge',
    summary: 'Oversee department faculty, verify academic evidence, manage workloads, and evaluate appraisals.',
    capabilities: [
      'Review and verify faculty publication proofs and academic submissions',
      'Monitor daily departmental attendance, leaves, and class substitutions',
      'Review faculty annual self-appraisals and provide HOD performance scoring',
      'Allocate subjects, balance teaching workloads, and inspect timetables',
      'Generate department research summaries for internal quality audits',
    ],
    demoRole: 'HOD',
  },
  {
    key: 'dean',
    title: 'Dean (Academic Affairs)',
    badge: 'Academic Governance',
    icon: 'bi-mortarboard',
    summary: 'Monitor academic health across all departments, approve curriculum offerings, and review senior appraisals.',
    capabilities: [
      'Inspect institution-wide academic activity across all 7 engineering departments',
      'Evaluate HOD-reviewed faculty performance appraisals and add Dean assessments',
      'Oversee institutional research output, patents, and funded project grants',
      'Review cross-departmental workload equity and teaching commitments',
      'Track academic year milestones, syllabus coverage, and semester cycles',
    ],
    demoRole: 'DEAN',
  },
  {
    key: 'principal',
    title: 'Principal / Head of Institution',
    badge: 'Executive Leadership',
    icon: 'bi-bank',
    summary: 'Executive dashboard tracking institutional research growth, departmental performance, and statutory compliance.',
    capabilities: [
      'Access real-time institutional overview and executive summary cards',
      'Give final sign-off and approval on annual faculty appraisal cycles',
      'Compare departmental publications, citations, and external research funding',
      'Monitor institution-wide leave, faculty strength, and attendance rates',
      'Export verified accreditation datasets for NAAC, NBA, and NIRF audits',
    ],
    demoRole: 'PRINCIPAL',
  },
  {
    key: 'admin',
    title: 'Institution Administrator',
    badge: 'System Governance',
    icon: 'bi-gear-wide-connected',
    summary: 'Configure institutional parameters, user directories, academic calendars, and system audit logs.',
    capabilities: [
      'Manage user accounts, department associations, and designations',
      'Configure academic years, semester terms, and appraisal cycle windows',
      'Set up leave policies, holiday calendars, and workload credit rules',
      'Inspect comprehensive audit trails of every login, edit, and approval',
      'Maintain institutional parameters and data backup schedules',
    ],
    demoRole: 'ADMIN',
  },
];

/** Registered Institutional Demo Environments */
const REGISTERED_COLLEGES = [
  {
    code: 'kpriet',
    name: 'KPR Institute of Engineering and Technology',
    location: 'Coimbatore, Tamil Nadu',
    type: 'Autonomous Engineering College',
    departmentsCount: 7,
    departments: ['CSE', 'ECE', 'MECH', 'EEE', 'IT', 'AIDS', 'CIVIL'],
    highlights: ['Autonomous Institution', 'NAAC A Grade', 'NBA Accredited Programs', 'Active Research Centers'],
  },
  {
    code: 'demo',
    name: 'Demo Institute of Technology',
    location: 'Chennai, Tamil Nadu',
    type: 'Collegiate Demonstration Environment',
    departmentsCount: 7,
    departments: ['CSE', 'ECE', 'MECH', 'EEE', 'IT', 'AIDS', 'CIVIL'],
    highlights: ['Multi-Department Sample Roster', 'Complete Seed Data', 'Pre-configured Appraisal Cycles', 'Live Research Records'],
  },
];

/** Analytics Highlights */
const ANALYTICS_FEATURES = [
  {
    icon: 'bi-journal-check',
    title: 'Research & Publications Growth',
    text: 'Track Scopus, WoS, and SCI-indexed papers, citation trends, and conference contributions with multi-year comparisons.',
  },
  {
    icon: 'bi-cash-coin',
    title: 'Funded Projects & Consultancy',
    text: 'Monitor external funding grants from DST, SERB, AICTE, ISRO, and industry consultancy engagements by department.',
  },
  {
    icon: 'bi-speedometer',
    title: 'Department Performance Index',
    text: 'Benchmarking metrics evaluating teaching workload, student mentoring touchpoints, and faculty development participation.',
  },
  {
    icon: 'bi-file-earmark-spreadsheet',
    title: 'Automated Accreditation Exports',
    text: 'Generate structured tables for NAAC Criteria 2, 3, and 6 and NBA Criterion 5 from verified transactional records.',
  },
];

/** Floating Cards on Hero */
const HERO_FLOATING_CARDS = [
  { icon: 'bi-patch-check-fill', tone: 'green', title: 'Publication Verified', text: 'IEEE Access paper approved by HOD', pos: 'tl' },
  { icon: 'bi-calendar2-check-fill', tone: 'blue', title: 'Duty Leave Approved', text: 'Faculty FDP · 3 Days', pos: 'br' },
  { icon: 'bi-award-fill', tone: 'amber', title: 'Appraisal Submitted', text: 'Annual evaluation with Principal review', pos: 'bl' },
];

/** True once element scrolls into view */
function useInView<T extends HTMLElement>(margin = '0px 0px -10% 0px') {
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

const Section: React.FC<{
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  tone?: 'white' | 'tint';
  children: React.ReactNode;
}> = ({ id, eyebrow, title, intro, tone = 'white', children }) => {
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

export const HomePage: React.FC = () => {
  const reducedMotion = usePrefersReducedMotion();
  const [activeRoleIndex, setActiveRoleIndex] = useState(0);
  const activeRole = ROLE_DETAILS[activeRoleIndex];
  const visualRef = useRef<HTMLDivElement>(null);

  const capabilitiesInView = useInView<HTMLDivElement>();
  const rolesInView = useInView<HTMLDivElement>();
  const institutionsInView = useInView<HTMLDivElement>();
  const analyticsInView = useInView<HTMLDivElement>();

  // Tilt effect for hero browser mock
  const onHeroMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reducedMotion || e.pointerType !== 'mouse' || !visualRef.current) return;
    const r = visualRef.current.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / r.width;
    const y = (e.clientY - (r.top + r.height / 2)) / r.height;
    visualRef.current.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
    visualRef.current.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
  };

  const onHeroLeave = () => {
    visualRef.current?.style.setProperty('--ry', '-3deg');
    visualRef.current?.style.setProperty('--rx', '1deg');
  };

  return (
    <div className="pub-home">
      {/* SECTION 2: HERO */}
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
              <img src={PRODUCT_MARK} alt="" width={20} height={20} />
              {PRODUCT_NAME} &bull; Institutional ERP Platform
            </span>

            <h1 className="pub-hero-title">
              One Platform. Complete Academic Management.
            </h1>

            <p className="pub-hero-lead">
              FacultyCore brings faculty management, academic activities, research, institutional approvals, performance
              tracking, and accreditation reporting together in one connected platform.
            </p>

            <div className="pub-hero-actions">
              <Link to="/login?demo=true" className="pub-btn pub-btn-primary pub-btn-shine">
                <i className="bi bi-compass" />
                Explore Demo Accounts
              </Link>
              <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-ghost">
                <i className="bi bi-box-arrow-in-right" />
                Institution Sign In
              </Link>
            </div>

            <p className="pub-hero-note">
              <i className="bi bi-shield-check" aria-hidden="true" />
              Live multi-college demo environments available for evaluation across all roles.
            </p>
          </div>

          <div className="pub-hero-visual" ref={visualRef} aria-hidden="true">
            <div className="pub-browser">
              <div className="pub-browser-bar">
                <span />
                <span />
                <span />
                <div className="pub-browser-url">
                  <i className="bi bi-lock-fill" /> {PRODUCT_NAME.toLowerCase()}.app/portal
                </div>
              </div>
              <img src="/images/portal-preview.jpg" alt="FacultyCore Dashboard" width={1200} height={925} />
              <span className="pub-browser-glare" />
            </div>

            {HERO_FLOATING_CARDS.map((c, i) => (
              <div
                key={c.title}
                className={`pub-float pub-float-${c.pos}`}
                style={{ animationDelay: `${600 + i * 250}ms, ${i * 1.2}s` }}
              >
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

        {/* Live figures bar */}
        <div className="pub-container" style={{ marginTop: '2.5rem' }}>
          <div className="pub-stats is-visible">
            <div className="pub-stat">
              <strong><AnimatedNumber value={2} duration={1000} /></strong>
              <span>Registered Colleges</span>
            </div>
            <div className="pub-stat">
              <strong><AnimatedNumber value={14} duration={1200} /></strong>
              <span>Academic Departments</span>
            </div>
            <div className="pub-stat">
              <strong><AnimatedNumber value={80} duration={1400} />+</strong>
              <span>Faculty &amp; HOD Demo Accounts</span>
            </div>
            <div className="pub-stat">
              <strong><AnimatedNumber value={350} duration={1600} />+</strong>
              <span>Sample Research Records</span>
            </div>
            <span className="pub-stats-live">
              <span className="pub-live-dot" /> Verified Database Roster
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 3: PLATFORM OVERVIEW (CORE CAPABILITIES) */}
      <Section
        id="features"
        eyebrow="Core Capabilities"
        title="Comprehensive Academic Management for Modern Institutions"
        intro="FacultyCore replaces fragmented spreadsheets, manual paper forms, and isolated portals with a single verified institutional source of truth."
      >
        <div
          ref={capabilitiesInView.ref}
          className={`pub-feature-grid ${capabilitiesInView.inView ? 'is-visible' : ''}`}
        >
          {PLATFORM_CAPABILITIES.map((cap, i) => (
            <article key={cap.title} className="pub-feature" style={{ ['--i' as string]: i }}>
              <span className="pub-feature-icon">
                <i className={`bi ${cap.icon}`} aria-hidden="true" />
              </span>
              <h3>{cap.title}</h3>
              <p>{cap.text}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* SECTION 4: ROLE-BASED MANAGEMENT */}
      <Section
        id="roles"
        tone="tint"
        eyebrow="Role-Based Workspaces"
        title="Tailored Workspaces for Every Institutional Stakeholder"
        intro="Each stakeholder experiences a dedicated dashboard aligned with their academic, administrative, and governance responsibilities."
      >
        <div ref={rolesInView.ref} className="pub-roles">
          <div
            className="pub-role-tabs"
            role="tablist"
            aria-label="Stakeholder Roles"
            style={{ ['--active' as string]: activeRoleIndex }}
          >
            <span className="pub-role-indicator" aria-hidden="true" />
            {ROLE_DETAILS.map((r, i) => (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={i === activeRoleIndex}
                className={i === activeRoleIndex ? 'is-active' : ''}
                onClick={() => setActiveRoleIndex(i)}
                onMouseEnter={() => !reducedMotion && setActiveRoleIndex(i)}
              >
                <i className={`bi ${r.icon}`} aria-hidden="true" />
                {r.title}
              </button>
            ))}
          </div>

          <div className="pub-role-panel" role="tabpanel" key={activeRole.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="pub-role-panel-icon">
                <i className={`bi ${activeRole.icon}`} aria-hidden="true" />
              </span>
              <div>
                <h3 style={{ margin: 0 }}>{activeRole.title}</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{activeRole.badge}</span>
              </div>
            </div>

            <p style={{ color: '#475569', fontSize: '0.925rem', marginBottom: '1.25rem' }}>{activeRole.summary}</p>

            <ul>
              {activeRole.capabilities.map((point, idx) => (
                <li key={idx} style={{ animationDelay: `${60 + idx * 60}ms` }}>
                  <i className="bi bi-check2-circle" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <Link to={`/login?demo=true&role=${activeRole.demoRole}`} className="pub-btn pub-btn-primary pub-btn-sm">
                <i className="bi bi-compass" /> Explore {activeRole.title} in Demo
              </Link>
              <Link to={ROUTES.LOGIN} className="pub-role-link" style={{ margin: 0, alignSelf: 'center' }}>
                Sign In to Account <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* SECTION 5: INSTITUTIONAL MANAGEMENT */}
      <Section
        id="institutions"
        eyebrow="Multi-Institution Architecture"
        title="Multi-Tenant Isolation with Dedicated College Environments"
        intro="FacultyCore supports multiple autonomous colleges on a single platform. Each college operates with its own isolated database, custom domains, branding, and role-based permissions."
      >
        <div ref={institutionsInView.ref} className="pub-inst-grid">
          {REGISTERED_COLLEGES.map((college) => (
            <div key={college.code} className="pub-inst-card">
              <div>
                <div className="pub-inst-card-top">
                  <div className="pub-inst-icon">
                    <i className="bi bi-building-check" />
                  </div>
                  <div>
                    <h3 className="pub-inst-title">{college.name}</h3>
                    <p className="pub-inst-meta">
                      <i className="bi bi-geo-alt" /> {college.location} &bull; {college.type}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 0.5rem 0' }}>
                    <strong>Departments ({college.departmentsCount}):</strong>{' '}
                    {college.departments.join(', ')}
                  </p>
                  <div className="pub-inst-highlights">
                    {college.highlights.map((h) => (
                      <span key={h} className="pub-inst-chip">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <Link
                  to={`/login?demo=true&inst=${college.code}`}
                  className="pub-btn pub-btn-primary pub-btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <i className="bi bi-compass" /> Explore {college.code.toUpperCase()} Demo Accounts
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SECTION 6: REPORTS AND ANALYTICS */}
      <Section
        id="analytics"
        tone="tint"
        eyebrow="Accreditation & Analytics"
        title="Actionable Analytics and Direct NAAC & NBA Evidence"
        intro="Transform raw institutional transactions into compliance-ready reports, department comparisons, and research growth curves."
      >
        <div ref={analyticsInView.ref} className="pub-analytics-grid">
          {ANALYTICS_FEATURES.map((item) => (
            <div key={item.title} className="pub-analytics-card">
              <div className="pub-analytics-icon">
                <i className={`bi ${item.icon}`} />
              </div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SECTION 7: ABOUT & ARCHITECTURE */}
      <Section
        id="about"
        eyebrow="Platform Architecture"
        title="Built for High Security, Integrity, and Audit Compliance"
        intro="FacultyCore employs enterprise security standards to protect institutional data, personnel records, and intellectual property."
      >
        <div className="pub-security-grid is-visible">
          <article className="pub-security">
            <span className="pub-security-icon">
              <i className="bi bi-database-lock" aria-hidden="true" />
            </span>
            <div>
              <h3>Strict Tenant Database Isolation</h3>
              <p>Each college's records are stored in a dedicated database container. Data crossover between tenants is structurally impossible.</p>
            </div>
          </article>

          <article className="pub-security">
            <span className="pub-security-icon">
              <i className="bi bi-shield-check" aria-hidden="true" />
            </span>
            <div>
              <h3>Role-Based Access Control (RBAC)</h3>
              <p>Granular permissions ensure faculty, HODs, deans, and principals access only records authorized for their role and department.</p>
            </div>
          </article>

          <article className="pub-security">
            <span className="pub-security-icon">
              <i className="bi bi-clock-history" aria-hidden="true" />
            </span>
            <div>
              <h3>Comprehensive Audit Trail</h3>
              <p>Every authentication attempt, profile edit, evidence submission, and administrative change is permanently timestamped with actor details.</p>
            </div>
          </article>

          <article className="pub-security">
            <span className="pub-security-icon">
              <i className="bi bi-file-lock2" aria-hidden="true" />
            </span>
            <div>
              <h3>Encrypted Evidence &amp; Documents</h3>
              <p>Certificates, publication proofs, and appraisal documents are securely stored with authorization checks executed on every access.</p>
            </div>
          </article>
        </div>
      </Section>

      {/* SECTION 8: CONTACT SUPPORT */}
      <Section
        id="contact"
        tone="tint"
        eyebrow="Assistance & Support"
        title="Institution Onboarding and Technical Inquiries"
        intro="Have questions about deploying FacultyCore at your university or institution? Reach out to our technical administration team."
      >
        <div style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center', background: '#ffffff', padding: '2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <i className="bi bi-headset" style={{ fontSize: '2.5rem', color: '#2864A5' }} />
          <h3 style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '1.2rem', color: '#172B45' }}>Platform Administration &amp; Support</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.25rem 0' }}>
            For system demonstrations, institutional tenant onboarding, or account inquiries, contact our platform administrators.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f1f5f9', borderRadius: '8px', color: '#172B45', fontWeight: 600, fontSize: '0.9rem' }}>
            <i className="bi bi-envelope-at-fill" style={{ color: '#2864A5' }} />
            support@facultycore.app
          </div>
        </div>
      </Section>

      {/* SECTION 9: CALL TO ACTION (CTA) */}
      <section className="pub-cta">
        <span className="pub-cta-sheen" aria-hidden="true" />
        <div className="pub-container pub-cta-inner">
          <div>
            <h2>Explore FacultyCore in Action</h2>
            <p>
              Experience live institutional dashboards with real sample data across KPRIET and Demo Institute. Sign in with
              one click as Principal, Admin, Dean, HOD, or Faculty.
            </p>
          </div>
          <div className="pub-hero-actions">
            <Link to="/login?demo=true" className="pub-btn pub-btn-light pub-btn-shine">
              <i className="bi bi-compass" />
              Explore Demo Accounts
            </Link>
            <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-outline-light">
              <i className="bi bi-box-arrow-in-right" />
              Institution Sign In
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
