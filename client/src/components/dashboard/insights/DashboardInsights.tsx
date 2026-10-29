import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AnimatedNumber,
  CHART_COLORS,
  ChartCard,
  ChartTooltip,
  FitChart,
  ProgressBar,
  QUARTILE_COLORS,
  humanize,
  useChartAnimation,
} from '../../charts';

// ------------------------------------------------------------------------------------------
// Types (match server/src/services/dashboard-charts.service.ts)
// ------------------------------------------------------------------------------------------

type YearRow = { year: string; academicYear: string } & Record<string, string | number>;
interface NameValue {
  name: string;
  value: number;
}

export interface FacultyCharts {
  publicationsByYear: YearRow[];
  activityMix: NameValue[];
  leaveBalance: { type: string; used: number; total: number; remaining: number }[];
  attendanceRate90d: number | null;
}

export interface HodCharts {
  publicationsByQuartile: YearRow[];
  attendanceTrend: { date: string; rate: number; present: number; total: number }[];
  facultyByDesignation: NameValue[];
  pendingByType: NameValue[];
}

export interface InstitutionCharts {
  researchTrend: { year: string; academicYear: string; publications: number; grantsLakhs: number }[];
  departmentComparison: { dept: string; publications: number; projects: number; activities: number; fdp: number }[];
  patentFunnel: { stage: string; value: number }[];
  attendanceRate30d: number | null;
  researchGrowthPercent: number | null;
  currentAcademicYear: string;
}

export interface AdminCharts {
  usersByStatus: NameValue[];
  usersByRole: NameValue[];
  signInsPerDay: { date: string; signIns: number; failed: number }[];
}

// ------------------------------------------------------------------------------------------
// Shared bits
// ------------------------------------------------------------------------------------------

const AXIS = { fontSize: 11, stroke: '#8A94A6', tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid vertical={false} stroke="#EEF1F5" />;
const CURSOR = { fill: 'rgba(27, 52, 95, 0.05)' };
const sum = (rows: Record<string, unknown>[], keys: string[]) =>
  rows.reduce((total, r) => total + keys.reduce((s, k) => s + (Number(r[k]) || 0), 0), 0);

/** Highlight the hovered category and fade the rest. */
function useHover() {
  const [active, setActive] = useState<number | null>(null);
  return {
    active,
    chartProps: {
      onMouseMove: (s: { activeTooltipIndex?: number | string | null }) =>
        setActive(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null),
      onMouseLeave: () => setActive(null),
    },
    opacity: (i: number) => (active === null || active === i ? 1 : 0.4),
  };
}

const Donut: React.FC<{ data: NameValue[]; centerLabel: string; colors?: string[] }> = ({ data, centerLabel, colors = CHART_COLORS }) => {
  const anim = useChartAnimation();
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="donut-layout">
      <div className="donut-chart">
        <FitChart>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              {...anim}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={colors[i % colors.length]} fillOpacity={active === null || active === i ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </FitChart>
        <div className="donut-center">
          <AnimatedNumber value={active !== null ? data[active]?.value ?? total : total} className="donut-center-value" />
          <span className="donut-center-label">{active !== null ? humanize(data[active]?.name ?? '') : centerLabel}</span>
        </div>
      </div>
      <ul className="donut-legend">
        {data.map((d, i) => (
          <li
            key={d.name}
            className={active === i ? 'is-active' : ''}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="donut-legend-dot" style={{ background: colors[i % colors.length] }} />
            <span className="donut-legend-name">{humanize(d.name)}</span>
            <strong>{d.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ------------------------------------------------------------------------------------------
// Faculty
// ------------------------------------------------------------------------------------------

/** Verified publications per academic year (last five), by type; used on the faculty dashboard. */
export const FacultyPublicationsChart: React.FC<{ rows: FacultyCharts['publicationsByYear'] }> = ({ rows }) => {
  const hover = useHover();
  const anim = useChartAnimation();
  const pubs = rows.map((r) => ({
    ...r,
    Journal: Number(r.JOURNAL || 0) + Number(r.REVIEW_PAPER || 0),
    Conference: Number(r.CONFERENCE || 0),
    'Book / chapter': Number(r.BOOK || 0) + Number(r.BOOK_CHAPTER || 0) + Number(r.EDITED_BOOK || 0),
    Other: Number(r.TECHNICAL_PAPER || 0) + Number(r.OTHER || 0),
  }));
  // Journal and Conference always shown (zero is a real value); other types only when present
  const series = ['Journal', 'Conference', 'Book / chapter', 'Other'].filter((k, i) => i < 2 || sum(pubs, [k]) > 0);
  return (
    <FitChart>
      <BarChart data={pubs} barCategoryGap="28%" {...hover.chartProps}>
        {GRID}
        <XAxis dataKey="year" {...AXIS} />
        <YAxis allowDecimals={false} width={28} {...AXIS} />
        <Tooltip cursor={CURSOR} content={<ChartTooltip labelPrefix="AY " />} />
        {series.map((k, si) => (
          <Bar key={k} dataKey={k} stackId="p" fill={CHART_COLORS[si]} radius={si === series.length - 1 ? [4, 4, 0, 0] : 0} {...anim} animationBegin={si * 120}>
            {pubs.map((_, i) => (
              <Cell key={i} fillOpacity={hover.opacity(i)} />
            ))}
          </Bar>
        ))}
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </BarChart>
    </FitChart>
  );
};

export const FacultyInsights: React.FC<{ charts?: FacultyCharts }> = ({ charts }) => {
  const hover = useHover();
  const anim = useChartAnimation();
  if (!charts) return null;

  const pubs = charts.publicationsByYear.map((r) => ({
    ...r,
    Journal: Number(r.JOURNAL || 0) + Number(r.REVIEW_PAPER || 0),
    Conference: Number(r.CONFERENCE || 0),
    'Book / chapter': Number(r.BOOK || 0) + Number(r.BOOK_CHAPTER || 0) + Number(r.EDITED_BOOK || 0),
    Other: Number(r.TECHNICAL_PAPER || 0) + Number(r.OTHER || 0),
  }));
  const series = ['Journal', 'Conference', 'Book / chapter', 'Other'].filter((k) => sum(pubs, [k]) > 0);

  return (
    <div className="insights-grid insights-grid-3">
      <ChartCard title="My publications" subtitle="Verified, last 5 academic years" empty={series.length === 0} emptyText="No verified publications yet.">
        <FitChart>
          <BarChart data={pubs} barCategoryGap="28%" {...hover.chartProps}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis allowDecimals={false} width={28} {...AXIS} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip labelPrefix="AY " />} />
            {series.map((k, si) => (
              <Bar key={k} dataKey={k} stackId="p" fill={CHART_COLORS[si]} radius={si === series.length - 1 ? [4, 4, 0, 0] : 0} {...anim} animationBegin={si * 120}>
                {pubs.map((_, i) => (
                  <Cell key={i} fillOpacity={hover.opacity(i)} />
                ))}
              </Bar>
            ))}
            {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          </BarChart>
        </FitChart>
      </ChartCard>

      <ChartCard title="Academic activities" subtitle="FDPs, workshops, conferences attended" empty={charts.activityMix.length === 0} emptyText="No activities recorded yet.">
        <Donut data={charts.activityMix} centerLabel="Total" />
      </ChartCard>

      <ChartCard
        title="Leave balance"
        subtitle={charts.attendanceRate90d !== null ? `Attendance (last 90 days): ${charts.attendanceRate90d}%` : 'This academic year'}
        empty={charts.leaveBalance.length === 0}
        emptyText="No leave balance set up for this year."
      >
        <div className="progress-list">
          {charts.leaveBalance.slice(0, 5).map((b, i) => (
            <ProgressBar
              key={b.type}
              label={humanize(b.type)}
              value={b.remaining}
              max={b.total}
              detail={`${b.remaining} of ${b.total} left`}
              color={CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))}
        </div>
      </ChartCard>
    </div>
  );
};

// ------------------------------------------------------------------------------------------
// HOD
// ------------------------------------------------------------------------------------------

export const HodInsights: React.FC<{ charts?: HodCharts | null }> = ({ charts }) => {
  const hover = useHover();
  const pendingHover = useHover();
  const anim = useChartAnimation();
  if (!charts) return null;

  const quartiles = ['Q1', 'Q2', 'Q3', 'Q4', 'NA'].filter((q) => sum(charts.publicationsByQuartile, [q]) > 0);
  const pending = charts.pendingByType.filter((p) => p.value > 0);
  const avgAttendance = charts.attendanceTrend.length
    ? Math.round((charts.attendanceTrend.reduce((s, d) => s + d.rate, 0) / charts.attendanceTrend.length) * 10) / 10
    : null;

  return (
    <div className="insights-grid insights-grid-2">
      <ChartCard title="Department publications" subtitle="Verified, by journal quartile" empty={quartiles.length === 0} emptyText="No verified publications yet.">
        <FitChart>
          <BarChart data={charts.publicationsByQuartile} barCategoryGap="30%" {...hover.chartProps}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis allowDecimals={false} width={28} {...AXIS} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip labelPrefix="AY " />} />
            {quartiles.map((q, qi) => (
              <Bar
                key={q}
                dataKey={q}
                name={q === 'NA' ? 'Not ranked' : q}
                stackId="q"
                fill={QUARTILE_COLORS[q]}
                radius={qi === quartiles.length - 1 ? [4, 4, 0, 0] : 0}
                {...anim}
                animationBegin={qi * 120}
              >
                {charts.publicationsByQuartile.map((_, i) => (
                  <Cell key={i} fillOpacity={hover.opacity(i)} />
                ))}
              </Bar>
            ))}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </FitChart>
      </ChartCard>

      <ChartCard
        title="Faculty attendance"
        subtitle={avgAttendance !== null ? `Last 30 days · average ${avgAttendance}%` : 'Last 30 days'}
        empty={charts.attendanceTrend.length === 0}
        emptyText="No attendance marked in the last 30 days."
      >
        <FitChart>
          <AreaChart data={charts.attendanceTrend}>
            <defs>
              <linearGradient id="hodAttendance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2F8F5B" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#2F8F5B" stopOpacity={0} />
              </linearGradient>
            </defs>
            {GRID}
            <XAxis dataKey="date" {...AXIS} minTickGap={24} />
            <YAxis domain={[0, 100]} width={34} unit="%" {...AXIS} />
            <Tooltip content={<ChartTooltip unit="%" />} />
            <Area type="monotone" dataKey="rate" name="Present" stroke="#2F8F5B" strokeWidth={2} fill="url(#hodAttendance)" activeDot={{ r: 4 }} {...anim} />
          </AreaChart>
        </FitChart>
      </ChartCard>

      <ChartCard title="Waiting for your review" subtitle="Pending items by type" empty={pending.length === 0} emptyText="Nothing pending. All caught up." height={220}>
        <FitChart>
          <BarChart data={pending} layout="vertical" margin={{ left: 8, right: 24 }} {...pendingHover.chartProps}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={92} {...AXIS} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip />} />
            <Bar dataKey="value" name="Pending" radius={[0, 4, 4, 0]} barSize={18} label={{ position: 'right', fontSize: 12, fill: '#1F2937' }} {...anim}>
              {pending.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={pendingHover.opacity(i)} />
              ))}
            </Bar>
          </BarChart>
        </FitChart>
      </ChartCard>

      <ChartCard title="Faculty by designation" empty={charts.facultyByDesignation.length === 0} height={220}>
        <Donut data={charts.facultyByDesignation} centerLabel="Faculty" />
      </ChartCard>
    </div>
  );
};

// ------------------------------------------------------------------------------------------
// Principal / Dean
// ------------------------------------------------------------------------------------------

export const InstitutionInsights: React.FC<{ charts?: InstitutionCharts; variant: 'principal' | 'dean' }> = ({ charts, variant }) => {
  const hover = useHover();
  const deptHover = useHover();
  const anim = useChartAnimation();
  if (!charts) return null;

  const hasTrend = charts.researchTrend.some((r) => r.publications || r.grantsLakhs);
  const depts = charts.departmentComparison.slice(0, 8);
  const funnelMax = Math.max(1, ...charts.patentFunnel.map((p) => p.value));

  const principal = variant === 'principal';
  return (
    <div className={`insights-grid ${principal ? 'insights-grid-3' : 'insights-grid-2'}`}>
      <ChartCard
        className={principal ? 'span-2' : ''}
        title="Research output"
        subtitle="Verified publications and sanctioned grants (₹ lakh)"
        empty={!hasTrend}
        action={
          charts.researchGrowthPercent !== null ? (
            <span className={`trend-chip ${charts.researchGrowthPercent >= 0 ? 'is-up' : 'is-down'}`}>
              <i className={`bi ${charts.researchGrowthPercent >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}`} />
              {Math.abs(charts.researchGrowthPercent)}% vs last year
            </span>
          ) : undefined
        }
      >
        <FitChart>
          <ComposedChart data={charts.researchTrend} {...hover.chartProps}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis yAxisId="pubs" allowDecimals={false} width={28} {...AXIS} />
            <YAxis yAxisId="grants" orientation="right" width={40} {...AXIS} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip labelPrefix="AY " />} />
            <Bar yAxisId="pubs" dataKey="publications" name="Publications" fill="#1B345F" radius={[4, 4, 0, 0]} barSize={26} {...anim}>
              {charts.researchTrend.map((_, i) => (
                <Cell key={i} fillOpacity={hover.opacity(i)} />
              ))}
            </Bar>
            <Line yAxisId="grants" type="monotone" dataKey="grantsLakhs" name="Grants (₹ lakh)" stroke="#C28A2C" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} {...anim} animationBegin={300} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </ComposedChart>
        </FitChart>
      </ChartCard>

      {variant === 'principal' && (
        <ChartCard title="Patents" subtitle="From filing to grant" height={240} empty={charts.patentFunnel[0]?.value === 0} emptyText="No patents recorded yet.">
          <div className="funnel">
            {charts.patentFunnel.map((p, i) => (
              <ProgressBar key={p.stage} label={p.stage} value={p.value} max={funnelMax} detail={String(p.value)} color={CHART_COLORS[i]} />
            ))}
          </div>
        </ChartCard>
      )}
      <ChartCard
        className={principal ? 'span-3' : ''}
        title={variant === 'dean' ? 'Departments this year' : 'Department comparison'}
        subtitle={`${charts.currentAcademicYear} · verified publications, funded projects, activities`}
        empty={depts.length === 0}
      >
        <FitChart>
          <BarChart data={depts} barCategoryGap="22%" {...deptHover.chartProps}>
            {GRID}
            <XAxis dataKey="dept" {...AXIS} />
            <YAxis allowDecimals={false} width={28} {...AXIS} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip />} />
            {(['publications', 'projects', variant === 'dean' ? 'fdp' : 'activities'] as const).map((k, ki) => (
              <Bar key={k} dataKey={k} name={k === 'fdp' ? 'FDP / STTP' : humanize(k)} fill={CHART_COLORS[ki]} radius={[3, 3, 0, 0]} {...anim} animationBegin={ki * 120}>
                {depts.map((_, i) => (
                  <Cell key={i} fillOpacity={deptHover.opacity(i)} />
                ))}
              </Bar>
            ))}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </FitChart>
      </ChartCard>

    </div>
  );
};

// ------------------------------------------------------------------------------------------
// Admin
// ------------------------------------------------------------------------------------------

export const AdminInsights: React.FC<{ charts?: AdminCharts }> = ({ charts }) => {
  const roleHover = useHover();
  const anim = useChartAnimation();
  if (!charts) return null;
  const totalSignIns = charts.signInsPerDay.reduce((s, d) => s + d.signIns, 0);

  return (
    <div className="insights-grid insights-grid-3">
      <ChartCard className="span-2" title="Sign-ins" subtitle={`Last 14 days · ${totalSignIns} successful`}>
        <FitChart>
          <AreaChart data={charts.signInsPerDay}>
            <defs>
              <linearGradient id="adminSignins" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B345F" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#1B345F" stopOpacity={0} />
              </linearGradient>
            </defs>
            {GRID}
            <XAxis dataKey="date" {...AXIS} minTickGap={16} />
            <YAxis allowDecimals={false} width={28} {...AXIS} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="signIns" name="Signed in" stroke="#1B345F" strokeWidth={2} fill="url(#adminSignins)" activeDot={{ r: 4 }} {...anim} />
            <Area type="monotone" dataKey="failed" name="Failed attempts" stroke="#B4535F" strokeWidth={1.5} fill="none" strokeDasharray="4 3" {...anim} animationBegin={200} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </AreaChart>
        </FitChart>
      </ChartCard>

      <ChartCard title="Active users by role">
        <FitChart>
          <BarChart data={charts.usersByRole} layout="vertical" margin={{ left: 4, right: 28 }} {...roleHover.chartProps}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={78} tickFormatter={humanize} {...AXIS} />
            <Tooltip cursor={CURSOR} content={<ChartTooltip />} />
            <Bar dataKey="value" name="Users" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 12, fill: '#1F2937' }} {...anim}>
              {charts.usersByRole.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={roleHover.opacity(i)} />
              ))}
            </Bar>
          </BarChart>
        </FitChart>
      </ChartCard>
    </div>
  );
};
