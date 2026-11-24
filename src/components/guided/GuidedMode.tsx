// ============================================================
// COMPONENT - GUIDED MODE (Main Wizard)
// ============================================================
//
// Chaque parcours est une suite d'étapes. Deux règles évitent les clics inutiles :
// - les élèves déjà importés ne redemandent pas d'étape : le parcours commence
//   à l'étape suivante, et « Retour » permet toujours d'y revenir ;
// - l'étape « Enseignants » n'apparaît que si la base n'en contient aucun.
// La dernière étape lance directement la répartition ; le résultat s'ouvre
// ensuite dans le tableau, avec le bilan et les points à vérifier.

import { useCallback, useMemo, useState } from 'react';
import { X, Check } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { etapesDuParcours, ETAPES_DE_CALCUL, STEP_LABELS } from './guidedFlow';
import { useEleveStore } from '../../stores/eleveStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { StepScenarioChoice } from './steps/StepScenarioChoice';
import { StepImportEleves } from './steps/StepImportEleves';
import { StepThemesEleves } from './steps/StepThemesEleves';
import { StepGroupes } from './steps/StepGroupes';
import { StepImportEnseignants } from './steps/StepImportEnseignants';
import { StepImportStages } from './steps/StepImportStages';
import { StepConfiguration } from './steps/StepConfiguration';
import { StepSalles } from './steps/StepSalles';
import { StepRecap } from './steps/StepRecap';
import { StepResults } from './steps/StepResults';
import { StepSelectEleves } from './steps/StepSelectEleves';
import { StepSelectAdultes } from './steps/StepSelectAdultes';
import { StepConfigGroupes } from './steps/StepConfigGroupes';
import './GuidedMode.css';
import './GuidedFlow.css';

export function GuidedMode() {
  const { guidedMode, setGuidedStep, exitGuidedMode } = useUIStore();
  const { currentStep } = guidedMode;
  const nbEnseignants = useEnseignantStore(state => state.enseignants.length);
  const nbEleves = useEleveStore(state => state.eleves.length);

  // Instantané pris à l'ouverture : l'étape « Enseignants » ne doit pas
  // disparaître pendant qu'on y importe des enseignants.
  const [avaitDesEnseignants] = useState(() => nbEnseignants > 0);

  const activeSteps = useMemo(() => {
    const etapes = etapesDuParcours(guidedMode.scenarioType);
    return avaitDesEnseignants && currentStep !== 'enseignants'
      ? etapes.filter(e => e !== 'enseignants')
      : etapes;
  }, [guidedMode.scenarioType, avaitDesEnseignants, currentStep]);

  const enCalcul = ETAPES_DE_CALCUL.includes(currentStep);
  const currentStepIndex = enCalcul ? activeSteps.length : activeSteps.indexOf(currentStep);

  const handleBack = useCallback(() => {
    if (enCalcul) {
      setGuidedStep(activeSteps[activeSteps.length - 1]);
    } else if (currentStepIndex > 0) {
      setGuidedStep(activeSteps[currentStepIndex - 1]);
    } else {
      exitGuidedMode();
    }
  }, [enCalcul, currentStepIndex, setGuidedStep, activeSteps, exitGuidedMode]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < activeSteps.length - 1) {
      setGuidedStep(activeSteps[currentStepIndex + 1]);
    } else {
      setGuidedStep('recap');
    }
  }, [currentStepIndex, setGuidedStep, activeSteps]);

  const handleExit = useCallback(() => {
    exitGuidedMode();
  }, [exitGuidedMode]);

  const estDerniere = currentStepIndex === activeSteps.length - 1;

  const renderStep = () => {
    switch (currentStep) {
      case 'scenario':
        return <StepScenarioChoice onNext={handleNext} />;
      case 'eleves':
        return <StepImportEleves onNext={handleNext} onBack={handleBack} />;
      case 'stages':
        return <StepImportStages onNext={handleNext} onBack={handleBack} />;
      case 'themes':
        return <StepThemesEleves onNext={handleNext} onBack={handleBack} />;
      case 'groupes':
        return <StepGroupes onNext={handleNext} onBack={handleBack} />;
      case 'enseignants':
        return <StepImportEnseignants onNext={handleNext} onBack={handleBack} />;
      case 'configuration':
        return <StepConfiguration onNext={handleNext} onBack={handleBack} lanceLeCalcul={estDerniere} />;
      case 'salles':
        return <StepSalles onNext={handleNext} onBack={handleBack} />;
      case 'selection':
        return <StepSelectEleves onNext={handleNext} onBack={handleBack} />;
      case 'adultes':
        return <StepSelectAdultes onNext={handleNext} onBack={handleBack} />;
      case 'parametres':
        return <StepConfigGroupes onNext={handleNext} onBack={handleBack} />;
      case 'recap':
        return <StepRecap onNext={handleNext} onBack={handleBack} />;
      case 'results':
        return <StepResults onFinish={handleExit} onBack={handleBack} />;
      default:
        return null;
    }
  };

  const etapeLarge = ['themes', 'groupes', 'enseignants', 'configuration', 'salles', 'selection', 'adultes', 'parametres'].includes(currentStep);

  return (
    <div className="guided-overlay">
      <div className={`guided-container ${etapeLarge ? 'guided-container-wide' : ''}`}>
        {/* En-tête identique à chaque étape : où j'en suis, et comment quitter */}
        <div className="guided-header guided-header-uni">
          <ol className="guided-stepper" aria-label="Étapes">
            {activeSteps.map((step, index) => {
              const faite = index < currentStepIndex;
              const active = index === currentStepIndex;
              return (
                <li
                  key={step}
                  className={`stepper-item ${faite ? 'done' : ''} ${active ? 'active' : ''}`}
                  aria-current={active ? 'step' : undefined}
                >
                  {faite && !enCalcul ? (
                    <button type="button" className="stepper-link" onClick={() => setGuidedStep(step)}>
                      <span className="stepper-num" aria-hidden="true"><Check size={12} /></span>
                      <span className="stepper-label">{STEP_LABELS[step]}</span>
                    </button>
                  ) : (
                    <span className="stepper-link">
                      <span className="stepper-num" aria-hidden="true">{faite ? <Check size={12} /> : index + 1}</span>
                      <span className="stepper-label">{STEP_LABELS[step]}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          <button className="guided-exit-btn" onClick={handleExit}>
            Quitter
            <X size={16} />
          </button>
        </div>

        {!enCalcul && currentStep !== 'eleves' && nbEleves > 0 && activeSteps[0] === 'eleves' && (
          <div className="guided-donnees">
            <span>{nbEleves} élèves importés</span>
            <button type="button" className="guided-donnees-lien" onClick={() => setGuidedStep('eleves')}>
              Modifier
            </button>
          </div>
        )}

        {/* Content */}
        <div className="guided-content">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
