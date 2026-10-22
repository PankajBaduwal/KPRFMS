import { apiClient } from '../api/client';
import type {
  TimetableSlot,
  FacultySubstitution,
  FacultyTimetableView,
  DepartmentTimetableView,
  InstitutionalTimetableView,
  ConflictCheckResult,
  CreateTimetableSlotInput,
  UpdateTimetableSlotInput,
  CreateSubstitutionInput,
} from '../types/timetable';

export const timetableService = {
  // 1. Faculty View
  async getFacultyTimetable(
    facultyId: string,
    params?: { academicYear?: string; date?: string }
  ): Promise<FacultyTimetableView> {
    const res = await apiClient.get(`/timetable/faculty/${facultyId}`, { params });
    return res.data.data;
  },

  async getMyTimetable(params?: { academicYear?: string; date?: string }): Promise<FacultyTimetableView> {
    const res = await apiClient.get('/timetable/my-timetable', { params });
    return res.data.data;
  },

  // 2. Department View
  async getDepartmentTimetable(
    departmentId: string,
    params?: { academicYear?: string; semester?: number; section?: string }
  ): Promise<DepartmentTimetableView> {
    const res = await apiClient.get(`/timetable/department/${departmentId}`, { params });
    return res.data.data;
  },

  // 3. Dean / Institutional View
  async getInstitutionalTimetable(params?: {
    academicYear?: string;
    day?: string;
    room?: string;
    departmentId?: string;
  }): Promise<InstitutionalTimetableView> {
    const res = await apiClient.get('/timetable/institution', { params });
    return res.data.data;
  },

  // 4. Conflict Check
  async checkConflicts(data: {
    academicYear: string;
    day: string;
    period: number;
    room: string;
    section: string;
    semester: number;
    departmentId: string;
    facultyId: string;
    excludeSlotId?: string;
  }): Promise<ConflictCheckResult> {
    const res = await apiClient.post('/timetable/check-conflict', data);
    return res.data.data;
  },

  async checkSubstitutionConflicts(data: {
    substituteFacultyId: string;
    date: string;
    period: number;
    academicYear: string;
  }): Promise<ConflictCheckResult> {
    const res = await apiClient.post('/timetable/substitutions/check-conflict', data);
    return res.data.data;
  },

  // 5. Slot CRUD
  async createSlot(data: CreateTimetableSlotInput): Promise<TimetableSlot> {
    const res = await apiClient.post('/timetable/slots', data);
    return res.data.data;
  },

  async updateSlot(id: string, data: UpdateTimetableSlotInput): Promise<TimetableSlot> {
    const res = await apiClient.put(`/timetable/slots/${id}`, data);
    return res.data.data;
  },

  async deleteSlot(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete(`/timetable/slots/${id}`);
    return res.data;
  },

  async getSlots(params?: {
    academicYear?: string;
    semester?: number;
    departmentId?: string;
    section?: string;
    day?: string;
    period?: number;
    room?: string;
    facultyId?: string;
  }): Promise<TimetableSlot[]> {
    const res = await apiClient.get('/timetable/slots', { params });
    return res.data.data;
  },

  // 6. Substitution
  async createSubstitution(data: CreateSubstitutionInput): Promise<FacultySubstitution> {
    const res = await apiClient.post('/timetable/substitutions', data);
    return res.data.data;
  },

  async cancelSubstitution(id: string): Promise<{ message: string }> {
    const res = await apiClient.put(`/timetable/substitutions/${id}/cancel`);
    return res.data;
  },

  async getSubstitutions(params?: {
    academicYear?: string;
    date?: string;
    status?: string;
    originalFacultyId?: string;
    substituteFacultyId?: string;
  }): Promise<FacultySubstitution[]> {
    const res = await apiClient.get('/timetable/substitutions', { params });
    return res.data.data;
  },
};
