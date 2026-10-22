import { apiGet } from '../api/client';

export interface AcademicYearOptions {
  currentAcademicYear: string;
  academicYears: string[];
  source: 'MASTER' | 'CALENDAR';
}

export const academicYearService = {
  async getOptions(): Promise<AcademicYearOptions> {
    const res = await apiGet<AcademicYearOptions>('/academic-years');
    return res.data;
  },
};
