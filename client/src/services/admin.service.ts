import { apiClient } from '../api/client';
import type {
  IAdminOverview,
  IAdminUser,
  IAdminDepartment,
  IAdminProgram,
  IAdminSubject,
  IAdminAcademicYear,
  IAdminSemester,
  IAdminMasterItem,
  IAdminInstitutionSettings,
  IAdminRole,
  IAdminAuditLog,
  ICreateUserResult,
  IResetPasswordResult,
} from '../types/admin';
import type { PaginatedData } from '../types';

const BASE = '/admin';

export const adminService = {
  // Overview
  async getOverview(): Promise<IAdminOverview> {
    const res = await apiClient.get(`${BASE}/overview`);
    return res.data.data;
  },

  // Roles
  async getRoles(): Promise<IAdminRole[]> {
    const res = await apiClient.get(`${BASE}/roles`);
    return res.data.data;
  },

  // Users
  async getUsers(params: {
    role?: string;
    departmentId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedData<IAdminUser>> {
    const res = await apiClient.get(`${BASE}/users`, { params });
    return res.data.data;
  },

  async getUserById(id: string): Promise<IAdminUser> {
    const res = await apiClient.get(`${BASE}/users/${id}`);
    return res.data.data;
  },

  async createUser(data: Record<string, unknown>): Promise<ICreateUserResult> {
    const res = await apiClient.post(`${BASE}/users`, data);
    return res.data.data;
  },

  async updateUser(id: string, data: Record<string, unknown>): Promise<IAdminUser> {
    const res = await apiClient.put(`${BASE}/users/${id}`, data);
    return res.data.data;
  },

  async toggleUserStatus(id: string, status: string): Promise<IAdminUser> {
    const res = await apiClient.patch(`${BASE}/users/${id}/status`, { status });
    return res.data.data;
  },

  async resetPassword(
    id: string,
    data?: { newPassword?: string; temporary?: boolean }
  ): Promise<IResetPasswordResult> {
    const res = await apiClient.post(`${BASE}/users/${id}/reset-password`, data || {});
    return res.data.data;
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`${BASE}/users/${id}`);
    return res.data.data;
  },

  // Departments
  async getDepartments(): Promise<IAdminDepartment[]> {
    const res = await apiClient.get(`${BASE}/departments`);
    return res.data.data;
  },

  async getDepartmentById(id: string): Promise<IAdminDepartment> {
    const res = await apiClient.get(`${BASE}/departments/${id}`);
    return res.data.data;
  },

  async createDepartment(data: Record<string, unknown>): Promise<IAdminDepartment> {
    const res = await apiClient.post(`${BASE}/departments`, data);
    return res.data.data;
  },

  async updateDepartment(id: string, data: Record<string, unknown>): Promise<IAdminDepartment> {
    const res = await apiClient.put(`${BASE}/departments/${id}`, data);
    return res.data.data;
  },

  async deleteDepartment(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`${BASE}/departments/${id}`);
    return res.data.data;
  },

  // Programs
  async getPrograms(departmentId?: string): Promise<IAdminProgram[]> {
    const res = await apiClient.get(`${BASE}/programs`, {
      params: departmentId && departmentId !== 'ALL' ? { departmentId } : {},
    });
    return res.data.data;
  },

  async createProgram(data: Record<string, unknown>): Promise<IAdminProgram> {
    const res = await apiClient.post(`${BASE}/programs`, data);
    return res.data.data;
  },

  async updateProgram(id: string, data: Record<string, unknown>): Promise<IAdminProgram> {
    const res = await apiClient.put(`${BASE}/programs/${id}`, data);
    return res.data.data;
  },

  async deleteProgram(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`${BASE}/programs/${id}`);
    return res.data.data;
  },

  // Subjects
  async getSubjects(params: {
    department?: string;
    semester?: number;
    academicYear?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<IAdminSubject>> {
    const res = await apiClient.get(`${BASE}/subjects`, { params });
    return res.data.data;
  },

  async createSubject(data: Record<string, unknown>): Promise<IAdminSubject> {
    const res = await apiClient.post(`${BASE}/subjects`, data);
    return res.data.data;
  },

  async updateSubject(id: string, data: Record<string, unknown>): Promise<IAdminSubject> {
    const res = await apiClient.put(`${BASE}/subjects/${id}`, data);
    return res.data.data;
  },

  async deleteSubject(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`${BASE}/subjects/${id}`);
    return res.data.data;
  },

  // Academic Years
  async getAcademicYears(): Promise<IAdminAcademicYear[]> {
    const res = await apiClient.get(`${BASE}/academic-years`);
    return res.data.data;
  },

  async createAcademicYear(data: Record<string, unknown>): Promise<IAdminAcademicYear> {
    const res = await apiClient.post(`${BASE}/academic-years`, data);
    return res.data.data;
  },

  async updateAcademicYear(
    id: string,
    data: Record<string, unknown>
  ): Promise<IAdminAcademicYear> {
    const res = await apiClient.put(`${BASE}/academic-years/${id}`, data);
    return res.data.data;
  },

  async setCurrentAcademicYear(id: string): Promise<IAdminAcademicYear> {
    const res = await apiClient.patch(`${BASE}/academic-years/${id}/set-current`);
    return res.data.data;
  },

  async deleteAcademicYear(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`${BASE}/academic-years/${id}`);
    return res.data.data;
  },

  // Semesters
  async getSemesters(academicYear?: string): Promise<IAdminSemester[]> {
    const res = await apiClient.get(`${BASE}/semesters`, {
      params: academicYear && academicYear !== 'ALL' ? { academicYear } : {},
    });
    return res.data.data;
  },

  async createSemester(data: Record<string, unknown>): Promise<IAdminSemester> {
    const res = await apiClient.post(`${BASE}/semesters`, data);
    return res.data.data;
  },

  async updateSemester(id: string, data: Record<string, unknown>): Promise<IAdminSemester> {
    const res = await apiClient.put(`${BASE}/semesters/${id}`, data);
    return res.data.data;
  },

  async setCurrentSemester(id: string): Promise<IAdminSemester> {
    const res = await apiClient.patch(`${BASE}/semesters/${id}/set-current`);
    return res.data.data;
  },

  async deleteSemester(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`${BASE}/semesters/${id}`);
    return res.data.data;
  },

  // Master Items
  async getMasterItems(category?: string): Promise<IAdminMasterItem[]> {
    const url = category && category !== 'ALL' ? `${BASE}/masters/${category}` : `${BASE}/masters`;
    const res = await apiClient.get(url);
    return res.data.data;
  },

  async createMasterItem(data: Record<string, unknown>): Promise<IAdminMasterItem> {
    const res = await apiClient.post(`${BASE}/masters`, data);
    return res.data.data;
  },

  async updateMasterItem(id: string, data: Record<string, unknown>): Promise<IAdminMasterItem> {
    const res = await apiClient.put(`${BASE}/masters/${id}`, data);
    return res.data.data;
  },

  async toggleMasterItemStatus(id: string, isActive: boolean): Promise<IAdminMasterItem> {
    const res = await apiClient.patch(`${BASE}/masters/${id}/status`, { isActive });
    return res.data.data;
  },

  async deleteMasterItem(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`${BASE}/masters/${id}`);
    return res.data.data;
  },

  // Institution Settings
  async getInstitutionSettings(): Promise<IAdminInstitutionSettings> {
    const res = await apiClient.get(`${BASE}/settings`);
    return res.data.data;
  },

  async updateInstitutionSettings(
    data: Record<string, unknown>
  ): Promise<IAdminInstitutionSettings> {
    const res = await apiClient.put(`${BASE}/settings`, data);
    return res.data.data;
  },

  // Audit Logs
  async getAuditLogs(params: {
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<IAdminAuditLog>> {
    const res = await apiClient.get(`${BASE}/audit-logs`, { params });
    return res.data.data;
  },
};
