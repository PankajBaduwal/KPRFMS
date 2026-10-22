import { apiClient } from '../api/client';
import type {
  FacultyAttendanceRecord,
  AttendanceCorrectionRequest,
  DailyDepartmentAttendance,
  MonthlyFacultySummary,
  DepartmentMonthlySummary,
  YearlyFacultySummary,
  InstitutionOverview,
  AttendanceAuditLog,
  RecordAttendanceInput,
  BulkRecordAttendanceInput,
  UpdateAttendanceInput,
  SubmitCorrectionInput,
  ReviewCorrectionInput,
  AttendanceStatus,
} from '../types/attendance';

export const attendanceService = {
  // ----------------------------------------------------
  // Record single attendance
  // ----------------------------------------------------
  async recordAttendance(input: RecordAttendanceInput): Promise<FacultyAttendanceRecord> {
    const res = await apiClient.post('/attendance', input);
    return res.data.data;
  },

  // ----------------------------------------------------
  // Bulk record attendance
  // ----------------------------------------------------
  async bulkRecordAttendance(
    input: BulkRecordAttendanceInput
  ): Promise<{ recorded: number; errorCount: number; results: FacultyAttendanceRecord[]; errors: any[] }> {
    const res = await apiClient.post('/attendance/bulk', input);
    return res.data.data;
  },

  // ----------------------------------------------------
  // Update attendance (unlocked)
  // ----------------------------------------------------
  async updateAttendance(id: string, input: UpdateAttendanceInput): Promise<FacultyAttendanceRecord> {
    const res = await apiClient.put(`/attendance/${id}`, input);
    return res.data.data;
  },

  // ----------------------------------------------------
  // Lock attendance records
  // ----------------------------------------------------
  async lockAttendance(input: {
    startDate: string;
    endDate: string;
    departmentId?: string;
  }): Promise<{ lockedCount: number }> {
    const res = await apiClient.post('/attendance/lock', input);
    return res.data.data;
  },

  // ----------------------------------------------------
  // Query attendance records
  // ----------------------------------------------------
  async getRecords(params?: {
    facultyId?: string;
    departmentId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
    academicYear?: string;
    month?: number;
    year?: number;
  }): Promise<FacultyAttendanceRecord[]> {
    const res = await apiClient.get('/attendance', { params });
    return res.data.data;
  },

  // ----------------------------------------------------
  // Get logged-in faculty attendance
  // ----------------------------------------------------
  async getMyAttendance(params?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
    academicYear?: string;
    month?: number;
    year?: number;
  }): Promise<FacultyAttendanceRecord[]> {
    const res = await apiClient.get('/attendance/my', { params });
    return res.data.data;
  },

  // ----------------------------------------------------
  // Daily department attendance
  // ----------------------------------------------------
  async getDailyDepartment(
    departmentId: string,
    date?: string
  ): Promise<DailyDepartmentAttendance> {
    const res = await apiClient.get(`/attendance/daily/department/${departmentId}`, {
      params: { date },
    });
    return res.data.data;
  },

  // ----------------------------------------------------
  // Monthly faculty summary
  // ----------------------------------------------------
  async getMonthlyFacultySummary(
    facultyId: string,
    month?: number,
    year?: number
  ): Promise<MonthlyFacultySummary> {
    const res = await apiClient.get(`/attendance/summary/monthly/faculty/${facultyId}`, {
      params: { month, year },
    });
    return res.data.data;
  },

  // ----------------------------------------------------
  // Monthly department summary
  // ----------------------------------------------------
  async getDepartmentMonthlySummary(
    departmentId: string,
    month?: number,
    year?: number
  ): Promise<DepartmentMonthlySummary> {
    const res = await apiClient.get(`/attendance/summary/monthly/department/${departmentId}`, {
      params: { month, year },
    });
    return res.data.data;
  },

  // ----------------------------------------------------
  // Yearly summary for a faculty
  // ----------------------------------------------------
  async getYearlySummary(
    facultyId: string,
    academicYear?: string
  ): Promise<YearlyFacultySummary> {
    const res = await apiClient.get(`/attendance/summary/yearly/faculty/${facultyId}`, {
      params: { academicYear },
    });
    return res.data.data;
  },

  // ----------------------------------------------------
  // Institution overview
  // ----------------------------------------------------
  async getInstitutionOverview(date?: string): Promise<InstitutionOverview> {
    const res = await apiClient.get('/attendance/overview/institution', {
      params: { date },
    });
    return res.data.data;
  },

  // ----------------------------------------------------
  // Audit history
  // ----------------------------------------------------
  async getAuditHistory(attendanceId: string): Promise<AttendanceAuditLog[]> {
    const res = await apiClient.get(`/attendance/${attendanceId}/audit`);
    return res.data.data;
  },

  // ----------------------------------------------------
  // Submit correction request
  // ----------------------------------------------------
  async submitCorrectionRequest(
    input: SubmitCorrectionInput
  ): Promise<AttendanceCorrectionRequest> {
    const res = await apiClient.post('/attendance/corrections', input);
    return res.data.data;
  },

  // ----------------------------------------------------
  // Review correction request (Approve/Reject)
  // ----------------------------------------------------
  async reviewCorrectionRequest(
    id: string,
    input: ReviewCorrectionInput
  ): Promise<AttendanceCorrectionRequest> {
    const res = await apiClient.put(`/attendance/corrections/${id}/review`, input);
    return res.data.data;
  },

  // ----------------------------------------------------
  // Get correction requests
  // ----------------------------------------------------
  async getCorrectionRequests(params?: {
    departmentId?: string;
    facultyId?: string;
    status?: string;
    academicYear?: string;
  }): Promise<AttendanceCorrectionRequest[]> {
    const res = await apiClient.get('/attendance/corrections', { params });
    return res.data.data;
  },
};
