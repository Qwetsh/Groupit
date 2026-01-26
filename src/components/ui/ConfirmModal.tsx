import React from 'react';
import { AlertTriangle, Trash2, RefreshCw, X } from 'lucide-react';
import './ConfirmModal.css';

// ============================================================
// TYPES
// ============================================================

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface ConfirmOptions {
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

// ============================================================
// COMPONENT
// ============================================================

const variantIcons: Record<ConfirmVariant, React.ReactNode> = {
  danger: <Trash2 size={24} />,
  warning: <AlertTriangle size={24} />,
  info: <RefreshCw size={24} />,
};

const variantColors: Record<ConfirmVariant, string> = {
  danger: 'var(--color-danger, #dc2626)',
  warning: 'var(--color-warning, #f59e0b)',
  info: 'var(--color-primary, #2563eb)',
};

/**
 * Modal de confirmation réutilisable
 * Remplace les appels confirm() bloquants
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'warning',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isLoading) {
      onCancel();
    }
  };

  return (
    <div
      className="confirm-modal-overlay"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="confirm-modal">
        <button
          className="confirm-modal-close"
          onClick={onCancel}
          disabled={isLoading}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        <div className="confirm-modal-icon" style={{ color: variantColors[variant] }}>
          {variantIcons[variant]}
        </div>

        <h2 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h2>

        <div className="confirm-modal-message">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        <div className="confirm-modal-actions">
          <button
            className="btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            className={`btn-confirm btn-${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus
          >
            {isLoading ? 'En cours...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
