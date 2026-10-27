import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchService } from '../services/search.service';
import { EmptyState } from './EmptyState';
import type {
  IGlobalSearchResponse,
  ISearchResultItem,
  SearchEntityType,
} from '../types/search';
import { SEARCH_ENTITY_TYPES } from '../types/search';
import { FEATURES, isHiddenPath } from '../constants/features';
import { institutionStorageKey } from '../lib/institution';

// Canonical Groups mandated by Phase 15
export type CanonicalGroupId =
  | 'ALL'
  | 'FACULTY'
  | 'PUBLICATIONS'
  | 'PROJECTS'
  | 'DOCUMENTS'
  | 'SUBJECTS'
  | 'DEPARTMENTS'
  | 'STUDENTS'
  | 'ACTIVITIES';

export interface ICanonicalGroupDef {
  id: CanonicalGroupId;
  label: string;
  icon: string;
  accent: string;
  bgLight: string;
  serverTypes: SearchEntityType[];
}

export const CANONICAL_GROUPS: ICanonicalGroupDef[] = ([
  {
    id: 'FACULTY',
    label: 'Faculty',
    icon: 'bi-person-badge',
    accent: '#2563eb',
    bgLight: '#eff6ff',
    serverTypes: [SEARCH_ENTITY_TYPES.FACULTY],
  },
  {
    id: 'PUBLICATIONS',
    label: 'Publications',
    icon: 'bi-journal-bookmark',
    accent: '#059669',
    bgLight: '#ecfdf5',
    serverTypes: [SEARCH_ENTITY_TYPES.PUBLICATION, SEARCH_ENTITY_TYPES.PATENT],
  },
  {
    id: 'PROJECTS',
    label: 'Projects',
    icon: 'bi-folder2-open',
    accent: '#d97706',
    bgLight: '#fffbeb',
    serverTypes: [SEARCH_ENTITY_TYPES.PROJECT],
  },
  {
    id: 'DOCUMENTS',
    label: 'Documents',
    icon: 'bi-file-earmark-text',
    accent: '#475569',
    bgLight: '#f8fafc',
    serverTypes: [SEARCH_ENTITY_TYPES.DOCUMENT],
  },
  {
    id: 'SUBJECTS',
    label: 'Subjects',
    icon: 'bi-book',
    accent: '#0891b2',
    bgLight: '#ecfeff',
    serverTypes: [SEARCH_ENTITY_TYPES.SUBJECT],
  },
  {
    id: 'DEPARTMENTS',
    label: 'Departments',
    icon: 'bi-building',
    accent: '#7c3aed',
    bgLight: '#f5f3ff',
    serverTypes: [SEARCH_ENTITY_TYPES.DEPARTMENT],
  },
  {
    id: 'STUDENTS',
    label: 'Students',
    icon: 'bi-mortarboard',
    accent: '#4f46e5',
    bgLight: '#eef2ff',
    serverTypes: [SEARCH_ENTITY_TYPES.STUDENT_PROJECT, SEARCH_ENTITY_TYPES.PHD_SCHOLAR],
  },
  {
    id: 'ACTIVITIES',
    label: 'Activities',
    icon: 'bi-calendar-event',
    accent: '#e11d48',
    bgLight: '#fff1f2',
    serverTypes: [
      SEARCH_ENTITY_TYPES.CONFERENCE,
      SEARCH_ENTITY_TYPES.WORKSHOP,
      SEARCH_ENTITY_TYPES.SEMINAR,
    ],
  },
] as ICanonicalGroupDef[]).filter((g) => FEATURES.TEACHING || g.id !== 'SUBJECTS'); // Subjects belong to the Teaching module

interface IGroupedResults {
  canonicalId: CanonicalGroupId;
  label: string;
  icon: string;
  accent: string;
  bgLight: string;
  items: ISearchResultItem[];
}

interface IRecentItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  type: string;
  icon: string;
  timestamp: number;
}

// Per institution: recent searches from one institution never appear in another
const recentSearchesKey = () => institutionStorageKey('recent_searches');
const recentVisitedKey = () => institutionStorageKey('recent_visited');

// Sample quick suggestion prompts
const SUGGESTED_PROMPTS = [
  { label: 'Faculty Directory', query: 'Faculty' },
  { label: 'Computer Science', query: 'CSE' },
  { label: 'Machine Learning', query: 'Machine Learning' },
  { label: 'Research Projects', query: 'DST' },
  { label: 'SCOPUS Indexed', query: 'SCOPUS' },
  { label: 'Curriculum Subjects', query: 'CS' },
  { label: 'Patents', query: 'Patent' },
].filter((p) => FEATURES.TEACHING || p.label !== 'Curriculum Subjects');

// Quick jump direct navigation links
const QUICK_JUMP_LINKS = [
  { label: 'Faculty Directory', url: '/portal/directory', icon: 'bi-people', color: '#2563eb' },
  { label: 'Publications', url: '/portal/publications', icon: 'bi-journal-text', color: '#059669' },
  { label: 'Research Projects', url: '/portal/projects', icon: 'bi-cash-coin', color: '#d97706' },
  { label: 'Student Projects', url: '/portal/student-projects', icon: 'bi-kanban', color: '#4f46e5' },
  { label: 'PhD Scholars', url: '/portal/phd-scholars', icon: 'bi-mortarboard', color: '#7c3aed' },
  { label: 'Subjects Catalog', url: '/portal/subjects', icon: 'bi-book', color: '#0891b2' },
  { label: 'Academic Activities', url: '/portal/activities', icon: 'bi-calendar-check', color: '#e11d48' },
  { label: 'Documents Repository', url: '/portal/documents', icon: 'bi-files', color: '#475569' },
].filter((link) => !isHiddenPath(link.url));

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CanonicalGroupId>('ALL');
  const [results, setResults] = useState<IGlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  // Local storage recent history
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentVisited, setRecentVisited] = useState<IRecentItem[]>([]);

  // Load recent history from localStorage
  useEffect(() => {
    try {
      const savedSearches = localStorage.getItem(recentSearchesKey());
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches).slice(0, 5));
      }
      const savedVisited = localStorage.getItem(recentVisitedKey());
      if (savedVisited) {
        setRecentVisited(JSON.parse(savedVisited).slice(0, 5));
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, [isOpen]);

  // Save query to recent searches
  const recordSearchQuery = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    try {
      setRecentSearches((prev) => {
        const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
        localStorage.setItem(recentSearchesKey(), JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Ignore storage write errors
    }
  }, []);

  // Save clicked item to recent visited
  const recordVisitedItem = useCallback((item: ISearchResultItem) => {
    try {
      const canonical = CANONICAL_GROUPS.find((g) => g.serverTypes.includes(item.type));
      const entry: IRecentItem = {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url,
        type: canonical?.label || item.type,
        icon: canonical?.icon || 'bi-link-45deg',
        timestamp: Date.now(),
      };
      setRecentVisited((prev) => {
        const updated = [entry, ...prev.filter((i) => i.id !== item.id && i.url !== item.url)].slice(0, 6);
        localStorage.setItem(recentVisitedKey(), JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(recentSearchesKey());
    localStorage.removeItem(recentVisitedKey());
    setRecentSearches([]);
    setRecentVisited([]);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
    } else {
      setQuery('');
      setResults(null);
      setError(null);
      setSelectedIndex(0);
      setActiveCategory('ALL');
    }
  }, [isOpen]);

  // Debounced search execution (250ms)
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      setError(null);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        // If single server type category is active, we can pass it for fast targeted query
        let typeParam: SearchEntityType | undefined;
        if (activeCategory !== 'ALL') {
          const groupDef = CANONICAL_GROUPS.find((g) => g.id === activeCategory);
          if (groupDef && groupDef.serverTypes.length === 1) {
            typeParam = groupDef.serverTypes[0];
          }
        }

        const data = await searchService.search(trimmed, typeParam);
        setResults(data);
        setSelectedIndex(0);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Search execution failed.');
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, activeCategory, isOpen]);

  // Transform raw server results into the 8 Canonical Groups
  const canonicalGroups: IGroupedResults[] = useMemo(() => {
    if (!results || !results.groups) return [];

    const groupedMap: Record<CanonicalGroupId, ISearchResultItem[]> = {
      ALL: [],
      FACULTY: [],
      PUBLICATIONS: [],
      PROJECTS: [],
      DOCUMENTS: [],
      SUBJECTS: [],
      DEPARTMENTS: [],
      STUDENTS: [],
      ACTIVITIES: [],
    };

    // Distribute items into canonical buckets
    for (const serverGroup of results.groups) {
      for (const item of serverGroup.items) {
        const match = CANONICAL_GROUPS.find((cg) => cg.serverTypes.includes(item.type));
        if (match) {
          groupedMap[match.id].push(item);
        }
      }
    }

    // Build ordered list of non-empty canonical groups
    const finalGroups: IGroupedResults[] = [];
    for (const def of CANONICAL_GROUPS) {
      const items = groupedMap[def.id];
      if (items && items.length > 0) {
        if (activeCategory === 'ALL' || activeCategory === def.id) {
          finalGroups.push({
            canonicalId: def.id,
            label: def.label,
            icon: def.icon,
            accent: def.accent,
            bgLight: def.bgLight,
            items,
          });
        }
      }
    }

    return finalGroups;
  }, [results, activeCategory]);

  // Flattened items for unified keyboard arrow traversal
  const flatItems: ISearchResultItem[] = useMemo(() => {
    return canonicalGroups.flatMap((g) => g.items);
  }, [canonicalGroups]);

  // Clamped active item
  const selectedItem: ISearchResultItem | undefined = useMemo(() => {
    if (flatItems.length === 0) return undefined;
    return flatItems[Math.min(selectedIndex, flatItems.length - 1)];
  }, [flatItems, selectedIndex]);

  // Category counts for tab badges
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CanonicalGroupId, number>> = { ALL: results?.totalCount || 0 };
    if (!results || !results.groups) return counts;

    for (const def of CANONICAL_GROUPS) {
      let count = 0;
      for (const g of results.groups) {
        if (def.serverTypes.includes(g.type)) {
          count += g.items.length;
        }
      }
      counts[def.id] = count;
    }
    return counts;
  }, [results]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Selection handler
  const handleSelect = useCallback(
    (item: ISearchResultItem) => {
      recordSearchQuery(query);
      recordVisitedItem(item);
      onClose();
      if (item.url) {
        navigate(item.url);
      }
    },
    [navigate, onClose, query, recordSearchQuery, recordVisitedItem]
  );

  // Copy link handler
  const handleCopyLink = useCallback(
    (url: string) => {
      const fullUrl = `${window.location.origin}${url}`;
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    },
    []
  );

  // Keyboard navigation inside the palette
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedItem) {
        handleSelect(selectedItem);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Cycle through active categories
      const allTabs: CanonicalGroupId[] = ['ALL', ...CANONICAL_GROUPS.map((g) => g.id)];
      const currentIdx = allTabs.indexOf(activeCategory);
      const nextIdx = e.shiftKey
        ? (currentIdx - 1 + allTabs.length) % allTabs.length
        : (currentIdx + 1) % allTabs.length;
      setActiveCategory(allTabs[nextIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query.trim().length > 0) {
        setQuery('');
      } else {
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  let flatIndexCounter = 0;

  return (
    <div className="global-search-backdrop" onClick={onClose}>
      <div
        className="global-search-palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global Search Overlay"
      >
        {/* Top Search Input Box */}
        <div className="global-search-input-box">
          <span style={{ fontSize: '18px', color: loading ? '#2563eb' : '#64748b', display: 'flex' }}>
            {loading ? (
              <i className="bi bi-arrow-repeat" style={{ animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <i className="bi bi-search" />
            )}
          </span>

          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder={FEATURES.TEACHING ? "Search faculty, publications, projects, documents, subjects..." : "Search faculty, publications, projects, documents..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            aria-autocomplete="list"
          />

          {query.length > 0 && (
            <button
              type="button"
              aria-label="Clear search query"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: '15px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear search query"
            >
              <i className="bi bi-x-circle-fill" aria-hidden="true" />
            </button>
          )}

          <kbd className="global-search-kbd" title="Press ESC to close or clear">
            ESC
          </kbd>
        </div>

        {/* Canonical Category Filter Pills (The 8 Mandatory Groups + All) */}
        <div className="global-search-filters-bar">
          <button
            type="button"
            className={`global-search-filter-pill ${activeCategory === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setActiveCategory('ALL')}
          >
            <i className="bi bi-grid-fill" />
            <span>All Categories</span>
            {categoryCounts.ALL !== undefined && categoryCounts.ALL > 0 && (
              <span className="pill-count">{categoryCounts.ALL}</span>
            )}
          </button>

          {CANONICAL_GROUPS.map((group) => {
            const count = categoryCounts[group.id] || 0;
            const isActive = activeCategory === group.id;

            return (
              <button
                key={group.id}
                type="button"
                className={`global-search-filter-pill ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(group.id)}
              >
                <i className={`bi ${group.icon}`} style={{ color: isActive ? 'inherit' : group.accent }} />
                <span>{group.label}</span>
                {count > 0 && <span className="pill-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Main Body: Zero-State OR Split Results Container */}
        {query.trim().length < 2 && !loading ? (
          /* ================================================================
             ZERO STATE: SUGGESTIONS & RECENT HISTORY
             ================================================================ */
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {/* Recent Searches & Visited (if available) */}
            {(recentSearches.length > 0 || recentVisited.length > 0) && (
              <div style={{ marginBottom: '22px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--color-text-muted, #64748b)',
                    }}
                  >
                    <i className="bi bi-clock-history" style={{ marginRight: '6px' }} />
                    Recent Activity
                  </div>
                  <button
                    onClick={clearHistory}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#94a3b8',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Clear history
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                  {recentVisited.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onClose();
                        navigate(item.url);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--color-surface, #ffffff)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border, #e2e8f0)')}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#2563eb',
                          fontSize: '13px',
                          flexShrink: 0,
                        }}
                      >
                        <i className={`bi ${item.icon}`} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: 'var(--color-text, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted, #64748b)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.type} &bull; {item.subtitle}
                        </div>
                      </div>
                      <i className="bi bi-arrow-right-short" style={{ color: '#94a3b8', fontSize: '18px' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Directory Jump Links */}
            <div style={{ marginBottom: '22px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted, #64748b)',
                  marginBottom: '10px',
                }}
              >
                <i className="bi bi-compass" style={{ marginRight: '6px' }} />
                Direct Module Jump
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: '8px',
                }}
              >
                {QUICK_JUMP_LINKS.map((link) => (
                  <button
                    key={link.url}
                    onClick={() => {
                      onClose();
                      navigate(link.url);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--color-surface, #ffffff)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = link.color;
                      e.currentTarget.style.background = 'var(--color-hover, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border, #e2e8f0)';
                      e.currentTarget.style.background = 'var(--color-surface, #ffffff)';
                    }}
                  >
                    <i className={`bi ${link.icon}`} style={{ color: link.color, fontSize: '15px' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                      {link.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Suggested Search Terms */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted, #64748b)',
                  marginBottom: '8px',
                }}
              >
                <i className="bi bi-lightbulb" style={{ marginRight: '6px' }} />
                Suggested Searches
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => {
                      setQuery(prompt.query);
                      inputRef.current?.focus();
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      background: 'var(--color-background, #f1f5f9)',
                      border: '1px solid var(--color-border, #cbd5e1)',
                      color: 'var(--color-text-secondary, #475569)',
                      fontSize: '11.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <i className="bi bi-search" style={{ fontSize: '10px', color: '#94a3b8' }} />
                    <span>{prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================
             RESULTS CONTAINER: LOADING / ERROR / EMPTY / SPLIT RESULTS
             ================================================================ */
          <div className="global-search-split-container">
            {/* Left Column: Grouped Results List */}
            <div className="global-search-results-list">
              {/* Loading Skeletons */}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0' }}>
                  <div style={{ height: '14px', width: '120px', background: '#e2e8f0', borderRadius: '4px' }} />
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: '#e2e8f0',
                          animation: 'pulse 1.5s infinite',
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            height: '13px',
                            width: '65%',
                            background: '#e2e8f0',
                            borderRadius: '4px',
                            marginBottom: '6px',
                          }}
                        />
                        <div style={{ height: '10px', width: '40%', background: '#f1f5f9', borderRadius: '3px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div
                  style={{
                    margin: '12px 0',
                    padding: '12px 16px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="bi bi-exclamation-triangle-fill" />
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={() => setQuery((q) => q + ' ')}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '4px',
                      border: '1px solid #fca5a5',
                      background: '#ffffff',
                      color: '#b91c1c',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* No Results Empty State */}
              {!loading && !error && query.trim().length >= 2 && flatItems.length === 0 && (
                <div style={{ padding: '24px 12px' }}>
                  <EmptyState
                    icon="bi-search"
                    title={`No records found for "${query.trim()}"`}
                    reason={
                      activeCategory !== 'ALL'
                        ? `No matching records found in ${CANONICAL_GROUPS.find((g) => g.id === activeCategory)?.label || 'this category'} within your authorized clearance.`
                        : 'No authorized faculty, research, curriculum, or document records matched this query.'
                    }
                    nextStep="Check for typing errors, try a faculty name, employee ID, or course code."
                    secondaryAction={
                      activeCategory !== 'ALL' ? (
                        <button
                          type="button"
                          onClick={() => setActiveCategory('ALL')}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            border: '1px solid var(--color-border, #e2e8f0)',
                            background: '#ffffff',
                            color: 'var(--color-primary, #2563eb)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Search across all categories
                        </button>
                      ) : undefined
                    }
                    compact
                  />
                </div>
              )}

              {/* Grouped Search Results Display */}
              {!loading && canonicalGroups.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {canonicalGroups.map((group) => (
                    <div key={group.canonicalId}>
                      {/* Group Sticky Header */}
                      <div className="global-search-group-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className={`bi ${group.icon}`} style={{ color: group.accent, fontSize: '13px' }} />
                          <span>{group.label}</span>
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                          {group.items.length} {group.items.length === 1 ? 'match' : 'matches'}
                        </span>
                      </div>

                      {/* Items in this Canonical Group */}
                      <div>
                        {group.items.map((item) => {
                          const thisIndex = flatIndexCounter++;
                          const isSelected = thisIndex === selectedIndex;

                          return (
                            <div
                              key={item.id}
                              ref={isSelected ? activeItemRef : undefined}
                              className={`global-search-item-row ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(thisIndex)}
                            >
                              {/* Entity Icon Avatar */}
                              <div
                                className="global-search-item-icon"
                                style={{
                                  background: group.bgLight,
                                  color: group.accent,
                                }}
                              >
                                <i className={`bi ${group.icon}`} />
                              </div>

                              {/* Item Text Details */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      fontSize: '13.5px',
                                      fontWeight: 600,
                                      color: isSelected ? 'var(--color-primary, #1d4ed8)' : 'var(--color-text, #0f172a)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {item.title}
                                  </span>

                                  {item.badge && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background:
                                          item.badgeVariant === 'success'
                                            ? '#dcfce7'
                                            : item.badgeVariant === 'warning'
                                            ? '#fef3c7'
                                            : item.badgeVariant === 'info'
                                            ? '#cffafe'
                                            : '#f1f5f9',
                                        color:
                                          item.badgeVariant === 'success'
                                            ? '#166534'
                                            : item.badgeVariant === 'warning'
                                            ? '#92400e'
                                            : item.badgeVariant === 'info'
                                            ? '#155e75'
                                            : '#475569',
                                      }}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    fontSize: '11.5px',
                                    color: 'var(--color-text-secondary, #475569)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginTop: '2px',
                                  }}
                                >
                                  {item.subtitle}
                                </div>

                                {item.description && (
                                  <div
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--color-text-muted, #94a3b8)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      marginTop: '1px',
                                    }}
                                  >
                                    {item.description}
                                  </div>
                                )}
                              </div>

                              {/* Enter Chevron / Arrow */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  color: isSelected ? '#2563eb' : 'transparent',
                                  fontSize: '13px',
                                  flexShrink: 0,
                                }}
                              >
                                <i className="bi bi-arrow-return-left" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Live Instant Result Preview Pane */}
            <div className="global-search-preview-pane">
              {selectedItem ? (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Entity Category Badge */}
                  {(() => {
                    const groupDef = CANONICAL_GROUPS.find((g) => g.serverTypes.includes(selectedItem.type));
                    const accent = groupDef?.accent || '#2563eb';
                    const icon = groupDef?.icon || 'bi-box';
                    const categoryLabel = groupDef?.label || selectedItem.type;

                    const metadata: Record<string, any> = (selectedItem.metadata as Record<string, any>) || {};

                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              background: groupDef?.bgLight || '#eff6ff',
                              color: accent,
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                            }}
                          >
                            <i className={`bi ${icon}`} />
                            <span>{categoryLabel}</span>
                          </div>

                          {selectedItem.badge && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background:
                                  selectedItem.badgeVariant === 'success'
                                    ? '#dcfce7'
                                    : selectedItem.badgeVariant === 'warning'
                                    ? '#fef3c7'
                                    : selectedItem.badgeVariant === 'info'
                                    ? '#cffafe'
                                    : '#f1f5f9',
                                color:
                                  selectedItem.badgeVariant === 'success'
                                    ? '#166534'
                                    : selectedItem.badgeVariant === 'warning'
                                    ? '#92400e'
                                    : selectedItem.badgeVariant === 'info'
                                    ? '#155e75'
                                    : '#475569',
                              }}
                            >
                              {selectedItem.badge}
                            </span>
                          )}
                        </div>

                        {/* Title & Subtitle Header */}
                        <div style={{ marginBottom: '16px' }}>
                          <h4
                            style={{
                              fontSize: '16px',
                              fontWeight: 700,
                              color: 'var(--color-text, #0f172a)',
                              marginBottom: '4px',
                              lineHeight: 1.3,
                            }}
                          >
                            {selectedItem.title}
                          </h4>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #475569)' }}>
                            {selectedItem.subtitle}
                          </div>
                          {selectedItem.description && (
                            <div
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--color-text-muted, #64748b)',
                                marginTop: '4px',
                                lineHeight: 1.4,
                              }}
                            >
                              {selectedItem.description}
                            </div>
                          )}
                        </div>

                        {/* Detailed Key-Value Properties Card */}
                        <div
                          style={{
                            background: 'var(--color-surface, #ffffff)',
                            border: '1px solid var(--color-border, #e2e8f0)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            marginBottom: '16px',
                            fontSize: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                              color: '#94a3b8',
                              borderBottom: '1px solid #f1f5f9',
                              paddingBottom: '4px',
                            }}
                          >
                            Record Specifications
                          </div>

                          {/* Dynamic Property Entries */}
                          {Boolean(metadata.employeeId) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Employee ID</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.employeeId)}</span>
                            </div>
                          )}
                          {Boolean(metadata.designation) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Designation</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.designation)}</span>
                            </div>
                          )}
                          {Boolean(metadata.department) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Department</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.department)}</span>
                            </div>
                          )}
                          {Boolean(metadata.email) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Contact</span>
                              <span style={{ fontWeight: 500, color: '#2563eb' }}>{String(metadata.email)}</span>
                            </div>
                          )}

                          {Boolean(metadata.journal) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Journal / Source</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.journal)}</span>
                            </div>
                          )}
                          {Boolean(metadata.authors) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Authors</span>
                              <span style={{ fontWeight: 500, color: '#0f172a' }}>{String(metadata.authors)}</span>
                            </div>
                          )}
                          {Boolean(metadata.doi) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>DOI</span>
                              <span style={{ fontWeight: 500, color: '#2563eb' }}>{String(metadata.doi)}</span>
                            </div>
                          )}
                          {Boolean(metadata.indexing) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Indexing</span>
                              <span style={{ fontWeight: 600, color: '#059669' }}>{String(metadata.indexing)}</span>
                            </div>
                          )}

                          {Boolean(metadata.fundingAgency) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Funding Agency</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.fundingAgency)}</span>
                            </div>
                          )}
                          {Boolean(metadata.projectNumber) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Project Ref</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.projectNumber)}</span>
                            </div>
                          )}
                          {metadata.sanctionedAmount !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Sanctioned Grant</span>
                              <span style={{ fontWeight: 700, color: '#d97706' }}>
                                ₹{Number(metadata.sanctionedAmount).toLocaleString('en-IN')}
                              </span>
                            </div>
                          )}
                          {Boolean(metadata.pi) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Principal Investigator</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.pi)}</span>
                            </div>
                          )}

                          {Boolean(metadata.code) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Course Code</span>
                              <span style={{ fontWeight: 700, color: '#0891b2' }}>{String(metadata.code)}</span>
                            </div>
                          )}
                          {Boolean(metadata.credits) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Credits</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.credits)}</span>
                            </div>
                          )}
                          {Boolean(metadata.semester) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Semester</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>Semester {String(metadata.semester)}</span>
                            </div>
                          )}

                          {Boolean(metadata.supervisor) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Doctoral Supervisor</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.supervisor)}</span>
                            </div>
                          )}
                          {Boolean(metadata.stage) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Research Stage</span>
                              <span style={{ fontWeight: 600, color: '#4f46e5' }}>{String(metadata.stage)}</span>
                            </div>
                          )}

                          {Boolean(metadata.organizer) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Organizer</span>
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(metadata.organizer)}</span>
                            </div>
                          )}

                          {Boolean(metadata.fileName) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b' }}>Attached File</span>
                              <span style={{ fontWeight: 600, color: '#475569' }}>{String(metadata.fileName)}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Source Table</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                              {selectedItem.sourceCollection}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleSelect(selectedItem)}
                            style={{
                              width: '100%',
                              padding: '9px 16px',
                              borderRadius: '8px',
                              background: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                            }}
                          >
                            <span>Open Record</span>
                            <kbd
                              style={{
                                padding: '1px 5px',
                                background: 'rgba(255, 255, 255, 0.25)',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              ↵
                            </kbd>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(selectedItem.url)}
                            style={{
                              width: '100%',
                              padding: '7px 14px',
                              borderRadius: '8px',
                              background: '#ffffff',
                              color: copiedLink ? '#059669' : '#475569',
                              border: '1px solid #cbd5e1',
                              fontWeight: 500,
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <i className={copiedLink ? 'bi bi-check2' : 'bi bi-link-45deg'} />
                            <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Direct Link'}</span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '13px',
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  Select a record to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation Bar */}
        <div className="global-search-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>
              <kbd className="global-search-kbd">↑</kbd> <kbd className="global-search-kbd">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="global-search-kbd">↵</kbd> Open
            </span>
            <span>
              <kbd className="global-search-kbd">Tab</kbd> Switch Group
            </span>
            <span>
              <kbd className="global-search-kbd">Esc</kbd> Dismiss
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
            <i className="bi bi-shield-check" style={{ color: '#059669' }} />
            <span>RBAC Protected &bull; Authorized Records Only</span>
          </div>
        </div>
      </div>
    </div>
  );
};
