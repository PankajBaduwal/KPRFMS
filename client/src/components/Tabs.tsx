import React, { useRef } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  children?: React.ReactNode;
  'aria-label'?: string;
}

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({
  id,
  activeTab,
  children,
  className = '',
}) => {
  if (id !== activeTab) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={`tab-panel ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
  children,
  'aria-label': ariaLabel = 'Navigation Tabs',
}) => {
  const tabsListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const currentIndex = enabledTabs.findIndex((t) => t.id === tabs[index].id);
    let targetTab: TabItem | undefined;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      targetTab = enabledTabs[(currentIndex + 1) % enabledTabs.length];
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      targetTab = enabledTabs[(currentIndex - 1 + enabledTabs.length) % enabledTabs.length];
    } else if (e.key === 'Home') {
      e.preventDefault();
      targetTab = enabledTabs[0];
    } else if (e.key === 'End') {
      e.preventDefault();
      targetTab = enabledTabs[enabledTabs.length - 1];
    }

    if (targetTab) {
      onChange(targetTab.id);
      const targetBtn = tabsListRef.current?.querySelector<HTMLButtonElement>(`#tab-${targetTab.id}`);
      targetBtn?.focus();
    }
  };

  return (
    <div className={`tabs-container ${className}`.trim()}>
      <div
        ref={tabsListRef}
        className="tabs-nav"
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              aria-disabled={tab.disabled}
              disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              className={`tab-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => !tab.disabled && onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
            >
              {tab.icon && <i className={`bi ${tab.icon}`} aria-hidden="true" />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="tab-badge">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
};
