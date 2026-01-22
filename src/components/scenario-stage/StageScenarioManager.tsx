// ============================================================
// STAGE SCENARIO MANAGER - Conteneur principal
// Configuration simplifiée : État des stages → Affectations
// Les stages proviennent de "Élèves > Stage" (source unique)
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStageStore } from '../../stores/stageStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useEleveStore } from '../../stores/eleveStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import type { Scenario } from '../../domain/models';
import { filterEleves, filterEnseignants } from '../../utils/filteringUtils';
import { StageStatusStep } from './StageStatusStep';
import { Check, AlertCircle, ArrowRight, ClipboardList } from 'lucide-react';
import './StageScenarioManager.css';

interface StageScenarioManagerProps {
  scenario: Scenario;
}

// Distance Haversine pour pré-filtrage
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function StageScenarioManager({ scenario }: StageScenarioManagerProps) {
  const navigate = useNavigate();
  const setCurrentScenario = useScenarioStore(state => state.setCurrentScenario);

  // Stores - sélecteurs granulaires
  const stages = useStageStore(state => state.stages);
  const loadGlobalStages = useStageStore(state => state.loadGlobalStages);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const eleves = useEleveStore(state => state.eleves);

  // State local
  const [isComputingRoutes, setIsComputingRoutes] = useState(false);
  const [routesComputed, setRoutesComputed] = useState(0);

  // Charger les stages GLOBAUX (pas par scénario) - source unique
  useEffect(() => {
    loadGlobalStages();
  }, [loadGlobalStages]);

  // Filtrer les élèves de 3ème selon les filtres du scénario
  const eleves3eme = useMemo(() => {
    return filterEleves(eleves, scenario.parametres.filtresEleves, ['3e']);
  }, [eleves, scenario.parametres.filtresEleves]);

  // Filtrer les stages pour les élèves de 3ème uniquement
  const stagesEleves3eme = useMemo(() => {
    const eleveIds = new Set(eleves3eme.map(e => e.id));
    return stages.filter(s => s.eleveId && eleveIds.has(s.eleveId));
  }, [stages, eleves3eme]);

  // Filtrer les enseignants selon les filtres définis dans le scénario
  const enseignantsEligibles = useMemo(() => {
    return filterEnseignants(enseignants, scenario.parametres.filtresEnseignants);
  }, [enseignants, scenario.parametres.filtresEnseignants]);

  // Stats pour affichage
  const stats = useMemo(() => {
    const stagesGeocodes = stagesEleves3eme.filter(
      s => (s.geoStatus === 'ok' || s.geoStatus === 'manual') && s.lat && s.lon
    ).length;
    const enseignantsGeocodes = enseignantsEligibles.filter(
      e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon
    ).length;

    return {
      stagesTotal: stagesEleves3eme.length,
      stagesGeocodes,
      eleves3emeTotal: eleves3eme.length,
      enseignantsGeocodes,
      enseignantsTotal: enseignantsEligibles.length,
      // Prêt si au moins 1 stage et 1 enseignant géocodés
      pret: stagesGeocodes > 0 && enseignantsGeocodes > 0,
    };
  }, [stagesEleves3eme, enseignantsEligibles, eleves3eme]);

  // Calcul des routes (pré-filtrage par distance)
  const handleComputeRoutes = useCallback(async () => {
    if (!stats.pret) return;

    setIsComputingRoutes(true);
    setRoutesComputed(0);

    const distanceMaxKm = scenario.parametres.suiviStage?.distanceMaxKm ?? 50;
    const maxCandidatesPerStage = 5;

    const geocodedStages = stagesEleves3eme.filter(
      s => (s.geoStatus === 'ok' || s.geoStatus === 'manual') && s.lat && s.lon
    );
    const geocodedEnseignants = enseignantsEligibles.filter(
      e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon
    );

    let totalPairs = 0;

    for (const stage of geocodedStages) {
      const distances = geocodedEnseignants.map(ens => ({
        enseignant: ens,
        distance: haversineDistance(stage.lat!, stage.lon!, ens.lat!, ens.lon!),
      }));

      const candidates = distances
        .filter(d => d.distance <= distanceMaxKm)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxCandidatesPerStage);

      totalPairs += candidates.length;
    }

    setRoutesComputed(totalPairs);
    setIsComputingRoutes(false);
  }, [scenario, stagesEleves3eme, enseignantsEligibles, stats.pret]);

  // Configuration terminée = prêt pour le matching
  const isConfigurationComplete = stats.pret && routesComputed > 0;

  // Naviguer vers la page Affectations
  const handleGoToAffectations = () => {
    setCurrentScenario(scenario.id!);
    navigate('/board');
  };

  return (
    <div className="stage-scenario-manager">
      {/* Header avec stats */}
      <div className="stage-header">
        <div className="stage-title">
          <h3>
            <ClipboardList size={20} />
            Configuration du Suivi de Stage
          </h3>
          <span className="stage-subtitle">
            {eleves3eme.length} élèves de 3ème · {enseignantsEligibles.length} tuteurs potentiels
          </span>
        </div>

        {enseignantsEligibles.length === 0 && (
          <div className="stage-alert stage-alert-error">
            <AlertCircle size={16} />
            <span>
              Aucun enseignant ne correspond aux filtres du scénario.
              Modifiez les filtres dans les paramètres du scénario (onglet Enseignants).
            </span>
          </div>
        )}
      </div>

      {/* Contenu principal : État des stages */}
      <div className="stage-step-content">
        <StageStatusStep
          stages={stagesEleves3eme}
          eleves={eleves3eme}
          enseignants={enseignantsEligibles}
          onStartRouteCalc={handleComputeRoutes}
          isComputingRoutes={isComputingRoutes}
          routesComputed={routesComputed}
        />
      </div>

      {/* Bouton vers les affectations */}
      {isConfigurationComplete && (
        <div className="stage-ready-banner">
          <div className="ready-content">
            <Check size={20} />
            <div className="ready-text">
              <strong>Configuration terminée !</strong>
              <span>
                {stats.stagesGeocodes} stages et {stats.enseignantsGeocodes} enseignants prêts pour le matching.
              </span>
            </div>
          </div>
          <button className="btn-go-affectations" onClick={handleGoToAffectations}>
            Lancer les affectations
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Message si pas prêt mais calcul terminé */}
      {!isConfigurationComplete && routesComputed === 0 && stats.pret && (
        <div className="stage-info-banner">
          <AlertCircle size={16} />
          <span>Lancez le pré-calcul des trajets pour continuer vers les affectations.</span>
        </div>
      )}
    </div>
  );
}
