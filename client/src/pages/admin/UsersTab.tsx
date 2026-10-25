// Extracted from AdminPage.tsx — the "users" tab.
import { EmptyState } from '../../components/EmptyState';
import { Pagination } from '../../components/Pagination';
import { FEATURES } from '../../constants/features';
import React, { useState } from 'react';
import type { IAdminDepartment, IAdminOverview, IAdminRole, IAdminUser } from '../../types/admin';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { adminService } from '../../services/admin.service';
import { FacultyImportModal } from './FacultyImportModal';

export interface UsersTabProps {
  departmentsList: IAdminDepartment[];
  handleApproveRegistration: (user: IAdminUser) => Promise<void>;
  handleDeleteUser: (user: IAdminUser) => void;
  handleRejectRegistration: (user: IAdminUser) => Promise<void>;
  handleResetPassword: (user: IAdminUser) => Promise<void>;
  handleToggleUserStatus: (user: IAdminUser) => Promise<void>;
  overview: IAdminOverview | null;
  pendingRegistrations: number;
  rolesList: IAdminRole[];
  setEditingUser: React.Dispatch<React.SetStateAction<IAdminUser | null>>;
  setUserDeptFilter: React.Dispatch<React.SetStateAction<string>>;
  setUserFormData: React.Dispatch<React.SetStateAction<{ employeeId: string; name: string; email: string; phone: string; role: string; departmentId: string; designation: string; password: string; status: string; }>>;
  setUserModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setUserPage: React.Dispatch<React.SetStateAction<number>>;
  setUserRoleFilter: React.Dispatch<React.SetStateAction<string>>;
  setUserSearch: React.Dispatch<React.SetStateAction<string>>;
  setUserStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  setUserSubTab: React.Dispatch<React.SetStateAction<"roles" | "permissions" | "directory">>;
  userDeptFilter: string;
  userPage: number;
  userRoleFilter: string;
  userSearch: string;
  userStatusFilter: string;
  userSubTab: "roles" | "permissions" | "directory";
  userTotalPages: number;
  users: IAdminUser[];
  /** Reload the user list (after an import or a security reset) */
  onUsersChanged: () => void;
  showToast: (message: string) => void;
}

export const UsersTab: React.FC<UsersTabProps> = ({ departmentsList, handleApproveRegistration, handleDeleteUser, handleRejectRegistration, handleResetPassword, handleToggleUserStatus, overview, pendingRegistrations, rolesList, setEditingUser, setUserDeptFilter, setUserFormData, setUserModalOpen, setUserPage, setUserRoleFilter, setUserSearch, setUserStatusFilter, setUserSubTab, userDeptFilter, userPage, userRoleFilter, userSearch, userStatusFilter, userSubTab, userTotalPages, users, onUsersChanged, showToast }) => {
  const [importOpen, setImportOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<IAdminUser | null>(null);
  const [resetting, setResetting] = useState(false);

  const confirmResetTwoFactor = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await adminService.resetTwoFactor(resetTarget._id);
      showToast(res.message);
      onUsersChanged();
    } catch (err: any) {
      showToast(err?.message || 'Could not reset two-factor sign-in.');
    } finally {
      setResetting(false);
      setResetTarget(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sub Navigation: Directory / Roles / Permissions */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setUserSubTab('directory')}
                className={`btn btn-sm ${userSubTab === 'directory' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <i className="bi bi-people-fill" /> User Accounts ({overview?.metrics?.totalUsers ?? users.length})
              </button>
              <button
                type="button"
                onClick={() => setUserSubTab('roles')}
                className={`btn btn-sm ${userSubTab === 'roles' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <i className="bi bi-shield-lock-fill" /> Roles & Hierarchy ({rolesList.length || 5})
              </button>
              <button
                type="button"
                onClick={() => setUserSubTab('permissions')}
                className={`btn btn-sm ${userSubTab === 'permissions' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <i className="bi bi-key-fill" /> Permissions Matrix
              </button>
            </div>
  
            {/* Sub Tab: Directory */}
            {userSubTab === 'directory' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {pendingRegistrations > 0 && userStatusFilter !== 'PENDING' && (
                  <div
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      padding: '0.85rem 1.1rem',
                      borderRadius: '10px',
                      border: '1px solid #fcd34d',
                      backgroundColor: '#fffbeb',
                      color: '#92400e',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>
                      <i className="bi bi-person-plus-fill" style={{ marginRight: 8 }} />
                      <strong>{pendingRegistrations}</strong> faculty registration{pendingRegistrations === 1 ? '' : 's'} awaiting your approval
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-warning"
                      onClick={() => {
                        setUserStatusFilter('PENDING');
                        setUserPage(1);
                      }}
                    >
                      Review registrations
                    </button>
                  </div>
                )}
                {/* Filter Bar & Action Header */}
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
                      placeholder="Search by name, email, employee ID..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUserPage(1);
                      }}
                      style={{ maxWidth: '280px' }}
                    />
  
                    <select
                      className="form-select form-select-sm"
                      value={userRoleFilter}
                      onChange={(e) => {
                        setUserRoleFilter(e.target.value);
                        setUserPage(1);
                      }}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Roles</option>
                      {rolesList.map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.name}
                        </option>
                      ))}
                    </select>
  
                    <select
                      className="form-select form-select-sm"
                      value={userDeptFilter}
                      onChange={(e) => {
                        setUserDeptFilter(e.target.value);
                        setUserPage(1);
                      }}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Departments</option>
                      {departmentsList.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
  
                    <select
                      className="form-select form-select-sm"
                      value={userStatusFilter}
                      onChange={(e) => {
                        setUserStatusFilter(e.target.value);
                        setUserPage(1);
                      }}
                      style={{ width: 'auto' }}
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PENDING">PENDING APPROVAL</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
  
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setImportOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <i className="bi bi-file-earmark-spreadsheet" /> Import from Excel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingUser(null);
                      setUserFormData({
                        employeeId: '',
                        name: '',
                        email: '',
                        phone: '',
                        role: 'FACULTY',
                        departmentId: departmentsList[0]?._id || '',
                        designation: 'Assistant Professor',
                        password: '',
                        status: 'ACTIVE',
                      });
                      setUserModalOpen(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <i className="bi bi-person-plus-fill" /> Add New User
                  </button>
                  </div>
                </div>
  
                {/* Users Table */}
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
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Faculty / User</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Employee ID</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Role</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Department</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length > 0 ? (
                          users.map((u) => {
                            const deptName =
                              typeof u.departmentId === 'object' && u.departmentId
                                ? u.departmentId.name
                                : u.departmentId || '—';
                            return (
                              <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div
                                      style={{
                                        width: '34px',
                                        height: '34px',
                                        borderRadius: '50%',
                                        backgroundColor: '#e0e7ff',
                                        color: '#4338ca',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                      }}
                                    >
                                      {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                  {u.employeeId}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span
                                    style={{
                                      padding: '0.2rem 0.6rem',
                                      borderRadius: '9999px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      backgroundColor:
                                        u.role === 'ADMIN'
                                          ? '#fee2e2'
                                          : u.role === 'PRINCIPAL'
                                          ? '#fef3c7'
                                          : u.role === 'DEAN'
                                          ? '#e0e7ff'
                                          : u.role === 'HOD'
                                          ? '#f3e8ff'
                                          : '#ecfdf5',
                                      color:
                                        u.role === 'ADMIN'
                                          ? '#991b1b'
                                          : u.role === 'PRINCIPAL'
                                          ? '#92400e'
                                          : u.role === 'DEAN'
                                          ? '#3730a3'
                                          : u.role === 'HOD'
                                          ? '#6b21a8'
                                          : '#065f46',
                                    }}
                                  >
                                    {u.role}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{deptName}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span
                                    style={{
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontSize: '0.725rem',
                                      fontWeight: 600,
                                      backgroundColor: u.status === 'ACTIVE' ? '#dcfce7' : u.status === 'PENDING' ? '#fef3c7' : '#f1f5f9',
                                      color: u.status === 'ACTIVE' ? '#15803d' : u.status === 'PENDING' ? '#92400e' : '#64748b',
                                    }}
                                  >
                                    {u.status === 'PENDING' ? 'PENDING APPROVAL' : u.status}
                                  </span>
                                  {u.status === 'PENDING' && u.emailVerificationRequired && (
                                    <div style={{ fontSize: '0.7rem', marginTop: 4, color: u.emailVerifiedAt ? '#15803d' : '#b45309' }}>
                                      <i className={`bi ${u.emailVerifiedAt ? 'bi-envelope-check' : 'bi-envelope-exclamation'}`} />{' '}
                                      {u.emailVerifiedAt ? 'Email confirmed' : 'Email not confirmed yet'}
                                    </div>
                                  )}
                                  {u.twoFactorEnabled && (
                                    <div style={{ fontSize: '0.7rem', marginTop: 4, color: '#1d4ed8' }} title="Two-factor sign-in is on">
                                      <i className="bi bi-shield-lock-fill" /> 2-step sign-in
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                  {u.status === 'PENDING' ? (
                                  <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-success"
                                      title={u.emailVerificationRequired && !u.emailVerifiedAt ? 'Waiting for the person to confirm their email' : 'Approve registration'}
                                      disabled={Boolean(u.emailVerificationRequired && !u.emailVerifiedAt)}
                                      onClick={() => handleApproveRegistration(u)}
                                    >
                                      <i className="bi bi-check-lg" /> Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      title="Reject registration"
                                      onClick={() => handleRejectRegistration(u)}
                                    >
                                      <i className="bi bi-x-lg" /> Reject
                                    </button>
                                  </div>
                                  ) : (
                                  <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      title="Edit user"
                                      onClick={() => {
                                        setEditingUser(u);
                                        setUserFormData({
                                          employeeId: u.employeeId,
                                          name: u.name,
                                          email: u.email,
                                          phone: u.phone || '',
                                          role: u.role,
                                          departmentId:
                                            typeof u.departmentId === 'object' && u.departmentId
                                              ? u.departmentId._id
                                              : (u.departmentId as string) || '',
                                          designation: u.designation || '',
                                          password: '',
                                          status: u.status,
                                        });
                                        setUserModalOpen(true);
                                      }}
                                    >
                                      <i className="bi bi-pencil" />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-warning"
                                      title="Reset Password"
                                      onClick={() => handleResetPassword(u)}
                                    >
                                      <i className="bi bi-key-fill" />
                                    </button>
                                    {u.twoFactorEnabled && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-warning"
                                        title="Reset two-factor sign-in (lost phone)"
                                        onClick={() => setResetTarget(u)}
                                      >
                                        <i className="bi bi-shield-x" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className={`btn btn-sm ${u.status === 'ACTIVE' ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                                      title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                      onClick={() => handleToggleUserStatus(u)}
                                    >
                                      <i className={`bi ${u.status === 'ACTIVE' ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      title="Delete user"
                                      onClick={() => handleDeleteUser(u)}
                                    >
                                      <i className="bi bi-trash" />
                                    </button>
                                  </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} style={{ padding: 0 }}>
                              {userSearch.trim() || userRoleFilter !== 'ALL' || userDeptFilter !== 'ALL' || userStatusFilter !== 'ALL' ? (
                                <EmptyState
                                  icon="bi-funnel"
                                  title="No users match your filters"
                                  reason="No user accounts match the current search, role, department or status filter."
                                  nextStep="Clear the search box or set the filters back to All to see every account."
                                  compact
                                />
                              ) : (
                                <EmptyState
                                  icon="bi-people"
                                  title="No user accounts created yet"
                                  reason="No faculty, HOD or leadership accounts have been added to the portal."
                                  nextStep="Use Add New User above to create the first account."
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
                      currentPage={userPage}
                      totalPages={userTotalPages}
                      onPageChange={setUserPage}
                    />
                  </div>
                </div>
              </div>
            )}
  
            {/* Sub Tab: Roles & Hierarchy */}
            {userSubTab === 'roles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Quick Info Banner */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    padding: '1.25rem',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      Institutional Governance Roles
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      Pre-configured hierarchical role taxonomy governing portal routing, API guards, and approval authorities.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ textAlign: 'center', padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4f46e5' }}>{rolesList.length || 5}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Configured Roles</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>5 Tiers</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Hierarchy Levels</div>
                    </div>
                  </div>
                </div>
  
                {/* Roles Table */}
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
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Role Identifier</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Designation Title</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Hierarchy</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Active Members</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>Governance Scope</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            role: 'ADMIN',
                            name: 'System Administrator',
                            hierarchy: 1,
                            description: 'Full portal governance, master taxonomy management, user credential resets, security diagnostics, and immutable audit inspection.',
                            color: '#ef4444',
                            bg: '#fee2e2',
                          },
                          {
                            role: 'PRINCIPAL',
                            name: 'Principal / Head of Institution',
                            hierarchy: 2,
                            description: 'Executive campus oversight, cross-department academic & research performance tracking, final institutional appraisal endorsement.',
                            color: '#f59e0b',
                            bg: '#fef3c7',
                          },
                          {
                            role: 'DEAN',
                            name: 'Dean of Academic & Research Affairs',
                            hierarchy: 3,
                            description: 'Academic council governance, research grants oversight, PhD scholar tracking, and deanery approval workflows.',
                            color: '#6366f1',
                            bg: '#e0e7ff',
                          },
                          {
                            role: 'HOD',
                            name: 'Head of Department',
                            hierarchy: 4,
                            description: FEATURES.TEACHING
                              ? 'Departmental faculty management, subject allocations, timetable coordination, leave/OD approvals, and initial appraisal scoring.'
                              : 'Departmental faculty management, leave/OD approvals, and initial appraisal scoring.',
                            color: '#8b5cf6',
                            bg: '#f3e8ff',
                          },
                          {
                            role: 'FACULTY',
                            name: 'Department Faculty Member',
                            hierarchy: 5,
                            description: FEATURES.TEACHING
                              ? 'Curriculum delivery, timetable tracking, student mentoring, publications recording, leave applications, and self-appraisal submissions.'
                              : 'Student mentoring, publications recording, leave applications, and self-appraisal submissions.',
                            color: '#10b981',
                            bg: '#ecfdf5',
                          },
                        ].map((r) => {
                          const count = overview?.metrics?.usersByRole?.[r.role] ?? 0;
                          return (
                            <tr key={r.role} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    backgroundColor: r.bg,
                                    color: r.color,
                                  }}
                                >
                                  {r.role}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                                {r.name}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span className="badge bg-light text-dark border">
                                  Tier {r.hierarchy}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{count}</span> Users
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: '0.8rem', maxWidth: '380px' }}>
                                {r.description}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => {
                                    setUserRoleFilter(r.role);
                                    setUserSubTab('directory');
                                  }}
                                >
                                  View Accounts &rarr;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
  
            {/* Sub Tab: Permissions Matrix */}
            {userSubTab === 'permissions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div
                  style={{
                    backgroundColor: '#fff',
                    padding: '1.25rem',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      Role-Based Access Control (RBAC) Matrix
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      Comprehensive permission mapping across portal functional domains and institutional role levels.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <i className="bi bi-check-circle-fill text-success" /> Full Control / Manage
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <i className="bi bi-shield-check text-primary" /> Review & Approve
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <i className="bi bi-pencil-square text-warning" /> Submit & Apply
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <i className="bi bi-eye text-info" /> Read / View Only
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#94a3b8' }}>
                      <i className="bi bi-dash-circle text-muted" /> Restricted
                    </span>
                  </div>
                </div>
  
                {/* Permissions Matrix Table */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'center' }}>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'left', width: '30%' }}>
                            Functional Domain & Modules
                          </th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>ADMIN</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>PRINCIPAL</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>DEAN</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>HOD</th>
                          <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', width: '14%' }}>FACULTY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { module: 'User Accounts & Access Control', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'View Dept', faculty: 'View Own' },
                          { module: 'Master Taxonomies & Data Dictionary', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'Restricted', faculty: 'Restricted' },
                          { module: 'Departments & Degree Programs', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'View Dept', faculty: 'View Dept' },
                          { module: 'Curriculum & Course Catalog', admin: 'Full Control', principal: 'View Only', dean: 'Review', hod: 'Manage Dept', faculty: 'View Allocated' },
                          { module: 'Academic Calendar & Term Schedules', admin: 'Full Control', principal: 'View Only', dean: 'View Only', hod: 'View Only', faculty: 'View Only' },
                          { module: 'Subject Allocation & Workload', admin: 'Full Control', principal: 'Overview', dean: 'Overview', hod: 'Assign & Allocate', faculty: 'View Own' },
                          { module: 'Timetable & Room Coordination', admin: 'Full Control', principal: 'Overview', dean: 'Overview', hod: 'Generate & Swap', faculty: 'View Schedule' },
                          { module: 'Daily Attendance & Biometric Overrides', admin: 'Full Control', principal: 'Institution Overview', dean: 'Deanery Overview', hod: 'Review & Verify', faculty: 'View & Mark' },
                          { module: 'Leave & On-Duty (OD) Workflow', admin: 'System Log', principal: 'Tier-3 Endorse', dean: 'Tier-2 Endorse', hod: 'Tier-1 Approve', faculty: 'Apply & Track' },
                          { module: 'Publications & Research Repository', admin: 'Audit Log', principal: 'Executive Metrics', dean: 'Deanery Verify', hod: 'Department Verify', faculty: 'Record & Claim' },
                          { module: 'Funded Grants & Industrial Consultancy', admin: 'Audit Log', principal: 'Executive Oversight', dean: 'Deanery Oversight', hod: 'Review Dept', faculty: 'Submit & Lead' },
                          { module: 'Student Projects & Mentoring', admin: 'Audit Log', principal: 'Executive Analytics', dean: 'Academic Oversight', hod: 'Department Reviews', faculty: 'Mentor & Grade' },
                          { module: 'PhD Scholars Supervision', admin: 'Audit Log', principal: 'Doctoral Oversight', dean: 'Deanery Oversight', hod: 'Department Review', faculty: 'Supervise & Guide' },
                          { module: 'Annual Performance Appraisal', admin: 'Cycle Config', principal: 'Final Endorsement', dean: 'Deanery Assessment', hod: 'Initial Evaluation', faculty: 'Self-Appraisal Form' },
                          { module: 'Institutional Settings & Policies', admin: 'Full Control', principal: 'Review', dean: 'Restricted', hod: 'Restricted', faculty: 'Restricted' },
                          { module: 'Immutable Audit Trail & Forensics', admin: 'Full Forensic', principal: 'Audit Review', dean: 'Deanery Logs', hod: 'Dept Event Log', faculty: 'Restricted' },
                        ].filter((row) => FEATURES.TEACHING || !/Curriculum|Subject Allocation|Timetable/.test(row.module)).map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                              {row.module}
                            </td>
                            {[row.admin, row.principal, row.dean, row.hod, row.faculty].map((cell, cIdx) => {
                              const isFull = cell.includes('Full') || cell.includes('Assign') || cell.includes('Config');
                              const isReview = cell.includes('Approve') || cell.includes('Endorse') || cell.includes('Verify') || cell.includes('Assessment') || cell.includes('Generate');
                              const isApply = cell.includes('Apply') || cell.includes('Submit') || cell.includes('Self') || cell.includes('Mentor') || cell.includes('Supervise') || cell.includes('Record');
                              const isView = cell.includes('View') || cell.includes('Overview') || cell.includes('Oversight') || cell.includes('Audit') || cell.includes('Metrics');
                              return (
                                <td key={cIdx} style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      backgroundColor: isFull ? '#dcfce7' : isReview ? '#e0f2fe' : isApply ? '#fef3c7' : isView ? '#f1f5f9' : '#f8fafc',
                                      color: isFull ? '#15803d' : isReview ? '#0369a1' : isApply ? '#92400e' : isView ? '#475569' : '#94a3b8',
                                      border: isFull ? '1px solid #bbf7d0' : isReview ? '1px solid #bae6fd' : isApply ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                    }}
                                  >
                                    {cell}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            <FacultyImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(created) => {
          if (created > 0) {
            showToast(`${created} faculty account(s) imported. Each was emailed a link to set their password.`);
            onUsersChanged();
          }
        }}
      />
      <ConfirmationDialog
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={confirmResetTwoFactor}
        loading={resetting}
        variant="warning"
        title="Reset two-factor sign-in?"
        message={
          <>
            <strong>{resetTarget?.name}</strong> will sign in with their password only until they set up two-factor
            sign-in again. Do this only after confirming their identity (for example, a lost phone).
          </>
        }
        confirmLabel="Reset"
      />
    </div>
  );
};
