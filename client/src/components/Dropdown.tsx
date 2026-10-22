import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface DropdownItem {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: (DropdownItem | 'divider')[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  const getActionableItems = useCallback(() => {
    if (!menuRef.current) return [];
    return Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])'));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      const actionableButtons = getActionableItems();
      if (actionableButtons.length === 0) return;

      const activeIndex = actionableButtons.indexOf(document.activeElement as HTMLButtonElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = activeIndex === -1 ? 0 : (activeIndex + 1) % actionableButtons.length;
        actionableButtons[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = activeIndex <= 0 ? actionableButtons.length - 1 : activeIndex - 1;
        actionableButtons[prevIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        actionableButtons[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        actionableButtons[actionableButtons.length - 1]?.focus();
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    },
    [isOpen, getActionableItems]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      // Focus first item when opened via keyboard
      const timer = setTimeout(() => {
        const actionable = getActionableItems();
        if (actionable.length > 0 && document.activeElement === triggerRef.current) {
          actionable[0].focus();
        }
      }, 50);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleClickOutside, handleKeyDown, getActionableItems]);

  return (
    <div
      ref={dropdownRef}
      className={className}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        tabIndex={0}
        role="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{ cursor: 'pointer' }}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          className="dropdown-menu-custom"
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            [align === 'right' ? 'right' : 'left']: 0,
            marginTop: '4px',
            zIndex: 1000,
          }}
        >
          {items.map((item, index) => {
            if (item === 'divider') {
              return <div key={index} className="dropdown-divider-custom" role="separator" />;
            }
            return (
              <button
                key={index}
                type="button"
                className="dropdown-item-custom"
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                disabled={item.disabled}
                style={item.variant === 'danger' ? { color: 'var(--color-danger)' } : undefined}
              >
                {item.icon && <i className={`bi ${item.icon}`} aria-hidden="true" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
