// ============================================================
// GUIDED STEP - RECAP (Lancement répartition avec animation)
// ============================================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useEleveStore } from '../../../stores/eleveStore';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import { useJuryStore } from '../../../stores/juryStore';
import { useAffectationStore } from '../../../stores/affectationStore';
import { useStageStore } from '../../../stores/stageStore';
import { solveStageMatching, toStageGeoInfo, toEnseignantGeoInfo, type DistributionMode } from '../../../algorithms';
import { planifierCreneaux } from '../../../algorithms/timeSlots';
import { runOralDnbSolver, runCustomSolver } from '../../../algorithms/solverRunner';
import { computeRoutePairs, geocodeAddressWithFallback } from '../../../infrastructure/geo/stageGeoWorkflow';
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
  const updateStageGeoExtended = useStageStore(state => state.updateStageGeoExtended);
  const setStageGeoError = useStageStore(state => state.setStageGeoError);
  const updateEnseignant = useEnseignantStore(state => state.updateEnseignant);

  const [state, setState] = useState<RecapState>('ready');
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [affectationCount, setAffectationCount] = useState(0);
  const [pendingAffectations, setPendingAffectations] = useState<Awaited<ReturnType<typeof addAffectations>> | null>(null);
  // Problèmes signalés par le moteur (élèves sans jury, matières non couvertes…)
  const [alertes, setAlertes] = useState<string[]>([]);

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


  const handleLaunchRepartition = useCallback(async () => {
    if (!scenario) return;

    setState('running');
    setError(null);
    setProgressMessage(null);
    setProgressPercent(0);
    setAlertes([]);

    try {

      if (scenario.type === 'custom') {
        // === MODE PERSONNALISE ===
        const customConfig = guidedMode.customConfig;
        const result = await runCustomSolver(eleves, enseignants, scenario, customConfig);

        // Create jurys from groups
        const { addJury } = useJuryStore.getState();
        for (const g of result.groups) {
          await addJury({
            scenarioId: scenario.id!,
            nom: g.nom,
            enseignantIds: g.enseignantIds,
            capaciteMax: g.capaciteMax,
          });
        }

        // Reload jurys to get IDs
        const freshJurys = useJuryStore.getState().getJurysByScenario(scenario.id!);
        const juryIdMap = new Map<string, string>();
        for (const g of result.groups) {
          const match = freshJurys.find(j => j.nom === g.nom);
          if (match) juryIdMap.set(g.id, match.id!);
        }

        const affectationsToAdd = result.affectations.map(aff => ({
          eleveId: aff.eleveId,
          enseignantId: aff.enseignantId || '',
          juryId: juryIdMap.get(aff.juryId) || '',
          scenarioId: scenario.id!,
          type: 'autre' as const,
          metadata: {} as Record<string, unknown>,
          scoreTotal: aff.score,
          scoreDetail: aff.scoreDetail,
        }));

        const savedAffectations = await addAffectations(affectationsToAdd);
        setAffectationCount(affectationsToAdd.length);

        // Time slots if enabled
        if (customConfig.useTimeSlots && customConfig.demiJournees.length > 0) {
          const selectedEleves = eleves.filter(e => customConfig.selectedEleveIds.includes(e.id));
          if (customConfig.demiJournees.length > 1) {
            setPendingAffectations(savedAffectations);
            setState('choosing_distribution');
          } else {
            await applyTimeSlotsCustom(savedAffectations, freshJurys, selectedEleves, customConfig);
            setState('success');
          }
        } else {
          setState('success');
        }
      } else if (scenario.type === 'oral_dnb') {
        // === ORAL DNB ===
        const result = await runOralDnbSolver(
          eleves3e,
          enseignants,
          scenarioJurys,
          scenario
        );
        setAlertes((result.alertes ?? []).map(a => a.message));

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
        const effectiveDemiJournees = demiJournees && demiJournees.length > 0 ? demiJournees : ['mercredi_matin'];
        const choixFait = scenario.parametres.oralDnb?.distributionCreneaux;
        if (effectiveDemiJournees.length > 1 && !choixFait) {
          // Configuration ancienne, sans choix enregistré : on le demande
          setPendingAffectations(savedAffectations);
          setState('choosing_distribution');
        } else {
          await applyTimeSlots(savedAffectations, effectiveDemiJournees, choixFait ?? 'fill_first');
          setState('success');
        }
      } else {
        // === SUIVI STAGE ===
        setProgressMessage('Préparation des données...');

        // Get stages for 3e students
        const eleveIds3e = new Set(eleves3e.map(e => e.id));
        let stagesForEleves = stages.filter(s => s.eleveId && eleveIds3e.has(s.eleveId) && !s.scenarioId);

        if (stagesForEleves.length === 0) {
          throw new Error('Aucun stage trouvé pour les élèves de 3ème. Importez les stages dans l\'étape Stages du wizard.');
        }

        // Get selected enseignants
        const selectedEnsIds = new Set(scenario.parametres.filtresEnseignants?.enseignantIds || []);
        const selectedEns = selectedEnsIds.size > 0
          ? enseignants.filter(e => selectedEnsIds.has(e.id!))
          : enseignants;

        // === Phase 1: Auto-geocode stages + enseignants with pending/error status ===
        const stagesToGeocode = stagesForEleves.filter(
          s => s.adresse && (!s.geoStatus || s.geoStatus === 'pending' || s.geoStatus === 'error' || s.geoStatus === 'not_found')
        );
        const teachersToGeocode = selectedEns.filter(
          e => e.adresse && (!e.geoStatus || e.geoStatus === 'pending' || e.geoStatus === 'error' || e.geoStatus === 'not_found')
        );

        const totalToGeocode = stagesToGeocode.length + teachersToGeocode.length;
        if (totalToGeocode > 0) {
          let geocoded = 0;
          setProgressMessage(`Géocodage des adresses (0/${totalToGeocode})...`);
          setProgressPercent(0);

          // Geocode stages
          for (const stage of stagesToGeocode) {
            const geoResult = await geocodeAddressWithFallback(stage.adresse!);
            if (geoResult.point) {
              await updateStageGeoExtended(
                stage.id, geoResult.point.lat, geoResult.point.lon,
                geoResult.status, geoResult.statusExtended, geoResult.precision, geoResult.queryUsed
              );
            } else {
              await setStageGeoError(stage.id, geoResult.errorMessage || 'Non trouvé');
            }
            geocoded++;
            setProgressMessage(`Géocodage des adresses (${geocoded}/${totalToGeocode})...`);
            setProgressPercent(Math.round((geocoded / totalToGeocode) * 30));
            await new Promise(r => setTimeout(r, 100));
          }

          // Geocode enseignants
          for (const teacher of teachersToGeocode) {
            const geoResult = await geocodeAddressWithFallback(teacher.adresse!);
            if (geoResult.point) {
              await updateEnseignant(teacher.id!, {
                lat: geoResult.point.lat,
                lon: geoResult.point.lon,
                geoStatus: geoResult.status,
              });
            }
            geocoded++;
            setProgressMessage(`Géocodage des adresses (${geocoded}/${totalToGeocode})...`);
            setProgressPercent(Math.round((geocoded / totalToGeocode) * 30));
            await new Promise(r => setTimeout(r, 100));
          }

          // Reload fresh data from stores after geocoding
          await loadStages();
          const freshStages = useStageStore.getState().stages;
          stagesForEleves = freshStages.filter(s => s.eleveId && eleveIds3e.has(s.eleveId) && !s.scenarioId);
        }

        // === Phase 2: Build geo infos + compute routes ===
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

        // Re-read enseignants (may have updated geo)
        const freshEns = selectedEnsIds.size > 0
          ? useEnseignantStore.getState().enseignants.filter(e => selectedEnsIds.has(e.id!))
          : useEnseignantStore.getState().enseignants;

        const ensGeoInfos = freshEns.map(e => toEnseignantGeoInfo({
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
        setProgressMessage('Calcul des itinéraires (préparation)...');
        setProgressPercent(30);
        const routeResult = await computeRoutePairs(stageGeoInfos, ensGeoInfos, {
          maxDistanceKm: scenario.parametres.suiviStage?.distanceMaxKm || 20,
          onProgress: (geoState) => {
            if (geoState.total > 0) {
              setProgressMessage(`Calcul des itinéraires (${geoState.current}/${geoState.total})...`);
              setProgressPercent(30 + Math.round((geoState.current / geoState.total) * 60));
            }
          },
        });

        // === Phase 3: Run the solver ===
        setProgressMessage('Optimisation des affectations...');
        setProgressPercent(90);
        const stageParams = scenario.parametres.suiviStage;
        const matchingResult = solveStageMatching(stageGeoInfos, ensGeoInfos, routeResult.pairs, {
          distanceMaxKm: stageParams?.distanceMaxKm || 20,
          dureeMaxMin: stageParams?.dureeMaxMin || 45,
          useLocalSearch: true,
          verbose: true,
          clusterDistanceKm: 1,
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
        setProgressPercent(100);

        // No time slots for stages
        setState('success');
      }
    } catch (err) {
      console.error('Repartition error:', err);
      setError(String(err));
      setState('error');
    }
  }, [scenario, eleves3e, enseignants, scenarioJurys, stages, addAffectations, updateStageGeoExtended, setStageGeoError, updateEnseignant, loadStages]);

  const applyTimeSlotsCustom = useCallback(async (
    savedAffectations: Awaited<ReturnType<typeof addAffectations>>,
    jurys: ReturnType<typeof getJurysByScenario>,
    selectedEleves: typeof eleves,
    customConfig: typeof guidedMode.customConfig
  ) => {
    const { updates, alertes: alertesCreneaux } = planifierCreneaux({
      jurys, affectations: savedAffectations, eleves: selectedEleves,
      demiJournees: customConfig.demiJournees, mode: 'fill_first',
      heureDebutMatin: customConfig.heureDebutMatin, heureDebutAprem: customConfig.heureDebutAprem,
      enseignants,
    });
    setAlertes(prev => [...prev, ...alertesCreneaux]);
    for (const [affId, meta] of updates) {
      await updateAffectation(affId, {
        metadata: { dateCreneau: meta.dateCreneau, heureCreneau: meta.heureCreneau },
      });
    }
  }, [updateAffectation, enseignants]);

  const applyTimeSlots = useCallback(async (
    savedAffectations: Awaited<ReturnType<typeof addAffectations>>,
    demiJournees: string[],
    mode: DistributionMode
  ) => {
    const { updates, alertes: alertesCreneaux } = planifierCreneaux({
      jurys: scenarioJurys, affectations: savedAffectations, eleves: eleves3e, demiJournees, mode,
      heureDebutMatin: scenario?.parametres.oralDnb?.heureDebutMatin,
      heureDebutAprem: scenario?.parametres.oralDnb?.heureDebutAprem,
      dureeSupplementaireTiersTemps: scenario?.parametres.oralDnb?.dureeSupplementaireTiersTemps,
      enseignants,
    });
    setAlertes(prev => [...prev, ...alertesCreneaux]);
    for (const [affId, meta] of updates) {
      await updateAffectation(affId, {
        metadata: { dateCreneau: meta.dateCreneau, heureCreneau: meta.heureCreneau },
      });
    }
  }, [scenarioJurys, eleves3e, updateAffectation, enseignants, scenario]);

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
    if (scenario?.id) {
      useScenarioStore.getState().setCurrentScenario(scenario.id);
    }
    exitGuidedMode();
    navigate('/board');
  }, [exitGuidedMode, navigate, scenario]);

  // Le calcul part dès l'arrivée sur cette étape : le bouton « Lancer la
  // répartition » est sur l'étape précédente. Une seule fois, même si React
  // rejoue l'effet.
  const lancement = useRef(false);
  useEffect(() => {
    if (lancement.current || !scenario) return;
    lancement.current = true;
    if (existingAffectationCount > 0) {
      handleViewResults();
    } else {
      void handleLaunchRepartition();
    }
  }, [scenario, existingAffectationCount, handleViewResults, handleLaunchRepartition]);

  // Une fois terminé, on ouvre directement les résultats avec le bilan
  useEffect(() => {
    if (state !== 'success' || !scenario?.id) return;
    const resume = scenario.type === 'suivi_stage'
      ? `${affectationCount} élèves ont un enseignant tuteur.`
      : scenario.type === 'custom'
      ? `${affectationCount} élèves répartis dans ${scenarioJurys.length} groupes.`
      : `${affectationCount} élèves répartis dans ${scenarioJurys.length} jurys.`;
    useUIStore.getState().setDerniereRepartition({ scenarioId: scenario.id, resume, alertes });
    handleViewResults();
  }, [state, scenario, affectationCount, scenarioJurys.length, alertes, handleViewResults]);

  if (!scenario) {
    return (
      <div className="guided-step step-recap">
        <h1 className="step-title">Erreur</h1>
        <p>Configuration non trouvée. Veuillez retourner à l'étape précédente.</p>
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
      </div>
    );
  }

  // SUCCESS STATE : les résultats s’ouvrent (voir l’effet plus haut)
  if (state === 'success') {
    return (
      <div className="guided-step step-recap running-view">
        <div className="running-animation">
          <CheckCircle size={64} />
        </div>
        <h1 className="step-title">Ouverture des résultats…</h1>
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
        <h1 className="step-title">Répartition en cours...</h1>
        <p className="step-subtitle">
          {progressMessage || "L'algorithme optimise les affectations pour respecter les contraintes."}
        </p>
        <div className="running-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%`, transition: 'width 0.3s ease' }}
            />
          </div>
          <span className="progress-label">{progressPercent}%</span>
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
          Une erreur s'est produite lors de la répartition.
        </p>
        <div className="error-message">
          <p>{error}</p>
        </div>
        <div className="step-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            Retour
          </button>
          <button className="btn btn-primary" onClick={handleLaunchRepartition}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // READY / RUNNING : le calcul démarre tout seul
  return (
      <div className="guided-step step-recap running-view">
        <div className="running-animation">
          <Loader2 size={64} className="spin" />
        </div>
        <h1 className="step-title">Répartition en cours...</h1>
        <p className="step-subtitle">
          {progressMessage || "L'algorithme optimise les affectations pour respecter les contraintes."}
        </p>
        <div className="running-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%`, transition: 'width 0.3s ease' }}
            />
          </div>
          <span className="progress-label">{progressPercent}%</span>
        </div>
      </div>
    );
}
