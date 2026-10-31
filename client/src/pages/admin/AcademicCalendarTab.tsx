// Extracted from AdminPage.tsx — the "academic_calendar" tab.
import { EmptyState } from '../../components/EmptyState';
import React from 'react';
import type { IAdminAcademicYear, IAdminSemester } from '../../types/admin';

export interface AcademicCalendarTabProps {
  academicYearsList: IAdminAcademicYear[];
  aySearch: string;
  aySubTab: "semesters" | "years" | "all";
  defaultAcademicYear: string;
  filteredAcademicYears: IAdminAcademicYear[];
  filteredSemesters: IAdminSemester[];
  handleDeleteAy: (ay: IAdminAcademicYear) => void;
  handleDeleteSem: (sem: IAdminSemester) => void;
  handleSetCurrentAy: (ay: IAdminAcademicYear) => Promise<void>;
  handleSetCurrentSem: (sem: IAdminSemester) => Promise<void>;
  semSearch: string;
  semTypeFilter: "ALL" | "ODD" | "EVEN";
  semestersList: IAdminSemester[];
  setAyFormData: React.Dispatch<React.SetStateAction<{ name: string; startDate: string; endDate: string; status: string; description: string; }>>;
  setAyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAySearch: React.Dispatch<React.SetStateAction<string>>;
  setAySubTab: React.Dispatch<React.SetStateAction<"semesters" | "years" | "all">>;
  setEditingAy: React.Dispatch<React.SetStateAction<IAdminAcademicYear | null>>;
  setEditingSem: React.Dispatch<React.SetStateAction<IAdminSemester | null>>;
  setSemFormData: React.Dispatch<React.SetStateAction<{ name: string; semesterNumber: number; type: string; academicYear: string; startDate: string; endDate: string; status: string; }>>;
  setSemModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSemSearch: React.Dispatch<React.SetStateAction<string>>;
  setSemTypeFilter: React.Dispatch<React.SetStateAction<"ALL" | "ODD" | "EVEN">>;
}

export const AcademicCalendarTab: React.FC<AcademicCalendarTabProps> = ({ academicYearsList, aySearch, aySubTab, defaultAcademicYear, filteredAcademicYears, filteredSemesters, handleDeleteAy, handleDeleteSem, handleSetCurrentAy, handleSetCurrentSem, semSearch, semTypeFilter, semestersList, setAyFormData, setAyModalOpen, setAySearch, setAySubTab, setEditingAy, setEditingSem, setSemFormData, setSemModalOpen, setSemSearch, setSemTypeFilter }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sub Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setAySubTab('years')}
                className={`btn btn-sm ${aySubTab === 'years' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-calendar3 me-1" /> Academic Years ({academicYearsList.length})
              </button>
              <button
                type="button"
                onClick={() => setAySubTab('semesters')}
                className={`btn btn-sm ${aySubTab === 'semesters' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-calendar-range me-1" /> Semesters ({semestersList.length})
              </button>
              <button
                type="button"
                onClick={() => setAySubTab('all')}
                className={`btn btn-sm ${aySubTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-layout-split me-1" /> Side-by-Side Overview
              </button>
            </div>
  
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: aySubTab === 'all' ? 'repeat(auto-fit, minmax(460px, 1fr))' : '1fr',
                gap: '1.5rem',
              }}
            >
              {/* Academic Years Section */}
              {(aySubTab === 'years' || aySubTab === 'all') && (
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Academic Years</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Cycles & timelines</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search year..."
                        value={aySearch}
                        onChange={(e) => setAySearch(e.target.value)}
                        style={{ maxWidth: '160px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setEditingAy(null);
                          setAyFormData({ name: '', startDate: '', endDate: '', status: 'ACTIVE', description: '' });
                          setAyModalOpen(true);
                        }}
                      >
                        <i className="bi bi-plus-lg me-1" /> New Year
                      </button>
                    </div>
                  </div>
  
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredAcademicYears.length === 0 ? (
                      aySearch.trim() ? (
                        <EmptyState
                          icon="bi-funnel"
                          title="No academic years match search"
                          reason={`No academic cycle matches "${aySearch}".`}
                          nextStep="Clear the search input to see all academic years."
                          compact
                        />
                      ) : (
                        <EmptyState
                          icon="bi-calendar3"
                          title="No academic years configured"
                          reason="Records across the portal are organised by academic year, and none has been defined yet."
                          nextStep="Use New Year above to add the current academic year."
                          compact
                        />
                      )
                    ) : (
                      filteredAcademicYears.map((ay) => (
                        <div
                          key={ay._id}
                          style={{
                            padding: '0.875rem 1rem',
                            borderRadius: '8px',
                            border: ay.isCurrent ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                            backgroundColor: ay.isCurrent ? '#eff6ff' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#172B45' }}>{ay.name}</span>
                              {ay.isCurrent && <span className="badge bg-primary">CURRENT ACTIVE</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                              {new Date(ay.startDate).toLocaleDateString()} &mdash; {new Date(ay.endDate).toLocaleDateString()}
                              {ay.description && ` • ${ay.description}`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {!ay.isCurrent && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleSetCurrentAy(ay)}
                                title="Set as Current Active Year"
                              >
                                Set Active
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setEditingAy(ay);
                                setAyFormData({
                                  name: ay.name,
                                  startDate: ay.startDate ? ay.startDate.slice(0, 10) : '',
                                  endDate: ay.endDate ? ay.endDate.slice(0, 10) : '',
                                  status: ay.status,
                                  description: ay.description || '',
                                });
                                setAyModalOpen(true);
                              }}
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteAy(ay)}
                              disabled={ay.isCurrent}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
  
              {/* Semesters Section */}
              {(aySubTab === 'semesters' || aySubTab === 'all') && (
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Semesters</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Odd & Even Academic Terms</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search semester..."
                        value={semSearch}
                        onChange={(e) => setSemSearch(e.target.value)}
                        style={{ maxWidth: '150px' }}
                      />
                      <select
                        className="form-select form-select-sm"
                        value={semTypeFilter}
                        onChange={(e) => setSemTypeFilter(e.target.value as any)}
                        style={{ width: 'auto' }}
                      >
                        <option value="ALL">All Terms</option>
                        <option value="ODD">ODD Terms</option>
                        <option value="EVEN">EVEN Terms</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setEditingSem(null);
                          setSemFormData({
                            name: defaultAcademicYear ? `Odd Semester ${defaultAcademicYear}` : '',
                            semesterNumber: 1,
                            type: 'ODD',
                            academicYear: defaultAcademicYear,
                            startDate: '',
                            endDate: '',
                            status: 'ACTIVE',
                          });
                          setSemModalOpen(true);
                        }}
                      >
                        <i className="bi bi-plus-lg me-1" /> New Semester
                      </button>
                    </div>
                  </div>
  
                  <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredSemesters.length === 0 ? (
                      semSearch.trim() || semTypeFilter !== 'ALL' ? (
                        <EmptyState
                          icon="bi-funnel"
                          title="No semesters match filter"
                          reason="No odd or even semester terms match your search or term filter."
                          nextStep="Reset the filter to view all semester terms."
                          compact
                        />
                      ) : (
                        <EmptyState
                          icon="bi-calendar-week"
                          title="No semesters configured"
                          reason="No odd or even semester terms have been defined for any academic year."
                          nextStep="Use New Semester above to add a semester term."
                          compact
                        />
                      )
                    ) : (
                      filteredSemesters.map((sem) => (
                        <div
                          key={sem._id}
                          style={{
                            padding: '0.875rem 1rem',
                            borderRadius: '8px',
                            border: sem.isCurrent ? '2px solid #10b981' : '1px solid #e2e8f0',
                            backgroundColor: sem.isCurrent ? '#f0fdf4' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#172B45' }}>{sem.name}</span>
                              <span className="badge bg-secondary">{sem.type}</span>
                              {sem.isCurrent && <span className="badge bg-success">CURRENT</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                              AY: {sem.academicYear} | {new Date(sem.startDate).toLocaleDateString()} &mdash;{' '}
                              {new Date(sem.endDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {!sem.isCurrent && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleSetCurrentSem(sem)}
                              >
                                Set Active
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setEditingSem(sem);
                                setSemFormData({
                                  name: sem.name,
                                  semesterNumber: sem.semesterNumber,
                                  type: sem.type,
                                  academicYear: sem.academicYear,
                                  startDate: sem.startDate ? sem.startDate.slice(0, 10) : '',
                                  endDate: sem.endDate ? sem.endDate.slice(0, 10) : '',
                                  status: sem.status,
                                });
                                setSemModalOpen(true);
                              }}
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteSem(sem)}
                              disabled={sem.isCurrent}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
  );
};
