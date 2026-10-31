import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { AnimatedNumber, usePrefersReducedMotion } from '../components/charts';
import { PRODUCT_NAME, PRODUCT_MARK } from '../config/brand';

export type CapabilityCategory = 'all' | 'dossier' | 'operations' | 'governance' | 'accreditation';

interface CapabilityItem {
  icon: string;
  title: string;
  category: 'dossier' | 'operations' | 'governance' | 'accreditation';
  categoryLabel: string;
  text: string;
  highlight: string;
}

/** Core Platform Capabilities grouped by institutional pillar */
const PLATFORM_CAPABILITIES: CapabilityItem[] = [
  {
    icon: 'bi-person-vcard',
    title: 'Faculty Profile Management',
    category: 'dossier',
    categoryLabel: 'Faculty & Dossier',
    text: 'Comprehensive academic qualifications, career history, documents, and verified institutional service records in one unified dossier.',
    highlight: 'Unified Master Profile',
  },
  {
    icon: 'bi-journal-richtext',
    title: 'Research & Publications',
    category: 'dossier',
    categoryLabel: 'Faculty & Dossier',
    text: 'Scopus, WoS, and SCI-indexed journal papers, conference proceedings, patents, copyrights, consultancy, and research grants with DOI autofill.',
    highlight: 'DOI & CrossRef Lookup',
  },
  {
    icon: 'bi-mortarboard',
    title: 'Professional Development',
    category: 'dossier',
    categoryLabel: 'Faculty & Dossier',
    text: 'FDPs, workshops, STTPs, industrial training, certifications, and guest lectures with evidence upload and verification.',
    highlight: 'Verified Certificates',
  },
  {
    icon: 'bi-calendar-range',
    title: 'Teaching & Workload',
    category: 'operations',
    categoryLabel: 'Academic Operations',
    text: 'Semester subject allocations, lecture slots, laboratory sessions, weekly workload balance, and clash-free timetable scheduling.',
    highlight: 'Clash-Free Timetable',
  },
  {
    icon: 'bi-calendar2-check',
    title: 'Attendance & Leave Management',
    category: 'operations',
    categoryLabel: 'Academic Operations',
    text: 'Daily attendance logs, duty leaves, casual and medical leaves with automated entitlement balance counters and correction workflows.',
    highlight: 'Live Balance Counters',
  },
  {
    icon: 'bi-people',
    title: 'Student Mentoring & Guidance',
    category: 'operations',
    categoryLabel: 'Academic Operations',
    text: 'Batch-wise mentee allocations, academic counseling logs, student project supervision, and Ph.D. scholar research tracking.',
    highlight: 'Mentorship Logs & PhD Track',
  },
  {
    icon: 'bi-award',
    title: 'Faculty Performance Appraisal',
    category: 'governance',
    categoryLabel: 'Governance & Appraisals',
    text: 'Annual performance self-appraisals with attached evidence, multi-tier evaluation by HOD, Dean, and Principal with score benchmarks.',
    highlight: 'Multi-Tier Evaluation',
  },
  {
    icon: 'bi-diagram-3',
    title: 'Department Management',
    category: 'governance',
    categoryLabel: 'Governance & Appraisals',
    text: 'Departmental rosters, workload distribution, subject assignments, faculty allocations, and real-time operational status for HODs.',
    highlight: 'HOD Executive Console',
  },
  {
    icon: 'bi-graph-up-arrow',
    title: 'Institutional Analytics',
    category: 'accreditation',
    categoryLabel: 'Accreditation & Analytics',
    text: 'Executive metrics comparing departmental publications, funded grants, student pass rates, and staff appraisals across academic years.',
    highlight: 'Cross-Department Index',
  },
  {
    icon: 'bi-file-earmark-check',
    title: 'NAAC & NBA Direct Reporting',
    category: 'accreditation',
    categoryLabel: 'Accreditation & Analytics',
    text: 'Pre-formatted criterion reports and compliance data tables exported directly from verified institutional databases.',
    highlight: 'One-Click Compliance Export',
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
    previewWidget: {
      tag: 'Faculty Workspace',
      stat1: { label: 'Profile Completion', val: '94%' },
      stat2: { label: 'Verified Works', val: '14' },
      stat3: { label: 'Available Leaves', val: '12 Days' },
      status: 'Appraisal Cycle 2026-27 Active',
    },
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
    previewWidget: {
      tag: 'Department CSE Overview',
      stat1: { label: 'Faculty Roster', val: '24 Staff' },
      stat2: { label: 'Pending Approvals', val: '6 Items' },
      stat3: { label: 'Workload Balance', val: '98.2%' },
      status: 'Daily Timetable Normal',
    },
  },
  {
    key: 'dean',
    title: 'Dean (Academic Affairs)',
    badge: 'Academic Governance',
    icon: 'bi-mortarboard',
    summary: 'Monitor academic health across all departments, approve curriculum offerings, and review senior appraisals.',
    capabilities: [
      'Inspect institution-wide academic activity across all engineering departments',
      'Evaluate HOD-reviewed faculty performance appraisals and add Dean assessments',
      'Oversee institutional research output, patents, and funded project grants',
      'Review cross-departmental workload equity and teaching commitments',
      'Track academic year milestones, syllabus coverage, and semester cycles',
    ],
    demoRole: 'DEAN',
    previewWidget: {
      tag: 'Institutional Academic Oversight',
      stat1: { label: 'Departments', val: '7 Active' },
      stat2: { label: 'Research Grants', val: '₹1.84 Cr' },
      stat3: { label: 'Appraisals Reviewed', val: '86%' },
      status: 'Semester Milestones On Track',
    },
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
    previewWidget: {
      tag: 'Executive Leadership Console',
      stat1: { label: 'Faculty Strength', val: '172' },
      stat2: { label: 'Total Publications', val: '350+' },
      stat3: { label: 'NAAC III Benchmark', val: '3.84/4.0' },
      status: 'Institution Active · Multi-Tenant',
    },
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
    previewWidget: {
      tag: 'System Administration',
      stat1: { label: 'Active Users', val: '172' },
      stat2: { label: 'Audit Trail Records', val: '3,100+' },
      stat3: { label: 'Database Isolation', val: 'fc_t_kpriet' },
      status: 'System Healthy · SSL Encrypted',
    },
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
    departments: ['CSE', 'ECE', 'MECH', 'EEE', 'IT', 'AI&DS', 'CIVIL'],
    facultyCount: '165+ Faculty Members',
    highlights: ['Autonomous Institution', 'NAAC A Grade', 'NBA Accredited Programs', 'Active Research Centers'],
  },
  {
    code: 'demo',
    name: 'Demo Institute of Technology',
    location: 'Chennai, Tamil Nadu',
    type: 'Collegiate Demonstration Environment',
    departmentsCount: 7,
    departments: ['CSE', 'ECE', 'MECH', 'EEE', 'IT', 'AI&DS', 'CIVIL'],
    facultyCount: '37+ Sample Profiles',
    highlights: ['Multi-Department Sample Roster', 'Complete Seed Data', 'Pre-configured Appraisal Cycles', 'Live Research Records'],
  },
];

/** Analytics Highlights */
const ANALYTICS_FEATURES = [
  {
    icon: 'bi-journal-check',
    title: 'Research & Publications Growth',
    text: 'Track Scopus, WoS, and SCI-indexed papers, citation trends, and conference contributions with multi-year comparisons.',
    badge: 'Journal Analytics',
  },
  {
    icon: 'bi-cash-coin',
    title: 'Funded Projects & Consultancy',
    text: 'Monitor external funding grants from DST, SERB, AICTE, ISRO, and industry consultancy engagements by department.',
    badge: 'Grants Pipeline',
  },
  {
    icon: 'bi-speedometer',
    title: 'Department Performance Index',
    text: 'Benchmarking metrics evaluating teaching workload, student mentoring touchpoints, and faculty development participation.',
    badge: 'Performance KPI',
  },
  {
    icon: 'bi-file-earmark-spreadsheet',
    title: 'Automated Accreditation Exports',
    text: 'Generate structured tables for NAAC Criteria 2, 3, and 6 and NBA Criterion 5 from verified transactional records.',
    badge: 'NAAC / NBA Ready',
  },
];

/** Floating Cards on Hero */
const HERO_FLOATING_CARDS = [
  { icon: 'bi-patch-check-fill', tone: 'green', title: 'Publication Verified', text: 'IEEE Access paper approved by HOD', pos: 'tl' },
  { icon: 'bi-calendar2-check-fill', tone: 'blue', title: 'Duty Leave Approved', text: 'Faculty FDP · 3 Days', pos: 'br' },
  { icon: 'bi-award-fill', tone: 'amber', title: 'Appraisal Evaluated', text: 'Principal score: 94.6% · Verified', pos: 'bl' },
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
  const [selectedCategory, setSelectedCategory] = useState<CapabilityCategory>('all');
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

  const filteredCapabilities =
    selectedCategory === 'all'
      ? PLATFORM_CAPABILITIES
      : PLATFORM_CAPABILITIES.filter((c) => c.category === selectedCategory);

  return (
    <div className="pub-home">
      {/* ========================================================
          HERO SECTION
          ======================================================== */}
      <section className="pub-hero" onPointerMove={onHeroMove} onPointerLeave={onHeroLeave}>
        <div className="pub-hero-bg" aria-hidden="true">
          <span className="pub-blob pub-blob-a" />
          <span className="pub-blob pub-blob-b" />
          <span className="pub-blob pub-blob-c" />
          <span className="pub-grid" />
        </div>

        <div className="pub-container pub-hero-grid">
          <div className="pub-hero-copy">
            <div className="pub-hero-badge-wrap">
              <span className="pub-hero-badge">
                <img src={PRODUCT_MARK} alt="" width={20} height={20} />
                <span>{PRODUCT_NAME} • Institutional ERP Platform</span>
              </span>
              <span className="pub-hero-status-pill">
                <span className="pub-live-dot" /> Multi-Tenant Active
              </span>
            </div>

            <h1 className="pub-hero-title">
              One Unified Platform. <br />
              <span className="pub-hero-title-highlight">Complete Academic Management.</span>
            </h1>

            <p className="pub-hero-lead">
              FacultyCore brings faculty profiles, academic workload, verified research dossiers, appraisals, and statutory
              accreditation reporting together in one connected institutional ERP.
            </p>

            <div className="pub-hero-actions">
              <Link to="/login?demo=true" className="pub-btn pub-btn-primary pub-btn-shine">
                <i className="bi bi-compass" />
                <span>Explore Demo Accounts</span>
              </Link>
              <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-ghost">
                <i className="bi bi-box-arrow-in-right" />
                <span>Institution Sign In</span>
              </Link>
            </div>

            <div className="pub-hero-trust-row">
              <span className="pub-trust-item">
                <i className="bi bi-shield-check" aria-hidden="true" />
                MongoDB Atlas Multi-Tenant Isolation
              </span>
              <span className="pub-trust-item">
                <i className="bi bi-check-circle" aria-hidden="true" />
                Autonomous Colleges Ready
              </span>
            </div>
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
              <img src="/images/portal-preview.jpg" alt="FacultyCore Dashboard Preview" width={1200} height={925} />
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

        {/* Live figures / statistics banner */}
        <div className="pub-container" style={{ marginTop: '2.5rem' }}>
          <div className="pub-stats is-visible">
            <div className="pub-stat">
              <div className="pub-stat-top">
                <i className="bi bi-buildings" />
                <strong><AnimatedNumber value={2} duration={1000} /></strong>
              </div>
              <span>Registered Colleges</span>
              <small>KPRIET &amp; Demo Institute</small>
            </div>

            <div className="pub-stat">
              <div className="pub-stat-top">
                <i className="bi bi-diagram-3" />
                <strong><AnimatedNumber value={14} duration={1200} /></strong>
              </div>
              <span>Academic Departments</span>
              <small>CSE, ECE, MECH, EEE &amp; More</small>
            </div>

            <div className="pub-stat">
              <div className="pub-stat-top">
                <i className="bi bi-people" />
                <strong><AnimatedNumber value={80} duration={1400} />+</strong>
              </div>
              <span>Faculty &amp; Leadership Accounts</span>
              <small>Role-Scoped Access Controls</small>
            </div>

            <div className="pub-stat">
              <div className="pub-stat-top">
                <i className="bi bi-journal-check" />
                <strong><AnimatedNumber value={350} duration={1600} />+</strong>
              </div>
              <span>Sample Research Records</span>
              <small>Verified Publications &amp; Grants</small>
            </div>

            <span className="pub-stats-live">
              <span className="pub-live-dot" /> Connected with Cloud Database
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================
          CORE CAPABILITIES (CATEGORIZED & WELL ORGANIZED)
          ======================================================== */}
      <Section
        id="features"
        eyebrow="Core Capabilities"
        title="Comprehensive Academic Management for Modern Institutions"
        intro="FacultyCore replaces fragmented spreadsheets, manual paperwork, and isolated departmental databases with a single verified institutional source of truth."
      >
        {/* Category Pill Filters */}
        <div className="pub-category-filter-bar" role="tablist" aria-label="Feature categories">
          <button
            type="button"
            className={`pub-category-btn ${selectedCategory === 'all' ? 'is-active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Capabilities <span className="pub-count-pill">{PLATFORM_CAPABILITIES.length}</span>
          </button>
          <button
            type="button"
            className={`pub-category-btn ${selectedCategory === 'dossier' ? 'is-active' : ''}`}
            onClick={() => setSelectedCategory('dossier')}
          >
            <i className="bi bi-person-vcard" /> Faculty &amp; Dossier
          </button>
          <button
            type="button"
            className={`pub-category-btn ${selectedCategory === 'operations' ? 'is-active' : ''}`}
            onClick={() => setSelectedCategory('operations')}
          >
            <i className="bi bi-calendar-range" /> Academic Operations
          </button>
          <button
            type="button"
            className={`pub-category-btn ${selectedCategory === 'governance' ? 'is-active' : ''}`}
            onClick={() => setSelectedCategory('governance')}
          >
            <i className="bi bi-award" /> Governance &amp; Appraisals
          </button>
          <button
            type="button"
            className={`pub-category-btn ${selectedCategory === 'accreditation' ? 'is-active' : ''}`}
            onClick={() => setSelectedCategory('accreditation')}
          >
            <i className="bi bi-graph-up-arrow" /> Accreditation &amp; Analytics
          </button>
        </div>

        <div
          ref={capabilitiesInView.ref}
          className={`pub-feature-grid ${capabilitiesInView.inView ? 'is-visible' : ''}`}
        >
          {filteredCapabilities.map((cap, i) => (
            <article key={cap.title} className="pub-feature-card-modern" style={{ ['--i' as string]: i }}>
              <div className="pub-feature-card-top">
                <span className="pub-feature-icon">
                  <i className={`bi ${cap.icon}`} aria-hidden="true" />
                </span>
                <span className="pub-feature-tag">{cap.highlight}</span>
              </div>
              <h3>{cap.title}</h3>
              <p>{cap.text}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ========================================================
          ROLE-BASED WORKSPACES
          ======================================================== */}
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
                <span>{r.title}</span>
              </button>
            ))}
          </div>

          <div className="pub-role-panel" role="tabpanel" key={activeRole.key}>
            <div className="pub-role-panel-header">
              <div className="pub-role-panel-badge-row">
                <span className="pub-role-panel-icon">
                  <i className={`bi ${activeRole.icon}`} aria-hidden="true" />
                </span>
                <div>
                  <h3>{activeRole.title}</h3>
                  <span className="pub-role-badge-text">{activeRole.badge}</span>
                </div>
              </div>
            </div>

            <p className="pub-role-summary">{activeRole.summary}</p>

            <div className="pub-role-body-grid">
              <div className="pub-role-checklist">
                <h4>Core Responsibilities &amp; Capabilities:</h4>
                <ul>
                  {activeRole.capabilities.map((point, idx) => (
                    <li key={idx} style={{ animationDelay: `${60 + idx * 60}ms` }}>
                      <i className="bi bi-check2-circle" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Realistic Role Dashboard Preview Widget */}
              <div className="pub-role-preview-widget">
                <div className="pub-role-widget-header">
                  <span className="pub-widget-dot" />
                  <strong>{activeRole.previewWidget.tag}</strong>
                </div>
                <div className="pub-role-widget-metrics">
                  <div className="pub-widget-metric-cell">
                    <span className="metric-val">{activeRole.previewWidget.stat1.val}</span>
                    <span className="metric-label">{activeRole.previewWidget.stat1.label}</span>
                  </div>
                  <div className="pub-widget-metric-cell">
                    <span className="metric-val">{activeRole.previewWidget.stat2.val}</span>
                    <span className="metric-label">{activeRole.previewWidget.stat2.label}</span>
                  </div>
                  <div className="pub-widget-metric-cell">
                    <span className="metric-val">{activeRole.previewWidget.stat3.val}</span>
                    <span className="metric-label">{activeRole.previewWidget.stat3.label}</span>
                  </div>
                </div>
                <div className="pub-widget-status-footer">
                  <i className="bi bi-activity" /> {activeRole.previewWidget.status}
                </div>
              </div>
            </div>

            <div className="pub-role-actions-row">
              <Link to={`/login?demo=true&role=${activeRole.demoRole}`} className="pub-btn pub-btn-primary pub-btn-sm">
                <i className="bi bi-compass" />
                <span>Explore {activeRole.title} in Demo</span>
              </Link>
              <Link to={ROUTES.LOGIN} className="pub-role-link">
                <span>Sign In to Account</span> <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ========================================================
          MULTI-INSTITUTION ARCHITECTURE
          ======================================================== */}
      <Section
        id="institutions"
        eyebrow="Multi-Institution Architecture"
        title="Multi-Tenant Isolation with Dedicated College Environments"
        intro="FacultyCore supports multiple autonomous colleges on a single platform. Each college operates with its own isolated database, custom domains, branding, and role-based permissions."
      >
        <div ref={institutionsInView.ref} className="pub-inst-grid">
          {REGISTERED_COLLEGES.map((college) => (
            <div key={college.code} className="pub-inst-card-elevated">
              <div className="pub-inst-card-header">
                <div className="pub-inst-icon-wrap">
                  <i className="bi bi-building-check" />
                </div>
                <div className="pub-inst-header-text">
                  <div className="pub-inst-badge-row">
                    <span className="pub-inst-code-badge">{college.code.toUpperCase()}</span>
                    <span className="pub-inst-status-pill">
                      <span className="pub-live-dot" /> Active Tenant
                    </span>
                  </div>
                  <h3 className="pub-inst-title">{college.name}</h3>
                  <p className="pub-inst-meta">
                    <i className="bi bi-geo-alt" /> {college.location} &bull; {college.type}
                  </p>
                </div>
              </div>

              <div className="pub-inst-card-body">
                <div className="pub-inst-stats-strip">
                  <div className="inst-strip-item">
                    <strong>{college.departmentsCount}</strong>
                    <span>Departments</span>
                  </div>
                  <div className="inst-strip-item">
                    <strong>{college.facultyCount}</strong>
                    <span>Faculty Roster</span>
                  </div>
                  <div className="inst-strip-item">
                    <strong>fc_t_{college.code}</strong>
                    <span>Isolated DB</span>
                  </div>
                </div>

                <div className="pub-inst-dept-box">
                  <span className="dept-label">Academic Departments:</span>
                  <div className="dept-tags">
                    {college.departments.map((d) => (
                      <span key={d} className="dept-tag">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pub-inst-highlights">
                  {college.highlights.map((h) => (
                    <span key={h} className="pub-inst-chip">
                      <i className="bi bi-check2" /> {h}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pub-inst-card-footer">
                <Link
                  to={`/login?demo=true&inst=${college.code}`}
                  className="pub-btn pub-btn-primary pub-btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <i className="bi bi-compass" />
                  <span>Explore {college.code.toUpperCase()} Demo Accounts</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ========================================================
          ACCREDITATION & ANALYTICS
          ======================================================== */}
      <Section
        id="analytics"
        tone="tint"
        eyebrow="Accreditation & Analytics"
        title="Actionable Analytics and Direct NAAC & NBA Evidence"
        intro="Transform raw institutional transactions into compliance-ready reports, department comparisons, and research growth curves."
      >
        <div ref={analyticsInView.ref} className="pub-analytics-grid">
          {ANALYTICS_FEATURES.map((item) => (
            <div key={item.title} className="pub-analytics-card-modern">
              <div className="pub-analytics-top-row">
                <div className="pub-analytics-icon">
                  <i className={`bi ${item.icon}`} />
                </div>
                <span className="pub-analytics-badge">{item.badge}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>

        {/* Accreditation Compliance Readiness Bar */}
        <div className="pub-compliance-matrix-card">
          <div className="compliance-matrix-header">
            <div>
              <span className="matrix-eyebrow">Institutional Compliance Readiness</span>
              <h4>Automated Statutory Criteria Coverage</h4>
            </div>
            <span className="matrix-audit-badge">
              <i className="bi bi-shield-check" /> Committee-Inspection Ready
            </span>
          </div>

          <div className="compliance-pillars-grid">
            <div className="compliance-pillar">
              <span className="pillar-metric">Criterion 2</span>
              <strong>Teaching-Learning &amp; Evaluation</strong>
              <small>Timetable, workload equity &amp; mentoring logs</small>
            </div>
            <div className="compliance-pillar">
              <span className="pillar-metric">Criterion 3</span>
              <strong>Research, Innovations &amp; Extension</strong>
              <small>Scopus/WoS papers, grants, patents &amp; consultancy</small>
            </div>
            <div className="compliance-pillar">
              <span className="pillar-metric">Criterion 5</span>
              <strong>Faculty Contributions (NBA)</strong>
              <small>FDP participation, STTPs &amp; continuous education</small>
            </div>
            <div className="compliance-pillar">
              <span className="pillar-metric">Criterion 6</span>
              <strong>Governance &amp; Appraisals</strong>
              <small>Multi-tier appraisal cycles &amp; audit trails</small>
            </div>
          </div>
        </div>
      </Section>

      {/* ========================================================
          PLATFORM ARCHITECTURE & SECURITY
          ======================================================== */}
      <Section
        id="about"
        eyebrow="Platform Architecture"
        title="Built for High Security, Integrity, and Audit Compliance"
        intro="FacultyCore employs enterprise security standards to protect institutional data, personnel records, and intellectual property."
      >
        <div className="pub-security-grid is-visible">
          <article className="pub-security-card-modern">
            <span className="pub-security-icon">
              <i className="bi bi-database-lock" aria-hidden="true" />
            </span>
            <div>
              <h3>Strict Tenant Database Isolation</h3>
              <p>Each college's records are stored in a dedicated database container. Data crossover between tenants is structurally impossible.</p>
              <span className="security-subtag">Per-Tenant MongoDB Collections</span>
            </div>
          </article>

          <article className="pub-security-card-modern">
            <span className="pub-security-icon">
              <i className="bi bi-shield-check" aria-hidden="true" />
            </span>
            <div>
              <h3>Role-Based Access Control (RBAC)</h3>
              <p>Granular permissions ensure faculty, HODs, deans, and principals access only records authorized for their role and department.</p>
              <span className="security-subtag">5 Hierarchical Access Tiers</span>
            </div>
          </article>

          <article className="pub-security-card-modern">
            <span className="pub-security-icon">
              <i className="bi bi-clock-history" aria-hidden="true" />
            </span>
            <div>
              <h3>Comprehensive Audit Trail</h3>
              <p>Every authentication attempt, profile edit, evidence submission, and administrative change is permanently timestamped with actor details.</p>
              <span className="security-subtag">Immutable Timestamping</span>
            </div>
          </article>

          <article className="pub-security-card-modern">
            <span className="pub-security-icon">
              <i className="bi bi-file-lock2" aria-hidden="true" />
            </span>
            <div>
              <h3>Encrypted Evidence &amp; Documents</h3>
              <p>Certificates, publication proofs, and appraisal documents are securely stored with authorization checks executed on every access.</p>
              <span className="security-subtag">Session-Guarded Media Vault</span>
            </div>
          </article>
        </div>
      </Section>

      {/* ========================================================
          SUPPORT & CONTACT SECTION
          ======================================================== */}
      <Section
        id="contact"
        tone="tint"
        eyebrow="Assistance & Support"
        title="Institution Onboarding and Technical Inquiries"
        intro="Have questions about deploying FacultyCore at your university or institution? Reach out to our technical administration team."
      >
        <div className="pub-support-box-elevated">
          <div className="pub-support-icon-ring">
            <i className="bi bi-headset" />
          </div>
          <h3>Platform Administration &amp; Institutional Onboarding</h3>
          <p>
            For system demonstrations, institutional tenant onboarding, or account inquiries, contact our platform administrators.
          </p>
          <div className="pub-support-email-pill">
            <i className="bi bi-envelope-at-fill" />
            <span>support@facultycore.app</span>
          </div>
        </div>
      </Section>

      {/* ========================================================
          FINAL CALL TO ACTION
          ======================================================== */}
      <section className="pub-cta">
        <span className="pub-cta-sheen" aria-hidden="true" />
        <div className="pub-container pub-cta-inner">
          <div className="pub-cta-copy">
            <h2>Explore FacultyCore in Action</h2>
            <p>
              Experience live institutional dashboards with real sample data across KPRIET and Demo Institute. Sign in with
              one click as Principal, Admin, Dean, HOD, or Faculty.
            </p>
          </div>
          <div className="pub-hero-actions">
            <Link to="/login?demo=true" className="pub-btn pub-btn-light pub-btn-shine">
              <i className="bi bi-compass" />
              <span>Explore Demo Accounts</span>
            </Link>
            <Link to={ROUTES.LOGIN} className="pub-btn pub-btn-outline-light">
              <i className="bi bi-box-arrow-in-right" />
              <span>Institution Sign In</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
