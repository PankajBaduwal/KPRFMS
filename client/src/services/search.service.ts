import { apiClient } from '../api/client';
import type { IGlobalSearchResponse, SearchEntityType } from '../types/search';

const BASE = '/search';

export const searchService = {
  /**
   * Execute global multi-entity search with RBAC enforcement
   */
  async search(query: string, type?: SearchEntityType): Promise<IGlobalSearchResponse> {
    const res = await apiClient.get(BASE, {
      params: {
        q: query,
        type: type || undefined,
      },
    });
    return res.data.data;
  },
};
