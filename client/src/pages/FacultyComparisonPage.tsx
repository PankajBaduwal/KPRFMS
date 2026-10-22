import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { facultyComparisonService } from '../services/faculty-comparison.service';
import { FacultyComparisonDrillDownModal } from '../components/FacultyComparisonDrillDownModal';
import { EmptyState, SkeletonTable, ErrorState } from '../components';
import type {
  IFacultyComparisonFilters,
  IComparisonFilterOptions,
  IFacultyFactualMetrics,
} from '../types/faculty-comparison';

export const FacultyComparisonPage: React.FC = () => {
  // Filters State
  const [filters, setFilters] = useState<IFacultyComparisonFilters>({
    academicYear: 'ALL',
    departmentId: 'ALL',
    search: '',
    verificationState: 'ALL',
  });

  const [facultyCategory, setFacultyCategory] = useState<string>('ALL');
  const [semester, setSemester] = useState<string>('ALL');

  const [filterOptions, setFilterOptions] = useState<IComparisonFilterOptions>({
    academicYears: [],
    departments: [],
    faculty: [],
  });

  // Comparison Scope: Faculty level vs Department Aggregate level
  const [comparisonScope, setComparisonScope] = useState<'FACULTY' | 'DEPARTMENT'>('FACULTY');

  // Data & State
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<IFacultyFactualMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);
  // False until the first comparison response has arrived
  const [hasLoaded, setHasLoaded] = useState(false);

  // Sorting for Faculty Table
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Sorting for Department Table
  const [deptSortKey, setDeptSortKey] = useState<string>('publications');
  const [deptSortOrder, setDeptSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected faculty for side-by-side comparative inspection
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);
  const [sideBySideMode, setSideBySideMode] = useState<boolean>(false);

  // Selected departments for side-by-side comparison
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [deptSideBySideMode, setDeptSideBySideMode] = useState<boolean>(false);

  // Drill-down Modal State
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    facultyId: string | null;
    facultyName: string;
    metric: string | null;
    metricLabel: string;
  }>({
    isOpen: false,
    facultyId: null,
    facultyName: '',
    metric: null,
    metricLabel: '',
  });

  // Load filter options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const opts = await facultyComparisonService.getFilterOptions();
        setFilterOptions(opts);
      } catch (err: any) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadOptions();
  }, []);

  // Fetch Comparison Records
  const fetchComparison = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await facultyComparisonService.getComparison(filters);
      setRecords(res.records);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load faculty comparison data');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [filters]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const handleFilterChange = (key: keyof IFacultyComparisonFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      academicYear: 'ALL',
      departmentId: 'ALL',
      search: '',
      verificationState: 'ALL',
    });
    setFacultyCategory('ALL');
    setSemester('ALL');
    setSelectedFacultyIds([]);
    setSideBySideMode(false);
    setSelectedDeptIds([]);
    setDeptSideBySideMode(false);
  };

  // Distinct Faculty Categories / Designations
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.designation && r.designation.trim()) set.add(r.designation.trim());
    });
    filterOptions.faculty.forEach((f) => {
      if (f.designation && f.designation.trim()) set.add(f.designation.trim());
    });
    return Array.from(set).sort();
  }, [records, filterOptions.faculty]);

  // Filtered records by Category / Designation
  const filteredRecords = useMemo(() => {
    let list = records;
    if (facultyCategory !== 'ALL') {
      list = list.filter((r) => r.designation?.toLowerCase() === facultyCategory.toLowerCase());
    }
    return list;
  }, [records, facultyCategory]);

  const hasActiveFilters =
    (filters.academicYear || 'ALL') !== 'ALL' ||
    ((filters.departmentId || 'ALL') !== 'ALL' && filterOptions.departments.length > 1) ||
    (filters.verificationState || 'ALL') !== 'ALL' ||
    facultyCategory !== 'ALL' ||
    semester !== 'ALL' ||
    !!(filters.search && filters.search.trim());

  const toggleSelectFaculty = (facultyId: string) => {
    setSelectedFacultyIds((prev) => {
      if (prev.includes(facultyId)) {
        return prev.filter((id) => id !== facultyId);
      } else {
        if (prev.length >= 4) {
          alert('You can select up to 4 faculty members for side-by-side comparison.');
          return prev;
        }
        return [...prev, facultyId];
      }
    });
  };

  const toggleSelectDept = (deptId: string) => {
    setSelectedDeptIds((prev) => {
      if (prev.includes(deptId)) {
        return prev.filter((id) => id !== deptId);
      } else {
        if (prev.length >= 3) {
          alert('You can select up to 3 departments for side-by-side comparison.');
          return prev;
        }
        return [...prev, deptId];
      }
    });
  };

  const openDrillDown = (facultyId: string, facultyName: string, metric: string, metricLabel: string) => {
    setDrillDown({
      isOpen: true,
      facultyId,
      facultyName,
      metric,
      metricLabel,
    });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const handleDeptSort = (key: string) => {
    if (deptSortKey === key) {
      setDeptSortOrder(deptSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setDeptSortKey(key);
      setDeptSortOrder('desc');
    }
  };

  // Sorted faculty records
  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortKey) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'department':
          valA = a.departmentName.toLowerCase();
          valB = b.departmentName.toLowerCase();
          break;
        case 'publications':
          valA = a.publications.total;
          valB = b.publications.total;
          break;
        case 'verifiedPublications':
          valA = a.publications.verified;
          valB = b.publications.verified;
          break;
        case 'fundedProjects':
          valA = a.fundedProjects.count;
          valB = b.fundedProjects.count;
          break;
        case 'fundingAmount':
          valA = a.fundedProjects.totalSanctionedAmount;
          valB = b.fundedProjects.totalSanctionedAmount;
          break;
        case 'phdScholars':
          valA = a.phdScholars.total;
          valB = b.phdScholars.total;
          break;
        case 'mentoring':
          valA = a.mentoring.menteeCount;
          valB = b.mentoring.menteeCount;
          break;
        case 'facultyDevelopment':
          valA = a.facultyDevelopment.total;
          valB = b.facultyDevelopment.total;
          break;
        case 'conferences':
          valA = a.conferences.total;
          valB = b.conferences.total;
          break;
        case 'workload':
          valA = a.workload.weeklyHours;
          valB = b.workload.weeklyHours;
          break;
        default:
          valA = a.name;
          valB = b.name;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredRecords, sortKey, sortOrder]);

  const sideBySideRecords = useMemo(() => {
    return records.filter((r) => selectedFacultyIds.includes(r.facultyId));
  }, [records, selectedFacultyIds]);

  // Aggregate Department Comparison Data
  const departmentAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        departmentId: string;
        departmentName: string;
        departmentCode: string;
        facultyCount: number;
        totalPublications: number;
        verifiedPublications: number;
        scopusOrSci: number;
        fundedProjectsCount: number;
        totalSanctionedAmount: number;
        totalReceivedAmount: number;
        phdScholarsTotal: number;
        menteeCountTotal: number;
        fdpTotal: number;
        totalWorkloadHours: number;
        overloadedCount: number;
        normalCount: number;
      }
    >();

    filteredRecords.forEach((r) => {
      const dId = r.departmentId || 'dept-unknown';
      if (!map.has(dId)) {
        map.set(dId, {
          departmentId: dId,
          departmentName: r.departmentName || 'Academic Department',
          departmentCode: r.departmentCode || 'DEPT',
          facultyCount: 0,
          totalPublications: 0,
          verifiedPublications: 0,
          scopusOrSci: 0,
          fundedProjectsCount: 0,
          totalSanctionedAmount: 0,
          totalReceivedAmount: 0,
          phdScholarsTotal: 0,
          menteeCountTotal: 0,
          fdpTotal: 0,
          totalWorkloadHours: 0,
          overloadedCount: 0,
          normalCount: 0,
        });
      }

      const item = map.get(dId)!;
      item.facultyCount += 1;
      item.totalPublications += r.publications?.total || 0;
      item.verifiedPublications += r.publications?.verified || 0;
      item.scopusOrSci += r.publications?.scopusOrSci || 0;
      item.fundedProjectsCount += r.fundedProjects?.count || 0;
      item.totalSanctionedAmount += r.fundedProjects?.totalSanctionedAmount || 0;
      item.totalReceivedAmount += r.fundedProjects?.totalReceivedAmount || 0;
      item.phdScholarsTotal += r.phdScholars?.total || 0;
      item.menteeCountTotal += r.mentoring?.menteeCount || 0;
      item.fdpTotal += r.facultyDevelopment?.total || 0;
      item.totalWorkloadHours += r.workload?.weeklyHours || 0;
      if (r.workload?.status === 'OVERLOADED') {
        item.overloadedCount += 1;
      } else {
        item.normalCount += 1;
      }
    });

    return Array.from(map.values()).map((dept) => ({
      ...dept,
      avgWorkloadHours:
        dept.facultyCount > 0 ? Number((dept.totalWorkloadHours / dept.facultyCount).toFixed(1)) : 0,
      pubsPerFaculty:
        dept.facultyCount > 0 ? Number((dept.totalPublications / dept.facultyCount).toFixed(1)) : 0,
    }));
  }, [filteredRecords]);

  // Sorted department records
  const sortedDepartmentAggregates = useMemo(() => {
    const list = [...departmentAggregates];
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      switch (deptSortKey) {
        case 'name':
          valA = a.departmentName.toLowerCase();
          valB = b.departmentName.toLowerCase();
          break;
        case 'faculty':
          valA = a.facultyCount;
          valB = b.facultyCount;
          break;
        case 'publications':
          valA = a.totalPublications;
          valB = b.totalPublications;
          break;
        case 'verifiedPublications':
          valA = a.verifiedPublications;
          valB = b.verifiedPublications;
          break;
        case 'pubsPerFaculty':
          valA = a.pubsPerFaculty;
          valB = b.pubsPerFaculty;
          break;
        case 'funding':
          valA = a.totalSanctionedAmount;
          valB = b.totalSanctionedAmount;
          break;
        case 'phdScholars':
          valA = a.phdScholarsTotal;
          valB = b.phdScholarsTotal;
          break;
        case 'workload':
          valA = a.avgWorkloadHours;
          valB = b.avgWorkloadHours;
          break;
        default:
          valA = a.totalPublications;
          valB = b.totalPublications;
      }
      if (valA < valB) return deptSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return deptSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [departmentAggregates, deptSortKey, deptSortOrder]);

  const sideBySideDepts = useMemo(() => {
    return departmentAggregates.filter((d) => selectedDeptIds.includes(d.departmentId));
  }, [departmentAggregates, selectedDeptIds]);

  // Status Summary Metrics
  const summaryStats = useMemo(() => {
    const totalFaculty = filteredRecords.length;
    const totalPubs = filteredRecords.reduce((acc, r) => acc + (r.publications?.total || 0), 0);
    const totalVerifiedPubs = filteredRecords.reduce((acc, r) => acc + (r.publications?.verified || 0), 0);
    const totalGrants = filteredRecords.reduce((acc, r) => acc + (r.fundedProjects?.totalSanctionedAmount || 0), 0);
    const overloadedCount = filteredRecords.filter((r) => r.workload?.status === 'OVERLOADED').length;
    const avgWorkload =
      totalFaculty > 0
        ? (filteredRecords.reduce((acc, r) => acc + (r.workload?.weeklyHours || 0), 0) / totalFaculty).toFixed(1)
        : '0';

    return {
      totalFaculty,
      totalPubs,
      totalVerifiedPubs,
      totalGrantsLakhs: (totalGrants / 100000).toFixed(1),
      avgWorkload,
      overloadedCount,
      complianceRate: totalFaculty > 0 ? (((totalFaculty - overloadedCount) / totalFaculty) * 100).toFixed(0) : '100',
    };
  }, [filteredRecords]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1520px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* 1. Institutional Comparison Header */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
            <span
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.725rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Institutional Analysis
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Academic & Departmental Comparative Matrix
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
            Institutional Faculty & Department Comparison
          </h2>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.875rem' }}>
            Objective institutional comparative metrics for workload balancing, research productivity, and departmental benchmarking.
          </p>
        </div>

        {/* Comparison Scope Switcher & Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Scope Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => {
                setComparisonScope('FACULTY');
                setSideBySideMode(false);
              }}
              style={{
                padding: '0.45rem 0.95rem',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: comparisonScope === 'FACULTY' ? '#0f172a' : 'transparent',
                color: comparisonScope === 'FACULTY' ? '#ffffff' : '#475569',
                fontWeight: comparisonScope === 'FACULTY' ? 700 : 500,
                fontSize: '0.825rem',
                cursor: 'pointer',
              }}
            >
              <i className="bi bi-people me-1" /> Faculty Comparison
            </button>
            <button
              onClick={() => {
                setComparisonScope('DEPARTMENT');
                setDeptSideBySideMode(false);
              }}
              style={{
                padding: '0.45rem 0.95rem',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: comparisonScope === 'DEPARTMENT' ? '#0f172a' : 'transparent',
                color: comparisonScope === 'DEPARTMENT' ? '#ffffff' : '#475569',
                fontWeight: comparisonScope === 'DEPARTMENT' ? 700 : 500,
                fontSize: '0.825rem',
                cursor: 'pointer',
              }}
            >
              <i className="bi bi-buildings me-1" /> Department Comparison
            </button>
          </div>

          <button
            onClick={fetchComparison}
            disabled={loading}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 2. Executive Status Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
          <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Faculty In View
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
            {summaryStats.totalFaculty}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
            Across {departmentAggregates.length} Academic Departments
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
          <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Publications Output
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', margin: '0.2rem 0' }}>
            {summaryStats.totalPubs}
          </div>
          <div style={{ fontSize: '0.775rem', color: '#059669', fontWeight: 600 }}>
            {summaryStats.totalVerifiedPubs} Verified Papers
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
          <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Extramural Grants
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', margin: '0.2rem 0' }}>
            ₹{summaryStats.totalGrantsLakhs}L
          </div>
          <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
            Total Sanctioned Research Funding
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '1rem' }}>
          <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Workload Average
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
            {summaryStats.avgWorkload} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>hrs/wk</span>
          </div>
          <div style={{ fontSize: '0.775rem', color: summaryStats.overloadedCount === 0 ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
            {summaryStats.complianceRate}% Workload Compliant
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Filter Toolbar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          padding: '1.15rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Active Filters:</span>
            <span style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Year: <strong>{filters.academicYear === 'ALL' ? 'All Years' : filters.academicYear}</strong>
            </span>
            <span style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              Department: <strong>{filters.departmentId === 'ALL' ? 'All Departments' : filterOptions.departments.find((d) => d.id === filters.departmentId)?.name || 'Filtered'}</strong>
            </span>
            {facultyCategory !== 'ALL' && (
              <span style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Category: <strong>{facultyCategory}</strong>
              </span>
            )}
            {semester !== 'ALL' && (
              <span style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Semester: <strong>{semester}</strong>
              </span>
            )}
            <span style={{ fontSize: '0.75rem', backgroundColor: filters.verificationState === 'VERIFIED_ONLY' ? '#ecfdf5' : '#f1f5f9', color: filters.verificationState === 'VERIFIED_ONLY' ? '#059669' : '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              State: <strong>{filters.verificationState === 'VERIFIED_ONLY' ? 'Verified Only' : 'All'}</strong>
            </span>
          </div>

          <button
            onClick={handleResetFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <i className="bi bi-x-circle" /> Reset Filters
          </button>
        </div>

        {/* Filter Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.85rem',
          }}
        >
          {/* Academic Year */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Academic Year
            </label>
            <select
              value={filters.academicYear || 'ALL'}
              onChange={(e) => handleFilterChange('academicYear', e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Academic Years</option>
              {filterOptions.academicYears.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Department
            </label>
            <select
              value={filters.departmentId || 'ALL'}
              onChange={(e) => handleFilterChange('departmentId', e.target.value)}
              disabled={filterOptions.departments.length === 1}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                backgroundColor: filterOptions.departments.length === 1 ? '#f8fafc' : '#ffffff',
              }}
            >
              {filterOptions.departments.length > 1 && <option value="ALL">All Authorized Departments</option>}
              {filterOptions.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Faculty Category / Designation */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Faculty Category (Cadre)
            </label>
            <select
              value={facultyCategory}
              onChange={(e) => setFacultyCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Faculty Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Semester Period
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="ALL">All Semesters (Annual)</option>
              <option value="ODD">Odd Semesters (1, 3, 5, 7)</option>
              <option value="EVEN">Even Semesters (2, 4, 6, 8)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* Verification State */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Verification State
            </label>
            <select
              value={filters.verificationState || 'ALL'}
              onChange={(e) => handleFilterChange('verificationState', e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                backgroundColor: '#ffffff',
                fontWeight: filters.verificationState === 'VERIFIED_ONLY' ? 700 : 400,
                color: filters.verificationState === 'VERIFIED_ONLY' ? '#059669' : '#0f172a',
              }}
            >
              <option value="ALL">All Records (Inclusive)</option>
              <option value="VERIFIED_ONLY">Verified Only (Strict)</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
              Search Faculty
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Name or ID..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem 0.45rem 1.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.825rem',
                  backgroundColor: '#ffffff',
                }}
              />
              <i
                className="bi bi-search"
                style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.75rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {!hasLoaded ? (
        <div className="card-custom" style={{ padding: 0 }} role="status" aria-busy="true">
          <SkeletonTable rows={8} columns={8} />
        </div>
      ) : error ? (
        <div style={{ margin: '1.5rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Unable to load comparison data"
            message={error}
            onRetry={fetchComparison}
            retryText="Retry Loading Comparison"
          />
        </div>
      ) : comparisonScope === 'DEPARTMENT' ? (
        /* ======================================================== */
        /* DEPARTMENT COMPARISON INTERFACE                          */
        /* ======================================================== */
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Executive Department Comparative Matrix ({departmentAggregates.length} Departments)
              </h4>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Select checkboxes to compare departments side-by-side or sort columns to benchmark productivity.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {selectedDeptIds.length >= 2 && (
                <button
                  onClick={() => setDeptSideBySideMode(!deptSideBySideMode)}
                  style={{
                    backgroundColor: deptSideBySideMode ? '#0f172a' : '#2563eb',
                    color: '#ffffff',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <i className="bi bi-columns-gap me-1" />
                  {deptSideBySideMode ? 'Show Table' : `Compare Selected (${selectedDeptIds.length})`}
                </button>
              )}
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Sort: <strong style={{ color: '#0f172a' }}>{deptSortKey}</strong> ({deptSortOrder})
              </div>
            </div>
          </div>

          {/* Department Side-by-Side Mode */}
          {deptSideBySideMode && sideBySideDepts.length >= 2 ? (
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sideBySideDepts.length}, 1fr)`, gap: '1.25rem' }}>
                {sideBySideDepts.map((d) => (
                  <div key={d.departmentId} style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#2563eb' }}>{d.departmentCode}</span>
                      <h4 style={{ margin: '0.2rem 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{d.departmentName}</h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>FACULTY STRENGTH</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{d.facultyCount} Faculty</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>PUBLICATIONS & DENSITY</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb' }}>
                          {d.totalPublications} <span style={{ fontSize: '0.8rem', color: '#059669' }}>({d.verifiedPublications} verified)</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.pubsPerFaculty} papers/faculty</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>RESEARCH FUNDING</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed' }}>
                          ₹{(d.totalSanctionedAmount / 100000).toFixed(1)}L
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.fundedProjectsCount} funded projects</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>AVERAGE WORKLOAD</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{d.avgWorkloadHours} hrs/wk</div>
                        <div style={{ fontSize: '0.75rem', color: d.overloadedCount > 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                          {d.overloadedCount > 0 ? `${d.overloadedCount} overloaded` : 'Optimal load'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>SCHOLARS & MENTORING</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                          {d.phdScholarsTotal} PhD Scholars • {d.menteeCountTotal} Mentees
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Department Executive Comparison Table */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th scope="col" style={{ padding: '0.75rem', width: '36px', textAlign: 'center' }}>
                      <span className="visually-hidden">Select</span>
                    </th>
                    <th scope="col" onClick={() => handleDeptSort('name')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      Department <i className="bi bi-arrow-down-up ms-1" />
                    </th>
                    <th scope="col" onClick={() => handleDeptSort('faculty')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      Faculty <i className="bi bi-arrow-down-up ms-1" />
                    </th>
                    <th scope="col" onClick={() => handleDeptSort('publications')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      Publications <i className="bi bi-arrow-down-up ms-1" />
                    </th>
                    <th scope="col" onClick={() => handleDeptSort('pubsPerFaculty')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      Pubs/Faculty <i className="bi bi-arrow-down-up ms-1" />
                    </th>
                    <th scope="col" onClick={() => handleDeptSort('funding')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      Grants (₹ Lakhs) <i className="bi bi-arrow-down-up ms-1" />
                    </th>
                    <th scope="col" onClick={() => handleDeptSort('phdScholars')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      PhD Scholars <i className="bi bi-arrow-down-up ms-1" />
                    </th>
                    <th scope="col" onClick={() => handleDeptSort('workload')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                      Avg Workload <i className="bi bi-arrow-down-up ms-1" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDepartmentAggregates.map((d, index) => {
                    const isSelected = selectedDeptIds.includes(d.departmentId);
                    return (
                      <tr
                        key={d.departmentId}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectDept(d.departmentId)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>#{index + 1}</span>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{d.departmentName} ({d.departmentCode})</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{d.facultyCount}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 700, color: '#2563eb' }}>{d.totalPublications}</span>{' '}
                          <span style={{ fontSize: '0.725rem', color: '#059669' }}>({d.verifiedPublications} ver.)</span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{d.pubsPerFaculty}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#7c3aed' }}>
                          ₹{(d.totalSanctionedAmount / 100000).toFixed(1)}L
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{d.phdScholarsTotal}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 600 }}>{d.avgWorkloadHours}h/wk</span>
                          {d.overloadedCount > 0 && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                              {d.overloadedCount} over
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* FACULTY COMPARISON INTERFACE                             */
        /* ======================================================== */
        <div>
          {/* Faculty Side-by-Side View */}
          {sideBySideMode && sideBySideRecords.length >= 2 ? (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Side-by-Side Comparative Matrix ({sideBySideRecords.length} Faculty Members)
                </h4>
                <button
                  onClick={() => setSideBySideMode(false)}
                  style={{
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Back to Full Table
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${sideBySideRecords.length}, 1fr)`,
                  gap: '1rem',
                }}
              >
                {sideBySideRecords.map((f) => (
                  <div
                    key={f.facultyId}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      padding: '1.25rem',
                    }}
                  >
                    <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                        {f.departmentCode} • {f.employeeId}
                      </div>
                      <h4 style={{ margin: '0.25rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                        {f.name}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{f.designation}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.825rem' }}>
                      <div
                        onClick={() => openDrillDown(f.facultyId, f.name, 'publications', 'Publications')}
                        style={{ padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>PUBLICATIONS</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb' }}>
                          {f.publications.total} <span style={{ fontSize: '0.8rem', color: '#059669' }}>({f.publications.verified} ver.)</span>
                        </div>
                      </div>

                      <div
                        onClick={() => openDrillDown(f.facultyId, f.name, 'fundedProjects', 'Grants')}
                        style={{ padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>FUNDED GRANTS</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c3aed' }}>
                          ₹{(f.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                        </div>
                      </div>

                      <div
                        onClick={() => openDrillDown(f.facultyId, f.name, 'workload', 'Workload')}
                        style={{ padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>WEEKLY WORKLOAD</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                          {f.workload.weeklyHours} hrs/wk
                        </div>
                      </div>

                      <div
                        onClick={() => openDrillDown(f.facultyId, f.name, 'phdScholars', 'PhD Scholars')}
                        style={{ padding: '0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>PHD SCHOLARS</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                          {f.phdScholars.total} Scholars
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Faculty Table View */
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Faculty Comparative Roster ({sortedRecords.length} Faculty Members)
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Select checkboxes to compare up to 4 faculty side-by-side. Click any metric cell for instant record drill-down.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {selectedFacultyIds.length >= 2 && (
                    <button
                      onClick={() => setSideBySideMode(true)}
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '4px',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '0.775rem',
                        cursor: 'pointer',
                      }}
                    >
                      Compare Selected ({selectedFacultyIds.length})
                    </button>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Sort: <strong style={{ color: '#0f172a' }}>{sortKey}</strong> ({sortOrder})
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th scope="col" style={{ padding: '0.75rem', width: '36px', textAlign: 'center' }}>
                        <span className="visually-hidden">Select</span>
                      </th>
                      <th scope="col" onClick={() => handleSort('name')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        Faculty Member <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                      <th scope="col" onClick={() => handleSort('department')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        Department <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                      <th scope="col" onClick={() => handleSort('publications')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        Publications <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                      <th scope="col" onClick={() => handleSort('fundingAmount')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        Grants / Funding <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                      <th scope="col" onClick={() => handleSort('phdScholars')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        PhD Scholars <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                      <th scope="col" onClick={() => handleSort('mentoring')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        Mentoring <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                      <th scope="col" onClick={() => handleSort('facultyDevelopment')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        FDP / STTP <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                      <th scope="col" onClick={() => handleSort('workload')} style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        Workload <i className="bi bi-arrow-down-up ms-1" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <EmptyState
                            icon="bi-funnel"
                            title={hasActiveFilters ? "No faculty records match your filters" : "No faculty records available"}
                            reason={hasActiveFilters ? "Try adjusting search terms, faculty category, or department filters." : "No faculty submissions have been recorded yet."}
                            compact
                          />
                        </td>
                      </tr>
                    ) : (
                      sortedRecords.map((f) => {
                        const isSelected = selectedFacultyIds.includes(f.facultyId);
                        return (
                          <tr
                            key={f.facultyId}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectFaculty(f.facultyId)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{f.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {f.employeeId} • {f.designation}
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{f.departmentName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{f.departmentCode}</div>
                            </td>
                            <td
                              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                              onClick={() => openDrillDown(f.facultyId, f.name, 'publications', 'Publications')}
                            >
                              <div style={{ fontWeight: 700, color: '#2563eb' }}>{f.publications.total}</div>
                              <div style={{ fontSize: '0.725rem', color: '#059669' }}>{f.publications.verified} ver.</div>
                            </td>
                            <td
                              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                              onClick={() => openDrillDown(f.facultyId, f.name, 'fundedProjects', 'Grants')}
                            >
                              <div style={{ fontWeight: 700, color: '#7c3aed' }}>
                                ₹{(f.fundedProjects.totalSanctionedAmount / 100000).toFixed(1)}L
                              </div>
                              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{f.fundedProjects.count} proj</div>
                            </td>
                            <td
                              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                              onClick={() => openDrillDown(f.facultyId, f.name, 'phdScholars', 'PhD Scholars')}
                            >
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{f.phdScholars.total}</div>
                            </td>
                            <td
                              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                              onClick={() => openDrillDown(f.facultyId, f.name, 'mentoring', 'Mentoring')}
                            >
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{f.mentoring.menteeCount}</div>
                            </td>
                            <td
                              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                              onClick={() => openDrillDown(f.facultyId, f.name, 'facultyDevelopment', 'FDP / STTP')}
                            >
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{f.facultyDevelopment.total}</div>
                            </td>
                            <td
                              style={{ padding: '0.85rem 1rem', cursor: 'pointer' }}
                              onClick={() => openDrillDown(f.facultyId, f.name, 'workload', 'Workload')}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{f.workload.weeklyHours}h/wk</span>
                                <span
                                  style={{
                                    fontSize: '0.675rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    backgroundColor:
                                      f.workload.status === 'OVERLOADED'
                                        ? '#fee2e2'
                                        : f.workload.status === 'NORMAL'
                                        ? '#dcfce7'
                                        : '#fef3c7',
                                    color:
                                      f.workload.status === 'OVERLOADED'
                                        ? '#b91c1c'
                                        : f.workload.status === 'NORMAL'
                                        ? '#15803d'
                                        : '#b45309',
                                  }}
                                >
                                  {f.workload.status === 'OVERLOADED' ? 'Over' : f.workload.status === 'NORMAL' ? 'Norm' : 'Under'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drill-Down Modal */}
      <FacultyComparisonDrillDownModal
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown((prev) => ({ ...prev, isOpen: false }))}
        facultyId={drillDown.facultyId}
        facultyName={drillDown.facultyName}
        metric={drillDown.metric}
        metricLabel={drillDown.metricLabel}
        academicYear={filters.academicYear}
        verificationState={filters.verificationState}
      />
    </div>
  );
};

export default FacultyComparisonPage;
