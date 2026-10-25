// Extracted from AdminPage.tsx — the "curriculum" tab.
import { EmptyState } from '../../components/EmptyState';
import { Pagination } from '../../components/Pagination';
import React from 'react';
import type { IAdminDepartment, IAdminProgram, IAdminSubject } from '../../types/admin';

export interface CurriculumTabProps {
  defaultAcademicYear: string;
  defaultBatch: string;
  departmentsList: IAdminDepartment[];
  handleDeleteSubject: (subject: IAdminSubject) => void;
  programsList: IAdminProgram[];
  setEditingSubject: React.Dispatch<React.SetStateAction<IAdminSubject | null>>;
  setSubjectDeptFilter: React.Dispatch<React.SetStateAction<string>>;
  setSubjectFormData: React.Dispatch<React.SetStateAction<{ subjectCode: string; subjectName: string; department: string; program: string; semester: number; academicYear: string; credits: number; lectureHours: number; tutorialHours: number; practicalHours: number; batch: string; status: string; }>>;
  setSubjectModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSubjectPage: React.Dispatch<React.SetStateAction<number>>;
  setSubjectSearch: React.Dispatch<React.SetStateAction<string>>;
  setSubjectSemFilter: React.Dispatch<React.SetStateAction<string>>;
  subjectDeptFilter: string;
  subjectPage: number;
  subjectSearch: string;
  subjectSemFilter: string;
  subjectTotalPages: number;
  subjectsList: IAdminSubject[];
}

export const CurriculumTab: React.FC<CurriculumTabProps> = ({ defaultAcademicYear, defaultBatch, departmentsList, handleDeleteSubject, programsList, setEditingSubject, setSubjectDeptFilter, setSubjectFormData, setSubjectModalOpen, setSubjectPage, setSubjectSearch, setSubjectSemFilter, subjectDeptFilter, subjectPage, subjectSearch, subjectSemFilter, subjectTotalPages, subjectsList }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Filters & Action Bar */}
            <div
              style={{
                backgroundColor: '#fff',
                padding: '1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1 }}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search by code or course name..."
                  value={subjectSearch}
                  onChange={(e) => {
                    setSubjectSearch(e.target.value);
                    setSubjectPage(1);
                  }}
                  style={{ maxWidth: '240px' }}
                />
  
                <select
                  className="form-select form-select-sm"
                  value={subjectDeptFilter}
                  onChange={(e) => {
                    setSubjectDeptFilter(e.target.value);
                    setSubjectPage(1);
                  }}
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
                  value={subjectSemFilter}
                  onChange={(e) => {
                    setSubjectSemFilter(e.target.value);
                    setSubjectPage(1);
                  }}
                  style={{ width: 'auto' }}
                >
                  <option value="ALL">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={String(s)}>Semester {s}</option>
                  ))}
                </select>
              </div>
  
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectFormData({
                    subjectCode: '',
                    subjectName: '',
                    department: departmentsList[0]?.code || 'CSE',
                    program: programsList[0]?.code || 'B.E. CSE',
                    semester: 1,
                    academicYear: defaultAcademicYear,
                    credits: 3,
                    lectureHours: 3,
                    tutorialHours: 0,
                    practicalHours: 0,
                    batch: defaultBatch,
                    status: 'ACTIVE',
                  });
                  setSubjectModalOpen(true);
                }}
              >
                <i className="bi bi-plus-lg me-1" /> Add Subject
              </button>
            </div>
  
            {/* Subjects Table */}
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
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Course Code</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Subject Title</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Dept / Program</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Sem</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Credits</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>L-T-P</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsList.length > 0 ? (
                      subjectsList.map((sub) => (
                        <tr key={sub._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>
                            {sub.subjectCode}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                            {sub.subjectName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                            {sub.department} / {sub.program}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge bg-light text-dark border">Sem {sub.semester}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{sub.credits}</td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#64748b' }}>
                            {sub.lectureHours}-{sub.tutorialHours}-{sub.practicalHours}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.725rem',
                                fontWeight: 600,
                                backgroundColor: sub.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                                color: sub.status === 'ACTIVE' ? '#15803d' : '#991b1b',
                              }}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  setEditingSubject(sub);
                                  setSubjectFormData({
                                    subjectCode: sub.subjectCode,
                                    subjectName: sub.subjectName,
                                    department: sub.department,
                                    program: sub.program,
                                    semester: sub.semester,
                                    academicYear: sub.academicYear,
                                    credits: sub.credits,
                                    lectureHours: sub.lectureHours,
                                    tutorialHours: sub.tutorialHours,
                                    practicalHours: sub.practicalHours,
                                    batch: sub.batch,
                                    status: sub.status,
                                  });
                                  setSubjectModalOpen(true);
                                }}
                              >
                                <i className="bi bi-pencil" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteSubject(sub)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
                          {subjectSearch.trim() || subjectDeptFilter !== 'ALL' ? (
                            <EmptyState
                              icon="bi-funnel"
                              title="No subjects match your filters"
                              reason="No curriculum subjects match the current search or department filter."
                              nextStep="Clear the search box or select All Departments to see every subject."
                              compact
                            />
                          ) : (
                            <EmptyState
                              icon="bi-journal-bookmark"
                              title="No curriculum subjects added yet"
                              reason="The subject catalogue is empty, so subjects cannot be allocated to faculty."
                              nextStep="Use Add Subject above to add the first curriculum subject."
                              compact
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
  
              {/* Pagination */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <Pagination
                  currentPage={subjectPage}
                  totalPages={subjectTotalPages}
                  onPageChange={setSubjectPage}
                />
              </div>
            </div>
          </div>
  );
};
