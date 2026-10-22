import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api/client';
import { ROUTES } from '../constants/routes';
import { FEATURES } from '../constants/features';

// Profile-domain pills that describe the Teaching module
const TEACHING_DOMAINS = ['Course Allocation', 'Weekly Workload'];
import '../styles/home.css';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
}

type ProfileTab = 'overview' | 'academic' | 'teaching' | 'research' | 'publications' | 'workload' | 'attendance' | 'appraisal';

type InstitutionalRole = 'FACULTY' | 'HOD' | 'DEAN' | 'PRINCIPAL' | 'ADMIN';

export const HomePage: React.FC = () => {
  // Live Server Health Telemetry (Preserved from existing implementation)
  const [healthStatus, setHealthStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [healthDetails, setHealthDetails] = useState<HealthData | null>(null);

  // Section 4 Interactive Profile Preview Tab State
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('overview');

  // Section 7 Interactive Role-Based State
  const [activeRole, setActiveRole] = useState<InstitutionalRole>('FACULTY');

  useEffect(() => {
    let mounted = true;
    apiGet<HealthData>('/health')
      .then((res) => {
        if (mounted && res.success) {
          setHealthStatus('connected');
          setHealthDetails(res.data);
        }
      })
      .catch(() => {
        if (mounted) {
          setHealthStatus('disconnected');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="home-page" id="overview">
      {/* ========================================================
          SECTION 1 — PREMIUM HERO
          ======================================================== */}
      <section className="hero-section" aria-label="Introduction to Faculty Management System">
        <div className="home-container">
          <div className="hero-grid">
            {/* Left Side: Editorial Typography & Actions */}
            <div className="hero-left">
              <div className="hero-institution-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#FFFFFF', borderRadius: 'var(--radius-pill)', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                <img
                  src="/images/kpriet-favicon.png"
                  alt="KPRIET"
                  style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                />
                <span style={{ color: 'var(--color-primary, #1B345F)', fontWeight: 700 }}>KPR Institute of Engineering and Technology</span>
              </div>

              <h1 className="hero-title">
                Faculty Management System
              </h1>

              <div className="hero-tagline">
                One Connected Platform for Faculty, Academic, Research and Institutional Management
              </div>

              <p className="hero-description">
                Centralize faculty profiles, academic responsibilities, {FEATURES.TEACHING ? 'workload, ' : ''}research, publications, professional activities, approvals, performance and institutional records in one secure platform.
              </p>

              <div className="hero-cta-group">
                <Link to={ROUTES.LOGIN} className="hero-btn-primary">
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  <span>Sign In</span>
                </Link>

                <a href="#overview-strip" className="hero-btn-secondary">
                  <i className="bi bi-compass" aria-hidden="true" />
                  <span>Explore Platform</span>
                </a>
              </div>

              {/* Live Institutional Server Telemetry */}
              <div className="hero-telemetry-pill" title="Live connection to institutional API engine">
                <span className="status-indicator" aria-hidden="true" />
                <span>
                  System Status: <strong>{healthStatus === 'connected' ? 'Operational' : healthStatus === 'checking' ? 'Synchronizing...' : 'Offline'}</strong>
                </span>
                {healthDetails && (
                  <span>
                    &bull; Engine Uptime: {Math.floor(healthDetails.uptime)}s
                  </span>
                )}
              </div>
            </div>

            {/* Right Side: Sophisticated Connected Product Composition */}
            <div className="hero-right">
              <div className="hero-visual-card" role="region" aria-label="System Architecture Composition">
                <div className="hero-visual-header">
                  <div className="hero-visual-title">
                    <i className="bi bi-diagram-3-fill" aria-hidden="true" />
                    <span>Institutional Connected Architecture</span>
                  </div>
                  <div className="hero-visual-meta">
                    <span className="badge-pill-status">AY 2026-2027</span>
                  </div>
                </div>

                {/* Central Core: Authoritative Faculty Record */}
                <div className="hero-core-node">
                  <div className="hero-core-icon">
                    <i className="bi bi-person-badge" aria-hidden="true" />
                  </div>
                  <div className="hero-core-details">
                    <h4>Central Faculty Repository</h4>
                    <p>Single authoritative source of identity, service credentials &amp; qualifications</p>
                  </div>
                </div>

                {/* 4 Connected Satellite Domains */}
                <div className="hero-satellite-grid">
                  <div className="hero-satellite-item">
                    <div className="hero-satellite-head">
                      <i className="bi bi-mortarboard" aria-hidden="true" />
                      <span>{FEATURES.TEACHING ? 'Academic & Teaching' : 'Academic & Mentoring'}</span>
                    </div>
                    <p>
                      {FEATURES.TEACHING
                        ? 'Subject mapping, contact hours, timetable & mentoring records'
                        : 'Qualifications, student mentoring, projects & PhD scholar records'}
                    </p>
                    <span className="hero-satellite-status">
                      <i className="bi bi-check2" aria-hidden="true" /> Active Sync
                    </span>
                  </div>

                  <div className="hero-satellite-item">
                    <div className="hero-satellite-head">
                      <i className="bi bi-journal-bookmark" aria-hidden="true" />
                      <span>Research &amp; IPR</span>
                    </div>
                    <p>Publications, sponsored grants, patents, copyrights &amp; consultancy</p>
                    <span className="hero-satellite-status">
                      <i className="bi bi-check2" aria-hidden="true" /> Scopus / SCI Verified
                    </span>
                  </div>

                  <div className="hero-satellite-item">
                    <div className="hero-satellite-head">
                      <i className="bi bi-speedometer2" aria-hidden="true" />
                      <span>{FEATURES.TEACHING ? 'Workload & Attendance' : 'Attendance & Leave'}</span>
                    </div>
                    <p>
                      {FEATURES.TEACHING
                        ? 'Weekly contact load ceilings, biometric sync & statutory appraisal'
                        : 'Daily attendance, leave balances & statutory appraisal'}
                    </p>
                    <span className="hero-satellite-status">
                      <i className="bi bi-check2" aria-hidden="true" /> Real-time Tracking
                    </span>
                  </div>

                  <div className="hero-satellite-item">
                    <div className="hero-satellite-head">
                      <i className="bi bi-shield-check" aria-hidden="true" />
                      <span>Approvals &amp; Audit</span>
                    </div>
                    <p>Multi-tier review (Faculty &rarr; HOD &rarr; Dean) with audit trail</p>
                    <span className="hero-satellite-status">
                      <i className="bi bi-check2" aria-hidden="true" /> Regulatory Compliant
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 2 — TRUST / INSTITUTIONAL STRIP
          ======================================================== */}
      <section className="institutional-strip-section" id="overview-strip" aria-label="Core Academic Domains">
        <div className="home-container">
          <div className="institutional-strip-grid">
            <div className="institutional-strip-item">
              <div className="institutional-strip-icon">
                <i className="bi bi-mortarboard" aria-hidden="true" />
              </div>
              <div className="institutional-strip-text">
                Academic Management
              </div>
            </div>

            <div className="institutional-strip-item">
              <div className="institutional-strip-icon">
                <i className="bi bi-person-lines-fill" aria-hidden="true" />
              </div>
              <div className="institutional-strip-text">
                Faculty Records
              </div>
            </div>

            <div className="institutional-strip-item">
              <div className="institutional-strip-icon">
                <i className="bi bi-lightbulb" aria-hidden="true" />
              </div>
              <div className="institutional-strip-text">
                Research &amp; Innovation
              </div>
            </div>

            <div className="institutional-strip-item">
              <div className="institutional-strip-icon">
                <i className="bi bi-calendar3-week" aria-hidden="true" />
              </div>
              <div className="institutional-strip-text">
                {FEATURES.TEACHING ? 'Workload & Timetable' : 'Attendance & Leave'}
              </div>
            </div>

            <div className="institutional-strip-item">
              <div className="institutional-strip-icon">
                <i className="bi bi-graph-up-arrow" aria-hidden="true" />
              </div>
              <div className="institutional-strip-text">
                Performance &amp; Appraisal
              </div>
            </div>

            <div className="institutional-strip-item">
              <div className="institutional-strip-icon">
                <i className="bi bi-file-earmark-check" aria-hidden="true" />
              </div>
              <div className="institutional-strip-text">
                Reports &amp; Accreditation
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 3 — WHY KPRIET FMS
          ======================================================== */}
      <section className="home-section" id="why-fms" aria-label="Why KPRIET Faculty Management System">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Institutional Value</span>
            <h2 className="section-title">
              Everything Faculty Management Needs. In One Place.
            </h2>
            <p className="section-subtitle">
              Designed to connect faculty records, academic responsibilities, research activities and institutional workflows through a single authoritative platform.
            </p>
          </div>

          <div className="why-grid">
            {/* Block 1 */}
            <div className="why-card">
              <div className="why-icon-wrap">
                <i className="bi bi-person-vcard" aria-hidden="true" />
              </div>
              <h3>1. One Faculty Profile</h3>
              <p>
                Eliminate fragmented spreadsheets and isolated dossiers. Every faculty member maintains a comprehensive, verified digital academic portfolio containing employment, {FEATURES.TEACHING ? 'teaching, ' : ''}research, patents, professional activities, and appraisals.
              </p>
              <ul className="why-bullets">
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Continuous lifecycle tracking from joining to promotion</li>
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Digital archive of uploaded evidentiary credentials &amp; certificates</li>
              </ul>
            </div>

            {/* Block 2 */}
            {FEATURES.TEACHING && (
            <div className="why-card">
              <div className="why-icon-wrap">
                <i className="bi bi-link-45deg" aria-hidden="true" />
              </div>
              <h3>2. Connected Academic Records</h3>
              <p>
                Subjects, teaching assignments, workload calculations, and timetable slots are directly bound together. Teaching loads automatically feed into weekly faculty contact hours and semester appraisals without duplicate data entry.
              </p>
              <ul className="why-bullets">
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Automatic section conflict &amp; schedule clash detection</li>
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Instant ceiling threshold alerts for over/under allocation</li>
              </ul>
            </div>
            )}

            {/* Block 3 */}
            <div className="why-card">
              <div className="why-icon-wrap">
                <i className="bi bi-check2-circle" aria-hidden="true" />
              </div>
              <h3>3. Structured Approval Workflows</h3>
              <p>
                Every research submission, patent claim, paper presentation, and leave request progresses through institutional verification gates (HOD &rarr; Dean &rarr; Principal) with mandatory remarks, change requests, and full audit logs.
              </p>
              <ul className="why-bullets">
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Two-way feedback loop with Return-for-Correction flows</li>
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Immutable time-stamped audit trails for statutory integrity</li>
              </ul>
            </div>

            {/* Block 4 */}
            <div className="why-card">
              <div className="why-icon-wrap">
                <i className="bi bi-bar-chart-steps" aria-hidden="true" />
              </div>
              <h3>4. Institution-Wide Visibility</h3>
              <p>
                Leadership teams gain instantaneous real-time visibility into department workloads, research publications velocity, grant distributions, and accreditation readiness across NAAC, NBA, and NIRF statutory criteria.
              </p>
              <ul className="why-bullets">
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> One-click generation of 20 statutory accreditation dossiers</li>
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Inter-departmental benchmarking and faculty comparisons</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 4 — FACULTY MANAGEMENT
          ======================================================== */}
      <section className="home-section home-section-alt" id="records" aria-label="Faculty Records Dossier">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Comprehensive Record</span>
            <h2 className="section-title">
              One Complete Faculty Record
            </h2>
            <p className="section-subtitle">
              The faculty profile consolidates all {FEATURES.TEACHING ? 18 : 18 - TEACHING_DOMAINS.length} institutional domains into a verified digital academic portfolio.
            </p>
          </div>

          {/* 18 Interconnected Domains Ribbon */}
          <div className="domains-ribbon" aria-label="Interconnected Profile Domains">
            {[
              'Personal Details', 'Employment History', 'Academic Qualifications', 'Teaching Experience',
              'Course Allocation', 'Weekly Workload', 'Journal Publications', 'Funded Projects',
              'Patents & IPR', 'Industry Consultancy', 'Academic Activities', 'Student Mentoring',
              'PhD Scholars Guided', 'Biometric Attendance', 'Leave Management', 'Annual Appraisal',
              'Document Vault', 'Verification History'
            ].filter((domain) => FEATURES.TEACHING || !TEACHING_DOMAINS.includes(domain)).map((domain) => (
              <span key={domain} className="domain-pill">
                <i className="bi bi-check2 text-primary" aria-hidden="true" />
                {domain}
              </span>
            ))}
          </div>

          {/* Interactive Faculty Profile Preview */}
          <div className="profile-preview-card" role="region" aria-label="Interactive Faculty Profile Preview">
            {/* Header Strip */}
            <div className="preview-header-bar">
              <div className="preview-faculty-info">
                <div className="preview-avatar">
                  KA
                </div>
                <div className="preview-faculty-text">
                  <h4>Dr. K. S. Arunkumar, Ph.D.</h4>
                  <p>Associate Professor &bull; Dept. of Computer Science &amp; Engineering &bull; EMP-1024</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="hero-satellite-status" style={{ background: '#F0FDF4', padding: '4px 10px', borderRadius: '4px', border: '1px solid #BBF7D0' }}>
                  <i className="bi bi-patch-check-fill" aria-hidden="true" /> Verified Institutional Record
                </span>
              </div>
            </div>

            {/* Interactive Preview Tabs */}
            <div className="preview-tabs-nav" role="tablist" aria-label="Profile Preview Domains">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'academic', label: 'Academic & Qualifications' },
                { id: 'teaching', label: 'Teaching & Courses' },
                { id: 'research', label: 'Research & Grants' },
                { id: 'publications', label: 'Publications' },
                { id: 'workload', label: 'Workload Summary' },
                { id: 'attendance', label: 'Attendance & Leaves' },
                { id: 'appraisal', label: 'Appraisal & API' },
              ].filter((tab) => FEATURES.TEACHING || (tab.id !== 'teaching' && tab.id !== 'workload')).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeProfileTab === tab.id}
                  className={`preview-tab-btn ${activeProfileTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveProfileTab(tab.id as ProfileTab)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents Viewport */}
            <div className="preview-tab-content">
              {activeProfileTab === 'overview' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Designation &amp; Rank</div>
                    <div className="preview-detail-val">Associate Professor (Selection Grade)</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Department</div>
                    <div className="preview-detail-val">Computer Science &amp; Engineering</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Highest Qualification</div>
                    <div className="preview-detail-val">Ph.D. in Information &amp; Communication Eng.</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Date of Joining</div>
                    <div className="preview-detail-val">12 June 2017 (9+ Years at KPRIET)</div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'academic' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Doctoral Degree</div>
                    <div className="preview-detail-val">Ph.D. &bull; Anna University, Chennai (2016)</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Postgraduate Degree</div>
                    <div className="preview-detail-val">M.E. Computer Science &bull; Distinction</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Teaching Experience</div>
                    <div className="preview-detail-val">14.5 Years Total Institutional Service</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Areas of Specialization</div>
                    <div className="preview-detail-val">Cloud Systems, Distributed Algorithms, AI</div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'teaching' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Current Course 1</div>
                    <div className="preview-detail-val">CS8591 &bull; Computer Networks (Section A)</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Current Course 2</div>
                    <div className="preview-detail-val">CS8792 &bull; Cryptography &amp; Network Security</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Lab Practical Assignment</div>
                    <div className="preview-detail-val">CS8581 &bull; Networks Laboratory (Batch II)</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Student Mentorship</div>
                    <div className="preview-detail-val">22 Assigned Undergraduate Mentees</div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'research' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Funded Research Projects</div>
                    <div className="preview-detail-val">2 Active (DST-SERB &amp; AICTE RPS)</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Total Grant Value</div>
                    <div className="preview-detail-val">&#8377; 34.50 Lakhs Sanctioned Funding</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Patents Published / Granted</div>
                    <div className="preview-detail-val">3 Published (Indian Patent Office) &bull; 1 Granted</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">PhD Guidance</div>
                    <div className="preview-detail-val">4 Doctoral Scholars Registered (Anna Univ)</div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'publications' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Scopus / SCI Indexed Articles</div>
                    <div className="preview-detail-val">18 Peer-Reviewed Journal Articles</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Conference Proceedings</div>
                    <div className="preview-detail-val">12 IEEE / Springer Conferences</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Citation Metrics</div>
                    <div className="preview-detail-val">h-index: 11 &bull; i10-index: 14 &bull; 420+ Citations</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">ORCID / Scopus ID</div>
                    <div className="preview-detail-val">0000-0002-8412-910X &bull; 57218394012</div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'workload' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Lecture Contact Hours</div>
                    <div className="preview-detail-val">8 Hours / Week Theory Teaching</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Laboratory Hours</div>
                    <div className="preview-detail-val">6 Hours / Week Practical Supervision</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Preparation &amp; Departmental</div>
                    <div className="preview-detail-val">4 Hours Academic Audit &amp; Mentoring</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Total Workload Status</div>
                    <div className="preview-detail-val">18 Hours &bull; Complies with AICTE Standard</div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'attendance' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Biometric Attendance Presence</div>
                    <div className="preview-detail-val">98.4% Regular Institutional Presence</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Casual Leaves Taken</div>
                    <div className="preview-detail-val">3 Days Utilized / 12 Days Balance</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">On-Duty (OD) Research Leave</div>
                    <div className="preview-detail-val">4 Days Sanctioned for IEEE Conference</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Medical Leave Balance</div>
                    <div className="preview-detail-val">10 Days Available in Current Calendar</div>
                  </div>
                </div>
              )}

              {activeProfileTab === 'appraisal' && (
                <div className="preview-detail-grid">
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Academic Performance Index (API)</div>
                    <div className="preview-detail-val">94.8 / 100 Grade: Exemplary</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Teaching Effectiveness</div>
                    <div className="preview-detail-val">4.82 / 5.00 Student Evaluation Index</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">HOD Appraisal Assessment</div>
                    <div className="preview-detail-val">Recommended for Senior Grade &bull; Verified</div>
                  </div>
                  <div className="preview-detail-item">
                    <div className="preview-detail-label">Statutory Dossier Status</div>
                    <div className="preview-detail-val">Approved by Principal Office &bull; AY 2025-26</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 5 — ACADEMIC & TEACHING MANAGEMENT
          ======================================================== */}
      {FEATURES.TEACHING && (
      <section className="home-section" id="teaching" aria-label="Academic & Teaching Workflow">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Teaching Workflow</span>
            <h2 className="section-title">
              From Teaching Assignment to Workload
            </h2>
            <p className="section-subtitle">
              Manage teaching responsibilities, subject allocation, workload, timetable and academic activities through a connected workflow.
            </p>
          </div>

          <div className="teaching-flow-container">
            {/* Step 1 */}
            <div className="flow-step-card">
              <div className="flow-step-num">1</div>
              <h4>Subject Allocation</h4>
              <p>HOD maps departmental curriculum, core courses, and professional electives across available qualified faculty.</p>
              <span className="flow-step-badge">Curriculum Mapping</span>
            </div>

            {/* Step 2 */}
            <div className="flow-step-card">
              <div className="flow-step-num">2</div>
              <h4>Teaching Assignment</h4>
              <p>Faculty receive structured theory, laboratory, and tutorial sections with assigned syllabus deliverables.</p>
              <span className="flow-step-badge">Section Assignment</span>
            </div>

            {/* Step 3 */}
            <div className="flow-step-card">
              <div className="flow-step-num">3</div>
              <h4>Workload Validation</h4>
              <p>System automatically calculates weekly contact hours, alerting on AICTE ceiling threshold breaches.</p>
              <span className="flow-step-badge">Threshold Check</span>
            </div>

            {/* Step 4 */}
            <div className="flow-step-card">
              <div className="flow-step-num">4</div>
              <h4>Timetable Scheduling</h4>
              <p>Generates conflict-free scheduling grids, room allocations, lab batches, and emergency substitutions.</p>
              <span className="flow-step-badge">Clash Detection</span>
            </div>

            {/* Step 5 */}
            <div className="flow-step-card">
              <div className="flow-step-num">5</div>
              <h4>Academic Records</h4>
              <p>Class attendance, syllabus coverage, and continuous internal assessment link directly to faculty performance.</p>
              <span className="flow-step-badge">Audit Binding</span>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ========================================================
          SECTION 6 — RESEARCH & INNOVATION
          ======================================================== */}
      <section className="home-section home-section-alt" id="research" aria-label="Research and Innovation Hub">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Scholarly Impact</span>
            <h2 className="section-title">
              Make Research Visible
            </h2>
            <p className="section-subtitle">
              The system connects all dimensions of institutional research, scholarly productivity, patents, and corporate engagements.
            </p>
          </div>

          <div className="research-tree-grid">
            {/* 1. Publications */}
            <div className="research-tree-card">
              <div className="research-card-head">
                <div className="research-card-icon">
                  <i className="bi bi-file-earmark-text" aria-hidden="true" />
                </div>
                <h4>Publications</h4>
              </div>
              <p>Indexed journal articles, book chapters, and peer-reviewed conference publications with digital DOI &amp; Scopus verification.</p>
              <div className="research-tag-list">
                <span className="research-tag">SCI / SCIE</span>
                <span className="research-tag">Scopus Indexed</span>
                <span className="research-tag">UGC-CARE</span>
                <span className="research-tag">DOI Verified</span>
              </div>
            </div>

            {/* 2. Research Projects */}
            <div className="research-tree-card">
              <div className="research-card-head">
                <div className="research-card-icon">
                  <i className="bi bi-cpu" aria-hidden="true" />
                </div>
                <h4>Sponsored Projects</h4>
              </div>
              <p>Principal Investigator &amp; Co-PI grant submissions, funding agency sanctions, utilization certificates, and milestones.</p>
              <div className="research-tag-list">
                <span className="research-tag">DST / SERB</span>
                <span className="research-tag">AICTE RPS</span>
                <span className="research-tag">DRDO</span>
                <span className="research-tag">Industry Funded</span>
              </div>
            </div>

            {/* 3. Patents & IPR */}
            <div className="research-tree-card">
              <div className="research-card-head">
                <div className="research-card-icon">
                  <i className="bi bi-award" aria-hidden="true" />
                </div>
                <h4>Patents &amp; Copyrights</h4>
              </div>
              <p>Intellectual property lifecycle tracking from provisional filing to publication, examination, and official commercial grant.</p>
              <div className="research-tag-list">
                <span className="research-tag">Indian Patent Office</span>
                <span className="research-tag">PCT Filings</span>
                <span className="research-tag">Copyrights</span>
                <span className="research-tag">Commercial Grants</span>
              </div>
            </div>

            {/* 4. Industrial Consultancy */}
            <div className="research-tree-card">
              <div className="research-card-head">
                <div className="research-card-icon">
                  <i className="bi bi-briefcase" aria-hidden="true" />
                </div>
                <h4>Industrial Consultancy</h4>
              </div>
              <p>Corporate technical advisory agreements, material testing, institutional revenue sharing, and verified client contracts.</p>
              <div className="research-tag-list">
                <span className="research-tag">Corporate MoUs</span>
                <span className="research-tag">Testing Reports</span>
                <span className="research-tag">Revenue Share</span>
                <span className="research-tag">Signed Agreements</span>
              </div>
            </div>

            {/* 5. Conferences & Workshops */}
            <div className="research-tree-card">
              <div className="research-card-head">
                <div className="research-card-icon">
                  <i className="bi bi-people" aria-hidden="true" />
                </div>
                <h4>Professional Activities</h4>
              </div>
              <p>Organization and participation in international conferences, FDP, STTP, workshops, and session chair engagements.</p>
              <div className="research-tag-list">
                <span className="research-tag">FDP / STTP</span>
                <span className="research-tag">IEEE Conferences</span>
                <span className="research-tag">Keynote Lectures</span>
                <span className="research-tag">Certificates</span>
              </div>
            </div>

            {/* 6. PhD Scholars */}
            <div className="research-tree-card">
              <div className="research-card-head">
                <div className="research-card-icon">
                  <i className="bi bi-mortarboard" aria-hidden="true" />
                </div>
                <h4>Doctoral Guidance</h4>
              </div>
              <p>Anna University recognized supervisor tracking for registered PhD scholars, comprehensive viva, and thesis defense.</p>
              <div className="research-tag-list">
                <span className="research-tag">Anna University Supervisor</span>
                <span className="research-tag">Doctoral Committee</span>
                <span className="research-tag">Synopsis Defense</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 7 — ROLE-BASED PLATFORM
          ======================================================== */}
      <section className="home-section" id="roles" aria-label="Role-Based Architecture">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Institutional Governance</span>
            <h2 className="section-title">
              Designed Around Every Institutional Role
            </h2>
            <p className="section-subtitle">
              Every level of academic administration experiences an interface specifically tailored to their statutory mandate.
            </p>
          </div>

          {/* Interactive Role Switcher */}
          <div className="roles-selector-nav" role="tablist" aria-label="Institutional Roles">
            {(['FACULTY', 'HOD', 'DEAN', 'PRINCIPAL', 'ADMIN'] as InstitutionalRole[]).map((role) => (
              <button
                key={role}
                type="button"
                role="tab"
                aria-selected={activeRole === role}
                className={`role-tab-btn ${activeRole === role ? 'is-active' : ''}`}
                onClick={() => setActiveRole(role)}
              >
                <i className={`bi ${
                  role === 'FACULTY' ? 'bi-person' :
                  role === 'HOD' ? 'bi-diagram-3' :
                  role === 'DEAN' ? 'bi-mortarboard' :
                  role === 'PRINCIPAL' ? 'bi-bank' : 'bi-shield-lock'
                }`} aria-hidden="true" />
                <span>{role}</span>
              </button>
            ))}
          </div>

          {/* Role Details Panel */}
          <div className="role-detail-panel">
            <div className="role-detail-left">
              <h3>
                {activeRole === 'FACULTY' && 'Faculty Member Workspace'}
                {activeRole === 'HOD' && 'Head of Department (HOD) Console'}
                {activeRole === 'DEAN' && 'Dean Academic & Research Governance'}
                {activeRole === 'PRINCIPAL' && 'Principal Executive Oversight'}
                {activeRole === 'ADMIN' && 'System Administrator Portal'}
              </h3>

              <div className="role-detail-quote">
                {activeRole === 'FACULTY' && '"Manage your academic, research and professional record with complete transparency."'}
                {activeRole === 'HOD' && (FEATURES.TEACHING
                  ? '"Coordinate department faculty, workload, approvals and academic activities efficiently."'
                  : '"Coordinate department faculty, approvals and academic activities efficiently."')}
                {activeRole === 'DEAN' && '"Monitor academic and research performance across authorized departments and schools."'}
                {activeRole === 'PRINCIPAL' && '"Gain institution-wide visibility into faculty, academics, research and institutional ranking."'}
                {activeRole === 'ADMIN' && '"Manage users, institutional configuration, permissions, security and system governance."'}
              </div>

              <p className="role-detail-desc">
                {activeRole === 'FACULTY' && 'Faculty maintain their living digital dossier. Submit research publications, patent records, course completion metrics, student project mentorships, and leave requests for formal departmental verification.'}
                {activeRole === 'HOD' && (FEATURES.TEACHING
                  ? 'Department leaders manage subject allocation, timetable balancing, classroom substitutions, and review submissions from department faculty members before institutional endorsement.'
                  : 'Department leaders review submissions, attendance and leave requests from department faculty members before institutional endorsement.')}
                {activeRole === 'DEAN' && (FEATURES.TEACHING ? 'Academic leadership evaluates cross-departmental curriculum progress, research publication output benchmarks, sponsored funding portfolios, and accreditation criteria data compilation.' : 'Academic leadership evaluates research publication output benchmarks, sponsored funding portfolios, and accreditation criteria data compilation across departments.')}
                {activeRole === 'PRINCIPAL' && 'The executive authority accesses macroeconomic dashboards, institutional KPIs, department rankings, faculty retention analytics, and authorized regulatory report generation.'}
                {activeRole === 'ADMIN' && 'Central IT Services manages user provisioning, employee ID bindings, role-based permissions (RBAC), academic year lifecycle initialization, and security audit log monitoring.'}
              </p>

              <ul className="role-features-list">
                {activeRole === 'FACULTY' && (
                  <>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Personal digital dossier &amp; verifiable credential management</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> {FEATURES.TEACHING ? 'Real-time weekly contact workload tracker with threshold alerts' : 'Research, patent & activity submissions with verification tracking'}</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Self-appraisal submission &amp; performance feedback tracking</li>
                  </>
                )}
                {activeRole === 'HOD' && (
                  <>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> {FEATURES.TEACHING ? 'Subject assignment & section conflict-free allocation' : 'Department attendance & leave approvals'}</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Department verification queue for papers, patents &amp; activities</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> {FEATURES.TEACHING ? 'Workload distribution balancing across junior and senior staff' : 'Faculty roster with research & verification overview'}</li>
                  </>
                )}
                {activeRole === 'DEAN' && (
                  <>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Cross-department performance comparison &amp; benchmarking</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Research output monitoring (Scopus/WoS metrics &amp; grant totals)</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Institutional NAAC &amp; NBA criterion audit preparation</li>
                  </>
                )}
                {activeRole === 'PRINCIPAL' && (
                  <>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Institution-wide executive KPI cards and trend visualizations</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> {FEATURES.TEACHING ? 'Department rankings based on research, teaching & grants' : 'Department rankings based on research & grants'}</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> One-click official statutory compliance report authorization</li>
                  </>
                )}
                {activeRole === 'ADMIN' && (
                  <>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> User account lifecycle provisioning &amp; role assignment</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> Department and designation master schema configuration</li>
                    <li><i className="bi bi-check-circle-fill" aria-hidden="true" /> System-wide immutable security audit log review</li>
                  </>
                )}
              </ul>
            </div>

            {/* Right: Functional Role Preview Box */}
            <div className="role-preview-box">
              <div className="role-preview-header">
                <h5>Authorized Modules for {activeRole}</h5>
                <span className="badge-pill-status">Role-Protected</span>
              </div>

              <div className="role-module-chips">
                {activeRole === 'FACULTY' && (
                  <>
                    <div className="role-module-chip">
                      <span><i className="bi bi-person me-2 text-primary" />Faculty Profile &amp; Dossier</span>
                      <span className="text-success">&bull; Full Access</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-calendar-week me-2 text-primary" />{FEATURES.TEACHING ? 'Timetable & Workload' : 'Attendance & Leave'}</span>
                      <span className="text-success">&bull; {FEATURES.TEACHING ? 'View / Track' : 'Apply / Track'}</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-journal-text me-2 text-primary" />Publications &amp; Patents</span>
                      <span className="text-success">&bull; Submit / Edit</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-card-checklist me-2 text-primary" />Annual Appraisal (API)</span>
                      <span className="text-success">&bull; Self-Appraisal</span>
                    </div>
                  </>
                )}

                {activeRole === 'HOD' && (
                  <>
                    <div className="role-module-chip">
                      <span><i className="bi bi-check2-square me-2 text-primary" />Department Approval Queue</span>
                      <span className="text-success">&bull; Review &amp; Sign</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-diagram-3 me-2 text-primary" />{FEATURES.TEACHING ? 'Subject Allocation Console' : 'Department Console'}</span>
                      <span className="text-success">&bull; {FEATURES.TEACHING ? 'Manage Mapping' : 'Department-Wide'}</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-people me-2 text-primary" />{FEATURES.TEACHING ? 'Faculty Workload Monitor' : 'Attendance & Leave Approvals'}</span>
                      <span className="text-success">&bull; {FEATURES.TEACHING ? 'Department-Wide' : 'Tier-1 Approve'}</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-graph-up me-2 text-primary" />Appraisal Review</span>
                      <span className="text-success">&bull; HOD Verification</span>
                    </div>
                  </>
                )}

                {activeRole === 'DEAN' && (
                  <>
                    <div className="role-module-chip">
                      <span><i className="bi bi-bar-chart me-2 text-primary" />Dean Academic Console</span>
                      <span className="text-success">&bull; Institutional</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-pie-chart me-2 text-primary" />Research &amp; Grant Analytics</span>
                      <span className="text-success">&bull; Cross-Dept</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-file-earmark-bar-graph me-2 text-primary" />Accreditation Dossiers</span>
                      <span className="text-success">&bull; NAAC / NBA</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-arrow-left-right me-2 text-primary" />Faculty Comparison</span>
                      <span className="text-success">&bull; Benchmarking</span>
                    </div>
                  </>
                )}

                {activeRole === 'PRINCIPAL' && (
                  <>
                    <div className="role-module-chip">
                      <span><i className="bi bi-speedometer me-2 text-primary" />Executive KPI Dashboard</span>
                      <span className="text-success">&bull; Executive View</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-trophy me-2 text-primary" />Department Ranking Index</span>
                      <span className="text-success">&bull; Institutional</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-shield-check me-2 text-primary" />Statutory Compliance Reports</span>
                      <span className="text-success">&bull; Full Authority</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-file-pdf me-2 text-primary" />NIRF Data Dossiers</span>
                      <span className="text-success">&bull; Export &amp; Certify</span>
                    </div>
                  </>
                )}

                {activeRole === 'ADMIN' && (
                  <>
                    <div className="role-module-chip">
                      <span><i className="bi bi-person-gear me-2 text-primary" />User &amp; Account Provisioning</span>
                      <span className="text-success">&bull; Full Admin</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-key me-2 text-primary" />Role-Based Permissions (RBAC)</span>
                      <span className="text-success">&bull; Policy Guard</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-journal-code me-2 text-primary" />System Audit Log Stream</span>
                      <span className="text-success">&bull; Immutable Log</span>
                    </div>
                    <div className="role-module-chip">
                      <span><i className="bi bi-calendar3 me-2 text-primary" />Academic Year Cycles</span>
                      <span className="text-success">&bull; Master Config</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 8 — WORKFLOW
          ======================================================== */}
      <section className="home-section home-section-alt" id="workflow" aria-label="Institutional Review Lifecycle">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Institutional Verification</span>
            <h2 className="section-title">
              From Submission to Verification
            </h2>
            <p className="section-subtitle">
              Every scholarly record, patent claim, and professional activity progresses through transparent, verifiable quality gates.
            </p>
          </div>

          {/* Linear Progression Track */}
          <div className="workflow-linear-track">
            <div className="workflow-node">
              <span className="workflow-node-badge" style={{ background: '#F1F5F9', color: '#475569' }}>Step 1</span>
              <h5>DRAFT</h5>
              <p>Faculty creates entry and attaches evidentiary document</p>
            </div>

            <div className="workflow-node">
              <span className="workflow-node-badge" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>Step 2</span>
              <h5>SUBMITTED</h5>
              <p>Entry locked and routed to departmental verification queue</p>
            </div>

            <div className="workflow-node">
              <span className="workflow-node-badge" style={{ background: '#FEF3C7', color: '#B45309' }}>Step 3</span>
              <h5>UNDER REVIEW</h5>
              <p>HOD / Department Coordinator inspects source documentation</p>
            </div>

            <div className="workflow-node">
              <span className="workflow-node-badge" style={{ background: '#F0FDF4', color: '#0F766E' }}>Step 4</span>
              <h5>VERIFIED</h5>
              <p>Approved and authenticated for institutional accreditation</p>
            </div>

            <div className="workflow-node">
              <span className="workflow-node-badge" style={{ background: '#F8FAFC', color: '#0F172A' }}>Step 5</span>
              <h5>FINAL / ARCHIVED</h5>
              <p>Integrated into institutional dossiers (NAAC / NBA / NIRF)</p>
            </div>
          </div>

          {/* Feedback & Rejection Branches */}
          <div className="workflow-branches-grid">
            <div className="workflow-branch-card is-return">
              <i className="bi bi-arrow-return-left text-warning fs-4" aria-hidden="true" />
              <div>
                <h5 className="text-warning">Returned for Correction</h5>
                <p>
                  Reviewer provides mandatory feedback explaining deficiencies. The record unlocks for the faculty member to amend details or replace attachments before resubmitting.
                </p>
              </div>
            </div>

            <div className="workflow-branch-card is-reject">
              <i className="bi bi-x-circle text-danger fs-4" aria-hidden="true" />
              <div>
                <h5 className="text-danger">Rejected</h5>
                <p>
                  If an entry does not satisfy statutory or institutional guidelines, it is formally rejected with documented justification and archived in the immutable audit log.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 9 — INSTITUTIONAL INTELLIGENCE
          ======================================================== */}
      <section className="home-section" id="intelligence" aria-label="Institutional Intelligence & Reporting">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Accreditation &amp; Insights</span>
            <h2 className="section-title">
              From Faculty Records to Institutional Insight
            </h2>
            <p className="section-subtitle">
              Verified faculty records synthesize automatically into high-level institutional intelligence for statutory accreditation.
            </p>
          </div>

          {/* Macro KPI Cards */}
          <div className="analytics-preview-grid">
            {FEATURES.TEACHING && (
              <div className="analytics-stat-box">
                <div className="stat-label">Academic Load Index</div>
                <div className="stat-number">100%</div>
                <p className="stat-desc">Faculty workload adhering to AICTE contact ceilings</p>
              </div>
            )}

            <div className="analytics-stat-box">
              <div className="stat-label">Research Productivity</div>
              <div className="stat-number">18 Formats</div>
              <p className="stat-desc">Statutory NAAC, NBA &amp; NIRF reports ready for generation</p>
            </div>

            <div className="analytics-stat-box">
              <div className="stat-label">Verification Rate</div>
              <div className="stat-number">98.2%</div>
              <p className="stat-desc">Departmental review queue compliance within SLA</p>
            </div>

            <div className="analytics-stat-box">
              <div className="stat-label">Audit Readiness</div>
              <div className="stat-number">Continuous</div>
              <p className="stat-desc">Evidentiary documents linked with source timestamps</p>
            </div>
          </div>

          {/* Conceptual Departmental Benchmark Breakdown */}
          <div className="analytics-breakdown-card">
            <h4>Departmental Accreditation Benchmark Comparison (Indicative Institutional Model)</h4>
            <div className="analytics-bars-list">
              <div className="analytics-bar-item">
                <div className="analytics-bar-header">
                  <span>Computer Science &amp; Engineering (CSE)</span>
                  <span>96.4% Compliance Score</span>
                </div>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill" style={{ width: '96.4%' }} />
                </div>
              </div>

              <div className="analytics-bar-item">
                <div className="analytics-bar-header">
                  <span>Electronics &amp; Communication Engineering (ECE)</span>
                  <span>94.1% Compliance Score</span>
                </div>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill" style={{ width: '94.1%' }} />
                </div>
              </div>

              <div className="analytics-bar-item">
                <div className="analytics-bar-header">
                  <span>Mechanical Engineering (MECH)</span>
                  <span>91.8% Compliance Score</span>
                </div>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill" style={{ width: '91.8%' }} />
                </div>
              </div>

              <div className="analytics-bar-item">
                <div className="analytics-bar-header">
                  <span>Artificial Intelligence &amp; Data Science (AI&amp;DS)</span>
                  <span>95.0% Compliance Score</span>
                </div>
                <div className="analytics-bar-track">
                  <div className="analytics-bar-fill" style={{ width: '95.0%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 10 — SECURITY & GOVERNANCE
          ======================================================== */}
      <section className="home-section home-section-alt" id="governance" aria-label="Security and Governance">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Enterprise Security</span>
            <h2 className="section-title">
              Built for Institutional Governance
            </h2>
            <p className="section-subtitle">
              Engineered to meet the stringent data governance, cybersecurity, and confidentiality standards expected by top engineering universities.
            </p>
          </div>

          <div className="security-grid">
            <div className="security-card">
              <div className="security-card-icon">
                <i className="bi bi-shield-lock" aria-hidden="true" />
              </div>
              <h4>Role-Based Access (RBAC)</h4>
              <p>Strict role isolation guarantees faculty, HODs, Deans, and Principals only view and modify authorized records.</p>
            </div>

            <div className="security-card">
              <div className="security-card-icon">
                <i className="bi bi-key" aria-hidden="true" />
              </div>
              <h4>Secure Authentication</h4>
              <p>Encrypted credentials, HTTP-only secure cookie sessions, and automatic expiration defense against unauthorized access.</p>
            </div>

            <div className="security-card">
              <div className="security-card-icon">
                <i className="bi bi-file-earmark-lock" aria-hidden="true" />
              </div>
              <h4>Private Document Vault</h4>
              <p>Protected evidentiary document storage preventing direct URL scraping or unauthorized downloads.</p>
            </div>

            <div className="security-card">
              <div className="security-card-icon">
                <i className="bi bi-journal-check" aria-hidden="true" />
              </div>
              <h4>Immutable Audit History</h4>
              <p>Every approval, rejection, modification, and credential update is recorded with actor ID, timestamp, and IP address.</p>
            </div>

            <div className="security-card">
              <div className="security-card-icon">
                <i className="bi bi-patch-check" aria-hidden="true" />
              </div>
              <h4>Verification Workflows</h4>
              <p>Mandatory reviewer sign-off prevents unverified achievements from contaminating official accreditation submissions.</p>
            </div>

            <div className="security-card">
              <div className="security-card-icon">
                <i className="bi bi-database-check" aria-hidden="true" />
              </div>
              <h4>Institutional Data Sovereignty</h4>
              <p>All institutional data and intellectual property remains exclusively governed under university ownership policies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 11 — RESPONSIVE & ACCESSIBILITY
          ======================================================== */}
      <section className="home-section" id="accessibility" aria-label="Cross-Device Responsiveness and Accessibility">
        <div className="home-container">
          <div className="section-header">
            <span className="section-label">Universal Access</span>
            <h2 className="section-title">
              Engineered for Every Screen &amp; User
            </h2>
            <p className="section-subtitle">
              Access institutional records securely from office workstations, campus lecture halls, or mobile devices during travel.
            </p>
          </div>

          <div className="devices-grid">
            <div className="device-card">
              <i className="bi bi-display device-icon" aria-hidden="true" />
              <h4>Desktop Workstations</h4>
              <div className="device-res">1440px &ndash; 1920px+</div>
              <p>High-density multi-column management with expanded sidebars and advanced data tables.</p>
            </div>

            <div className="device-card">
              <i className="bi bi-laptop device-icon" aria-hidden="true" />
              <h4>Faculty Laptops</h4>
              <div className="device-res">1024px &ndash; 1366px</div>
              <p>Optimized viewport scaling with collapsible sidebars and sticky navigation tools.</p>
            </div>

            <div className="device-card">
              <i className="bi bi-tablet device-icon" aria-hidden="true" />
              <h4>Tablets &amp; iPads</h4>
              <div className="device-res">768px &ndash; 1024px</div>
              <p>Fluid responsive grids and touch-friendly targets for rapid departmental reviews.</p>
            </div>

            <div className="device-card">
              <i className="bi bi-phone device-icon" aria-hidden="true" />
              <h4>Mobile Devices</h4>
              <div className="device-res">320px &ndash; 480px</div>
              <p>Stacked layouts with touch navigation, zero horizontal overflow, and full WCAG AA contrast.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 12 — FINAL CALL TO ACTION
          ======================================================== */}
      <section className="final-cta-section" aria-label="Get Started with KPRIET FMS">
        <div className="home-container">
          <div className="final-cta-content">
            <div className="final-cta-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <img
                src="/images/kpriet-favicon.png"
                alt="KPRIET"
                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
              />
              <span>Official Institutional Portal &bull; KPRIET</span>
            </div>

            <h2 className="final-cta-title">
              One Connected Faculty Management System
            </h2>

            <p className="final-cta-desc">
              Bring academic, research, {FEATURES.TEACHING ? 'workload, ' : ''}performance and institutional records together in one professional platform.
            </p>

            <div>
              <Link to={ROUTES.LOGIN} className="final-cta-btn">
                <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                <span>Sign In to Faculty Management System</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
