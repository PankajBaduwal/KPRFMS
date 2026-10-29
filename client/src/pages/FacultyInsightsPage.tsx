import React, { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { formatErrorMessage } from '../utils/errorHandler';
import '../styles/funding.css';
import '../styles/dossier.css';

/**
 * Faculty oversight for HODs (their department) and Deans / the Principal (the institution):
 * a directory with completion and verified counts, transparent category rankings and a
 * department comparison in totals and per faculty member.
 */

interface DirRow {
  facultyId: string;
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  completion: number;
  verifiedPublications: number;
  grantsSanctioned: number;
  courses: number;
  professionalDevelopment: number;
  studentProjects: number;
  phdScholars: number;
  pendingSubmissions: number;
  returnedSubmissions: number;
}
interface Directory {
  scope: string;
  overview: Record<string, number>;
  designations: string[];
  rows: DirRow[];
}
interface Metric {
  key: string;
  label: string;
  group: string;
  period: string;
}
interface Ranking {
  label: string;
  period: string;
  scope: string;
  rules: string[];
  total: number;
  page: number;
  pages: number;
  rows: Array<{ rank: number; facultyId: string; name: string; department: string; designation: string; value: number; submitted: number; completeness: number }>;
}
interface Departments {
  period: string;
  note: string;
  metrics: Array<{ key: string; label: string }>;
  rows: Array<{ departmentId: string; code: string; name: string; faculty: number; values: Record<string, { total: number; perFaculty: number; waiting: number }> }>;
}

const num = (n: number) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : n.toLocaleString('en-IN'));
type Tab = 'directory' | 'rankings' | 'departments';

const DepartmentSelect: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const depts = useQuery({ queryKey: ['departments-list'], queryFn: async () => (await apiClient.get('/departments')).data.data as Array<{ _id: string; code: string; name: string }> });
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Department">
      <option value="">All departments</option>
      {(depts.data ?? []).map((d) => (
        <option key={d._id} value={d._id}>
          {d.code}
        </option>
      ))}
    </select>
  );
};

const DirectoryTab: React.FC<{ institution: boolean }> = ({ institution }) => {
  const { years } = useAcademicYears();
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['dossier-directory', departmentId, designation, academicYear],
    queryFn: async () => (await apiClient.get('/dossier/directory', { params: { departmentId: departmentId || undefined, designation: designation || undefined, academicYear: academicYear || undefined } })).data.data as Directory,
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data?.rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s) || r.employeeId.toLowerCase().includes(s));
  }, [q.data, search]);
  const o = q.data?.overview;
  return (
    <>
      {o && (
        <section className="fd-tiles">
          {(
            [
              ['Faculty', o.faculty],
              ['Average profile completion', `${o.averageCompletion}%`],
              ['Awaiting verification', o.pendingSubmissions, o.pendingSubmissions ? 'is-warn' : ''],
              ['Returned for correction', o.returnedSubmissions],
              ['Verified publications', o.verifiedPublications],
              ['Grants sanctioned', o.grantsSanctioned],
              ['Courses & certifications', o.courses],
              ['Professional development', o.professionalDevelopment],
            ] as Array<[string, string | number, string?]>
          ).map(([k, v, c]) => (
            <div key={k} className={`fd-tile ${c ?? ''}`}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </section>
      )}
      <section className="fd-card">
        <div className="ds-filters">
          <input className="ds-search" placeholder="Search name or employee ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          {institution && <DepartmentSelect value={departmentId} onChange={setDepartmentId} />}
          <select value={designation} onChange={(e) => setDesignation(e.target.value)} aria-label="Designation">
            <option value="">All designations</option>
            {(q.data?.designations ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} aria-label="Academic year">
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {q.isError && <p className="fd-error">{formatErrorMessage(q.error, 'The directory could not be loaded.')}</p>}
        <div className="fd-table-wrap">
          <table className="fd-table">
            <thead>
              <tr>
                <th>Faculty</th>
                {institution && <th>Dept</th>}
                <th className="num">Completion</th>
                <th className="num">Publications</th>
                <th className="num">Grants</th>
                <th className="num">Courses</th>
                <th className="num">Prof. dev.</th>
                <th className="num">Student projects</th>
                <th className="num">PhD scholars</th>
                <th className="num">Awaiting</th>
                <th className="num">Returned</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr>
                  <td colSpan={11} className="fd-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {q.data && rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="fd-muted">
                    No faculty match these filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.facultyId}>
                  <td>
                    <Link className="ds-title" to={`/portal/dossier?facultyId=${r.facultyId}`}>
                      {r.name}
                    </Link>
                    <div className="fd-muted">
                      {r.designation} · {r.employeeId}
                    </div>
                  </td>
                  {institution && <td>{r.department}</td>}
                  <td className="num">
                    <span className={r.completion < 50 ? 'fd-error' : ''}>{r.completion}%</span>
                  </td>
                  <td className="num">{r.verifiedPublications}</td>
                  <td className="num">{r.grantsSanctioned}</td>
                  <td className="num">{r.courses}</td>
                  <td className="num">{r.professionalDevelopment}</td>
                  <td className="num">{r.studentProjects}</td>
                  <td className="num">{r.phdScholars}</td>
                  <td className="num">{r.pendingSubmissions || '—'}</td>
                  <td className="num">{r.returnedSubmissions || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fd-muted" style={{ marginTop: 8 }}>
          Counts are verified records only{academicYear ? ` for ${academicYear}` : ''}; “awaiting” and “returned” count publications, courses and professional development records.
        </p>
      </section>
    </>
  );
};

const RankingsTab: React.FC<{ institution: boolean }> = ({ institution }) => {
  const { years, currentYear } = useAcademicYears() as { years: string[]; currentYear?: string };
  const [metric, setMetric] = useState('publications');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const metrics = useQuery({ queryKey: ['dossier-metrics'], queryFn: async () => (await apiClient.get('/dossier/rankings/metrics')).data.data as Metric[], staleTime: Infinity });
  const q = useQuery({
    queryKey: ['dossier-ranking', metric, departmentId, from, to, page],
    queryFn: async () => (await apiClient.get('/dossier/rankings', { params: { metric, departmentId: departmentId || undefined, from: from || undefined, to: to || undefined, page, limit: 25 } })).data.data as Ranking,
    placeholderData: keepPreviousData,
  });
  const groups = useMemo(() => {
    const m = new Map<string, Metric[]>();
    (metrics.data ?? []).forEach((x) => m.set(x.group, [...(m.get(x.group) ?? []), x]));
    return [...m.entries()];
  }, [metrics.data]);
  const r = q.data;
  const money = metric === 'grantValue';
  return (
    <section className="fd-card">
      <div className="ds-filters">
        <select
          value={metric}
          onChange={(e) => {
            setMetric(e.target.value);
            setPage(1);
          }}
          aria-label="Category"
        >
          {groups.map(([g, list]) => (
            <optgroup key={g} label={g}>
              {list.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {institution && (
          <DepartmentSelect
            value={departmentId}
            onChange={(v) => {
              setDepartmentId(v);
              setPage(1);
            }}
          />
        )}
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From academic year">
          <option value="">From: {currentYear ?? 'current year'}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              From {y}
            </option>
          ))}
        </select>
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To academic year">
          <option value="">To: same year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              To {y}
            </option>
          ))}
        </select>
      </div>
      {q.isError && <p className="fd-error">{formatErrorMessage(q.error, 'The ranking could not be loaded.')}</p>}
      {r && (
        <>
          <h2>
            {r.label} · {r.period}
          </h2>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th className="num">Rank</th>
                  <th>Faculty</th>
                  {institution && <th>Dept</th>}
                  <th className="num">Verified</th>
                  <th className="num">Waiting</th>
                  <th className="num">Profile completeness</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.facultyId}>
                    <td className="num ds-rank">{x.rank}</td>
                    <td>
                      <Link className="ds-title" to={`/portal/dossier?facultyId=${x.facultyId}`}>
                        {x.name}
                      </Link>
                      <div className="fd-muted">{x.designation}</div>
                    </td>
                    {institution && <td>{x.department}</td>}
                    <td className="num">{money ? num(x.value) : x.value}</td>
                    <td className="num">{x.submitted || '—'}</td>
                    <td className="num">
                      <span className={x.completeness < 50 ? 'fd-error' : ''}>{x.completeness}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.pages > 1 && (
            <div className="fd-pager">
              <button type="button" className="fd-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span className="fd-muted">
                Page {r.page} of {r.pages}
              </span>
              <button type="button" className="fd-btn" disabled={page >= r.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
          <h2 style={{ marginTop: 14 }}>How this ranking works</h2>
          <ul className="ds-rules">
            {r.rules.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

const DepartmentsTab: React.FC = () => {
  const { years } = useAcademicYears();
  const [year, setYear] = useState('');
  const [perFaculty, setPerFaculty] = useState(true);
  const q = useQuery({
    queryKey: ['dossier-departments', year],
    queryFn: async () => (await apiClient.get('/dossier/departments', { params: { from: year || undefined } })).data.data as Departments,
    placeholderData: keepPreviousData,
  });
  const d = q.data;
  return (
    <section className="fd-card">
      <div className="ds-filters">
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Academic year">
          <option value="">Current academic year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <nav className="fd-buckets">
          <button type="button" className={perFaculty ? 'is-on' : ''} onClick={() => setPerFaculty(true)}>
            Per faculty member
          </button>
          <button type="button" className={!perFaculty ? 'is-on' : ''} onClick={() => setPerFaculty(false)}>
            Totals
          </button>
        </nav>
      </div>
      {q.isError && <p className="fd-error">{formatErrorMessage(q.error, 'The comparison could not be loaded.')}</p>}
      {d && (
        <>
          <h2>Departments · {d.period}</h2>
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="num">Faculty</th>
                  {d.metrics.map((m) => (
                    <th key={m.key} className="num" title={m.label}>
                      {m.label.replace(/ \(verified\)| \(₹\)/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.departmentId}>
                    <td title={r.name}>{r.code}</td>
                    <td className="num">{r.faculty}</td>
                    {d.metrics.map((m) => {
                      const v = r.values[m.key];
                      const shown = perFaculty ? v.perFaculty : v.total;
                      return (
                        <td key={m.key} className="num" title={`Total ${v.total}; ${v.perFaculty} per faculty; ${v.waiting} waiting for verification`}>
                          {m.key === 'grantValue' ? num(shown) : shown}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fd-muted" style={{ marginTop: 8 }}>
            {d.note}
          </p>
        </>
      )}
    </section>
  );
};

export const FacultyInsightsPage: React.FC = () => {
  const role = useAuthStore((s) => s.user?.role);
  const institution = role !== 'HOD';
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'directory';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const tabs: Array<[Tab, string]> = [
    ['directory', role === 'HOD' ? 'Department faculty' : 'Faculty directory'],
    ['rankings', 'Rankings'],
    ...(institution ? ([['departments', 'Department comparison']] as Array<[Tab, string]>) : []),
  ];
  return (
    <div className="fd">
      <header className="fd-head">
        <div>
          <h1>{role === 'HOD' ? 'Department Faculty' : 'Faculty Performance'}</h1>
          <p className="fd-muted">Every figure comes from records verified by the HOD. Use completeness to judge how far a comparison can be trusted.</p>
        </div>
      </header>
      <nav className="ds-tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'directory' && <DirectoryTab institution={institution} />}
      {tab === 'rankings' && <RankingsTab institution={institution} />}
      {tab === 'departments' && institution && <DepartmentsTab />}
    </div>
  );
};
