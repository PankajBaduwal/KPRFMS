import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

const VARIANT_ICONS = {
  danger: { icon: 'bi-exclamation-octagon-fill', color: 'var(--color-danger)' },
  warning: { icon: 'bi-exclamation-triangle-fill', color: 'var(--color-warning)' },
  primary: { icon: 'bi-question-circle-fill', color: 'var(--color-primary)' },
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading: externalLoading,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading ?? internalLoading;

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  const { icon, color } = VARIANT_ICONS[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'warning' ? 'primary' : variant}
            size="sm"
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <i
          className={`bi ${icon}`}
          style={{ fontSize: '1.75rem', color, flexShrink: 0, marginTop: '2px' }}
          aria-hidden="true"
        />
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
    </Modal>
  );
};
