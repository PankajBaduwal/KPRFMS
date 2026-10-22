import { apiClient } from '../api/client';
import type {
  DocumentItem,
  DocumentListResponse,
  DocumentQueryFilters,
  UploadDocumentPayload,
} from '../types/document';

const BASE = '/documents';

export const documentService = {
  /**
   * Query documents with RBAC access control and multi-dimensional filters.
   */
  async getDocuments(filters: DocumentQueryFilters = {}): Promise<DocumentListResponse> {
    const params: any = {};
    if (filters.documentType && filters.documentType !== 'ALL') params.documentType = filters.documentType;
    if (filters.accessLevel && filters.accessLevel !== 'ALL') params.accessLevel = filters.accessLevel;
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.ownerId) params.ownerId = filters.ownerId;
    if (filters.search) params.search = filters.search;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;

    const res = await apiClient.get(BASE, { params });
    return res.data.data;
  },

  /**
   * Get single document record metadata.
   */
  async getDocument(id: string): Promise<DocumentItem> {
    const res = await apiClient.get(`${BASE}/${id}`);
    return res.data.data;
  },

  /**
   * Securely upload a document file with metadata.
   */
  async uploadDocument(
    file: File,
    payload: UploadDocumentPayload,
    onProgress?: (percent: number) => void
  ): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', payload.title);
    formData.append('documentType', payload.documentType);
    if (payload.accessLevel) formData.append('accessLevel', payload.accessLevel);
    if (payload.relatedEntityType) formData.append('relatedEntityType', payload.relatedEntityType);
    if (payload.relatedEntityId) formData.append('relatedEntityId', payload.relatedEntityId);
    if (payload.metadata) formData.append('metadata', JSON.stringify(payload.metadata));

    const res = await apiClient.post(`${BASE}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // Uploads can exceed the default 15s client timeout
      timeout: 0,
      // Real bytes-sent progress reported by the browser, not an estimate
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    return res.data.data;
  },

  /**
   * Authorized download: fetches file blob with auth session and triggers save.
   */
  async downloadDocument(id: string, filename: string): Promise<void> {
    const res = await apiClient.get(`${BASE}/${id}/download`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Authorized preview: fetches file blob and creates an object URL for safe inline display.
   */
  async getPreviewBlob(id: string): Promise<{ url: string; mimeType: string }> {
    const res = await apiClient.get(`${BASE}/${id}/preview`, {
      responseType: 'blob',
    });
    const mimeType = String(res.headers['content-type'] || 'application/pdf');
    const blob = new Blob([res.data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    return { url, mimeType };
  },

  /**
   * Update document metadata.
   */
  async updateMetadata(
    id: string,
    updates: { title?: string; accessLevel?: string; metadata?: any }
  ): Promise<DocumentItem> {
    const res = await apiClient.patch(`${BASE}/${id}`, updates);
    return res.data.data;
  },

  /**
   * Archive / soft-delete a document.
   */
  async archiveDocument(id: string): Promise<DocumentItem> {
    const res = await apiClient.delete(`${BASE}/${id}`);
    return res.data.data;
  },
};
