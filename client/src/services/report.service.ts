import { apiClient } from '../api/client';
import type {
  IReportMetadata,
  IFrameworkConfig,
  IReportResult,
  IReportFilterParams,
} from '../types/report';

const BASE = '/reports';

export const reportService = {
  /**
   * Get all 20 report types with user-role permission flags
   */
  async getReportTypes(): Promise<IReportMetadata[]> {
    const res = await apiClient.get(`${BASE}/types`);
    return res.data.data;
  },

  /**
   * Get accreditation framework configurations (NAAC, NBA, NIRF, AACSB, INTERNAL)
   */
  async getFrameworkConfigs(): Promise<IFrameworkConfig[]> {
    const res = await apiClient.get(`${BASE}/frameworks`);
    return res.data.data;
  },

  /**
   * Generate report data with filters and source record tracing
   */
  async generateReport(params: IReportFilterParams): Promise<IReportResult> {
    const res = await apiClient.get(`${BASE}/generate`, { params });
    return res.data.data;
  },

  /**
   * Download report export in CSV or Excel format
   */
  async downloadReport(params: IReportFilterParams, format: 'csv' | 'excel' | 'pdf'): Promise<void> {
    if (format === 'pdf') {
      // For PDF, fetch printable HTML and open high-fidelity print window
      const res = await apiClient.get(`${BASE}/export`, {
        params: { ...params, format: 'pdf' },
        responseType: 'text',
      });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(res.data);
        printWindow.document.close();
      }
      return;
    }

    const mimeType = format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel';
    const extension = format === 'csv' ? 'csv' : 'xls';

    const res = await apiClient.get(`${BASE}/export`, {
      params: { ...params, format },
      responseType: 'blob',
    });

    const blob = new Blob([res.data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeYear = (params.academicYear || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('download', `report_${params.reportType.toLowerCase()}_${safeYear}.${extension}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Fetch underlying source record detail for deep audit inspection
   */
  async getTraceRecord(collection: string, recordId: string): Promise<Record<string, unknown>> {
    const res = await apiClient.get(`${BASE}/trace/${collection}/${recordId}`);
    return res.data.data;
  },
};
