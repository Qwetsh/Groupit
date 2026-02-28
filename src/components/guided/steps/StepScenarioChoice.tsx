// ============================================================
// GUIDED STEP - SCENARIO CHOICE
// ============================================================

import { Briefcase, Mic } from 'lucide-react';
import { useUIStore, type GuidedScenarioType } from '../../../stores/uiStore';
import '../GuidedMode.css';

interface StepScenarioChoiceProps {
  onNext: () => void;
}

export function StepScenarioChoice({ onNext }: StepScenarioChoiceProps) {
  const { setGuidedScenarioType } = useUIStore();

  const handleChoice = (type: GuidedScenarioType) => {
    setGuidedScenarioType(type);
    onNext();
  };

  return (
    <div className="guided-step step-scenario">
      <h1 className="step-title">Que souhaitez-vous organiser ?</h1>
      <p className="step-subtitle">
        Choisissez le type d'affectation que vous voulez réaliser.
      </p>

      <div className="scenario-choices">
        <button
          className="scenario-choice"
          onClick={() => handleChoice('suivi_stage')}
        >
          <div className="scenario-icon stage">
            <Briefcase size={48} />
          </div>
          <div className="scenario-info">
            <h2>Suivi de Stage 3ème</h2>
            <p>
              Affecter chaque élève de 3ème à un enseignant tuteur
              pour le suivi de son stage en entreprise.
            </p>
          </div>
          <ul className="scenario-features">
            <li>Prise en compte des distances domicile-stage</li>
            <li>Équilibrage de la charge par enseignant</li>
            <li>Respect des contraintes horaires</li>
          </ul>
        </button>

        <button
          className="scenario-choice"
          onClick={() => handleChoice('oral_dnb')}
        >
          <div className="scenario-icon oral">
            <Mic size={48} />
          </div>
          <div className="scenario-info">
            <h2>Oral du DNB</h2>
            <p>
              Constituer les jurys d'oral et répartir les élèves
              entre les différents jurys.
            </p>
          </div>
          <ul className="scenario-features">
            <li>Création automatique des jurys</li>
            <li>Équilibrage du nombre d'élèves par jury</li>
            <li>Prise en compte des matières présentées</li>
          </ul>
        </button>
      </div>
    </div>
  );
}
