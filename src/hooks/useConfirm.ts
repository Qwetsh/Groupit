import { useState, useCallback } from 'react';
import type { ConfirmOptions, ConfirmVariant } from '../components/ui/ConfirmModal';

// ============================================================
// TYPES
// ============================================================

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmVariant;
  resolve: ((value: boolean) => void) | null;
}

interface UseConfirmReturn {
  /** État du modal pour le rendu */
  confirmState: ConfirmState;
  /** Ouvre le modal et retourne une Promise<boolean> */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Ferme le modal (appelé par onConfirm/onCancel) */
  handleConfirm: () => void;
  handleCancel: () => void;
}

// ============================================================
// HOOK
// ============================================================

const defaultState: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmer',
  cancelLabel: 'Annuler',
  variant: 'warning',
  resolve: null,
};

/**
 * Hook pour gérer les modals de confirmation de manière asynchrone
 *
 * @example
 * ```tsx
 * const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Supprimer ?',
 *     message: 'Cette action est irréversible.',
 *     variant: 'danger',
 *     confirmLabel: 'Supprimer',
 *   });
 *
 *   if (confirmed) {
 *     // Effectuer la suppression
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Supprimer</button>
 *     <ConfirmModal
 *       isOpen={confirmState.isOpen}
 *       title={confirmState.title}
 *       message={confirmState.message}
 *       variant={confirmState.variant}
 *       confirmLabel={confirmState.confirmLabel}
 *       cancelLabel={confirmState.cancelLabel}
 *       onConfirm={handleConfirm}
 *       onCancel={handleCancel}
 *     />
 *   </>
 * );
 * ```
 */
export function useConfirm(): UseConfirmReturn {
  const [state, setState] = useState<ConfirmState>(defaultState);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirmer',
        cancelLabel: options.cancelLabel || 'Annuler',
        variant: options.variant || 'warning',
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(defaultState);
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(defaultState);
  }, [state.resolve]);

  return {
    confirmState: state,
    confirm,
    handleConfirm,
    handleCancel,
  };
}

// ============================================================
// SHORTCUTS
// ============================================================

/**
 * Raccourci pour confirmation de suppression
 */
export function useConfirmDelete() {
  const { confirm, ...rest } = useConfirm();

  const confirmDelete = useCallback(
    (itemName: string, customMessage?: string) =>
      confirm({
        title: 'Confirmer la suppression',
        message: customMessage || `Supprimer "${itemName}" ?\n\nCette action est irréversible.`,
        variant: 'danger',
        confirmLabel: 'Supprimer',
      }),
    [confirm]
  );

  return { confirmDelete, confirm, ...rest };
}

/**
 * Raccourci pour confirmation de réinitialisation
 */
export function useConfirmReset() {
  const { confirm, ...rest } = useConfirm();

  const confirmReset = useCallback(
    (message?: string) =>
      confirm({
        title: 'Confirmer la réinitialisation',
        message: message || 'Êtes-vous sûr de vouloir réinitialiser ?\n\nCette action est irréversible.',
        variant: 'warning',
        confirmLabel: 'Réinitialiser',
      }),
    [confirm]
  );

  return { confirmReset, confirm, ...rest };
}
