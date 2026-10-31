import React from 'react';
import { Link } from 'react-router-dom';
import type { ActionItem } from '../../services/dashboard.service';

interface ActionItemsBannerProps {
  actions: ActionItem[];
  /** Not shown any more (it only repeated the user's role); kept so callers need no change */
  roleTitle?: string;
}

export const ActionItemsBanner: React.FC<ActionItemsBannerProps> = ({ actions }) => {
  if (!actions || actions.length === 0) {
    return (
      <div
        className="card-custom"
        style={{
          marginBottom: 'var(--space-6)',
          borderLeft: '4px solid var(--color-success)',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
            }}
          >
            <i className="bi bi-check-circle" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
              All Caught Up
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              No critical action items or pending escalations currently require your attention.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityStyle = (type: ActionItem['type']) => {
    switch (type) {
      case 'CRITICAL':
        return {
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderLeft: '4px solid var(--color-danger, #D14343)',
          badgeBg: 'rgba(239, 68, 68, 0.1)',
          badgeColor: '#dc2626',
          icon: 'bi-exclamation-octagon-fill',
        };
      case 'WARNING':
        return {
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderLeft: '4px solid var(--color-warning, #f59e0b)',
          badgeBg: 'rgba(245, 158, 11, 0.1)',
          badgeColor: '#d97706',
          icon: 'bi-exclamation-triangle-fill',
        };
      case 'INFO':
      default:
        return {
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderLeft: '4px solid var(--color-primary, #2864A5)',
          badgeBg: 'rgba(59, 130, 246, 0.1)',
          badgeColor: '#2563eb',
          icon: 'bi-info-circle-fill',
        };
    }
  };

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <i className="bi bi-bell-fill" style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0 }}>
            Needs your attention
          </h2>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#B42318',
            }}
          >
            {actions.length} {actions.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>

      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {actions.map((act, index) => {
          const style = getPriorityStyle(act.type);
          return (
            <div
              key={act.id}
              className="card-custom attention-item"
              data-index={Math.min(index, 5)}
              style={{
                border: style.border,
                borderLeft: style.borderLeft,
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-surface)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                transition: 'box-shadow 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flex: 1, minWidth: 260 }}>
                <i
                  className={`bi ${style.icon}`}
                  style={{
                    color: style.badgeColor,
                    fontSize: '1.15rem',
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                      {act.title}
                    </span>
                    {act.badge && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: style.badgeBg,
                          color: style.badgeColor,
                        }}
                      >
                        {act.badge}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-secondary)',
                      marginTop: 2,
                      lineHeight: 1.4,
                    }}
                  >
                    {act.description}
                  </div>
                </div>
              </div>

              <div>
                <Link
                  to={act.link}
                  className="btn btn-sm btn-outline-primary attention-cta"
                  style={{
                    fontSize: '0.8125rem',
                    padding: '4px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  {act.actionText}
                  <i className="bi bi-arrow-right" style={{ fontSize: '0.75rem' }} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
