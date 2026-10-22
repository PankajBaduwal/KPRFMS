import React from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = <i className="bi bi-chevron-right breadcrumb-separator" aria-hidden="true" />,
  className = '',
}) => {
  if (!items || items.length === 0) return null;

  return (
    <nav className={`breadcrumb-nav ${className}`.trim()} aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="breadcrumb-item">
              {index > 0 && <span className="mx-1">{separator}</span>}

              {isLast ? (
                <span className="breadcrumb-item is-current" aria-current="page">
                  {item.icon && <i className={`bi ${item.icon}`} aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              ) : item.href ? (
                <Link to={item.href} className="breadcrumb-item">
                  {item.icon && <i className={`bi ${item.icon}`} aria-hidden="true" />}
                  <span>{item.label}</span>
                </Link>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="breadcrumb-item btn-ghost"
                  style={{ padding: 0, height: 'auto', fontSize: 'inherit', color: 'inherit' }}
                >
                  {item.icon && <i className={`bi ${item.icon}`} aria-hidden="true" />}
                  <span>{item.label}</span>
                </button>
              ) : (
                <span className="breadcrumb-item">
                  {item.icon && <i className={`bi ${item.icon}`} aria-hidden="true" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
