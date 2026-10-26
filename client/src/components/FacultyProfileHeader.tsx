import React from 'react';
import type { FacultyProfile } from '../types/faculty';
import { Badge } from './Badge';
import { InstitutionName } from './InstitutionName';

interface FacultyProfileHeaderProps {
  profile: FacultyProfile;
  actions?: React.ReactNode;
}

export const FacultyProfileHeader: React.FC<FacultyProfileHeaderProps> = ({ profile, actions }) => {
  const [showAllMetrics, setShowAllMetrics] = React.useState(false);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div className="dossier-meta-stamp">
          <i className="bi bi-shield-check" aria-hidden="true" />
          <span><InstitutionName short fallback="Faculty" /> Faculty Dossier &bull; Official Employee Record</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Record Status: <strong style={{ color: 'var(--color-text)' }}>{profile.employment?.employmentType || 'REGULAR'}</strong>
        </div>
      </div>

      {/* Top Identity Row */}
      <div className="faculty-dossier-header-grid">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap', minWidth: 0 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 2 }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-primary)', margin: 0, wordBreak: 'break-word', letterSpacing: '-0.01em' }}>
                {profile.name}
              </h1>
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
                <Badge variant="neutral">Confirmed</Badge>
              )}
            </div>

            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              <strong style={{ color: 'var(--color-text)' }}>{profile.designation}</strong> &bull;{' '}
              <span>{profile.departmentId?.name || 'Department'}</span>{' '}
              {profile.departmentId?.code && (
                <span style={{ color: 'var(--color-text-muted)' }}>({profile.departmentId.code})</span>
              )}
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <span>
                <i className="bi bi-person-badge" style={{ marginRight: 4, color: 'var(--color-primary)' }} aria-hidden="true" />
                Emp ID: <strong style={{ color: 'var(--color-text)' }}>{profile.employeeId}</strong>
              </span>
              <span>
                <i className="bi bi-envelope" style={{ marginRight: 4, color: 'var(--color-primary)' }} aria-hidden="true" />
                <a href={`mailto:${profile.userId?.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {profile.userId?.email}
                </a>
              </span>
              {profile.basicInfo?.contactNumber && (
                <span>
                  <i className="bi bi-telephone" style={{ marginRight: 4, color: 'var(--color-primary)' }} aria-hidden="true" />
                  {profile.basicInfo.contactNumber}
                </span>
              )}
              {profile.employment?.joiningDate && (
                <span>
                  <i className="bi bi-calendar3" style={{ marginRight: 4, color: 'var(--color-primary)' }} aria-hidden="true" />
                  Joined: {new Date(profile.employment.joiningDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        {actions && <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>{actions}</div>}
      </div>

      {/* Prioritized Primary Metrics Strip (Clean & Focused) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)' }}>
          <div className="dossier-summary-tile">
            <span className="dossier-summary-tile-label">Experience</span>
            <span className="dossier-summary-tile-val">
              {teachingExpYears > 0 ? `${teachingExpYears.toFixed(1)}y` : '—'}
            </span>
          </div>

          <div className="dossier-summary-tile">
            <span className="dossier-summary-tile-label">Publications</span>
            <span className="dossier-summary-tile-val">{publicationsCount}</span>
          </div>

          <div className="dossier-summary-tile">
            <span className="dossier-summary-tile-label">Projects</span>
            <span className="dossier-summary-tile-val">{totalProjectsCount}</span>
          </div>

          <div className="dossier-summary-tile">
            <span className="dossier-summary-tile-label">Mentees</span>
            <span className="dossier-summary-tile-val">{studentsMentoredCount}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAllMetrics((prev) => !prev)}
            className="dossier-summary-tile"
            style={{
              cursor: 'pointer',
              border: '1px dashed var(--color-border)',
              background: 'transparent',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            title="Toggle additional scholarly metrics"
          >
            <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>
              {showAllMetrics ? 'Hide extra' : '+4 More'}
            </span>
            <i className={`bi ${showAllMetrics ? 'bi-chevron-up' : 'bi-chevron-down'}`} style={{ fontSize: '10px', color: 'var(--color-primary)' }} />
          </button>
        </div>

        {/* Secondary Metrics Row (Revealed seamlessly on demand) */}
        {showAllMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-2)', animation: 'fadeIn 180ms ease' }}>
            <div className="dossier-summary-tile">
              <span className="dossier-summary-tile-label">Funded Grants</span>
              <span className="dossier-summary-tile-val">{fundedProjectsCount}</span>
            </div>

            <div className="dossier-summary-tile">
              <span className="dossier-summary-tile-label">PhD Scholars</span>
              <span className="dossier-summary-tile-val">{phdScholarsCount}</span>
            </div>

            <div className="dossier-summary-tile">
              <span className="dossier-summary-tile-label">Conferences</span>
              <span className="dossier-summary-tile-val">{conferencesCount}</span>
            </div>

            <div className="dossier-summary-tile">
              <span className="dossier-summary-tile-label">Patents</span>
              <span className="dossier-summary-tile-val">{patentsCount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
