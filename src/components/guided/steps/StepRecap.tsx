// ============================================================
// GUIDED STEP - RECAP (Summary before launch)
// ============================================================

import { useState, useCallback } from 'react';
import { Users, GraduationCap, Settings, Play, Loader2 } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useEleveStore } from '../../../stores/eleveStore';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import { useAffectationStore } from '../../../stores/affectationStore';
import { solveMatching, convertToAffectations } from '../../../algorithms';
import '../GuidedMode.css';

interface StepRecapProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepRecap({ onNext, onBack }: StepRecapProps) {
  const { guidedMode } = useUIStore();
  const { scenarios } = useScenarioStore();
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const { addAffectations } = useAffectationStore();

  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenario = scenarios.find(s => s.id === guidedMode.createdScenarioId);

  // Filter eleves by scenario classes
  const scenarioClasses = scenario?.parametres?.filtresEleves?.classes || [];
  const filteredEleves = eleves.filter(e => scenarioClasses.includes(e.classe));

  const handleLaunch = useCallback(async () => {
    if (!scenario) return;

    setLaunching(true);
    setError(null);

    try {
      // Run the matching algorithm
      const result = solveMatching(filteredEleves, enseignants, scenario);

      // Convert results to affectations and save
      const affectations = convertToAffectations(result.affectations, scenario);
      await addAffectations(affectations);

      onNext();
    } catch (err) {
      setError(String(err));
      setLaunching(false);
    }
  }, [scenario, filteredEleves, enseignants, addAffectations, onNext]);

  if (!scenario) {
    return (
      <div className="guided-step step-recap">
        <h1 className="step-title">Erreur</h1>
        <p>Configuration non trouvée. Veuillez retourner à l'étape précédente.</p>
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="guided-step step-recap">
      <h1 className="step-title">Tout est prêt !</h1>
      <p className="step-subtitle">
        Vérifiez les informations ci-dessous avant de lancer la répartition.
      </p>

      <div className="recap-cards">
        <div className="recap-card">
          <div className="recap-icon">
            <Users size={28} />
          </div>
          <div className="recap-value">{filteredEleves.length}</div>
          <div className="recap-label">élèves</div>
          <div className="recap-detail">
            Classes : {scenarioClasses.join(', ')}
          </div>
        </div>

        <div className="recap-card">
          <div className="recap-icon">
            <GraduationCap size={28} />
          </div>
          <div className="recap-value">{enseignants.length}</div>
          <div className="recap-label">enseignants</div>
          <div className="recap-detail">
            Disponibles pour l'affectation
          </div>
        </div>

        <div className="recap-card">
          <div className="recap-icon">
            <Settings size={28} />
          </div>
          <div className="recap-value">{scenario.nom}</div>
          <div className="recap-label">configuration</div>
          <div className="recap-detail">
            {guidedMode.scenarioType === 'suivi_stage' ? 'Suivi de Stage' : 'Oral DNB'}
          </div>
        </div>
      </div>

      {error && (
        <div className="recap-error">
          <p>Une erreur s'est produite : {error}</p>
        </div>
      )}

      <div className="launch-section">
        <p className="launch-hint">
          L'algorithme va automatiquement répartir les élèves entre les enseignants
          en optimisant les critères configurés.
        </p>

        <button
          className="btn btn-primary btn-launch"
          onClick={handleLaunch}
          disabled={launching}
        >
          {launching ? (
            <>
              <Loader2 size={24} className="spin" />
              Répartition en cours...
            </>
          ) : (
            <>
              <Play size={24} />
              Lancer la répartition
            </>
          )}
        </button>
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack} disabled={launching}>
          Retour
        </button>
      </div>
    </div>
  );
}
