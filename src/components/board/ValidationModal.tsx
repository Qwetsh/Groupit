import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { ValidationSummary } from '../validation';
import type { ValidationModalProps } from './types';

/**
 * Modal de confirmation de validation des affectations
 */
export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  isValidating,
  scenario,
  affectations,
  eleves,
  enseignants,
  jurys,
  stages,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="validation-modal-overlay" onClick={onClose}>
      <div className="validation-modal validation-modal-enhanced" onClick={e => e.stopPropagation()}>
        <h2>Valider les affectations</h2>
        <p className="modal-description">
          Cette action va créer un snapshot immuable des affectations actuelles.
          Il sera consultable dans le tableau de bord et l'historique des enseignants.
        </p>

        <ValidationSummary
          scenario={scenario}
          affectations={affectations}
          eleves={eleves}
          enseignants={enseignants}
          jurys={jurys}
          stages={stages}
        />

        <div className="modal-actions">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={isValidating}
          >
            Annuler
          </button>
          <button
            className="btn-validate"
            onClick={onConfirm}
            disabled={isValidating}
          >
            {isValidating ? (
              <>
                <Loader2 size={16} className="spinning" />
                Validation...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Confirmer la validation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
