import React from 'react';
import type { FacultyProfile } from '../types/faculty';
import { Badge } from './Badge';
import { InstitutionName } from './InstitutionName';

interface FacultyProfileHeaderProps {
  profile: FacultyProfile;
  actions?: React.ReactNode;
}

export const FacultyProfileHeader: React.FC<FacultyProfileHeaderProps> = ({ profile, actions }) => {
  // Compute metrics cleanly
  const publicationsCount = profile.publications?.length || 0;
  const fundedProjectsCount = profile.fundedProjects?.length || 0;
  const studentProjectsCount = profile.studentProjects?.length || 0;
  const totalProjectsCount = fundedProjectsCount + studentProjectsCount;
  const phdScholarsCount = profile.phdScholars?.length || 0;
  const studentsMentoredCount =
    profile.studentMentoring?.reduce((acc, curr) => acc + (curr.studentCount || 0), 0) || 0;
  const conferencesCount = profile.conferences?.length || 0;
  const patentsCount = profile.patents?.length || 0;
  const teachingExpYears =
    profile.totalTeachingExperienceYears ||
    profile.experience
      ?.filter((e) => e.roleType === 'TEACHING')
      .reduce((acc, curr) => acc + (curr.totalYears || 0), 0) ||
    0;

  const getVerificationBadgeVariant = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'success';
      case 'REJECTED':
        return 'danger';
      default:
        return 'warning';
    }
  };

  const getInitials = (name: string) => {
    return name
      .replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '')
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="faculty-dossier-card" role="region" aria-label="Faculty Dossier Summary">
      {/* Institutional Dossier Stamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <div className="dossier-meta-stamp">
          <i className="bi bi-shield-check" aria-hidden="true" />
          <span><InstitutionName short fallback="Faculty" /> Faculty Dossier &bull; Official Employee Record</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Record Status:{' '}
          <strong style={{ color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {profile.employment?.employmentType || 'REGULAR'}
          </strong>
        </div>
      </div>

      {/* Top Identity Row */}
      <div className="faculty-dossier-header-grid">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap', minWidth: 0, flex: '1 1 500px' }}>
          {/* Photo Frame */}
          <div className="faculty-photo-frame" title={`${profile.name} Photo`}>
            {profile.profilePhoto ? (
              <img
                src={profile.profilePhoto}
                alt={profile.name}
                loading="lazy"
                decoding="async"
              />
            ) : (
              getInitials(profile.name)
            )}
          </div>

          {/* Core Credentials */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-primary, #142B4A)', margin: 0, wordBreak: 'break-word', letterSpacing: '-0.02em' }}>
                {profile.name}
              </h1>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Badge
                  variant={getVerificationBadgeVariant(profile.verificationStatus)}
                  role="status"
                  aria-label={`Verification status: ${profile.verificationStatus}`}
                >
                  <i
                    className={`bi ${
                      profile.verificationStatus === 'VERIFIED'
                        ? 'bi-patch-check-fill'
                        : profile.verificationStatus === 'REJECTED'
                        ? 'bi-x-circle-fill'
                        : 'bi-hourglass-split'
                    }`}
                    aria-hidden="true"
                    style={{ marginRight: 4 }}
                  />
                  <span>{profile.verificationStatus}</span>
                </Badge>
                {profile.employment?.probationStatus === 'CONFIRMED' && (
                  <Badge variant="success">Confirmed</Badge>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary, #334155)', marginBottom: '6px', fontWeight: 500 }}>
              <strong style={{ color: 'var(--color-text, #172B45)' }}>{profile.designation}</strong> &bull;{' '}
              <span>{profile.departmentId?.name || 'Department'}</span>{' '}
              {profile.departmentId?.code && (
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>({profile.departmentId.code})</span>
              )}
            </div>

            {/* Structured Meta Coordinates Pills */}
            <div className="dossier-meta-pills">
              <span className="dossier-meta-pill" title="Employee ID">
                <i className="bi bi-person-badge" aria-hidden="true" />
                Emp ID: <strong>{profile.employeeId}</strong>
              </span>
              {profile.userId?.email && (
                <span className="dossier-meta-pill" title="Email Address">
                  <i className="bi bi-envelope" aria-hidden="true" />
                  <a href={`mailto:${profile.userId.email}`}>{profile.userId.email}</a>
                </span>
              )}
              {profile.basicInfo?.contactNumber && (
                <span className="dossier-meta-pill" title="Contact Number">
                  <i className="bi bi-telephone" aria-hidden="true" />
                  <span>{profile.basicInfo.contactNumber}</span>
                </span>
              )}
              {profile.employment?.joiningDate && (
                <span className="dossier-meta-pill" title="Institutional Joining Date">
                  <i className="bi bi-calendar3" aria-hidden="true" />
                  <span>Joined: {new Date(profile.employment.joiningDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        {actions && <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>{actions}</div>}
      </div>

      {/* Comprehensive 8-Dimensional Scholarly Metrics Strip */}
      <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
          <div className="dossier-summary-tile" title="Total Teaching Experience">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">Experience</span>
              <i className="bi bi-briefcase dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">
              {teachingExpYears > 0 ? `${teachingExpYears.toFixed(1)}y` : '—'}
            </span>
          </div>

          <div className="dossier-summary-tile" title="Verified Publications">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">Publications</span>
              <i className="bi bi-journal-bookmark dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">{publicationsCount}</span>
          </div>

          <div className="dossier-summary-tile" title="Funded and Student Research Projects">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">Projects</span>
              <i className="bi bi-folder2-open dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">{totalProjectsCount}</span>
          </div>

          <div className="dossier-summary-tile" title="Assigned Mentees">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">Mentees</span>
              <i className="bi bi-people dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">{studentsMentoredCount}</span>
          </div>

          <div className="dossier-summary-tile" title="Funded Research Grants">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">Funded Grants</span>
              <i className="bi bi-cash-stack dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">{fundedProjectsCount}</span>
          </div>

          <div className="dossier-summary-tile" title="Doctoral Scholars Supervised">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">PhD Scholars</span>
              <i className="bi bi-mortarboard dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">{phdScholarsCount}</span>
          </div>

          <div className="dossier-summary-tile" title="Conferences & Proceedings">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">Conferences</span>
              <i className="bi bi-megaphone dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">{conferencesCount}</span>
          </div>

          <div className="dossier-summary-tile" title="Patents & Intellectual Property">
            <div className="dossier-summary-tile-top">
              <span className="dossier-summary-tile-label">Patents</span>
              <i className="bi bi-lightbulb dossier-summary-tile-icon" aria-hidden="true" />
            </div>
            <span className="dossier-summary-tile-val">{patentsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
