import { apiClient } from '../api/client';
import type { IAuditRecord, IAuditStats, IAuditFilterParams } from '../types/audit';
import type { PaginatedData } from '../types';

const BASE = '/audit-logs';

export const auditService = {
  /**
   * Query centralized immutable audit logs with multi-factor filters
   */
  async getLogs(params: IAuditFilterParams): Promise<PaginatedData<IAuditRecord>> {
    const res = await apiClient.get(BASE, { params });
    return res.data.data;
  },

  /**
   * Retrieve single audit log detail
   */
  async getLogById(id: string): Promise<IAuditRecord> {
    const res = await apiClient.get(`${BASE}/${id}`);
    return res.data.data;
  },

  /**
   * Retrieve audit distribution and analytics stats
   */
  async getStats(timeRange: '24h' | '7d' | '30d' | 'all' = '7d'): Promise<IAuditStats> {
    const res = await apiClient.get(`${BASE}/stats`, { params: { timeRange } });
    return res.data.data;
  },

  /**
   * Download CSV export file
   */
  async downloadCsvExport(params: IAuditFilterParams): Promise<void> {
    const res = await apiClient.get(`${BASE}/export`, {
      params,
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kpriet-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
