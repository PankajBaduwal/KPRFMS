import React from 'react';

export interface TimelineEvent {
  id: string;
  title: string;
  timestamp: string | Date;
  description?: React.ReactNode;
  status?: 'primary' | 'success' | 'warning' | 'danger';
  actor?: string;
  icon?: string;
}

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ events, className = '' }) => {
  if (!events || events.length === 0) return null;

  const formatDate = (val: string | Date): string => {
    try {
      const d = new Date(val);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(val);
    }
  };

  return (
    <div className={`timeline-container ${className}`.trim()}>
      <div className="timeline-line" aria-hidden="true" />
      {events.map((evt) => {
        const statusClass = evt.status ? `is-${evt.status}` : '';

        return (
          <div key={evt.id} className="timeline-item">
            <div className={`timeline-dot ${statusClass}`} aria-hidden="true">
              {evt.icon && (
                <i
                  className={`bi ${evt.icon}`}
                  style={{
                    fontSize: '9px',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                  aria-hidden="true"
                />
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
              <h4 className="timeline-title">{evt.title}</h4>
              <span className="timeline-time">{formatDate(evt.timestamp)}</span>
            </div>

            {evt.actor && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', marginTop: '2px' }}>
                by {evt.actor}
              </div>
            )}

            {evt.description && (
              <div className="timeline-desc">{evt.description}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
