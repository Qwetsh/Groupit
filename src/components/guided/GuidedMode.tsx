// ============================================================
// COMPONENT - GUIDED MODE (Main Wizard)
// ============================================================

import { useCallback } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { useUIStore, type GuidedStep } from '../../stores/uiStore';
import { StepScenarioChoice } from './steps/StepScenarioChoice';
import { StepImportEleves } from './steps/StepImportEleves';
import { StepImportEnseignants } from './steps/StepImportEnseignants';
import { StepConfiguration } from './steps/StepConfiguration';
import { StepRecap } from './steps/StepRecap';
import { StepResults } from './steps/StepResults';
import './GuidedMode.css';

const STEPS: GuidedStep[] = ['scenario', 'eleves', 'enseignants', 'configuration', 'recap', 'results'];

const STEP_LABELS: Record<GuidedStep, string> = {
  welcome: 'Bienvenue',
  scenario: 'Type',
  eleves: 'Élèves',
  enseignants: 'Enseignants',
  configuration: 'Configuration',
  recap: 'Récapitulatif',
  results: 'Résultats',
};

export function GuidedMode() {
  const { guidedMode, setGuidedStep, exitGuidedMode } = useUIStore();
  const { currentStep } = guidedMode;

  const currentStepIndex = STEPS.indexOf(currentStep);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setGuidedStep(STEPS[currentStepIndex - 1]);
    }
  }, [currentStepIndex, setGuidedStep]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setGuidedStep(STEPS[currentStepIndex + 1]);
    }
  }, [currentStepIndex, setGuidedStep]);

  const handleExit = useCallback(() => {
    exitGuidedMode();
  }, [exitGuidedMode]);

  const renderStep = () => {
    switch (currentStep) {
      case 'scenario':
        return <StepScenarioChoice onNext={handleNext} />;
      case 'eleves':
        return <StepImportEleves onNext={handleNext} onBack={handleBack} />;
      case 'enseignants':
        return <StepImportEnseignants onNext={handleNext} onBack={handleBack} />;
      case 'configuration':
        return <StepConfiguration onNext={handleNext} onBack={handleBack} />;
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
      <div className="guided-container">
        {/* Header */}
        <div className="guided-header">
          {currentStepIndex > 0 && currentStep !== 'results' && (
            <button className="guided-back-btn" onClick={handleBack}>
              <ChevronLeft size={20} />
              Retour
            </button>
          )}

          <div className="guided-progress">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`progress-dot ${index < currentStepIndex ? 'completed' : ''} ${index === currentStepIndex ? 'active' : ''}`}
                title={STEP_LABELS[step]}
              />
            ))}
          </div>

          <button className="guided-exit-btn" onClick={handleExit}>
            Passer en Expert
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="guided-step-indicator">
          Étape {currentStepIndex + 1} sur {STEPS.length}
        </div>

        {/* Content */}
        <div className="guided-content">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
