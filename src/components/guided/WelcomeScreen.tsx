// ============================================================
// COMPONENT - WELCOME SCREEN (First Launch)
// ============================================================

import { Compass, Zap } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import './GuidedMode.css';

export function WelcomeScreen() {
  const { setGuidedModeActive, markWelcomeSeen, setGuidedStep } = useUIStore();

  const handleChooseGuided = () => {
    markWelcomeSeen();
    setGuidedModeActive(true);
    setGuidedStep('scenario');
  };

  const handleChooseExpert = () => {
    markWelcomeSeen();
    setGuidedModeActive(false);
  };

  return (
    <div className="guided-overlay">
      <div className="welcome-screen">
        <div className="welcome-logo">
          <span className="logo-icon">G</span>
          <span className="logo-text">Groupit</span>
        </div>

        <h1 className="welcome-title">Bienvenue !</h1>
        <p className="welcome-subtitle">
          Comment souhaitez-vous utiliser l'application ?
        </p>

        <div className="welcome-choices">
          <button
            className="welcome-choice guided"
            onClick={handleChooseGuided}
          >
            <div className="choice-icon">
              <Compass size={32} />
            </div>
            <div className="choice-content">
              <h2>Mode Guidé</h2>
              <p>Idéal pour débuter. Je vous accompagne étape par étape pour réaliser votre première affectation.</p>
            </div>
            <div className="choice-badge">Recommandé</div>
          </button>

          <button
            className="welcome-choice expert"
            onClick={handleChooseExpert}
          >
            <div className="choice-icon">
              <Zap size={32} />
            </div>
            <div className="choice-content">
              <h2>Mode Expert</h2>
              <p>Accès direct à toutes les fonctionnalités. Pour les utilisateurs qui connaissent déjà l'application.</p>
            </div>
          </button>
        </div>

        <p className="welcome-hint">
          Vous pourrez changer de mode à tout moment dans les paramètres.
        </p>
      </div>
    </div>
  );
}
