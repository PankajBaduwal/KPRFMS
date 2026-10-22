export const SEARCH_ENTITY_TYPES = {
  FACULTY: 'FACULTY',
  DEPARTMENT: 'DEPARTMENT',
  SUBJECT: 'SUBJECT',
  PUBLICATION: 'PUBLICATION',
  PROJECT: 'PROJECT',
  STUDENT_PROJECT: 'STUDENT_PROJECT',
  PHD_SCHOLAR: 'PHD_SCHOLAR',
  CONFERENCE: 'CONFERENCE',
  WORKSHOP: 'WORKSHOP',
  SEMINAR: 'SEMINAR',
  PATENT: 'PATENT',
  DOCUMENT: 'DOCUMENT',
} as const;

export type SearchEntityType =
  (typeof SEARCH_ENTITY_TYPES)[keyof typeof SEARCH_ENTITY_TYPES];

export interface ISearchResultItem {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  description?: string;
  url: string;
  badge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  metadata?: Record<string, unknown>;
  sourceCollection: string;
}

export interface ISearchGroup {
  type: SearchEntityType;
  label: string;
  icon: string;
  count: number;
  items: ISearchResultItem[];
}

export interface IGlobalSearchResponse {
  query: string;
  totalCount: number;
  groups: ISearchGroup[];
}
