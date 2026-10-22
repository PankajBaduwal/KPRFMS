import { apiGet } from '../api/client';

export interface DepartmentListItem {
  _id: string;
  name: string;
  code: string;
  hodId?: string;
}

export const departmentService = {
  async getDepartments(): Promise<DepartmentListItem[]> {
    const res = await apiGet<DepartmentListItem[]>('/departments');
    return res.data;
  },
};
