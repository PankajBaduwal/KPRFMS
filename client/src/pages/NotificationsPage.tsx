import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FEATURES } from '../constants/features';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notification.service';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/Skeleton';
import { Pagination } from '../components/Pagination';
import { NotificationDetailModal } from '../components/NotificationDetailModal';
import type {
  NotificationItem,
  NotificationPreferences,
} from '../types/notification';
import {
  NOTIFICATION_CATEGORIES,
  getNotificationMeta,
  formatRelativeTime,
  formatFullTimestamp,
} from '../utils/notificationTypes';

export const NotificationsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tab: 'all' | 'unread' | 'preferences'
  const initialTab = searchParams.get('tab') === 'preferences' ? 'preferences' : 'all';
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'preferences'>(initialTab);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal inspection
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  // In-flight state management
  const requestIdRef = useRef(0);
  const [markingIds, setMarkingIds] = useState<Set<string>>(() => new Set());
  const markingIdsRef = useRef<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const markingAllRef = useRef(false);
  const savingPrefsRef = useRef(false);

  // Preferences State
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newSubmission: true,
    approvalRequired: true,
    approved: true,
    rejected: true,
    returned: true,
    leaveDecision: true,
    workloadUpdate: true,
    timetableChange: true,
    appraisalCycle: true,
    systemNotification: true,
  });
  const [prefsLoading, setPrefsLoading] = useState<boolean>(false);
  const [prefsLoaded, setPrefsLoaded] = useState<boolean>(false);
  const [prefsSaving, setPrefsSaving] = useState<boolean>(false);
  const [prefsSuccess, setPrefsSuccess] = useState<string | null>(null);

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      // Determine server type filter if a single type category is selected
      let typeParam: string | undefined;
      if (selectedCategory !== 'ALL') {
        const catDef = NOTIFICATION_CATEGORIES.find((c) => c.id === selectedCategory);
        if (catDef && catDef.types.length === 1) {
          typeParam = catDef.types[0];
        }
      }

      const res = await notificationService.getNotifications({
        page: currentPage,
        limit: 15,
        isRead: activeTab === 'unread' ? false : undefined,
        type: typeParam,
      });

      if (requestId !== requestIdRef.current) return;
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
      setTotalCount(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      setError(err?.response?.data?.message || 'Failed to load notifications.');
    } finally {
      if (requestId === requestIdRef.current) {
        setHasLoaded(true);
        setLoading(false);
      }
    }
  }, [currentPage, activeTab, selectedCategory]);

  // Fetch Preferences
  const fetchPreferences = async () => {
    setPrefsLoading(true);
    try {
      const data = await notificationService.getPreferences();
      setPreferences(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load preferences.');
    } finally {
      setPrefsLoaded(true);
      setPrefsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'preferences') {
      fetchPreferences();
    } else {
      fetchNotifications();
    }
  }, [activeTab, fetchNotifications]);

  const handleTabChange = (tab: 'all' | 'unread' | 'preferences') => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (tab === 'preferences') {
      setSearchParams({ tab: 'preferences' });
    } else {
      setSearchParams({});
    }
  };

  const setMarking = (id: string, on: boolean) => {
    if (on) markingIdsRef.current.add(id);
    else markingIdsRef.current.delete(id);
    setMarkingIds(new Set(markingIdsRef.current));
  };

  const handleMarkAsRead = async (id: string) => {
    if (markingIdsRef.current.has(id) || markingAllRef.current) return;
    setMarking(id, true);
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
      );
      if (selectedNotification && selectedNotification._id === id) {
        setSelectedNotification((prev) => (prev ? { ...prev, isRead: true } : null));
      }
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Failed to mark read:', err);
    } finally {
      setMarking(id, false);
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAllRef.current) return;
    markingAllRef.current = true;
    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Failed to mark all read:', err);
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
    }
  };

  const handleTogglePreference = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setPrefsSuccess(null);
  };

  const handleSavePreferences = async () => {
    if (savingPrefsRef.current) return;
    savingPrefsRef.current = true;
    setPrefsSaving(true);
    setPrefsSuccess(null);
    try {
      const updated = await notificationService.updatePreferences(preferences);
      setPreferences(updated);
      setPrefsSuccess('Notification preferences saved successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save preferences.');
    } finally {
      savingPrefsRef.current = false;
      setPrefsSaving(false);
    }
  };

  // Client-side filtering by category and search keyword
  const filteredNotifications = useMemo(() => {
    let list = notifications;

    // Filter by selected category definition
    if (selectedCategory !== 'ALL') {
      const catDef = NOTIFICATION_CATEGORIES.find((c) => c.id === selectedCategory);
      if (catDef) {
        list = list.filter((n) => catDef.types.includes(n.type));
      }
    }

    // Filter by search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          (n.senderId?.name && n.senderId.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [notifications, selectedCategory, searchQuery]);

  // Preference groups specification
  const preferenceFields: Array<{
    key: keyof NotificationPreferences;
    title: string;
    description: string;
    icon: string;
  }> = [
    {
      key: 'approvalRequired',
      title: 'Approvals Required',
      description: 'Alerts when your endorsement or verification is needed in the review queue.',
      icon: 'bi-check2-circle',
    },
    {
      key: 'approved',
      title: 'Approved Submissions',
      description: 'Notify me when my submitted proposals or records are sanctioned or approved.',
      icon: 'bi-patch-check',
    },
    {
      key: 'returned',
      title: 'Returned Submissions',
      description: 'Alert me immediately when a reviewer returns a submission for correction.',
      icon: 'bi-arrow-counterclockwise',
    },
    {
      key: 'rejected',
      title: 'Rejected Submissions',
      description: 'Notifications when submitted proposals or leaves are rejected.',
      icon: 'bi-x-circle',
    },
    {
      key: 'leaveDecision',
      title: 'Leave Decisions & Balances',
      description: 'Updates on leave requests, approvals, substitutions, and balance deductions.',
      icon: 'bi-calendar-check',
    },
    {
      key: 'workloadUpdate',
      title: 'Workload & Course Allocations',
      description: 'Alerts when subject assignments, weekly credits, or lab hours are updated.',
      icon: 'bi-speedometer2',
    },
    {
      key: 'timetableChange',
      title: 'Timetable & Slot Substitutions',
      description: 'Notifications when teaching slots or substitution duties are scheduled.',
      icon: 'bi-calendar-event',
    },
    {
      key: 'appraisalCycle',
      title: 'Appraisal Cycle Updates',
      description: 'Alerts when annual performance appraisal windows open or reviews complete.',
      icon: 'bi-award',
    },
    {
      key: 'newSubmission',
      title: 'New Submissions (Reviewers)',
      description: 'Alerts when faculty in your department submit new research or student records.',
      icon: 'bi-file-earmark-plus',
    },
    {
      key: 'systemNotification',
      title: 'System & Institutional Notices',
      description: 'General institutional announcements, academic notices, and platform updates.',
      icon: 'bi-shield-check',
    },
  ];

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-text, #0f172a)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <i className="bi bi-bell-fill" style={{ color: 'var(--color-primary, #2563eb)' }} />
            Notification Center
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary, #64748b)' }}>
            Institutional alerts, approval workflows, returned submissions, and academic updates.
          </p>
        </div>

        {activeTab !== 'preferences' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                id="mark-all-read-btn"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                aria-busy={markingAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: 'var(--color-surface, #ffffff)',
                  color: 'var(--color-text, #0f172a)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: markingAll ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                }}
              >
                {markingAll ? (
                  <span className="spinner spinner-sm" aria-hidden="true" />
                ) : (
                  <i className="bi bi-check2-all" style={{ color: '#2563eb' }} />
                )}
                <span>{markingAll ? 'Marking...' : 'Mark All Read'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchNotifications()}
              disabled={loading}
              aria-busy={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #e2e8f0)',
                background: 'var(--color-surface, #ffffff)',
                color: 'var(--color-text, #0f172a)',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="Refresh notifications"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Tab Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'all' ? '2px solid var(--color-primary, #2563eb)' : '2px solid transparent',
            color: activeTab === 'all' ? 'var(--color-primary, #2563eb)' : 'var(--color-text-secondary, #64748b)',
            fontWeight: activeTab === 'all' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>All Notifications</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '10px',
              background: activeTab === 'all' ? '#eff6ff' : '#f1f5f9',
              color: activeTab === 'all' ? '#2563eb' : '#64748b',
            }}
          >
            {hasLoaded ? totalCount : '...'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('unread')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'unread' ? '2px solid var(--color-primary, #2563eb)' : '2px solid transparent',
            color: activeTab === 'unread' ? 'var(--color-primary, #2563eb)' : 'var(--color-text-secondary, #64748b)',
            fontWeight: activeTab === 'unread' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('preferences')}
          style={{
            padding: '10px 16px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'preferences' ? '2px solid var(--color-primary, #2563eb)' : '2px solid transparent',
            color: activeTab === 'preferences' ? 'var(--color-primary, #2563eb)' : 'var(--color-text-secondary, #64748b)',
            fontWeight: activeTab === 'preferences' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: 'auto',
          }}
        >
          <i className="bi bi-sliders" />
          <span>Event Preferences</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB: NOTIFICATIONS FEED */}
      {activeTab !== 'preferences' && (
        <div>
          {/* Search & Category Filter Bar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '16px',
              background: 'var(--color-surface, #ffffff)',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid var(--color-border, #e2e8f0)',
            }}
          >
            {/* Search Input Box */}
            <div style={{ position: 'relative' }}>
              <i
                className="bi bi-search"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted, #94a3b8)',
                  fontSize: '13px',
                }}
              />
              <input
                type="text"
                placeholder="Search notifications by title, details, or sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  fontSize: '13px',
                  background: 'var(--color-background, #f8fafc)',
                  color: 'var(--color-text, #0f172a)',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    fontSize: '13px',
                  }}
                  title="Clear search"
                >
                  <i className="bi bi-x-circle-fill" />
                </button>
              )}
            </div>

            {/* Categorized Filter Pills (The 7 Mandated Types + All) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none',
                paddingTop: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: selectedCategory === 'ALL' ? '1px solid #2563eb' : '1px solid var(--color-border, #e2e8f0)',
                  background: selectedCategory === 'ALL' ? '#eff6ff' : 'var(--color-surface, #ffffff)',
                  color: selectedCategory === 'ALL' ? '#1d4ed8' : 'var(--color-text-secondary, #64748b)',
                  fontSize: '11.5px',
                  fontWeight: selectedCategory === 'ALL' ? 600 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <i className="bi bi-grid-fill" />
                <span>All Categories</span>
              </button>

              {NOTIFICATION_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      border: isSelected ? `1px solid ${cat.color}` : '1px solid var(--color-border, #e2e8f0)',
                      background: isSelected ? cat.bg : 'var(--color-surface, #ffffff)',
                      color: isSelected ? cat.color : 'var(--color-text-secondary, #64748b)',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <i className={`bi ${cat.icon}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List Area */}
          {(loading || !hasLoaded) && filteredNotifications.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonCard key={i} lines={2} />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div
              style={{
                background: 'var(--color-surface, #ffffff)',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                padding: '24px 12px',
              }}
            >
              <EmptyState
                icon="bi-bell-slash"
                title={
                  searchQuery
                    ? `No notifications found matching "${searchQuery}"`
                    : selectedCategory !== 'ALL'
                    ? `No ${NOTIFICATION_CATEGORIES.find((c) => c.id === selectedCategory)?.label || ''} notices`
                    : activeTab === 'unread'
                    ? 'No unread notifications'
                    : 'No notifications in your tray'
                }
                reason={
                  searchQuery
                    ? 'Try searching with different keywords or clear the search filter.'
                    : activeTab === 'unread'
                    ? 'You have reviewed all pending notifications.'
                    : 'System notices and approval workflow events will appear here as they occur.'
                }
                secondaryAction={
                  selectedCategory !== 'ALL' || searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('ALL');
                        setSearchQuery('');
                        setCurrentPage(1);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '16px',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        background: '#ffffff',
                        color: 'var(--color-primary, #2563eb)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
                compact
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredNotifications.map((item) => {
                const meta = getNotificationMeta(item.type);

                return (
                  <div
                    key={item._id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: item.isRead
                        ? '1px solid var(--color-border, #e2e8f0)'
                        : '1px solid #bfdbfe',
                      background: item.isRead
                        ? 'var(--color-surface, #ffffff)'
                        : 'rgba(37, 99, 235, 0.025)',
                      position: 'relative',
                      transition: 'all 0.12s ease',
                      borderLeft: !item.isRead ? '3px solid #2563eb' : undefined,
                    }}
                  >
                    {/* Restrained Category Icon */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: meta.bg,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <i className={`bi ${meta.icon}`} />
                    </div>

                    {/* Notification Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '4px',
                        }}
                      >
                        {/* Category Label Chip */}
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: meta.bg,
                            color: meta.color,
                            letterSpacing: '0.2px',
                          }}
                        >
                          {meta.label}
                        </span>

                        {/* Notification Title */}
                        <span
                          onClick={() => setSelectedNotification(item)}
                          style={{
                            fontWeight: item.isRead ? 600 : 700,
                            fontSize: '13.5px',
                            color: 'var(--color-text, #0f172a)',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text, #0f172a)')}
                        >
                          {item.title}
                        </span>

                        {/* Restrained Unread Dot */}
                        {!item.isRead && (
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#2563eb',
                            }}
                            title="Unread notification"
                          />
                        )}

                        {/* Timestamp */}
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: '11.5px',
                            color: 'var(--color-text-muted, #94a3b8)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      {/* Message Text */}
                      <p
                        style={{
                          margin: '4px 0 8px',
                          fontSize: '12.5px',
                          lineHeight: 1.5,
                          color: 'var(--color-text-secondary, #475569)',
                        }}
                      >
                        {item.message}
                      </p>

                      {/* Footer Metadata & Actions Strip */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px',
                          fontSize: '11.5px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {item.senderId?.name && (
                            <span style={{ color: 'var(--color-text-muted, #64748b)' }}>
                              From: <strong>{item.senderId.name}</strong>
                              {item.senderId.role ? ` (${item.senderId.role})` : ''}
                            </span>
                          )}
                          <span style={{ color: '#cbd5e1' }}>&bull;</span>
                          <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>
                            {formatFullTimestamp(item.createdAt)}
                          </span>
                        </div>

                        {/* Interactive Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedNotification(item)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--color-border, #e2e8f0)',
                              borderRadius: '4px',
                              color: 'var(--color-text-secondary, #475569)',
                              fontSize: '11.5px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              padding: '2px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="bi bi-eye" />
                            <span>Details</span>
                          </button>

                          {item.actionUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!item.isRead) handleMarkAsRead(item._id);
                                navigate(item.actionUrl!);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: '#eff6ff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <span>Open Resource</span>
                              <i className="bi bi-box-arrow-up-right" style={{ fontSize: '10px' }} />
                            </button>
                          )}

                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(item._id)}
                              disabled={markingIds.has(item._id) || markingAll}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-primary, #2563eb)',
                                fontSize: '11.5px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                padding: '2px 6px',
                              }}
                            >
                              {markingIds.has(item._id) ? (
                                <span className="spinner spinner-sm" aria-hidden="true" />
                              ) : (
                                <i className="bi bi-check2" />
                              )}
                              <span>Mark read</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standard Pagination Component */}
          {totalPages > 1 && (
            <div style={{ marginTop: '20px' }}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={15}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB: NOTIFICATION PREFERENCES */}
      {activeTab === 'preferences' && (
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              Institutional Event Subscription Preferences
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-text-secondary, #64748b)' }}>
              Customize which operational events trigger alerts in your in-app notification center.
            </p>
          </div>

          {prefsSuccess && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="bi bi-check-circle-fill" />
              <span>{prefsSuccess}</span>
            </div>
          )}

          {prefsLoading && !prefsLoaded ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
              <i className="bi bi-arrow-repeat spin" style={{ fontSize: '20px' }} />
              <div style={{ fontSize: '13px', marginTop: '6px' }}>Loading subscription preferences...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {preferenceFields
                .filter((field) => FEATURES.TEACHING || (field.key !== 'workloadUpdate' && field.key !== 'timetableChange'))
                .map((field) => {
                const isEnabled = preferences[field.key];

                return (
                  <div
                    key={field.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      background: 'var(--color-surface, #ffffff)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          background: isEnabled ? '#eff6ff' : '#f1f5f9',
                          color: isEnabled ? '#2563eb' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '15px',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        <i className={`bi ${field.icon}`} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--color-text, #0f172a)' }}>
                          {field.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748b)', marginTop: '2px' }}>
                          {field.description}
                        </div>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <label style={{ position: 'relative', display: 'inline-block', width: '42px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleTogglePreference(field.key)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          cursor: 'pointer',
                          inset: 0,
                          backgroundColor: isEnabled ? '#2563eb' : '#cbd5e1',
                          borderRadius: '24px',
                          transition: '0.2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '18px',
                            width: '18px',
                            left: isEnabled ? '20px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            transition: '0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          }}
                        />
                      </span>
                    </label>
                  </div>
                );
              })}

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={prefsSaving}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: prefsSaving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {prefsSaving ? (
                    <span className="spinner spinner-sm" aria-hidden="true" />
                  ) : (
                    <i className="bi bi-save" />
                  )}
                  <span>{prefsSaving ? 'Saving...' : 'Save Preferences'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reusable Notification Detail Modal */}
      <NotificationDetailModal
        notification={selectedNotification}
        isOpen={Boolean(selectedNotification)}
        onClose={() => setSelectedNotification(null)}
        onMarkAsRead={handleMarkAsRead}
      />
    </div>
  );
};
