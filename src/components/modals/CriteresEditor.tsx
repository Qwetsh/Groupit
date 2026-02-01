// ============================================================
// CRITÈRES EDITOR - Composant pour éditer les critères d'un scénario
// ============================================================

import { Lock, Info } from 'lucide-react';
import type { ScenarioType, CritereInstance, PriorityLevel } from '../../domain/models';
import { 
  getCritereDefinition,
  getOptionalCriteresForScenarioType,
  getForcedCriteresForScenarioType,
} from '../../domain/models';
import { useUIStore } from '../../stores/uiStore';
import './CriteresEditor.css';

interface CriteresEditorProps {
  scenarioType: ScenarioType;
  criteres: CritereInstance[];
  onChange: (criteres: CritereInstance[]) => void;
}

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  off: 'Désactivé',
  low: 'Faible',
  normal: 'Normal',
  high: 'Élevé',
};

const PRIORITY_ORDER: PriorityLevel[] = ['off', 'low', 'normal', 'high'];

export function CriteresEditor({ scenarioType, criteres, onChange }: CriteresEditorProps) {
  const expertMode = useUIStore(state => state.expertMode);
  
  // Récupérer les définitions pour ce type de scénario
  const forcedDefs = getForcedCriteresForScenarioType(scenarioType);
  const optionalDefs = getOptionalCriteresForScenarioType(scenarioType);
  
  // Trouver ou créer une instance de critère
  const getCritereInstance = (id: string): CritereInstance | undefined => {
    return criteres.find(c => c.id === id);
  };
  
  // Mettre à jour un critère
  const updateCritere = (id: string, updates: Partial<CritereInstance>) => {
    const existing = criteres.find(c => c.id === id);
    if (existing) {
      onChange(criteres.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      // Créer une nouvelle instance avec les valeurs par défaut
      const def = getCritereDefinition(id);
      if (def) {
        onChange([...criteres, {
          id,
          priority: def.defaultPriority,
          isHardConstraint: def.defaultHardConstraint,
          isForced: def.isForced,
          ...updates,
        }]);
      }
    }
  };
  
  // Rendu d'une carte de critère
  const renderCritereCard = (
    id: string,
    nom: string,
    description: string,
    isForced: boolean,
    canBeHardConstraint: boolean,
    hasWeightByHoursOption: boolean = false
  ) => {
    const instance = getCritereInstance(id);
    const currentPriority = instance?.priority ?? (isForced ? 'high' : 'normal');
    const isHardConstraint = instance?.isHardConstraint ?? false;
    const weightByHours = instance?.weightByHours ?? false;
    const isDisabled = currentPriority === 'off';
    
    return (
      <div
        key={id}
        className={`critere-card ${isForced ? 'forced' : ''} ${isDisabled ? 'disabled' : 'active'}`}
        data-priority={currentPriority}
      >
        <div className="critere-card-header">
          <div className="critere-card-info">
            <div className="critere-card-title">
              {nom}
              {isForced && (
                <span className="badge system">
                  <Lock size={10} style={{ marginRight: 4 }} />
                  Système
                </span>
              )}
            </div>
            <div className="critere-card-description">{description}</div>
          </div>
          
          <div className="priority-buttons">
            {PRIORITY_ORDER.map(priority => {
              // Les critères forcés ne peuvent pas être désactivés
              const isDisabledOption = isForced && priority === 'off';
              
              return (
                <button
                  key={priority}
                  type="button"
                  className={`priority-btn ${currentPriority === priority ? 'active' : ''}`}
                  data-priority={priority}
                  disabled={isDisabledOption}
                  onClick={() => updateCritere(id, { priority })}
                  title={isDisabledOption ? 'Ce critère système ne peut pas être désactivé' : undefined}
                >
                  {PRIORITY_LABELS[priority]}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Options spécifiques au critère */}
        {(canBeHardConstraint || hasWeightByHoursOption) && !isDisabled && (
          <div className="critere-card-footer">
            {canBeHardConstraint && (
              <label className="hard-constraint-toggle">
                <input
                  type="checkbox"
                  checked={isHardConstraint}
                  onChange={e => updateCritere(id, { isHardConstraint: e.target.checked })}
                />
                Contrainte dure (éliminatoire si non respectée)
              </label>
            )}
            
            {hasWeightByHoursOption && (
              <label className="weight-by-hours-toggle" title="Quand activé, un enseignant avec plus d'heures peut recevoir plus d'élèves proportionnellement.">
                <input
                  type="checkbox"
                  checked={weightByHours}
                  onChange={e => updateCritere(id, { weightByHours: e.target.checked })}
                />
                <span>Pondérer par charge horaire</span>
                <Info size={14} className="info-icon" />
              </label>
            )}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="criteres-editor">
      <p className="section-description">
        Définissez l'importance de chaque critère. Les critères avec une priorité plus élevée 
        auront plus d'influence sur les affectations.
      </p>
      
      {/* Critères forcés (visibles uniquement en mode expert) */}
      {expertMode && forcedDefs.length > 0 && (
        <>
          <div className="criteres-section-title">
            Critères système (appliqués automatiquement)
          </div>
          {forcedDefs.map(def => 
            renderCritereCard(
              def.id, 
              def.nom, 
              def.description, 
              true, 
              def.canBeHardConstraint,
              def.hasWeightByHoursOption ?? false
            )
          )}
        </>
      )}
      
      {/* Critères optionnels */}
      {optionalDefs.length > 0 && (
        <>
          {expertMode && forcedDefs.length > 0 && (
            <div className="criteres-section-title">
              Critères optionnels
            </div>
          )}
          {optionalDefs.map(def => 
            renderCritereCard(
              def.id, 
              def.nom, 
              def.description, 
              false, 
              def.canBeHardConstraint,
              def.hasWeightByHoursOption ?? false
            )
          )}
        </>
      )}
      
      {optionalDefs.length === 0 && !expertMode && (
        <div className="criteres-empty">
          Aucun critère optionnel disponible pour ce type de scénario.
        </div>
      )}
    </div>
  );
}
