import React from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import type { AcademicActivity } from '../types/activity';
import {
  ACTIVITY_TYPE_SHORT_LABELS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_BADGE_VARIANTS,
} from '../types/activity';
import { fileUrl } from '../utils/fileUrl';

interface ActivityTimelineProps {
  activities: AcademicActivity[];
  /** True when search or filters are narrowing the timeline. */
  hasActiveFilters?: boolean;
  /** Clears the page's filters; shown as "Clear filters" when filters are active. */
  onClearFilters?: () => void;
  /** Opens the create modal; shown when the timeline is truly empty. */
  onAdd?: () => void;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  hasActiveFilters = false,
  onClearFilters,
  onAdd,
}) => {
  if (activities.length === 0) {
    return (
      <div
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}
      >
        {hasActiveFilters ? (
          <EmptyState
            icon="bi-funnel"
            title="No activities match your timeline filters"
            reason="No records match the current search or filters."
            secondaryAction={
              onClearFilters ? (
                <Button variant="outline" size="sm" onClick={onClearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
            nextStep={onClearFilters ? undefined : 'Adjust the search or filters to see more activities.'}
          />
        ) : (
          <EmptyState
            icon="bi-clock-history"
            title="No academic activities on the timeline yet"
            reason="No conferences, workshops, seminars, FDPs or STTPs have been recorded yet."
            action={
              onAdd ? (
                <Button variant="primary" onClick={onAdd}>
                  + Record Activity
                </Button>
              ) : undefined
            }
            nextStep={onAdd ? undefined : 'Recorded activities will appear here in date order.'}
          />
        )}
      </div>
    );
  }

  // Sort by date or createdAt descending
  const sorted = [...activities].sort((a, b) => {
    const dateA = a.date || a.startDate || a.createdAt;
    const dateB = b.date || b.startDate || b.createdAt;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        position: 'relative',
        paddingLeft: 'var(--space-4)',
        borderLeft: '2px solid var(--color-border)',
        marginLeft: 'var(--space-2)',
      }}
    >
      {sorted.map((item) => {
        const displayDate = item.date
          ? new Date(item.date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : item.startDate
          ? `${new Date(item.startDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
            })} - ${
              item.endDate
                ? new Date(item.endDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : ''
            }`
          : item.academicYear;

        return (
          <div
            key={item._id}
            style={{
              position: 'relative',
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              padding: 'var(--space-3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* Timeline bullet dot */}
            <div
              style={{
                position: 'absolute',
                left: '-23px',
                top: '16px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor:
                  item.status === 'VERIFIED'
                    ? 'var(--color-success)'
                    : item.status === 'SUBMITTED'
                    ? 'var(--color-info)'
                    : 'var(--color-border-dark, #94a3b8)',
                border: '2px solid var(--color-bg-primary)',
              }}
            />

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--color-primary-light, #e0e7ff)',
                    color: 'var(--color-primary-dark, #3730a3)',
                  }}
                >
                  {ACTIVITY_TYPE_SHORT_LABELS[item.activityType]}
                </span>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  {displayDate} ({item.academicYear})
                </span>
              </div>

              <Badge variant={ACTIVITY_STATUS_BADGE_VARIANTS[item.status]}>
                {ACTIVITY_STATUS_LABELS[item.status]}
              </Badge>
            </div>

            {/* Title */}
            <div style={{ fontWeight: 600, fontSize: 'var(--font-md)', color: 'var(--color-text-primary)' }}>
              {item.title}
            </div>

            {/* Organizer & Location */}
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
              <strong>Organizer:</strong> {item.organizer}
              {item.location && <span> • <strong>Location:</strong> {item.location}</span>}
              {item.duration && <span> • <strong>Duration:</strong> {item.duration}</span>}
              {item.mode && <span> • <strong>Mode:</strong> {item.mode}</span>}
            </div>

            {/* Highlights */}
            {item.paperPresented && (
              <div
                style={{
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  background: 'var(--color-bg-secondary)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  display: 'inline-block',
                }}
              >
                <i className="bi bi-star-fill text-warning me-1" aria-hidden="true" />Paper Presented: {item.presentationTitle || 'Untitled Presentation'}
              </div>
            )}

            {item.role && (
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-secondary)' }}>
                <strong>Role:</strong> {item.role} {item.topic && `— Topic: ${item.topic}`}
              </div>
            )}

            {/* Certificate link */}
            {item.certificateUrl && (
              <div style={{ marginTop: '2px' }}>
                <a
                  href={fileUrl(item.certificateUrl)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-primary)',
                    textDecoration: 'underline',
                    fontWeight: 500,
                  }}
                >
                  View Verified Certificate ({item.certificateFileName || 'PDF'}) ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
