// ============================================================
// COMPONENT - GUIDED MODE (Main Wizard)
// ============================================================

import { useCallback, useMemo } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { useUIStore, type GuidedStep } from '../../stores/uiStore';
import { StepScenarioChoice } from './steps/StepScenarioChoice';
import { StepImportEleves } from './steps/StepImportEleves';
import { StepImportEnseignants } from './steps/StepImportEnseignants';
import { StepConfiguration } from './steps/StepConfiguration';
import { StepResults } from './steps/StepResults';
import './GuidedMode.css';

// Steps for the wizard - recap removed, configuration now handles jury creation
const STEPS: GuidedStep[] = ['scenario', 'eleves', 'enseignants', 'configuration', 'results'];

const STEP_LABELS: Record<GuidedStep, string> = {
  welcome: 'Bienvenue',
  scenario: 'Type',
  eleves: 'Eleves',
  enseignants: 'Enseignants',
  configuration: 'Configuration',
  recap: 'Recapitulatif',
  results: 'Resultats',
};

export function GuidedMode() {
  const { guidedMode, setGuidedStep, exitGuidedMode } = useUIStore();
  const { currentStep } = guidedMode;

  // Filter steps based on current step (handle legacy 'recap' step)
  const activeSteps = useMemo(() => {
    // If user is on 'recap' step, redirect to 'configuration'
    if (currentStep === 'recap') {
      setGuidedStep('configuration');
      return STEPS;
    }
    return STEPS;
  }, [currentStep, setGuidedStep]);

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
      case 'enseignants':
        return <StepImportEnseignants onNext={handleNext} onBack={handleBack} />;
      case 'configuration':
      case 'recap': // Handle legacy step
        return <StepConfiguration onNext={handleNext} onBack={handleBack} />;
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
            {activeSteps.map((step, index) => (
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
