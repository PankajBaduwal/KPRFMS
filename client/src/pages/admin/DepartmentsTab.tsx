// Extracted from AdminPage.tsx — the "departments" tab.
import { EmptyState } from '../../components/EmptyState';
import React from 'react';
import type { IAdminDepartment, IAdminProgram } from '../../types/admin';

export interface DepartmentsTabProps {
  departmentsList: IAdminDepartment[];
  deptSearch: string;
  deptStatusFilter: "ALL" | "ACTIVE" | "INACTIVE";
  deptSubTab: "programs" | "depts";
  filteredDepartments: IAdminDepartment[];
  filteredPrograms: IAdminProgram[];
  handleDeleteDept: (dept: IAdminDepartment) => void;
  handleDeleteProgram: (prog: IAdminProgram) => void;
  progDeptFilter: string;
  progLevelFilter: string;
  progSearch: string;
  progStatusFilter: "ALL" | "ACTIVE" | "INACTIVE";
  programsList: IAdminProgram[];
  setDeptFormData: React.Dispatch<React.SetStateAction<{ code: string; name: string; hodId: string; isActive: boolean; }>>;
  setDeptModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeptSearch: React.Dispatch<React.SetStateAction<string>>;
  setDeptStatusFilter: React.Dispatch<React.SetStateAction<"ALL" | "ACTIVE" | "INACTIVE">>;
  setDeptSubTab: React.Dispatch<React.SetStateAction<"programs" | "depts">>;
  setEditingDept: React.Dispatch<React.SetStateAction<IAdminDepartment | null>>;
  setEditingProg: React.Dispatch<React.SetStateAction<IAdminProgram | null>>;
  setProgDeptFilter: React.Dispatch<React.SetStateAction<string>>;
  setProgFormData: React.Dispatch<React.SetStateAction<{ code: string; name: string; departmentId: string; degreeLevel: string; durationYears: number; totalSemesters: number; status: string; }>>;
  setProgLevelFilter: React.Dispatch<React.SetStateAction<string>>;
  setProgModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProgSearch: React.Dispatch<React.SetStateAction<string>>;
  setProgStatusFilter: React.Dispatch<React.SetStateAction<"ALL" | "ACTIVE" | "INACTIVE">>;
}

export const DepartmentsTab: React.FC<DepartmentsTabProps> = ({ departmentsList, deptSearch, deptStatusFilter, deptSubTab, filteredDepartments, filteredPrograms, handleDeleteDept, handleDeleteProgram, progDeptFilter, progLevelFilter, progSearch, progStatusFilter, programsList, setDeptFormData, setDeptModalOpen, setDeptSearch, setDeptStatusFilter, setDeptSubTab, setEditingDept, setEditingProg, setProgDeptFilter, setProgFormData, setProgLevelFilter, setProgModalOpen, setProgSearch, setProgStatusFilter }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sub tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setDeptSubTab('depts')}
                className={`btn btn-sm ${deptSubTab === 'depts' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-diagram-3 me-1" /> Departments ({departmentsList.length})
              </button>
              <button
                type="button"
                onClick={() => setDeptSubTab('programs')}
                className={`btn btn-sm ${deptSubTab === 'programs' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-mortarboard me-1" /> Degree Programs ({programsList.length})
              </button>
            </div>
  
            {/* Sub Tab: Departments */}
            {deptSubTab === 'depts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Department Filters Bar */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    padding: '1rem 1.25rem',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Search by department name or code..."
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      style={{ maxWidth: '300px' }}
                    />
                    <select
                      className="form-select form-select-sm"
                      value={deptStatusFilter}
                      onChange={(e) => setDeptStatusFilter(e.target.value as any)}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">Active Units</option>
                      <option value="INACTIVE">Inactive Units</option>
                    </select>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Showing <strong>{filteredDepartments.length}</strong> of {departmentsList.length} departments
                    </span>
                  </div>
  
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingDept(null);
                      setDeptFormData({ code: '', name: '', hodId: '', isActive: true });
                      setDeptModalOpen(true);
                    }}
                  >
                    <i className="bi bi-plus-lg me-1" /> New Department
                  </button>
                </div>
  
                {/* Department Table */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Department Name</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Head of Department</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Faculty</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Programs</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDepartments.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: 0 }}>
                              {deptSearch.trim() || deptStatusFilter !== 'ALL' ? (
                                <EmptyState
                                  icon="bi-funnel"
                                  title="No departments match your filter"
                                  reason="No academic departments match the entered search or status filter."
                                  nextStep="Clear your filter criteria to see all departments."
                                  compact
                                />
                              ) : (
                                <EmptyState
                                  icon="bi-building"
                                  title="No academic departments created yet"
                                  reason="Faculty, programs and subjects all belong to a department, so none can be assigned until one exists."
                                  nextStep="Use New Department above to add the first department."
                                  compact
                                />
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredDepartments.map((d) => (
                            <tr key={d._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'monospace' }}>{d.code}</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#172B45' }}>{d.name}</td>
                              <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                                {d.hodId ? `${d.hodId.name} (${d.hodId.employeeId})` : '— Not Assigned —'}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span className="badge bg-light text-dark border">{d.facultyCount || 0} Faculty</span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span className="badge bg-light text-dark border">{d.programCount || 0} Programs</span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.725rem',
                                    fontWeight: 600,
                                    backgroundColor: d.isActive ? '#dcfce7' : '#fee2e2',
                                    color: d.isActive ? '#15803d' : '#991b1b',
                                  }}
                                >
                                  {d.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => {
                                      setEditingDept(d);
                                      setDeptFormData({
                                        code: d.code,
                                        name: d.name,
                                        hodId: d.hodId ? d.hodId._id : '',
                                        isActive: d.isActive,
                                      });
                                      setDeptModalOpen(true);
                                    }}
                                  >
                                    <i className="bi bi-pencil" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleDeleteDept(d)}
                                  >
                                    <i className="bi bi-trash" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
  
            {/* Sub Tab: Programs */}
            {deptSubTab === 'programs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Program Filters Bar */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    padding: '1rem 1.25rem',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Search program by name or code..."
                      value={progSearch}
                      onChange={(e) => setProgSearch(e.target.value)}
                      style={{ maxWidth: '260px' }}
                    />
                    <select
                      className="form-select form-select-sm"
                      value={progDeptFilter}
                      onChange={(e) => setProgDeptFilter(e.target.value)}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Departments</option>
                      {departmentsList.map((d) => (
                        <option key={d._id} value={d.code}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                    <select
                      className="form-select form-select-sm"
                      value={progLevelFilter}
                      onChange={(e) => setProgLevelFilter(e.target.value as any)}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Degree Levels</option>
                      <option value="UG">Undergraduate (UG)</option>
                      <option value="PG">Postgraduate (PG)</option>
                      <option value="PHD">Doctoral (Ph.D.)</option>
                      <option value="DIPLOMA">Diploma</option>
                    </select>
                    <select
                      className="form-select form-select-sm"
                      value={progStatusFilter}
                      onChange={(e) => setProgStatusFilter(e.target.value as any)}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active Programs</option>
                      <option value="INACTIVE">Inactive Programs</option>
                    </select>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Showing <strong>{filteredPrograms.length}</strong> of {programsList.length} programs
                    </span>
                  </div>
  
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingProg(null);
                      setProgFormData({
                        code: '',
                        name: '',
                        departmentId: departmentsList[0]?._id || '',
                        degreeLevel: 'UG',
                        durationYears: 4,
                        totalSemesters: 8,
                        status: 'ACTIVE',
                      });
                      setProgModalOpen(true);
                    }}
                  >
                    <i className="bi bi-plus-lg me-1" /> New Program
                  </button>
                </div>
  
                {/* Programs Table */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Code</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Program Name</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Department</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Level</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Duration</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPrograms.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: 0 }}>
                              {progSearch.trim() || progDeptFilter !== 'ALL' || progLevelFilter !== 'ALL' || progStatusFilter !== 'ALL' ? (
                                <EmptyState
                                  icon="bi-funnel"
                                  title="No programs match your filters"
                                  reason="No degree programs match the current search, department, degree level or status criteria."
                                  nextStep="Clear your filter criteria to see all registered degree programs."
                                  compact
                                />
                              ) : (
                                <EmptyState
                                  icon="bi-mortarboard"
                                  title="No degree programs created yet"
                                  reason="No UG or PG programs have been registered under any department."
                                  nextStep="Use New Program above to add the first program."
                                  compact
                                />
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredPrograms.map((p) => {
                            const deptName =
                              typeof p.departmentId === 'object' && p.departmentId
                                ? p.departmentId.name
                                : p.departmentCode || '—';
                            return (
                              <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontFamily: 'monospace' }}>{p.code}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#172B45' }}>{p.name}</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{deptName}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span className="badge bg-secondary">{p.degreeLevel}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  {p.durationYears} Years ({p.totalSemesters} Sems)
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span
                                    style={{
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.725rem',
                                      fontWeight: 600,
                                      backgroundColor: p.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                                      color: p.status === 'ACTIVE' ? '#15803d' : '#991b1b',
                                    }}
                                  >
                                    {p.status}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => {
                                        setEditingProg(p);
                                        setProgFormData({
                                          code: p.code,
                                          name: p.name,
                                          departmentId:
                                            typeof p.departmentId === 'object' && p.departmentId
                                              ? p.departmentId._id
                                              : (p.departmentId as string) || '',
                                          degreeLevel: p.degreeLevel,
                                          durationYears: p.durationYears,
                                          totalSemesters: p.totalSemesters,
                                          status: p.status,
                                        });
                                        setProgModalOpen(true);
                                      }}
                                    >
                                      <i className="bi bi-pencil" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleDeleteProgram(p)}
                                    >
                                      <i className="bi bi-trash" />
                                    </button>
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
              </div>
            )}
          </div>
  );
};
