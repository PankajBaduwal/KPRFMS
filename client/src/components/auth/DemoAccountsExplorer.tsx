import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  authService,
  type DemoCatalogResponse,
  type DemoInstitutionItem,
} from '../../services/auth.service';
import { setInstitutionCode } from '../../lib/institution';
import { useAuthStore } from '../../stores/authStore';
import { ROUTES } from '../../constants/routes';
import '../../styles/demo-explorer.css';

interface DemoAccountsExplorerProps {
  onClose?: () => void;
  onFillCredentials?: (email: string, role: string) => void;
  isModal?: boolean;
}

const DEFAULT_PASSWORDS: Record<string, string> = {
  ADMIN: 'Admin@12345',
  PRINCIPAL: 'Principal@12345',
  DEAN: 'Dean@12345',
  HOD: 'Hod@12345',
  FACULTY: 'Faculty@12345',
};

export const DemoAccountsExplorer: React.FC<DemoAccountsExplorerProps> = ({
  onClose,
  onFillCredentials,
  isModal = false,
}) => {
  const navigate = useNavigate();
  const { setSessionUser } = useAuthStore();
  const [catalog, setCatalog] = useState<DemoCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstCode, setSelectedInstCode] = useState<string>('kpriet');
  const [selectedDeptCode, setSelectedDeptCode] = useState<string>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [authenticatingEmail, setAuthenticatingEmail] = useState<string | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    authService
      .getDemoAccounts()
      .then((data) => {
        if (mounted) {
          setCatalog(data);
          if (data.institutions.length > 0) {
            setSelectedInstCode(data.institutions[0].institution.code);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load demo accounts catalog.');
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentInst = useMemo<DemoInstitutionItem | null>(() => {
    if (!catalog || selectedInstCode === 'platform') return null;
    return catalog.institutions.find((i) => i.institution.code === selectedInstCode) || null;
  }, [catalog, selectedInstCode]);

  const handleDemoLogin = async (account: {
    institutionCode: string;
    email: string;
    role: string;
    name: string;
  }) => {
    setAuthenticatingEmail(account.email);
    setError(null);
    try {
      const res = await authService.demoLogin({
        institutionCode: account.institutionCode,
        email: account.email,
        role: account.role,
      });

      if (account.institutionCode !== 'platform') {
        setInstitutionCode(account.institutionCode);
        setSessionUser(res.user);
        if (onClose) onClose();
        navigate(ROUTES.PORTAL);
      } else {
        if (onClose) onClose();
        window.location.href = '/platform';
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Demo sign-in failed. Please try again.');
      setAuthenticatingEmail(null);
    }
  };

  const handleCopyCredentials = (email: string, role: string) => {
    const password = DEFAULT_PASSWORDS[role] || 'Faculty@12345';
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const toggleDeptExpanded = (deptCode: string) => {
    setExpandedDepts((prev) => ({ ...prev, [deptCode]: !prev[deptCode] }));
  };

  // Filtered departments and faculty
  const filteredDepartments = useMemo(() => {
    if (!currentInst) return [];
    const q = searchQuery.trim().toLowerCase();

    return currentInst.departments
      .filter((dept) => {
        if (selectedDeptCode !== 'ALL' && dept.code !== selectedDeptCode) return false;
        return true;
      })
      .map((dept) => {
        const hodMatches =
          dept.hod &&
          (selectedRoleFilter === 'ALL' || selectedRoleFilter === 'HOD') &&
          (!q ||
            dept.hod.name.toLowerCase().includes(q) ||
            dept.hod.email.toLowerCase().includes(q) ||
            dept.hod.employeeId.toLowerCase().includes(q) ||
            dept.name.toLowerCase().includes(q) ||
            dept.code.toLowerCase().includes(q));

        const facultyMatches = dept.faculty.filter((fac) => {
          if (selectedRoleFilter === 'HOD') return false;
          if (!q) return true;
          return (
            fac.name.toLowerCase().includes(q) ||
            fac.email.toLowerCase().includes(q) ||
            fac.employeeId.toLowerCase().includes(q) ||
            fac.designation.toLowerCase().includes(q) ||
            dept.name.toLowerCase().includes(q)
          );
        });

        const showHod = selectedRoleFilter !== 'FACULTY' && (q ? hodMatches : true);

        return {
          ...dept,
          showHod,
          filteredFaculty: facultyMatches,
        };
      })
      .filter((dept) => dept.showHod || dept.filteredFaculty.length > 0);
  }, [currentInst, selectedDeptCode, selectedRoleFilter, searchQuery]);

  return (
    <div className={`demo-explorer ${isModal ? 'demo-explorer--modal' : ''}`}>
      {/* Header */}
      <div className="demo-explorer-header">
        <div className="demo-explorer-title-box">
          <span className="demo-badge-tag">
            <i className="bi bi-shield-check" /> Instant Live Evaluation
          </span>
          <h2 className="demo-explorer-title">Explore FacultyCore Demonstration Accounts</h2>
          <p className="demo-explorer-subtitle">
            Experience live institutional dashboards with real sample data across departments. One click securely
            authenticates the account and opens the correct portal.
          </p>
        </div>
        {onClose && (
          <button type="button" className="demo-close-btn" onClick={onClose} aria-label="Close demo accounts">
            <i className="bi bi-x-lg" />
          </button>
        )}
      </div>

      {error && (
        <div className="demo-error-banner" role="alert">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="demo-loading-state">
          <div className="demo-spinner" />
          <p>Loading verified college accounts and departmental rosters...</p>
        </div>
      ) : !catalog ? (
        <div className="demo-empty-state">
          <p>Unable to load demonstration accounts at this time.</p>
        </div>
      ) : (
        <>
          {/* Institution Selector Tabs */}
          <div className="demo-inst-tabs" role="tablist" aria-label="Colleges">
            {catalog.institutions.map((inst) => {
              const active = selectedInstCode === inst.institution.code;
              return (
                <button
                  key={inst.institution.code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`demo-inst-tab ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedInstCode(inst.institution.code);
                    setSelectedDeptCode('ALL');
                    setSearchQuery('');
                  }}
                >
                  <span className="demo-tab-icon">
                    <i className="bi bi-bank2" />
                  </span>
                  <span className="demo-tab-text">
                    <strong className="demo-tab-title">{inst.institution.name}</strong>
                    <span className="demo-tab-meta">
                      {inst.institution.city ? `${inst.institution.city}, ` : ''}
                      {inst.institution.state || 'India'} &bull; {inst.departments.length} Departments
                    </span>
                  </span>
                </button>
              );
            })}

            {/* Platform Super Admin Tab */}
            {catalog.platformSuperAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={selectedInstCode === 'platform'}
                className={`demo-inst-tab demo-inst-tab--platform ${selectedInstCode === 'platform' ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedInstCode('platform');
                  setSearchQuery('');
                }}
              >
                <span className="demo-tab-icon">
                  <i className="bi bi-cpu" />
                </span>
                <span className="demo-tab-text">
                  <strong className="demo-tab-title">FacultyCore Super Admin</strong>
                  <span className="demo-tab-meta">Platform-Wide Operator Console</span>
                </span>
              </button>
            )}
          </div>

          {/* Platform Super Admin View */}
          {selectedInstCode === 'platform' && catalog.platformSuperAdmin && (
            <div className="demo-platform-section">
              <div className="demo-card demo-card--leadership demo-card--platform">
                <div className="demo-card-avatar">
                  <i className="bi bi-shield-lock-fill" />
                </div>
                <div className="demo-card-content">
                  <div className="demo-card-meta">
                    <span className="demo-role-badge demo-role-badge--platform">Platform Super Admin</span>
                    <span className="demo-empid">Console Operator</span>
                  </div>
                  <h3 className="demo-card-name">{catalog.platformSuperAdmin.name}</h3>
                  <p className="demo-card-desig">{catalog.platformSuperAdmin.designation}</p>
                  <p className="demo-card-email">
                    <i className="bi bi-envelope" /> {catalog.platformSuperAdmin.email}
                  </p>
                </div>
                <div className="demo-card-actions">
                  <button
                    type="button"
                    className="demo-btn demo-btn-primary"
                    disabled={authenticatingEmail === catalog.platformSuperAdmin.email}
                    onClick={() =>
                      handleDemoLogin({
                        institutionCode: 'platform',
                        email: catalog.platformSuperAdmin.email,
                        role: 'PLATFORM_SUPER_ADMIN',
                        name: catalog.platformSuperAdmin.name,
                      })
                    }
                  >
                    {authenticatingEmail === catalog.platformSuperAdmin.email ? (
                      <>
                        <span className="demo-btn-spinner" /> Authenticating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right" /> Login as Super Admin
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Institutional View */}
          {currentInst && (
            <div className="demo-inst-content">
              {/* Institutional Leadership Row */}
              <div className="demo-section-block">
                <div className="demo-block-head">
                  <h3 className="demo-block-title">
                    <i className="bi bi-stars" /> Institutional Leadership &amp; Governance
                  </h3>
                  <span className="demo-block-sub">
                    Direct access to college-wide executive metrics, appraisals, approvals, and administrative settings.
                  </span>
                </div>

                <div className="demo-leadership-grid">
                  {currentInst.leadership.map((leader) => (
                    <div key={leader.id} className="demo-card demo-card--leadership">
                      <div className="demo-card-top">
                        <span className={`demo-role-badge demo-role-badge--${leader.role.toLowerCase()}`}>
                          {leader.roleLabel || leader.role}
                        </span>
                        <span className="demo-empid">{leader.employeeId}</span>
                      </div>

                      <div className="demo-card-main">
                        <h4 className="demo-card-name">{leader.name}</h4>
                        <p className="demo-card-desig">{leader.designation}</p>
                        <p className="demo-card-inst-name">{currentInst.institution.name}</p>
                        <p className="demo-card-email">
                          <i className="bi bi-envelope" /> {leader.email}
                        </p>
                      </div>

                      <div className="demo-card-actions">
                        <button
                          type="button"
                          className="demo-btn demo-btn-primary"
                          disabled={authenticatingEmail === leader.email}
                          onClick={() =>
                            handleDemoLogin({
                              institutionCode: currentInst.institution.code,
                              email: leader.email,
                              role: leader.role,
                              name: leader.name,
                            })
                          }
                        >
                          {authenticatingEmail === leader.email ? (
                            <>
                              <span className="demo-btn-spinner" /> Authenticating...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-box-arrow-in-right" /> Login as {leader.roleLabel || leader.role}
                            </>
                          )}
                        </button>
                        {onFillCredentials && (
                          <button
                            type="button"
                            className="demo-btn demo-btn-secondary"
                            onClick={() => onFillCredentials(leader.email, leader.role)}
                          >
                            Fill Form
                          </button>
                        )}
                        <button
                          type="button"
                          className="demo-btn demo-btn-ghost"
                          title="Copy login credentials"
                          onClick={() => handleCopyCredentials(leader.email, leader.role)}
                        >
                          {copiedEmail === leader.email ? (
                            <span className="demo-copied">Copied!</span>
                          ) : (
                            <i className="bi bi-clipboard" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Departmental Filter Bar */}
              <div className="demo-filter-bar">
                <div className="demo-search-box">
                  <i className="bi bi-search" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search faculty or HOD by name, email, employee ID..."
                    className="demo-search-input"
                  />
                  {searchQuery && (
                    <button type="button" className="demo-clear-search" onClick={() => setSearchQuery('')}>
                      <i className="bi bi-x-circle-fill" />
                    </button>
                  )}
                </div>

                <div className="demo-filter-group">
                  <div className="demo-role-pills" role="radiogroup" aria-label="Role filter">
                    <button
                      type="button"
                      className={`demo-pill ${selectedRoleFilter === 'ALL' ? 'is-active' : ''}`}
                      onClick={() => setSelectedRoleFilter('ALL')}
                    >
                      All Roles
                    </button>
                    <button
                      type="button"
                      className={`demo-pill ${selectedRoleFilter === 'HOD' ? 'is-active' : ''}`}
                      onClick={() => setSelectedRoleFilter('HOD')}
                    >
                      HODs Only
                    </button>
                    <button
                      type="button"
                      className={`demo-pill ${selectedRoleFilter === 'FACULTY' ? 'is-active' : ''}`}
                      onClick={() => setSelectedRoleFilter('FACULTY')}
                    >
                      Faculty Only
                    </button>
                  </div>
                </div>
              </div>

              {/* Department Pills */}
              <div className="demo-dept-pills-scroll" role="tablist" aria-label="Departments">
                <button
                  type="button"
                  className={`demo-dept-pill ${selectedDeptCode === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setSelectedDeptCode('ALL')}
                >
                  All Departments ({currentInst.departments.length})
                </button>
                {currentInst.departments.map((d) => (
                  <button
                    key={d.code}
                    type="button"
                    className={`demo-dept-pill ${selectedDeptCode === d.code ? 'is-active' : ''}`}
                    onClick={() => setSelectedDeptCode(d.code)}
                  >
                    {d.code} &bull; {d.name}
                  </button>
                ))}
              </div>

              {/* Department Roster Sections */}
              <div className="demo-departments-container">
                {filteredDepartments.length === 0 ? (
                  <div className="demo-empty-search">
                    <i className="bi bi-person-x" />
                    <h4>No matching demo accounts found</h4>
                    <p>Try clearing your search query or selecting "All Departments".</p>
                    <button
                      type="button"
                      className="demo-btn demo-btn-secondary"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedDeptCode('ALL');
                        setSelectedRoleFilter('ALL');
                      }}
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  filteredDepartments.map((dept) => {
                    const isExpanded = expandedDepts[dept.code] || false;
                    const facultyToShow = isExpanded ? dept.filteredFaculty : dept.filteredFaculty.slice(0, 3);
                    const remainingFacultyCount = Math.max(0, dept.filteredFaculty.length - 3);

                    return (
                      <div key={dept.code} className="demo-dept-section">
                        <div className="demo-dept-header">
                          <div className="demo-dept-title-area">
                            <span className="demo-dept-badge">{dept.code}</span>
                            <h4 className="demo-dept-name">{dept.name}</h4>
                            <span className="demo-dept-count">
                              {dept.filteredFaculty.length + (dept.showHod ? 1 : 0)} accounts
                            </span>
                          </div>
                        </div>

                        <div className="demo-accounts-grid">
                          {/* HOD Card */}
                          {dept.showHod && dept.hod && (
                            <div className="demo-card demo-card--hod">
                              <div className="demo-card-top">
                                <span className="demo-role-badge demo-role-badge--hod">HOD &bull; {dept.code}</span>
                                <span className="demo-empid">{dept.hod.employeeId}</span>
                              </div>
                              <div className="demo-card-main">
                                <h5 className="demo-card-name">{dept.hod.name}</h5>
                                <p className="demo-card-desig">{dept.hod.designation || 'Head of Department'}</p>
                                <p className="demo-card-dept-name">Department of {dept.name}</p>
                                <p className="demo-card-email">
                                  <i className="bi bi-envelope" /> {dept.hod.email}
                                </p>
                              </div>
                              <div className="demo-card-actions">
                                <button
                                  type="button"
                                  className="demo-btn demo-btn-primary"
                                  disabled={authenticatingEmail === dept.hod.email}
                                  onClick={() =>
                                    handleDemoLogin({
                                      institutionCode: currentInst.institution.code,
                                      email: dept.hod!.email,
                                      role: 'HOD',
                                      name: dept.hod!.name,
                                    })
                                  }
                                >
                                  {authenticatingEmail === dept.hod.email ? (
                                    <>
                                      <span className="demo-btn-spinner" /> Authenticating...
                                    </>
                                  ) : (
                                    <>
                                      <i className="bi bi-box-arrow-in-right" /> Login as HOD
                                    </>
                                  )}
                                </button>
                                {onFillCredentials && (
                                  <button
                                    type="button"
                                    className="demo-btn demo-btn-secondary"
                                    onClick={() => onFillCredentials(dept.hod!.email, 'HOD')}
                                  >
                                    Fill Form
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="demo-btn demo-btn-ghost"
                                  title="Copy credentials"
                                  onClick={() => handleCopyCredentials(dept.hod!.email, 'HOD')}
                                >
                                  {copiedEmail === dept.hod.email ? (
                                    <span className="demo-copied">Copied!</span>
                                  ) : (
                                    <i className="bi bi-clipboard" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Faculty Members */}
                          {facultyToShow.map((faculty) => (
                            <div key={faculty.id} className="demo-card demo-card--faculty">
                              <div className="demo-card-top">
                                <span className="demo-role-badge demo-role-badge--faculty">Faculty Member</span>
                                <span className="demo-empid">{faculty.employeeId}</span>
                              </div>
                              <div className="demo-card-main">
                                <h5 className="demo-card-name">{faculty.name}</h5>
                                <p className="demo-card-desig">{faculty.designation}</p>
                                <p className="demo-card-dept-name">Dept of {dept.name}</p>
                                <p className="demo-card-email">
                                  <i className="bi bi-envelope" /> {faculty.email}
                                </p>
                              </div>
                              <div className="demo-card-actions">
                                <button
                                  type="button"
                                  className="demo-btn demo-btn-primary"
                                  disabled={authenticatingEmail === faculty.email}
                                  onClick={() =>
                                    handleDemoLogin({
                                      institutionCode: currentInst.institution.code,
                                      email: faculty.email,
                                      role: 'FACULTY',
                                      name: faculty.name,
                                    })
                                  }
                                >
                                  {authenticatingEmail === faculty.email ? (
                                    <>
                                      <span className="demo-btn-spinner" /> Authenticating...
                                    </>
                                  ) : (
                                    <>
                                      <i className="bi bi-box-arrow-in-right" /> Login as Faculty
                                    </>
                                  )}
                                </button>
                                {onFillCredentials && (
                                  <button
                                    type="button"
                                    className="demo-btn demo-btn-secondary"
                                    onClick={() => onFillCredentials(faculty.email, 'FACULTY')}
                                  >
                                    Fill Form
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="demo-btn demo-btn-ghost"
                                  title="Copy credentials"
                                  onClick={() => handleCopyCredentials(faculty.email, 'FACULTY')}
                                >
                                  {copiedEmail === faculty.email ? (
                                    <span className="demo-copied">Copied!</span>
                                  ) : (
                                    <i className="bi bi-clipboard" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* View all faculty toggle */}
                        {remainingFacultyCount > 0 && !isExpanded && (
                          <div className="demo-dept-expand-bar">
                            <button
                              type="button"
                              className="demo-expand-btn"
                              onClick={() => toggleDeptExpanded(dept.code)}
                            >
                              <i className="bi bi-chevron-down" /> View all {dept.filteredFaculty.length} faculty accounts
                              in {dept.code}
                            </button>
                          </div>
                        )}
                        {isExpanded && dept.filteredFaculty.length > 3 && (
                          <div className="demo-dept-expand-bar">
                            <button
                              type="button"
                              className="demo-expand-btn"
                              onClick={() => toggleDeptExpanded(dept.code)}
                            >
                              <i className="bi bi-chevron-up" /> Show fewer accounts in {dept.code}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
