// ============================================================
// COMPONENT - GUIDED MODE (Main Wizard)
// ============================================================

import { useCallback, useMemo } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { useUIStore, type GuidedStep } from '../../stores/uiStore';
import { StepScenarioChoice } from './steps/StepScenarioChoice';
import { StepImportEleves } from './steps/StepImportEleves';
import { StepThemesEleves } from './steps/StepThemesEleves';
import { StepBinomes } from './steps/StepBinomes';
import { StepImportEnseignants } from './steps/StepImportEnseignants';
import { StepConfiguration } from './steps/StepConfiguration';
import { StepSalles } from './steps/StepSalles';
import { StepRecap } from './steps/StepRecap';
import { StepResults } from './steps/StepResults';
import './GuidedMode.css';

// Steps for the wizard (base + oral_dnb adds 'themes' + 'salles')
const STEPS_BASE: GuidedStep[] = ['scenario', 'eleves', 'enseignants', 'configuration', 'recap', 'results'];
const STEPS_ORAL_DNB: GuidedStep[] = ['scenario', 'eleves', 'themes', 'binomes', 'enseignants', 'configuration', 'salles', 'recap', 'results'];

const STEP_LABELS: Record<GuidedStep, string> = {
  welcome: 'Bienvenue',
  scenario: 'Type',
  eleves: 'Eleves',
  themes: 'Themes',
  binomes: 'Binômes',
  enseignants: 'Enseignants',
  configuration: 'Configuration',
  salles: 'Salles',
  recap: 'Recapitulatif',
  results: 'Resultats',
};

export function GuidedMode() {
  const { guidedMode, setGuidedStep, exitGuidedMode } = useUIStore();
  const { currentStep } = guidedMode;

  const activeSteps = useMemo(() =>
    guidedMode.scenarioType === 'oral_dnb' ? STEPS_ORAL_DNB : STEPS_BASE,
    [guidedMode.scenarioType]
  );

  const currentStepIndex = activeSteps.indexOf(currentStep);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setGuidedStep(activeSteps[currentStepIndex - 1]);
    }
  }, [currentStepIndex, setGuidedStep, activeSteps]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < activeSteps.length - 1) {
      setGuidedStep(activeSteps[currentStepIndex + 1]);
    }
  }, [currentStepIndex, setGuidedStep, activeSteps]);

  const handleExit = useCallback(() => {
    exitGuidedMode();
  }, [exitGuidedMode]);

  const renderStep = () => {
    switch (currentStep) {
      case 'scenario':
        return <StepScenarioChoice onNext={handleNext} />;
      case 'eleves':
        return <StepImportEleves onNext={handleNext} onBack={handleBack} />;
      case 'themes':
        return <StepThemesEleves onNext={handleNext} onBack={handleBack} />;
      case 'binomes':
        return <StepBinomes onNext={handleNext} onBack={handleBack} />;
      case 'enseignants':
        return <StepImportEnseignants onNext={handleNext} onBack={handleBack} />;
      case 'configuration':
        return <StepConfiguration onNext={handleNext} onBack={handleBack} />;
      case 'salles':
        return <StepSalles onNext={handleNext} onBack={handleBack} />;
      case 'recap':
        return <StepRecap onNext={handleNext} onBack={handleBack} />;
      case 'results':
        return <StepResults onFinish={handleExit} onBack={handleBack} />;
      default:
        return null;
    }
  };

  return (
    <div className="guided-overlay">
      <div className={`guided-container ${currentStep === 'configuration' ? 'guided-container-wide' : ''}`}>
        {/* Header */}
        <div className="guided-header">
          {currentStepIndex > 0 && currentStep !== 'results' && (
            <button className="guided-back-btn" onClick={handleBack}>
              <ChevronLeft size={20} />
              Retour
            </button>
          )}

          <div className="guided-progress">
            {activeSteps.map((step, index) => (
              <div
                key={step}
                className={`progress-dot ${index < currentStepIndex ? 'completed' : ''} ${index === currentStepIndex ? 'active' : ''}`}
                title={STEP_LABELS[step]}
              />
            ))}
          </div>

          <button className="guided-exit-btn" onClick={handleExit}>
            Retour a l'accueil
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="guided-step-indicator">
          Etape {currentStepIndex + 1} sur {activeSteps.length}
        </div>

        {/* Content */}
        <div className="guided-content">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
