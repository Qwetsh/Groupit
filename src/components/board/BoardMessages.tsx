import React from 'react';
import { AlertCircle, CheckCheck } from 'lucide-react';
import { formatArchiveDate } from '../../services';
import type { BoardMessagesProps } from './types';

/**
 * Messages d'avertissement, erreur et succès du Board
 */
export const BoardMessages: React.FC<BoardMessagesProps> = ({
  isJuryMode,
  isStageScenario,
  scenarioJurysCount,
  stageReadyForMatching,
  geocodedStagesCount,
  geocodedEnseignantsCount,
  activeScenarioNom,
  matchingError,
  matchingStats,
  validationSuccess,
  onClearError,
  onClearStats,
  onClearValidation,
}) => {
  return (
    <>
      {/* Warning message for jury mode without jurys */}
      {isJuryMode && scenarioJurysCount === 0 && (
        <div className="matching-message warning">
          <AlertCircle size={18} />
          <span>
            <strong>Configuration requise :</strong> Allez dans Scénarios → {activeScenarioNom} → Gestion des Jurys pour créer des jurys avant de lancer les affectations.
          </span>
        </div>
      )}

      {/* Warning message for stage mode without geocoded data */}
      {isStageScenario && !stageReadyForMatching && (
        <div className="matching-message warning">
          <AlertCircle size={18} />
          <span>
            <strong>Configuration requise :</strong> Allez dans Scénarios → {activeScenarioNom} → Suivi de Stage pour importer et géocoder les stages avant de lancer les affectations.
            {geocodedStagesCount === 0 && ' (Aucun stage géocodé)'}
            {geocodedStagesCount > 0 && geocodedEnseignantsCount === 0 && ' (Aucun enseignant géocodé)'}
          </span>
        </div>
      )}

      {/* Error message */}
      {matchingError && (
        <div className="matching-message error">
          <AlertCircle size={18} />
          {matchingError}
          <button onClick={onClearError}>×</button>
        </div>
      )}

      {/* Success message */}
      {matchingStats && !matchingError && (
        <div className="matching-message success">
          ✓ {matchingStats.affected}/{matchingStats.total} élèves affectés
          {matchingStats.tauxMatiere !== undefined && (
            <span className="matiere-info"> • {Math.round(matchingStats.tauxMatiere * 100)}% correspondance matière</span>
          )}
          <button onClick={onClearStats}>×</button>
        </div>
      )}

      {/* Validation success message */}
      {validationSuccess && (
        <div className="matching-message success validated">
          <CheckCheck size={18} />
          <span>
            Affectation validée le {formatArchiveDate(validationSuccess.date)}
            <span className="validation-hint"> — Consultable dans le tableau de bord</span>
          </span>
          <button onClick={onClearValidation}>×</button>
        </div>
      )}
    </>
  );
};
