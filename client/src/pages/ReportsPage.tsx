import React, { useState, useEffect, useCallback } from 'react';
import { reportService } from '../services/report.service';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Skeleton, SkeletonStats, SkeletonTable } from '../components/Skeleton';
import { formatErrorMessage } from '../utils/errorHandler';
import { FEATURES } from '../constants/features';
import {
  REPORT_TYPES,
  type ReportType,
  ACCREDITATION_FRAMEWORKS,
  type AccreditationFramework,
  type VerificationFilter,
  type IReportResult,
  type IReportMetadata,
  type IFrameworkConfig,
  type ISourceTrace,
} from '../types/report';

// Report types that belong to the Teaching module (see constants/features.ts)
const TEACHING_REPORT_TYPES: string[] = [REPORT_TYPES.WORKLOAD, REPORT_TYPES.SUBJECT_ALLOCATION];

export const ReportsPage: React.FC = () => {
  const { user } = useAuthStore();

  // Framework & Report Type Selection
  const [selectedFramework, setSelectedFramework] = useState<AccreditationFramework>(
    ACCREDITATION_FRAMEWORKS.NAAC
  );
  const [selectedReportType, setSelectedReportType] = useState<ReportType>(
    REPORT_TYPES.FACULTY_PROFILE
  );

  // Metadata Lists
  const [reportTypes, setReportTypes] = useState<IReportMetadata[]>([]);
  const [metaLoading, setMetaLoading] = useState<boolean>(true);
  const [frameworks, setFrameworks] = useState<IFrameworkConfig[]>([]);
  const [departments, setDepartments] = useState<Array<{ _id: string; name: string; code: string }>>([]);

  // Filters State
  const { currentYear, years: academicYears, isLoading: yearsLoading } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState<string>('');
  // True once the user picks a year or the current year default has been applied
  const [yearChosen, setYearChosen] = useState<boolean>(false);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [verification, setVerification] = useState<VerificationFilter>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Report Execution State
  const [reportResult, setReportResult] = useState<IReportResult | null>(null);
  // Starts true: the first report is requested as soon as the academic year is known.
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trace Record Inspector Modal State
  const [inspectingTrace, setInspectingTrace] = useState<ISourceTrace | null>(null);
  const [traceDetail, setTraceDetail] = useState<Record<string, unknown> | null>(null);
  const [traceLoading, setTraceLoading] = useState<boolean>(false);

  // Default the year filter to the current academic year once it loads
  useEffect(() => {
    if (currentYear && !yearChosen) {
      setAcademicYear(currentYear);
      setYearChosen(true);
    }
  }, [currentYear, yearChosen]);

  // Initialize Departments and User Role Scoping
  useEffect(() => {
    async function initData() {
      try {
        const [typesData, fwData, deptRes] = await Promise.all([
          reportService.getReportTypes(),
          reportService.getFrameworkConfigs(),
          apiClient.get('/departments').catch(() => ({ data: { data: [] } })),
        ]);
        // Workload and subject-allocation reports belong to the Teaching module
        setReportTypes(FEATURES.TEACHING ? typesData : typesData.filter((r) => !TEACHING_REPORT_TYPES.includes(r.type)));
        setFrameworks(fwData);
        setDepartments(deptRes.data?.data || []);

        // If user is HOD or FACULTY, auto-select their assigned department
        if (user && (user.role === 'HOD' || user.role === 'FACULTY') && user.departmentId) {
          setDepartmentId(user.departmentId);
        }
      } catch (err: any) {
        console.error('Failed to load reporting metadata:', err);
      } finally {
        setMetaLoading(false);
      }
    }
    initData();
  }, [user]);

  // Execute Report Generation
  const handleGenerateReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await reportService.generateReport({
        reportType: selectedReportType,
        framework: selectedFramework,
        academicYear: academicYear || undefined,
        departmentId: departmentId || undefined,
        verification,
        search: searchFilter.trim() || undefined,
      });

      setReportResult(result);
      setError(null);
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to generate report.'));
      setReportResult(null);
    } finally {
      setLoading(false);
    }
  }, [selectedReportType, selectedFramework, academicYear, departmentId, verification, searchFilter]);

  // Auto-generate when report type or framework changes
  useEffect(() => {
    // Wait for the current-year default so we don't fire a request with no year first
    if (!yearChosen && (yearsLoading || currentYear)) return;
    handleGenerateReport();
  }, [selectedReportType, selectedFramework, handleGenerateReport, yearChosen, yearsLoading, currentYear]);

  // Export handlers
  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (exporting) return;
    try {
      setExporting(format);
      await reportService.downloadReport(
        {
          reportType: selectedReportType,
          framework: selectedFramework,
          academicYear: academicYear || undefined,
          departmentId: departmentId || undefined,
          verification,
        },
        format
      );
    } catch (err: unknown) {
      const msg = formatErrorMessage(err, 'Failed to export document. Please try again.');
      setError(msg);
    } finally {
      setExporting(null);
    }
  };

  // Inspect source record trace
  const handleInspectTrace = async (trace: ISourceTrace) => {
    setInspectingTrace(trace);
    setTraceDetail(null);
    setTraceLoading(true);
    try {
      const data = await reportService.getTraceRecord(trace.sourceCollection, trace.sourceRecordId);
      setTraceDetail(data);
    } catch (err: any) {
      console.error('Failed to load trace record:', err);
    } finally {
      setTraceLoading(false);
    }
  };

  // Group report types by category
  const categories: Array<{ id: string; label: string }> = [
    { id: 'FACULTY', label: 'Faculty Roster' },
    { id: 'ACADEMIC', label: 'Academic & Courses' },
    { id: 'RESEARCH', label: 'Research & IPR' },
    { id: 'STUDENT', label: 'Student Mentoring' },
    { id: 'PERFORMANCE', label: 'Appraisal & Ops' },
  ];

  // Active framework metadata
  const currentFwConfig = frameworks.find((f) => f.framework === selectedFramework);
  const activeReportMeta = reportTypes.find((r) => r.type === selectedReportType);

  return (
    <div className="reports-page-container" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* 1. INSTITUTIONAL HEADER & BRANDING */}
      <div
        className="reports-header-card"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                KPR Institute of Engineering and Technology
              </h1>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Accreditation Dossiers & Statutory Audit Reporting Engine
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                display: 'inline-block',
                background: 'var(--color-primary-50)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--color-primary)',
              }}
            >
              {user?.name} ({user?.role})
            </span>
          </div>
        </div>

        {/* ACCREDITATION FRAMEWORK SELECTOR TABS */}
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, marginRight: '4px', color: 'var(--color-text-secondary)' }}>
            Accreditation Framework:
          </span>
          {Object.values(ACCREDITATION_FRAMEWORKS).map((fw) => {
            const isSelected = selectedFramework === fw;
            return (
              <button
                key={fw}
                onClick={() => setSelectedFramework(fw)}
                type="button"
                style={{
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: isSelected ? '#ffffff' : 'var(--color-text)',
                  fontWeight: isSelected ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {fw === 'INTERNAL' ? 'Internal Quality Audit' : fw}
              </button>
            );
          })}
        </div>

        {currentFwConfig && (
          <div
            style={{
              marginTop: '12px',
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-hover)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--color-primary)',
            }}
          >
            <strong style={{ color: 'var(--color-text)' }}>{currentFwConfig.name}:</strong> {currentFwConfig.description}
          </div>
        )}
      </div>

      {/* 2. MANDATORY STATUTORY DISCLAIMER (EXPLICIT REQUIREMENT) */}
      <div
        className="compliance-disclaimer-banner"
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderLeft: '5px solid #d97706',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: '20px', lineHeight: 1, color: '#b45309' }} aria-hidden="true" />
        <div style={{ fontSize: '12.5px', color: '#92400e', lineHeight: 1.45 }}>
          <strong>MANDATORY STATUTORY DISCLAIMER:</strong> Generating or viewing reports within this system does{' '}
          <strong>NOT</strong> constitute official compliance, accreditation, or certification by NAAC, NBA, NIRF,
          AACSB, or any statutory regulatory agency. Data and metrics are compiled exclusively from internal
          institutional records for audit preparation and quality assurance. Every metric must be verified against
          official accreditation submissions and source evidentiary documents.
        </div>
      </div>

      {/* 3. REPORT CATALOG SELECTOR (ALL 20 REPORTS) */}
      <div
        className="report-catalog-panel"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-file-earmark-bar-graph text-primary" aria-hidden="true" />
            Select Institutional Report (20 Formats)
          </h2>
          {activeReportMeta && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Mapped to: <strong style={{ color: '#0369a1' }}>{activeReportMeta.frameworkMappings[selectedFramework]}</strong>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {metaLoading && reportTypes.length === 0 && (
            <div role="status" aria-busy="true" aria-label="Loading report formats" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {categories.map((cat) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Skeleton variant="text" width={130} height={12} />
                  <Skeleton variant="rect" width={140} height={28} />
                  <Skeleton variant="rect" width={160} height={28} />
                  <Skeleton variant="rect" width={120} height={28} />
                </div>
              ))}
            </div>
          )}
          {categories.map((cat) => {
            const catReports = reportTypes.filter((r) => r.category === cat.id);
            if (catReports.length === 0) return null;
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    minWidth: '130px',
                    letterSpacing: '0.4px',
                  }}
                >
                  {cat.label}:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                  {catReports.map((r) => {
                    const isSelected = selectedReportType === r.type;
                    const isAllowed = r.isAllowed !== false;
                    return (
                      <button
                        key={r.type}
                        onClick={() => setSelectedReportType(r.type)}
                        disabled={!isAllowed}
                        title={isAllowed ? r.description : 'Your role does not have permission for this report'}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '5px',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                          background: isSelected ? '#eff6ff' : isAllowed ? '#ffffff' : '#f1f5f9',
                          color: isSelected ? '#1d4ed8' : isAllowed ? '#334155' : '#94a3b8',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '12px',
                          cursor: isAllowed ? 'pointer' : 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {!isAllowed && <i className="bi bi-lock-fill" aria-hidden="true" />}
                        {r.title.replace(' Report', '')}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MULTI-FACTOR FILTER BAR & ACTIONS */}
      <div
        className="filter-bar-card"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          {/* Academic Year */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Academic Year
            </label>
            <select
              value={academicYear}
              onChange={(e) => {
                setAcademicYear(e.target.value);
                setYearChosen(true);
              }}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
              }}
            >
              <option value="">All Academic Years</option>
              {academicYears.map((y) => (
                <option key={y} value={y}>
                  {y}{y === currentYear ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Department {user?.role === 'HOD' || user?.role === 'FACULTY' ? '(Locked to Your Dept)' : ''}
            </label>
            <select
              value={departmentId}
              disabled={user?.role === 'HOD' || user?.role === 'FACULTY'}
              onChange={(e) => setDepartmentId(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: user?.role === 'HOD' || user?.role === 'FACULTY' ? '#f1f5f9' : '#ffffff',
              }}
            >
              <option value="">All Departments (Institution-Wide)</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Verification Status */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Verification Status
            </label>
            <select
              value={verification}
              onChange={(e) => setVerification(e.target.value as VerificationFilter)}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
              }}
            >
              <option value="ALL">All Records (Verified & Pending)</option>
              <option value="VERIFIED">Verified Records Only</option>
              <option value="PENDING">Pending Verification</option>
              <option value="REJECTED">Returned / Rejected</option>
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Keyword Search
            </label>
            <input
              type="text"
              placeholder="Search faculty, title, roll no..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        {/* Action Controls & Export Buttons */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? <span className="spinner spinner-sm" aria-hidden="true" /> : <i className="bi bi-arrow-clockwise" aria-hidden="true" />}
            {loading ? 'Compiling Dossier...' : 'Refresh Report'}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Export CSV */}
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting !== null || !reportResult}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {exporting === 'csv' ? <span className="spinner spinner-sm" aria-hidden="true" /> : <i className="bi bi-file-earmark-text" aria-hidden="true" />}
              {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
            </button>

            {/* Export Excel */}
            <button
              onClick={() => handleExport('excel')}
              disabled={exporting !== null || !reportResult}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#15803d',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {exporting === 'excel' ? <span className="spinner spinner-sm" aria-hidden="true" /> : <i className="bi bi-file-earmark-spreadsheet" aria-hidden="true" />}
              {exporting === 'excel' ? 'Exporting...' : 'Export Excel (.xls)'}
            </button>

            {/* Print / PDF */}
            <button
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null || !reportResult}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {exporting === 'pdf' ? <span className="spinner spinner-sm" aria-hidden="true" /> : <i className="bi bi-printer" aria-hidden="true" />}
              {exporting === 'pdf' ? 'Rendering...' : 'Print / Save PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ERROR STATES */}
      {error && !reportResult && !loading ? (
        <div style={{ margin: '2rem auto', maxWidth: '640px' }}>
          <ErrorState
            title="Failed to compile report dossier"
            message={error}
            onRetry={handleGenerateReport}
            retryText="Retry Report Generation"
          />
        </div>
      ) : error && reportResult ? (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Error:</strong> {error}
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', padding: '4px' }}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* First report still compiling: skeleton tiles and table, never an empty state */}
      {loading && !reportResult && !error && (
        <div role="status" aria-busy="true" aria-label="Compiling report">
          <SkeletonStats count={4} className="mb-4" />
          <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: '20px' }}>
            <SkeletonTable rows={8} columns={6} />
          </div>
        </div>
      )}

      {/* Regenerating (type, framework, filters, refresh): keep the current report under an activity bar */}
      {loading && reportResult && (
        <div className="loading-bar" role="progressbar" aria-label="Compiling report" style={{ marginBottom: '12px', borderRadius: '2px' }} />
      )}

      {/* 5. SUMMARY KPI METRIC CARDS */}
      {reportResult && reportResult.summary.metrics.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginBottom: '20px',
          }}
        >
          {reportResult.summary.metrics.map((m, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#64748b' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
                  {m.value}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                Source Collection: <code style={{ color: '#0369a1' }}>{m.sourceCollection}</code>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. TRACEABLE DATA TABLE */}
      {reportResult && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* Table Header Details */}
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                {reportResult.reportTitle}
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Showing <strong>{reportResult.rows.length}</strong> traceable records &bull; Department:{' '}
                <strong>{reportResult.header.department}</strong> &bull; Year:{' '}
                <strong>{reportResult.header.academicYear}</strong>
              </div>
            </div>

            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
              Generated By: <strong>{reportResult.header.generatedBy.name}</strong> on{' '}
              {new Date(reportResult.header.generatedDate).toLocaleDateString()}
            </div>
          </div>

          {/* Table Content */}
          <div style={{ overflowX: 'auto' }}>
            <table
              className={loading ? 'table-refreshing' : undefined}
              aria-busy={loading}
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}
            >
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>#</th>
                  {reportResult.columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: '10px 14px',
                        textAlign: col.type === 'currency' ? 'right' : 'left',
                        fontWeight: 600,
                        color: '#475569',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>
                    Source Trace (Audit)
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportResult.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={reportResult.columns.length + 2}
                      style={{ padding: 0 }}
                    >
                      {searchFilter.trim() || verification !== 'ALL' ? (
                        <EmptyState
                          icon="bi-funnel"
                          title={`No ${reportResult.reportTitle} records match your filters`}
                          reason="No records match the current keyword search or verification status filter."
                          nextStep="Clear the keyword search or set Verification Status to All Records, then generate the report again."
                        />
                      ) : (
                        <EmptyState
                          icon="bi-file-earmark-bar-graph"
                          title={`No records for ${reportResult.reportTitle} (${reportResult.header.academicYear}, ${reportResult.header.department})`}
                          reason="Nothing that this report draws on has been recorded for the selected academic year and department yet."
                          nextStep="Choose a different academic year or department, or regenerate once faculty submit the relevant records."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  reportResult.rows.map((row, index) => {
                    const trace = row._trace;
                    return (
                      <tr
                        key={index}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa',
                        }}
                      >
                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '12px' }}>
                          {index + 1}
                        </td>
                        {reportResult.columns.map((col) => {
                          const val = row[col.key];
                          if (col.type === 'badge') {
                            const isGreen =
                              val === 'VERIFIED' || val === 'COMPLIANT' || val === 'GRANTED' || val === 'PRESENT';
                            const isRed =
                              val === 'REJECTED' || val === 'REVIEW_REQUIRED';
                            return (
                              <td key={col.key} style={{ padding: '10px 14px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: isGreen ? '#dcfce7' : isRed ? '#fee2e2' : '#fef3c7',
                                    color: isGreen ? '#166534' : isRed ? '#991b1b' : '#92400e',
                                  }}
                                >
                                  {String(val ?? 'N/A')}
                                </span>
                              </td>
                            );
                          }
                          if (col.type === 'currency' && typeof val === 'number') {
                            return (
                              <td key={col.key} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                                ₹{val.toLocaleString('en-IN')}
                              </td>
                            );
                          }
                          return (
                            <td key={col.key} style={{ padding: '10px 14px', color: '#334155' }}>
                              {String(val ?? '-')}
                            </td>
                          );
                        })}

                        {/* LINEAGE TRACE CELL */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleInspectTrace(trace)}
                            title="Inspect source record lineage"
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-search" aria-hidden="true" />
                            <span>{trace.sourceCollection.split('.')[0]}: {trace.referenceCode || trace.sourceRecordId.slice(-6)}</span>
                          </button>
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

      {/* 7. SOURCE RECORD INSPECTION MODAL */}
      {inspectingTrace && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingTrace(null)}
          title={`Source Record Audit Trail: ${inspectingTrace.referenceCode || inspectingTrace.sourceRecordId}`}
        >
          <div style={{ padding: '10px 0' }}>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '12.5px',
              }}
            >
              <div><strong>Source Collection:</strong> <code>{inspectingTrace.sourceCollection}</code></div>
              <div><strong>Document ID:</strong> <code>{inspectingTrace.sourceRecordId}</code></div>
              <div><strong>Faculty Associated:</strong> {inspectingTrace.facultyName || inspectingTrace.sourceFacultyId}</div>
              <div><strong>Verification Status:</strong> <span style={{ fontWeight: 600, color: '#166534' }}>{inspectingTrace.verificationStatus}</span></div>
            </div>

            {traceLoading ? (
              <div role="status" aria-busy="true" aria-label="Loading source document details" style={{ padding: '8px 0' }}>
                <Skeleton variant="text" width="45%" height={14} style={{ marginBottom: '10px' }} />
                <Skeleton variant="rect" width="100%" height={180} />
              </div>
            ) : traceDetail ? (
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Underlying MongoDB Source Record Payload:
                </h4>
                <pre
                  style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    padding: '14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(traceDetail, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '13px' }}>
                Source document verified in database.
              </div>
            )}

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => setInspectingTrace(null)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
