// ============================================================
// GUIDED STEP - RESULTS
// ============================================================

import { useCallback } from 'react';
import { CheckCircle, Users, Download, Eye, PartyPopper } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useAffectationStore } from '../../../stores/affectationStore';
import { useNavigate } from 'react-router-dom';
import '../GuidedMode.css';

interface StepResultsProps {
  onFinish: () => void;
  onBack: () => void;
}

export function StepResults({ onFinish }: StepResultsProps) {
  const { guidedMode } = useUIStore();
  const { scenarios } = useScenarioStore();
  const { affectations } = useAffectationStore();
  const navigate = useNavigate();

  const scenario = scenarios.find(s => s.id === guidedMode.createdScenarioId);
  const scenarioAffectations = affectations.filter(a => a.scenarioId === scenario?.id);

  const handleViewDetails = useCallback(() => {
    onFinish();
    navigate('/board');
  }, [onFinish, navigate]);

  const handleExport = useCallback(() => {
    // TODO: Implement export
    onFinish();
    navigate('/donnees');
  }, [onFinish, navigate]);

  const handleFinish = useCallback(() => {
    onFinish();
    navigate('/');
  }, [onFinish, navigate]);

  return (
    <div className="guided-step step-results">
      <div className="success-animation">
        <div className="success-icon">
          <CheckCircle size={64} />
        </div>
        <PartyPopper size={32} className="confetti left" />
        <PartyPopper size={32} className="confetti right" />
      </div>

      <h1 className="step-title success">Répartition terminée !</h1>
      <p className="step-subtitle">
        Tous les élèves ont été affectés avec succès.
      </p>

      <div className="results-summary">
        <div className="result-stat">
          <Users size={24} />
          <span className="stat-value">{scenarioAffectations.length}</span>
          <span className="stat-label">affectations créées</span>
        </div>
      </div>

      <div className="results-actions">
        <button
          className="result-action-btn primary"
          onClick={handleViewDetails}
        >
          <Eye size={20} />
          <div>
            <strong>Voir les détails</strong>
            <span>Consulter et ajuster les affectations</span>
          </div>
        </button>

        <button
          className="result-action-btn"
          onClick={handleExport}
        >
          <Download size={20} />
          <div>
            <strong>Exporter</strong>
            <span>Télécharger en PDF ou Excel</span>
          </div>
        </button>
      </div>

      <button className="btn btn-text" onClick={handleFinish}>
        Retourner au tableau de bord
      </button>
    </div>
  );
}
