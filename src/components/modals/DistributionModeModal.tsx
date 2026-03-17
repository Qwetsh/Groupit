// ============================================================
// MODAL - Choix du mode de distribution des créneaux
// ============================================================

import React from 'react';
import { Clock, AlignLeft, BarChart3 } from 'lucide-react';
import type { DistributionMode } from '../../algorithms/timeSlots';

interface DistributionModeModalProps {
  nbDemiJournees: number;
  onSelect: (mode: DistributionMode) => void;
  onClose: () => void;
}

export const DistributionModeModal: React.FC<DistributionModeModalProps> = ({
  nbDemiJournees,
  onSelect,
  onClose,
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content distribution-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Clock size={20} />
          <h2>Distribution des créneaux</h2>
        </div>

        <p className="modal-description">
          Vous avez configuré <strong>{nbDemiJournees} demi-journées</strong> pour l'oral.
          Comment souhaitez-vous répartir les élèves ?
        </p>

        <div className="distribution-choices">
          <button
            className="distribution-choice"
            onClick={() => onSelect('fill_first')}
          >
            <div className="choice-icon">
              <AlignLeft size={28} />
            </div>
            <div className="choice-content">
              <h3>Remplir en priorité</h3>
              <p>Remplir les premières demi-journées avant de passer aux suivantes.</p>
            </div>
          </button>

          <button
            className="distribution-choice"
            onClick={() => onSelect('distribute_evenly')}
          >
            <div className="choice-icon">
              <BarChart3 size={28} />
            </div>
            <div className="choice-content">
              <h3>Répartir équitablement</h3>
              <p>Distribuer les élèves de manière égale entre toutes les demi-journées.</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
