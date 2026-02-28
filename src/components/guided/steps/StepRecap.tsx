// ============================================================
// GUIDED STEP - RECAP (Lancement répartition avec animation)
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { Users, GraduationCap, Settings, Play, Loader2, CheckCircle, PartyPopper, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useEleveStore } from '../../../stores/eleveStore';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import { useJuryStore } from '../../../stores/juryStore';
import { useAffectationStore } from '../../../stores/affectationStore';
import { solveOralDnbComplete } from '../../../algorithms';
import '../GuidedMode.css';

interface StepRecapProps {
  onNext: () => void;
  onBack: () => void;
}

type RecapState = 'ready' | 'running' | 'success' | 'error';

export function StepRecap({ onBack }: StepRecapProps) {
  const navigate = useNavigate();
  const { guidedMode, exitGuidedMode } = useUIStore();
  const { scenarios } = useScenarioStore();
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const { getJurysByScenario } = useJuryStore();
  const { addAffectations, getAffectationsByScenario } = useAffectationStore();

  const [state, setState] = useState<RecapState>('ready');
  const [error, setError] = useState<string | null>(null);
  const [affectationCount, setAffectationCount] = useState(0);

  const scenario = scenarios.find(s => s.id === guidedMode.createdScenarioId);
  const scenarioJurys = scenario ? getJurysByScenario(scenario.id!) : [];

  // Filter eleves by 3eme
  const eleves3e = eleves.filter(e => e.classe?.startsWith('3'));

  // Check if already has affectations
  const existingAffectations = scenario ? getAffectationsByScenario(scenario.id!) : [];

  // Auto-check if we already have affectations
  useEffect(() => {
    if (existingAffectations.length > 0) {
      setState('success');
      setAffectationCount(existingAffectations.length);
    }
  }, [existingAffectations.length]);

  const handleLaunchRepartition = useCallback(async () => {
    if (!scenario) return;

    setState('running');
    setError(null);

    try {
      // Small delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 500));

      // Run the oral DNB algorithm
      const result = solveOralDnbComplete(
        eleves3e,
        enseignants,
        scenarioJurys,
        scenario
      );

      // Convert to affectations and save
      const affectationsToAdd = result.affectations.map(aff => ({
        eleveId: aff.eleveId,
        enseignantId: '', // For jury mode, we use juryId
        juryId: aff.juryId,
        scenarioId: scenario.id!,
        type: 'oral_dnb' as const,
        metadata: {},
        score: aff.score,
        scoreDetail: aff.scoreDetail,
        explication: aff.explication,
      }));

      await addAffectations(affectationsToAdd);
      setAffectationCount(affectationsToAdd.length);
      setState('success');

    } catch (err) {
      console.error('Repartition error:', err);
      setError(String(err));
      setState('error');
    }
  }, [scenario, eleves3e, enseignants, scenarioJurys, addAffectations]);

  const handleViewResults = useCallback(() => {
    exitGuidedMode();
    navigate('/board');
  }, [exitGuidedMode, navigate]);

  if (!scenario) {
    return (
      <div className="guided-step step-recap">
        <h1 className="step-title">Erreur</h1>
        <p>Configuration non trouvée. Veuillez retourner a l'etape precedente.</p>
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>
    );
  }

  // SUCCESS STATE
  if (state === 'success') {
    return (
      <div className="guided-step step-recap success-view">
        <div className="success-animation">
          <div className="success-icon">
            <CheckCircle size={64} />
          </div>
          <PartyPopper size={32} className="confetti left" />
          <PartyPopper size={32} className="confetti right" />
        </div>

        <h1 className="step-title success">Repartition terminee !</h1>
        <p className="step-subtitle">
          {affectationCount} eleves ont ete repartis dans {scenarioJurys.length} jurys.
        </p>

        <div className="success-stats">
          <div className="success-stat">
            <Users size={24} />
            <span className="stat-value">{affectationCount}</span>
            <span className="stat-label">eleves affectes</span>
          </div>
          <div className="success-stat">
            <GraduationCap size={24} />
            <span className="stat-value">{scenarioJurys.length}</span>
            <span className="stat-label">jurys</span>
          </div>
        </div>

        <button
          className="btn btn-primary btn-large view-results-btn"
          onClick={handleViewResults}
        >
          <Eye size={20} />
          Voir les resultats
        </button>

        <p className="success-hint">
          Vous pourrez ajuster les affectations manuellement par glisser-deposer.
        </p>
      </div>
    );
  }

  // RUNNING STATE
  if (state === 'running') {
    return (
      <div className="guided-step step-recap running-view">
        <div className="running-animation">
          <Loader2 size={64} className="spin" />
        </div>
        <h1 className="step-title">Repartition en cours...</h1>
        <p className="step-subtitle">
          L'algorithme optimise les affectations pour respecter les contraintes.
        </p>
        <div className="running-progress">
          <div className="progress-bar">
            <div className="progress-fill animated"></div>
          </div>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (state === 'error') {
    return (
      <div className="guided-step step-recap error-view">
        <h1 className="step-title error">Erreur</h1>
        <p className="step-subtitle">
          Une erreur s'est produite lors de la repartition.
        </p>
        <div className="error-message">
          <p>{error}</p>
        </div>
        <div className="step-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            Retour
          </button>
          <button className="btn btn-primary" onClick={handleLaunchRepartition}>
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  // READY STATE
  return (
    <div className="guided-step step-recap">
      <h1 className="step-title">Tout est pret !</h1>
      <p className="step-subtitle">
        Verifiez les informations ci-dessous avant de lancer la repartition.
      </p>

      <div className="recap-cards">
        <div className="recap-card">
          <div className="recap-icon">
            <Users size={28} />
          </div>
          <div className="recap-value">{eleves3e.length}</div>
          <div className="recap-label">eleves de 3eme</div>
        </div>

        <div className="recap-card">
          <div className="recap-icon jury">
            <GraduationCap size={28} />
          </div>
          <div className="recap-value">{scenarioJurys.length}</div>
          <div className="recap-label">jurys</div>
          <div className="recap-detail">
            {scenarioJurys.reduce((sum, j) => sum + j.capaciteMax, 0)} places au total
          </div>
        </div>

        <div className="recap-card">
          <div className="recap-icon config">
            <Settings size={28} />
          </div>
          <div className="recap-value">{scenario.nom}</div>
          <div className="recap-label">configuration</div>
        </div>
      </div>

      <div className="launch-section">
        <p className="launch-hint">
          L'algorithme va repartir les eleves dans les jurys en optimisant
          l'equilibrage et les correspondances de matieres.
        </p>

        <button
          className="btn btn-primary btn-launch"
          onClick={handleLaunchRepartition}
        >
          <Play size={24} />
          Lancer la repartition
        </button>
      </div>

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>
    </div>
  );
}
