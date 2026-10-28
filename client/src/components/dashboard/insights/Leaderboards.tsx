import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { dashboardService, type LeaderboardData, type LeaderboardMetric } from '../../../services/dashboard.service';
import { useAcademicYears } from '../../../hooks/useAcademicYears';
import { useAuthStore } from '../../../stores/authStore';
import { formatErrorMessage } from '../../../utils/errorHandler';
import { ROUTES } from '../../../constants/routes';
import { ChartCard, CHART_COLORS } from '../../charts';

type Tab = LeaderboardMetric | 'overall';

const TABS: { key: Tab; label: string; unit: string }[] = [
  { key: 'overall', label: 'Overall', unit: 'points' },
  { key: 'publications', label: 'Publications', unit: 'papers' },
  { key: 'projects', label: 'Projects', unit: 'projects' },
  { key: 'funding', label: 'Funding', unit: '' },
  { key: 'patents', label: 'Patents', unit: 'patents' },
  { key: 'fdp', label: 'FDPs', unit: 'FDP / STTP' },
  { key: 'activities', label: 'Activities', unit: 'activities' },
];
const METRICS: LeaderboardMetric[] = ['publications', 'projects', 'funding', 'patents', 'fdp', 'activities'];
const SHORT: Record<LeaderboardMetric, string> = { publications: 'pubs', projects: 'projects', funding: 'funding units', patents: 'patents', fdp: 'FDPs', activities: 'activities' };

const inr = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(1)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : `₹${n.toLocaleString('en-IN')}`;

/** Small grey note beside a person's value, e.g. "4 in Q1/Q2 · 112 citations". */
function detailText(metric: LeaderboardMetric, d: Record<string, number>, count: number) {
  switch (metric) {
    case 'publications':
      return `${d.q1q2 ?? 0} in Q1/Q2 · ${d.citations ?? 0} citations`;
    case 'projects':
      return d.amount ? `${inr(d.amount)} sanctioned` : 'Funded';
    case 'funding':
      return `${d.projects ?? count} funded project${(d.projects ?? count) === 1 ? '' : 's'}`;
    case 'patents':
      return `${d.granted ?? 0} granted`;
    default:
      return `${count} verified`;
  }
}
const components = (c: Record<LeaderboardMetric, number>) =>
  METRICS.filter((m) => c[m]).map((m) => `${c[m]} ${SHORT[m]}`).join(' · ');

const profileLink = (facultyId: string) => ROUTES.FACULTY_VIEW.replace(':facultyId', facultyId);

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => (
  <span className={`lb-rank${rank <= 3 ? ` lb-rank-${rank}` : ''}`} aria-label={`Rank ${rank}`}>
    {rank}
  </span>
);

/** How the ranking is calculated, what is waiting, and (for Admin/Principal) the versioned weights. */
const Methodology: React.FC<{ data: LeaderboardData }> = ({ data }) => {
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'PRINCIPAL';
  const m = data.methodology;
  const waiting = METRICS.filter((k) => data.awaitingVerification[k]).map((k) => `${data.awaitingVerification[k]} ${SHORT[k]}`);
  const [editing, setEditing] = useState(false);
  return (
    <details className="lb-method">
      <summary>
        <i className="bi bi-info-circle" aria-hidden="true" /> How these rankings are calculated
        <span className="lb-sub">
          {' '}
          · configuration {m.config.source === 'default' ? 'defaults (no version saved yet)' : `v${m.config.version}`}, {m.config.appliesTo}
        </span>
      </summary>
      <div className="lb-method-body">
        <p>
          <strong>Overall score</strong> <code>{m.formula}</code>
        </p>
        <table className="lb-weight-table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Points each</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((k) => (
              <tr key={k}>
                <td>{m.categories[k]}</td>
                <td className="num">
                  {m.weights[k]}
                  {k === 'funding' ? ` per ${inr(m.fundingUnit)}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul>
          {m.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="lb-sub">
          {waiting.length ? `Not counted yet, awaiting verification for ${data.academicYear}: ${waiting.join(' · ')}.` : `Nothing for ${data.academicYear} is awaiting verification.`}
          {m.config.createdByName ? ` Weights set by ${m.config.createdByName}${m.config.note ? ` — “${m.config.note}”` : ''}.` : ''}
        </p>
        {canEdit && !editing && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(true)}>
            Change weights
          </button>
        )}
        {canEdit && editing && <ConfigEditor academicYear={data.academicYear} onClose={() => setEditing(false)} />}
      </div>
    </details>
  );
};

const ConfigEditor: React.FC<{ academicYear: string; onClose: () => void }> = ({ academicYear, onClose }) => {
  const queryClient = useQueryClient();
  const cfg = useQuery({ queryKey: ['ranking-config', academicYear], queryFn: () => dashboardService.getRankingConfig(academicYear) });
  const [form, setForm] = useState<null | { weights: Record<LeaderboardMetric, number>; fundingUnit: number; risingMinPrevious: number; scope: 'all' | 'year'; effectiveFrom: string; note: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const active = cfg.data?.active;
  const f = form ?? (active ? { weights: active.weights, fundingUnit: active.fundingUnit, risingMinPrevious: active.risingMinPrevious, scope: 'all' as const, effectiveFrom: '', note: '' } : null);
  const save = useMutation({
    mutationFn: () =>
      dashboardService.saveRankingConfig({
        academicYear: f!.scope === 'year' ? academicYear : null,
        effectiveFrom: f!.effectiveFrom || undefined,
        weights: f!.weights,
        fundingUnit: f!.fundingUnit,
        risingMinPrevious: f!.risingMinPrevious,
        note: f!.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboards'] });
      queryClient.invalidateQueries({ queryKey: ['ranking-config'] });
      onClose();
    },
    onError: (e) => setError(formatErrorMessage(e, 'The configuration could not be saved.')),
  });
  if (!f) return <p className="lb-note">Loading configuration…</p>;
  const set = (patch: Partial<typeof f>) => setForm({ ...f, ...patch });
  return (
    <div className="lb-config">
      <div className="lb-config-grid">
        {METRICS.map((k) => (
          <label key={k}>
            <span>{k === 'funding' ? 'Funding (per unit)' : k[0].toUpperCase() + k.slice(1)}</span>
            <input type="number" min={0} max={20} step={0.5} className="form-control form-control-sm" value={f.weights[k]} onChange={(e) => set({ weights: { ...f.weights, [k]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) } })} />
          </label>
        ))}
        <label>
          <span>Funding unit (₹)</span>
          <input type="number" min={1000} step={1000} className="form-control form-control-sm" value={f.fundingUnit} onChange={(e) => set({ fundingUnit: Number(e.target.value) || 100000 })} />
        </label>
        <label>
          <span>Rising: earlier records needed</span>
          <input type="number" min={1} max={50} className="form-control form-control-sm" value={f.risingMinPrevious} onChange={(e) => set({ risingMinPrevious: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        <label>
          <span>Applies to</span>
          <select className="form-select form-select-sm" value={f.scope} onChange={(e) => set({ scope: e.target.value as 'all' | 'year' })}>
            <option value="all">Every academic year</option>
            <option value="year">Only {academicYear}</option>
          </select>
        </label>
        <label>
          <span>Effective from</span>
          <input type="date" className="form-control form-control-sm" value={f.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} />
        </label>
      </div>
      <label className="lb-config-note">
        <span>Reason for the change</span>
        <input className="form-control form-control-sm" maxLength={500} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Board decision of 12 Oct" />
      </label>
      {error && <p className="lb-error" role="alert">{error}</p>}
      <div className="lb-config-actions">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save as new version'}
        </button>
      </div>
      {(cfg.data?.history.length ?? 0) > 0 && (
        <details className="lb-history">
          <summary>History ({cfg.data!.history.length} versions)</summary>
          <ol>
            {cfg.data!.history.map((h) => (
              <li key={h.version}>
                v{h.version} · {h.academicYear ?? 'all years'} · from {h.effectiveFrom ? new Date(h.effectiveFrom).toLocaleDateString() : '—'} · {METRICS.map((k) => `${SHORT[k]} ${h.weights[k]}`).join(', ')}
                {h.createdByName ? ` · ${h.createdByName}` : ''}
                {h.note ? ` — ${h.note}` : ''}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
};

/**
 * Rankings for the Principal and Dean dashboards: overall and per-category top faculty, department
 * ranking with the "department of the year", and comparable-period risers. Verified records only.
 */
export const Leaderboards: React.FC = () => {
  const { years } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [tab, setTab] = useState<Tab>('overall');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leaderboards', academicYear, departmentId, designation],
    queryFn: () => dashboardService.getLeaderboards({ academicYear, departmentId, designation }),
    placeholderData: keepPreviousData,
  });

  if (isError) {
    return <p className="lb-note">Leaderboards could not be loaded. Refresh the page to try again.</p>;
  }
  if (isLoading || !data) {
    return <p className="lb-note">Loading leaderboards…</p>;
  }

  const tabInfo = TABS.find((t) => t.key === tab)!;
  const rows =
    tab === 'overall'
      ? data.overall.map((r) => ({ ...r, value: r.score, sub: components(r.components) }))
      : data.faculty[tab].map((r) => ({ ...r, sub: detailText(tab, r.details, r.count) }));
  const top = rows[0]?.value ?? 0;
  const maxScore = data.departments[0]?.score ?? 0;
  const deptFilterName = data.departmentOptions.find((d) => d.id === departmentId)?.code;
  const yearOptions = years.length ? years : [data.academicYear];
  const dy = data.departmentOfTheYear;
  const valueText = (v: number) => (tab === 'funding' ? inr(v * data.methodology.fundingUnit) : String(v));

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
        <label>
          <span>Designation</span>
          <select className="form-select form-select-sm" value={designation} onChange={(e) => setDesignation(e.target.value)}>
            <option value="">All designations</option>
            {data.designationOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <span className="lb-fair">
          <i className="bi bi-patch-check" aria-hidden="true" /> Verified records only
        </span>
      </div>

      {dy ? (
        <div className="lb-hero">
          <i className="bi bi-trophy-fill lb-hero-icon" aria-hidden="true" />
          <div className="lb-hero-text">
            <span className="lb-hero-kicker">Department of the year · {data.academicYear}</span>
            <strong>{dy.name}</strong>
            <span className="lb-hero-meta">
              {METRICS.filter((k) => dy.counts[k]).map((k) => `${k === 'funding' ? inr(dy.counts[k] * data.methodology.fundingUnit) : dy.counts[k]} ${k === 'funding' ? 'sanctioned' : SHORT[k]} (${dy.points[k]} pts)`).join(' · ')}
            </span>
          </div>
          <div className="lb-hero-score">
            <span>{dy.score}</span>
            <small>points</small>
          </div>
        </div>
      ) : (
        <p className="lb-note">
          {data.departmentOfTheYearTie.length
            ? `${data.departmentOfTheYearTie.join(' and ')} share the top score for ${data.academicYear}, so no single department of the year is named.`
            : `No verified records for ${data.academicYear} yet, so there is no department of the year.`}
        </p>
      )}

      <div className="insights-grid insights-grid-3">
        <ChartCard
          className="span-2 lb-card"
          title={`Top faculty${deptFilterName ? ` in ${deptFilterName}` : ''}${designation ? ` · ${designation}` : ''}`}
          subtitle={`${data.academicYear} · click a name to open the profile`}
          height="auto"
          action={
            <div className="lb-tabs" role="tablist" aria-label="Ranking category">
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className="lb-note">No verified records in this category for this selection yet.</p>
          ) : (
            <ol className="lb-list">
              {rows.map((r) => (
                <li key={r.facultyId}>
                  <Link to={profileLink(r.facultyId)} className="lb-row">
                    <RankBadge rank={r.rank} />
                    <span className="lb-person">
                      <span className="lb-name">{r.name}</span>
                      <span className="lb-sub">
                        {[r.designation, r.department].filter(Boolean).join(' · ')} — {r.sub}
                      </span>
                      <span className="lb-bar" aria-hidden="true">
                        <span style={{ width: `${top ? (r.value / top) * 100 : 0}%` }} />
                      </span>
                    </span>
                    <span className="lb-count">
                      {valueText(r.value)}
                      {tabInfo.unit && <small>{tabInfo.unit}</small>}
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
                  <li key={d.departmentId} className="lb-row lb-row-static" title={METRICS.map((k) => `${SHORT[k]}: ${d.counts[k]} → ${d.points[k]} pts`).join('\n')}>
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
          </ChartCard>

          <ChartCard title="Rising" subtitle={`${data.methodology.risingWindow.current} vs ${data.methodology.risingWindow.previous}`} height="auto">
            {data.rising.length === 0 ? (
              <p className="lb-note">Nobody with enough earlier verified records has improved on the comparable period yet.</p>
            ) : (
              <ol className="lb-list lb-list-compact">
                {data.rising.map((r) => (
                  <li key={r.facultyId}>
                    <Link to={profileLink(r.facultyId)} className="lb-row">
                      <span className="trend-chip is-up">+{r.change}</span>
                      <span className="lb-person">
                        <span className="lb-name">{r.name}</span>
                        <span className="lb-sub">{r.department} · {r.previous} → {r.current} points</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </ChartCard>
        </div>
      </div>

      <Methodology data={data} />
    </div>
  );
};
