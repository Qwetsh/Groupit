// ============================================================
// GUIDED STEP - RESULTS (Redirection vers Board)
// ============================================================

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useNavigate } from 'react-router-dom';
import '../GuidedMode.css';

interface StepResultsProps {
  onFinish: () => void;
  onBack: () => void;
}

export function StepResults({ onFinish }: StepResultsProps) {
  const { guidedMode, exitGuidedMode } = useUIStore();
  const navigate = useNavigate();

  // Redirect to board immediately
  useEffect(() => {
    // Small delay to show the transition
    const timer = setTimeout(() => {
      // Exit guided mode and navigate to board
      exitGuidedMode();

      // Navigate to board with scenario context
      if (guidedMode.scenarioType === 'oral_dnb') {
        navigate('/board');
      } else {
        navigate('/board');
      }

      onFinish();
    }, 500);

    return () => clearTimeout(timer);
  }, [exitGuidedMode, navigate, onFinish, guidedMode.scenarioType]);

  return (
    <div className="guided-step step-results loading-redirect">
      <div className="redirect-animation">
        <Loader2 size={48} className="spin" />
      </div>
      <h1 className="step-title">Preparation de la repartition...</h1>
      <p className="step-subtitle">
        Vous allez etre redirige vers l'ecran de repartition.
      </p>
    </div>
  );
}
