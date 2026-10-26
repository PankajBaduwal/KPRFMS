import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dashboardService, type LeaderboardMetric } from '../../../services/dashboard.service';
import { useAcademicYears } from '../../../hooks/useAcademicYears';
import { ROUTES } from '../../../constants/routes';
import { ChartCard, CHART_COLORS } from '../../charts';

const TABS: { key: LeaderboardMetric; label: string; unit: string }[] = [
  { key: 'publications', label: 'Publications', unit: 'papers' },
  { key: 'projects', label: 'Projects', unit: 'projects' },
  { key: 'patents', label: 'Patents', unit: 'patents' },
  { key: 'activities', label: 'FDPs & activities', unit: 'activities' },
];

const inr = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${n.toLocaleString('en-IN')}`;

/** Small grey note beside a person's count, e.g. "4 in Q1/Q2 · 112 citations". */
function detailText(metric: LeaderboardMetric, d: Record<string, number>) {
  switch (metric) {
    case 'publications':
      return `${d.q1q2 ?? 0} in Q1/Q2 · ${d.citations ?? 0} citations`;
    case 'projects':
      return d.amount ? `${inr(d.amount)} sanctioned` : 'Funded';
    case 'patents':
      return `${d.granted ?? 0} granted`;
    default:
      return `${d.fdps ?? 0} FDP / STTP`;
  }
}

const profileLink = (facultyId: string) => ROUTES.FACULTY_VIEW.replace(':facultyId', facultyId);

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => (
  <span className={`lb-rank${rank <= 3 ? ` lb-rank-${rank}` : ''}`} aria-label={`Rank ${rank}`}>
    {rank}
  </span>
);

/**
 * Leaderboards for the Principal and Dean dashboards: top faculty per metric, department
 * ranking with the "department of the year", and the fastest risers. Verified records only.
 */
export const Leaderboards: React.FC = () => {
  const { years } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [tab, setTab] = useState<LeaderboardMetric>('publications');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leaderboards', academicYear, departmentId],
    queryFn: () => dashboardService.getLeaderboards({ academicYear, departmentId }),
    placeholderData: keepPreviousData,
  });

  if (isError) {
    return <p className="lb-note">Leaderboards could not be loaded. Refresh the page to try again.</p>;
  }
  if (isLoading || !data) {
    return <p className="lb-note">Loading leaderboards…</p>;
  }

  const rows = data.faculty[tab];
  const top = rows[0]?.count ?? 0;
  const tabInfo = TABS.find((t) => t.key === tab)!;
  const maxScore = data.departments[0]?.score ?? 0;
  const deptFilterName = data.departmentOptions.find((d) => d.id === departmentId)?.code;
  const yearOptions = years.length ? years : [data.academicYear];

  return (
    <div className="lb">
      <div className="lb-filters">
        <label>
          <span>Year</span>
          <select className="form-select form-select-sm" value={academicYear || data.academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Department</span>
          <select className="form-select form-select-sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {data.departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
        </label>
        <span className="lb-fair">
          <i className="bi bi-patch-check" aria-hidden="true" /> Verified records only
        </span>
      </div>

      {data.departmentOfTheYear ? (
        <div className="lb-hero">
          <i className="bi bi-trophy-fill lb-hero-icon" aria-hidden="true" />
          <div className="lb-hero-text">
            <span className="lb-hero-kicker">Department of the year · {data.academicYear}</span>
            <strong>{data.departmentOfTheYear.name}</strong>
            <span className="lb-hero-meta">
              {data.departmentOfTheYear.counts.publications} publications · {data.departmentOfTheYear.counts.projects} funded projects ·{' '}
              {data.departmentOfTheYear.counts.patents} patents · {data.departmentOfTheYear.counts.activities} activities
            </span>
          </div>
          <div className="lb-hero-score">
            <span>{data.departmentOfTheYear.score}</span>
            <small>points</small>
          </div>
        </div>
      ) : (
        <p className="lb-note">No verified records for {data.academicYear} yet, so there is no department of the year.</p>
      )}

      <div className="insights-grid insights-grid-3">
        <ChartCard
          className="span-2 lb-card"
          title={`Top faculty${deptFilterName ? ` in ${deptFilterName}` : ''}`}
          subtitle={`${data.academicYear} · click a name to open the profile`}
          height="auto"
          action={
            <div className="lb-tabs" role="tablist" aria-label="Leaderboard metric">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={tab === t.key ? 'is-active' : ''}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className="lb-note">No verified {tabInfo.unit} for this selection yet.</p>
          ) : (
            <ol className="lb-list">
              {rows.map((r) => (
                <li key={r.facultyId}>
                  <Link to={profileLink(r.facultyId)} className="lb-row">
                    <RankBadge rank={r.rank} />
                    <span className="lb-person">
                      <span className="lb-name">{r.name}</span>
                      <span className="lb-sub">
                        {[r.designation, r.department].filter(Boolean).join(' · ')} — {detailText(tab, r.details)}
                      </span>
                      <span className="lb-bar" aria-hidden="true">
                        <span style={{ width: `${top ? (r.count / top) * 100 : 0}%` }} />
                      </span>
                    </span>
                    <span className="lb-count">
                      {r.count}
                      <small>{tabInfo.unit}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>

        <div className="lb-side">
          <ChartCard title="Department ranking" subtitle={`Weighted score, ${data.academicYear}`} height="auto">
            {data.departments.length === 0 ? (
              <p className="lb-note">No departments yet.</p>
            ) : (
              <ol className="lb-list lb-list-compact">
                {data.departments.map((d, i) => (
                  <li key={d.departmentId} className="lb-row lb-row-static" title={`${d.counts.publications} pubs · ${d.counts.projects} projects · ${d.counts.patents} patents · ${d.counts.activities} activities`}>
                    <RankBadge rank={d.rank} />
                    <span className="lb-person">
                      <span className="lb-name">{d.code}</span>
                      <span className="lb-bar" aria-hidden="true">
                        <span style={{ width: `${maxScore ? (d.score / maxScore) * 100 : 0}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </span>
                    </span>
                    <span className="lb-count">{d.score}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="lb-weights">
              Points: publication {data.weights.publications} · project {data.weights.projects} · patent {data.weights.patents} · activity{' '}
              {data.weights.activities}
            </p>
          </ChartCard>

          <ChartCard title="Rising" subtitle={`More publications than ${data.previousAcademicYear}`} height="auto">
            {data.rising.length === 0 ? (
              <p className="lb-note">Nobody has more verified publications than last year yet.</p>
            ) : (
              <ol className="lb-list lb-list-compact">
                {data.rising.map((r) => (
                  <li key={r.facultyId}>
                    <Link to={profileLink(r.facultyId)} className="lb-row">
                      <span className="trend-chip is-up">+{r.change}</span>
                      <span className="lb-person">
                        <span className="lb-name">{r.name}</span>
                        <span className="lb-sub">{r.department} · {r.previous} → {r.current}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

