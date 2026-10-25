import { apiGet, apiPost, apiPut, apiDelete, apiPatch, apiClient } from '../api/client';
import type {
  Publication,
  PublicationFilters,
  PublicationAnalytics,
  PublicationListResponse,
  PublicationVerificationStatus,
} from '../types/publication';

export interface DoiLookupResult {
  doi: string;
  title: string;
  publicationType: string;
  journalOrConference: string;
  publisher?: string;
  issn?: string;
  url?: string;
  publicationDate?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  citationCount: number;
  authors: string[];
  numberOfAuthors: number;
  suggestedAuthorPosition?: string;
  coAuthors: string[];
}

export interface OrcidWork {
  title: string;
  type?: string;
  year?: string;
  journal?: string;
  doi: string | null;
  alreadyAdded: boolean;
}

export const publicationService = {
  /** Publication details from Crossref by DOI. */
  async lookupDoi(doi: string): Promise<DoiLookupResult> {
    return (await apiGet<DoiLookupResult>(`/publications/lookup/doi?doi=${encodeURIComponent(doi)}`)).data;
  },

  /** Works listed on a public ORCID record. */
  async lookupOrcid(orcid: string): Promise<{ orcid: string; works: OrcidWork[] }> {
    return (await apiGet<{ orcid: string; works: OrcidWork[] }>(`/publications/lookup/orcid?orcid=${encodeURIComponent(orcid)}`)).data;
  },

  async getPublications(filters?: PublicationFilters): Promise<PublicationListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    const url = query ? `/publications?${query}` : '/publications';
    const res = await apiGet<PublicationListResponse>(url);
    return res.data;
  },

  async getPublicationAnalytics(params?: { departmentId?: string; academicYear?: string }): Promise<PublicationAnalytics> {
    const queryParams = new URLSearchParams();
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params?.academicYear) queryParams.append('academicYear', params.academicYear);
    const query = queryParams.toString();
    const url = query ? `/publications/analytics?${query}` : '/publications/analytics';
    const res = await apiGet<PublicationAnalytics>(url);
    return res.data;
  },

  async getPublicationById(id: string): Promise<Publication> {
    const res = await apiGet<Publication>(`/publications/${id}`);
    return res.data;
  },

  async createPublication(data: Partial<Publication>): Promise<Publication> {
    const res = await apiPost<Publication>('/publications', data);
    return res.data;
  },

  async updatePublication(id: string, data: Partial<Publication>): Promise<Publication> {
    const res = await apiPut<Publication>(`/publications/${id}`, data);
    return res.data;
  },

  async deletePublication(id: string): Promise<Publication> {
    const res = await apiDelete<Publication>(`/publications/${id}`);
    return res.data;
  },

  async submitPublication(id: string): Promise<Publication> {
    const res = await apiPost<Publication>(`/publications/${id}/submit`);
    return res.data;
  },

  async reviewPublication(
    id: string,
    status: PublicationVerificationStatus,
    remarks?: string
  ): Promise<Publication> {
    const res = await apiPatch<Publication>(`/publications/${id}/review`, {
      status,
      remarks,
    });
    return res.data;
  },

  async uploadPdf(file: File): Promise<{ pdfUrl: string; pdfFileName: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/publications/upload-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};
