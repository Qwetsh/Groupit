// ============================================================
// GUIDED STEP - CONFIGURATION (Simplified)
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { Settings, ChevronRight, Check } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useEleveStore } from '../../../stores/eleveStore';
import type { Scenario } from '../../../domain/models';
import '../GuidedMode.css';

interface StepConfigurationProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepConfiguration({ onNext, onBack }: StepConfigurationProps) {
  const { guidedMode, setGuidedCreatedScenarioId } = useUIStore();
  const { scenarios, addScenario, setActiveScenario } = useScenarioStore();
  const eleves = useEleveStore(state => state.eleves);

  const [scenarioName, setScenarioName] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Get unique classes from eleves
  const availableClasses = [...new Set(eleves.map(e => e.classe).filter(Boolean))].sort();

  // Auto-select 3ème classes for stage
  useEffect(() => {
    if (guidedMode.scenarioType === 'suivi_stage') {
      const classes3e = availableClasses.filter(c => c.startsWith('3'));
      setSelectedClasses(classes3e);
      setScenarioName('Suivi de Stage 3ème');
    } else if (guidedMode.scenarioType === 'oral_dnb') {
      const classes3e = availableClasses.filter(c => c.startsWith('3'));
      setSelectedClasses(classes3e);
      setScenarioName('Oral du DNB');
    }
  }, [guidedMode.scenarioType, availableClasses.join(',')]);

  const toggleClass = useCallback((classe: string) => {
    setSelectedClasses(prev =>
      prev.includes(classe)
        ? prev.filter(c => c !== classe)
        : [...prev, classe]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!scenarioName.trim() || selectedClasses.length === 0) return;

    setCreating(true);

    try {
      const newScenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> = {
        nom: scenarioName,
        type: guidedMode.scenarioType === 'suivi_stage' ? 'suivi_stage' : 'oral_dnb',
        mode: guidedMode.scenarioType === 'oral_dnb' ? 'groupes' : 'matching',
        parametres: {
          criteres: [],
          capaciteConfig: {
            capaciteBaseDefaut: 15,
            coefficients: { '6e': 0, '5e': 0, '4e': 0, '3e': 1 },
          },
          filtresEleves: {
            classes: selectedClasses,
          },
          filtresEnseignants: {},
          equilibrageActif: true,
        },
      };

      const createdScenario = await addScenario(newScenario);
      setGuidedCreatedScenarioId(createdScenario.id);
      setActiveScenario(createdScenario.id);

      onNext();
    } catch (error) {
      console.error('Error creating scenario:', error);
    } finally {
      setCreating(false);
    }
  }, [scenarioName, selectedClasses, guidedMode.scenarioType, addScenario, setGuidedCreatedScenarioId, setActiveScenario, onNext]);

  // Check if there's already a matching scenario
  const existingScenario = scenarios.find(s =>
    s.type === (guidedMode.scenarioType === 'suivi_stage' ? 'suivi_stage' : 'oral_dnb')
  );

  const handleUseExisting = useCallback(() => {
    if (existingScenario) {
      setGuidedCreatedScenarioId(existingScenario.id);
      setActiveScenario(existingScenario.id);
      onNext();
    }
  }, [existingScenario, setGuidedCreatedScenarioId, setActiveScenario, onNext]);

  return (
    <div className="guided-step step-config">
      <h1 className="step-title">Configuration</h1>
      <p className="step-subtitle">
        {guidedMode.scenarioType === 'suivi_stage'
          ? 'Configurez le suivi de stage pour vos élèves de 3ème.'
          : "Configurez l'oral du DNB."}
      </p>

      {existingScenario && (
        <div className="existing-scenario-notice">
          <Settings size={20} />
          <div>
            <strong>Configuration existante détectée</strong>
            <p>"{existingScenario.nom}" existe déjà.</p>
          </div>
          <button className="btn btn-secondary" onClick={handleUseExisting}>
            Utiliser cette configuration
          </button>
        </div>
      )}

      <div className="config-form">
        <div className="form-group">
          <label>Nom de la configuration</label>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Ex: Suivi de Stage 3ème"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Classes concernées</label>
          <p className="form-hint">Sélectionnez les classes dont les élèves participent.</p>
          <div className="class-selector">
            {availableClasses.map(classe => (
              <button
                key={classe}
                className={`class-chip ${selectedClasses.includes(classe) ? 'selected' : ''}`}
                onClick={() => toggleClass(classe)}
              >
                {selectedClasses.includes(classe) && <Check size={14} />}
                {classe}
              </button>
            ))}
          </div>
          {availableClasses.length === 0 && (
            <p className="no-classes-warning">
              Aucune classe trouvée. Assurez-vous que les élèves ont bien une classe assignée.
            </p>
          )}
        </div>

        <div className="config-summary">
          <div className="summary-item">
            <span className="summary-value">
              {eleves.filter(e => selectedClasses.includes(e.classe)).length}
            </span>
            <span className="summary-label">élèves concernés</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button
          className="btn btn-primary btn-large"
          onClick={handleCreate}
          disabled={!scenarioName.trim() || selectedClasses.length === 0 || creating}
        >
          {creating ? 'Création...' : 'Créer la configuration'}
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
