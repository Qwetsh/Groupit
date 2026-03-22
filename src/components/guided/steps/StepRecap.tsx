// ============================================================
// GUIDED STEP - RECAP (Lancement répartition avec animation)
// ============================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Users, GraduationCap, Settings, Play, Loader2, CheckCircle, PartyPopper, Eye, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useEleveStore } from '../../../stores/eleveStore';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import { useJuryStore } from '../../../stores/juryStore';
import { useAffectationStore } from '../../../stores/affectationStore';
import { useStageStore } from '../../../stores/stageStore';
import { solveOralDnbComplete, solveStageMatching, toStageGeoInfo, toEnseignantGeoInfo, assignTimeSlots, type DistributionMode } from '../../../algorithms';
import { computeRoutePairs } from '../../../infrastructure/geo/stageGeoWorkflow';
import { DistributionModeModal } from '../../modals/DistributionModeModal';
import '../GuidedMode.css';

interface StepRecapProps {
  onNext: () => void;
  onBack: () => void;
}

type RecapState = 'ready' | 'running' | 'choosing_distribution' | 'success' | 'error';

export function StepRecap({ onBack }: StepRecapProps) {
  const navigate = useNavigate();
  const { guidedMode, exitGuidedMode } = useUIStore();
  const { scenarios } = useScenarioStore();
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const { getJurysByScenario } = useJuryStore();
  const { addAffectations, getAffectationsByScenario, updateAffectation } = useAffectationStore();
  const { updateParametres } = useScenarioStore();

  const stages = useStageStore(state => state.stages);
  const loadStages = useStageStore(state => state.loadStages);

  const [state, setState] = useState<RecapState>('ready');
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [affectationCount, setAffectationCount] = useState(0);
  const [pendingAffectations, setPendingAffectations] = useState<Awaited<ReturnType<typeof addAffectations>> | null>(null);

  const scenario = scenarios.find(s => s.id === guidedMode.createdScenarioId);

  // Load stages on mount for stage scenarios
  useEffect(() => {
    if (scenario?.type === 'suivi_stage') {
      loadStages();
    }
  }, [scenario?.type, loadStages]);
  const scenarioJurys = scenario ? getJurysByScenario(scenario.id!) : [];

  // Filter eleves by 3eme
  const eleves3e = eleves.filter(e => e.classe?.startsWith('3'));

  // Check if already has affectations (memoized to avoid infinite loop)
  const existingAffectationCount = useMemo(
    () => scenario ? getAffectationsByScenario(scenario.id!).length : 0,
    [scenario, getAffectationsByScenario]
  );

  // Auto-check if we already have affectations
  useEffect(() => {
    if (existingAffectationCount > 0) {
      setState('success');
      setAffectationCount(existingAffectationCount);
    }
  }, [existingAffectationCount]);

  const handleLaunchRepartition = useCallback(async () => {
    if (!scenario) return;

    setState('running');
    setError(null);
    setProgressMessage(null);

    try {
      // Small delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 500));

      if (scenario.type === 'oral_dnb') {
        // === ORAL DNB ===
        const result = solveOralDnbComplete(
          eleves3e,
          enseignants,
          scenarioJurys,
          scenario
        );

        const affectationsToAdd = result.affectations.map(aff => ({
          eleveId: aff.eleveId,
          enseignantId: '',
          juryId: aff.juryId,
          scenarioId: scenario.id!,
          type: 'oral_dnb' as const,
          metadata: {},
          score: aff.score,
          scoreDetail: aff.scoreDetail,
          explication: aff.explication,
        }));

        const savedAffectations = await addAffectations(affectationsToAdd);
        setAffectationCount(affectationsToAdd.length);

        const demiJournees = scenario.parametres.oralDnb?.demiJourneesOral;
        const effectiveDemiJournees = demiJournees && demiJournees.length > 0 ? demiJournees : ['jeudi_matin'];
        if (effectiveDemiJournees.length > 1) {
          setPendingAffectations(savedAffectations);
          setState('choosing_distribution');
        } else {
          await applyTimeSlots(savedAffectations, effectiveDemiJournees, 'fill_first');
          setState('success');
        }
      } else {
        // === SUIVI STAGE ===
        setProgressMessage('Preparation des donnees...');

        // Get stages for 3e students
        const eleveIds3e = new Set(eleves3e.map(e => e.id));
        const stagesForEleves = stages.filter(s => s.eleveId && eleveIds3e.has(s.eleveId) && !s.scenarioId);

        if (stagesForEleves.length === 0) {
          throw new Error('Aucun stage trouve pour les eleves de 3eme. Importez les stages dans la page Eleves > Stages.');
        }

        // Convert to geo info
        const stageGeoInfos = stagesForEleves.map(s => toStageGeoInfo({
          id: s.id,
          eleveId: s.eleveId,
          eleveClasse: eleves3e.find(e => e.id === s.eleveId)?.classe,
          eleveOptions: eleves3e.find(e => e.id === s.eleveId)?.options,
          adresse: s.adresse || '',
          lat: s.lat,
          lon: s.lon,
          geoStatus: s.geoStatus || 'pending',
          geoErrorMessage: s.geoErrorMessage,
          nomEntreprise: s.nomEntreprise,
          tuteur: s.tuteur,
          dateDebut: s.dateDebut,
          dateFin: s.dateFin,
        }));

        // Get selected enseignants
        const selectedEnsIds = new Set(scenario.parametres.filtresEnseignants?.enseignantIds || []);
        const selectedEns = selectedEnsIds.size > 0
          ? enseignants.filter(e => selectedEnsIds.has(e.id!))
          : enseignants;

        const ensGeoInfos = selectedEns.map(e => toEnseignantGeoInfo({
          id: e.id!,
          nom: e.nom,
          prenom: e.prenom,
          matierePrincipale: e.matierePrincipale,
          adresse: e.adresse,
          lat: e.lat,
          lon: e.lon,
          geoStatus: e.geoStatus,
          geoErrorMessage: e.geoErrorMessage,
          capaciteStage: e.capaciteStage || scenario.parametres.suiviStage?.capaciteTuteurDefaut || 10,
          classesEnCharge: e.classesEnCharge,
          stageExclusions: e.stageExclusions,
        }));

        // Compute route pairs
        setProgressMessage('Calcul des itineraires...');
        const routeResult = await computeRoutePairs(stageGeoInfos, ensGeoInfos, {
          maxDistanceKm: scenario.parametres.suiviStage?.distanceMaxKm || 20,
        });

        // Run the solver
        setProgressMessage('Optimisation des affectations...');
        const stageParams = scenario.parametres.suiviStage;
        const matchingResult = solveStageMatching(stageGeoInfos, ensGeoInfos, routeResult.pairs, {
          distanceMaxKm: stageParams?.distanceMaxKm || 20,
          dureeMaxMin: stageParams?.dureeMaxMin || 45,
          useLocalSearch: true,
          verbose: true,
        });

        // Convert to affectations and save
        const affectationsToAdd = matchingResult.affectations.map(aff => ({
          eleveId: aff.eleveId,
          enseignantId: aff.enseignantId,
          scenarioId: scenario.id!,
          type: 'suivi_stage' as const,
          metadata: {
            stageId: aff.stageId,
            distanceKm: aff.distanceKm,
            durationMin: aff.durationMin,
          },
          scoreTotal: aff.score,
          explication: {
            raisonPrincipale: aff.explication,
            criteresUtilises: ['distance', 'equilibrage'],
            matiereRespectee: false,
            score: aff.score,
          },
        }));

        await addAffectations(affectationsToAdd);
        setAffectationCount(affectationsToAdd.length);

        // No time slots for stages
        setState('success');
      }
    } catch (err) {
      console.error('Repartition error:', err);
      setError(String(err));
      setState('error');
    }
  }, [scenario, eleves3e, enseignants, scenarioJurys, stages, addAffectations]);

  const applyTimeSlots = useCallback(async (
    savedAffectations: Awaited<ReturnType<typeof addAffectations>>,
    demiJournees: string[],
    mode: DistributionMode
  ) => {
    const updates = assignTimeSlots(scenarioJurys, savedAffectations, eleves3e, demiJournees, mode);
    for (const [affId, meta] of updates) {
      await updateAffectation(affId, {
        metadata: { dateCreneau: meta.dateCreneau, heureCreneau: meta.heureCreneau },
      });
    }
  }, [scenarioJurys, eleves3e, updateAffectation]);

  const handleDistributionSelect = useCallback(async (mode: DistributionMode) => {
    if (!scenario || !pendingAffectations) return;

    const demiJournees = scenario.parametres.oralDnb?.demiJourneesOral || [];
    try {
      await applyTimeSlots(pendingAffectations, demiJournees, mode);
      // Save chosen mode in scenario params
      await updateParametres(scenario.id!, {
        oralDnb: { ...scenario.parametres.oralDnb!, distributionCreneaux: mode },
      });
    } catch (err) {
      console.error('Time slots error:', err);
    }
    setPendingAffectations(null);
    setState('success');
  }, [scenario, pendingAffectations, applyTimeSlots, updateParametres]);

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
          {scenario?.type === 'suivi_stage'
            ? `${affectationCount} eleves ont ete affectes a des enseignants tuteurs.`
            : `${affectationCount} eleves ont ete repartis dans ${scenarioJurys.length} jurys.`}
        </p>

        <div className="success-stats">
          <div className="success-stat">
            <Users size={24} />
            <span className="stat-value">{affectationCount}</span>
            <span className="stat-label">eleves affectes</span>
          </div>
          <div className="success-stat">
            {scenario?.type === 'suivi_stage' ? <Briefcase size={24} /> : <GraduationCap size={24} />}
            <span className="stat-value">{scenario?.type === 'suivi_stage' ? affectationCount : scenarioJurys.length}</span>
            <span className="stat-label">{scenario?.type === 'suivi_stage' ? 'stages' : 'jurys'}</span>
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
          {progressMessage || "L'algorithme optimise les affectations pour respecter les contraintes."}
        </p>
        <div className="running-progress">
          <div className="progress-bar">
            <div className="progress-fill animated"></div>
          </div>
        </div>
      </div>
    );
  }

  // CHOOSING DISTRIBUTION MODE STATE
  if (state === 'choosing_distribution') {
    const demiJournees = scenario?.parametres.oralDnb?.demiJourneesOral || [];
    return (
      <div className="guided-step step-recap">
        <DistributionModeModal
          nbDemiJournees={demiJournees.length}
          onSelect={handleDistributionSelect}
          onClose={() => {
            // Default to fill_first if user closes modal
            handleDistributionSelect('fill_first');
          }}
        />
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

        {scenario.type === 'oral_dnb' ? (
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
        ) : (
          <div className="recap-card">
            <div className="recap-icon jury">
              <Briefcase size={28} />
            </div>
            <div className="recap-value">
              {stages.filter(s => s.eleveId && !s.scenarioId && eleves3e.some(e => e.id === s.eleveId)).length}
            </div>
            <div className="recap-label">stages</div>
          </div>
        )}

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
          {scenario.type === 'suivi_stage'
            ? "L'algorithme va affecter les enseignants tuteurs aux stages en optimisant les trajets et l'equilibrage."
            : "L'algorithme va repartir les eleves dans les jurys en optimisant l'equilibrage et les correspondances de matieres."}
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
