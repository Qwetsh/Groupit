// ============================================================
// STAGE MATCHING SOLVER - Algorithme d'affectation de stages
// ============================================================

import type {
  StageGeoInfo,
  EnseignantGeoInfo,
  TeacherStagePair,
  StageAffectationResult,
  StageMatchingResult,
  StageMatchingOptions,
} from '../infrastructure/geo/types';
import { DEFAULT_STAGE_MATCHING_OPTIONS, toGeoStatus, toExclusionType } from '../infrastructure/geo/types';
import { buildRoutePairsMap, getRoutePair } from '../infrastructure/geo';

// ============================================================
// TYPES INTERNES
// ============================================================

interface CandidateScore {
  enseignantId: string;
  stageId: string;
  durationMin: number;
  distanceKm: number;
  loadPenalty: number;
  totalScore: number;
  isValid: boolean;
  invalidReason?: string;
}

interface SolverState {
  affectations: Map<string, string>; // stageId -> enseignantId
  loads: Map<string, number>;        // enseignantId -> count
  totalCost: number;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Vérifie si l'élève est dans une des classes de l'enseignant
 */
function isEleveEnCoursForEnseignant(
  eleveClasse: string | undefined,
  enseignantClasses: string[] | undefined
): boolean {
  if (!eleveClasse || !enseignantClasses || enseignantClasses.length === 0) {
    return false;
  }
  return enseignantClasses.includes(eleveClasse);
}

// ============================================================
// SCORING
// ============================================================

/**
 * Calcule le score d'un candidat (plus petit = meilleur)
 */
function computeCandidateScore(
  pair: TeacherStagePair,
  currentLoad: number,
  avgLoad: number,
  options: StageMatchingOptions,
  isEleveEnCours?: boolean
): number {
  const { poidsDuree, poidsDistance, poidsEquilibrage, poidsElevesEnCours = 0 } = options;
  const totalPoids = poidsDuree + poidsDistance + poidsEquilibrage + poidsElevesEnCours;

  // Éviter division par zéro
  if (totalPoids === 0) return 0;

  // Normalisation des poids
  const wDuree = poidsDuree / totalPoids;
  const wDistance = poidsDistance / totalPoids;
  const wEquilibrage = poidsEquilibrage / totalPoids;
  const wElevesEnCours = poidsElevesEnCours / totalPoids;

  // Score durée (normalisé sur 60 min max)
  const scoreDuree = Math.min(pair.durationMin / 60, 1) * 100;

  // Score distance (normalisé sur 50 km max)
  const scoreDistance = Math.min(pair.distanceKm / 50, 1) * 100;

  // Score équilibrage (pénalité si au-dessus de la moyenne)
  const loadDiff = Math.max(0, currentLoad - avgLoad);
  const scoreEquilibrage = loadDiff * 20; // 20 points par stage au-dessus de la moyenne

  // Score élèves en cours (bonus si l'enseignant a l'élève dans ses classes)
  // Attention: score bas = meilleur, donc on met 0 si élève en cours, 100 sinon
  const scoreElevesEnCours = isEleveEnCours ? 0 : 100;

  return wDuree * scoreDuree + wDistance * scoreDistance + wEquilibrage * scoreEquilibrage + wElevesEnCours * scoreElevesEnCours;
}

/**
 * Vérifie si un enseignant peut prendre un stage (contraintes dures)
 */
function checkHardConstraints(
  enseignant: EnseignantGeoInfo,
  stage: StageGeoInfo,
  pair: TeacherStagePair,
  currentLoad: number,
  options: StageMatchingOptions
): { valid: boolean; reason?: string } {
  // Capacité max
  if (currentLoad >= enseignant.capacityMax) {
    return { valid: false, reason: 'Capacité maximale atteinte' };
  }
  
  // Durée max
  if (options.dureeMaxMin && pair.durationMin > options.dureeMaxMin) {
    return { valid: false, reason: `Trajet trop long (${Math.round(pair.durationMin)} min > ${options.dureeMaxMin} min)` };
  }
  
  // Distance max
  if (options.distanceMaxKm && pair.distanceKm > options.distanceMaxKm) {
    return { valid: false, reason: `Distance trop grande (${Math.round(pair.distanceKm)} km > ${options.distanceMaxKm} km)` };
  }
  
  // Exclusions
  if (enseignant.exclusions) {
    for (const exclusion of enseignant.exclusions) {
      // Exclusion par élève (on ne connaît pas l'élève ici, mais on peut vérifier le stage)
      if (exclusion.type === 'eleve' && exclusion.value === stage.eleveId) {
        return { valid: false, reason: `Exclusion élève: ${exclusion.reason || 'Non spécifié'}` };
      }
      
      // Exclusion par secteur (basé sur l'adresse ou le code postal)
      if (exclusion.type === 'secteur' || exclusion.type === 'zone') {
        const addr = stage.address.toLowerCase();
        if (addr.includes(exclusion.value.toLowerCase())) {
          return { valid: false, reason: `Exclusion zone: ${exclusion.value}` };
        }
      }
    }
  }
  
  return { valid: true };
}

// ============================================================
// ALGORITHME GLOUTON
// ============================================================

/**
 * Affectation gloutonne: pour chaque stage, choisir le meilleur enseignant disponible
 */
function greedyAssignment(
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[],
  pairsMap: Map<string, TeacherStagePair>,
  options: StageMatchingOptions
): SolverState {
  const state: SolverState = {
    affectations: new Map(),
    loads: new Map(),
    totalCost: 0,
  };

  // Initialiser les charges
  for (const ens of enseignants) {
    state.loads.set(ens.enseignantId, 0);
  }

  // Calculer la charge moyenne cible (éviter division par zéro)
  const avgLoad = enseignants.length > 0 ? stages.length / enseignants.length : 0;
  
  // Trier les stages par nombre de candidats valides (les plus contraints d'abord)
  const sortedStages = [...stages].sort((a, b) => {
    const candidatsA = enseignants.filter(e => pairsMap.has(`${a.stageId}:${e.enseignantId}`));
    const candidatsB = enseignants.filter(e => pairsMap.has(`${b.stageId}:${e.enseignantId}`));
    return candidatsA.length - candidatsB.length;
  });
  
  for (const stage of sortedStages) {
    let bestCandidate: CandidateScore | null = null;
    
    for (const ens of enseignants) {
      const pair = getRoutePair(pairsMap, stage.stageId, ens.enseignantId);
      if (!pair) continue;
      
      const currentLoad = state.loads.get(ens.enseignantId) || 0;
      
      // Vérifier contraintes dures
      const constraints = checkHardConstraints(ens, stage, pair, currentLoad, options);
      if (!constraints.valid) continue;

      // Vérifier si l'élève est dans les classes de l'enseignant
      const isEleveEnCours = isEleveEnCoursForEnseignant(stage.eleveClasse, ens.classesEnCharge);

      // Calculer le score
      const score = computeCandidateScore(pair, currentLoad, avgLoad, options, isEleveEnCours);
      
      if (!bestCandidate || score < bestCandidate.totalScore) {
        bestCandidate = {
          enseignantId: ens.enseignantId,
          stageId: stage.stageId,
          durationMin: pair.durationMin,
          distanceKm: pair.distanceKm,
          loadPenalty: 0,
          totalScore: score,
          isValid: true,
        };
      }
    }
    
    if (bestCandidate) {
      state.affectations.set(stage.stageId, bestCandidate.enseignantId);
      state.loads.set(
        bestCandidate.enseignantId, 
        (state.loads.get(bestCandidate.enseignantId) || 0) + 1
      );
      state.totalCost += bestCandidate.totalScore;
    }
  }
  
  return state;
}

// ============================================================
// AMÉLIORATION PAR RECHERCHE LOCALE
// ============================================================

/**
 * Tente d'améliorer la solution par swaps
 */
function localSearch(
  state: SolverState,
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[],
  pairsMap: Map<string, TeacherStagePair>,
  options: StageMatchingOptions
): SolverState {
  const maxIterations = options.maxIterations || 50;
  const timeoutMs = options.localSearchTimeoutMs || 3000;
  const startTime = performance.now();
  let improved = true;
  let iterations = 0;

  // Éviter division par zéro
  const avgLoad = enseignants.length > 0 ? stages.length / enseignants.length : 0;

  while (improved && iterations < maxIterations) {
    // Vérifier timeout pour éviter freeze UI
    if (performance.now() - startTime > timeoutMs) {
      if (options.verbose) {
        console.log(`[StageSolver] Local search timeout après ${iterations} itérations`);
      }
      break;
    }

    improved = false;
    iterations++;
    
    // Essayer de réaffecter chaque stage à un meilleur enseignant
    for (const stage of stages) {
      const currentEnsId = state.affectations.get(stage.stageId);
      if (!currentEnsId) continue;
      
      const currentPair = getRoutePair(pairsMap, stage.stageId, currentEnsId);
      if (!currentPair) continue;
      
      const currentEns = enseignants.find(e => e.enseignantId === currentEnsId);
      if (!currentEns) continue;

      const currentLoad = state.loads.get(currentEnsId) || 0;
      const isCurrentEleveEnCours = isEleveEnCoursForEnseignant(stage.eleveClasse, currentEns.classesEnCharge);
      const currentScore = computeCandidateScore(currentPair, currentLoad - 1, avgLoad, options, isCurrentEleveEnCours);

      // Chercher un meilleur candidat
      for (const ens of enseignants) {
        if (ens.enseignantId === currentEnsId) continue;

        const pair = getRoutePair(pairsMap, stage.stageId, ens.enseignantId);
        if (!pair) continue;

        const newLoad = state.loads.get(ens.enseignantId) || 0;

        // Vérifier contraintes
        const constraints = checkHardConstraints(ens, stage, pair, newLoad, options);
        if (!constraints.valid) continue;

        const isNewEleveEnCours = isEleveEnCoursForEnseignant(stage.eleveClasse, ens.classesEnCharge);
        const newScore = computeCandidateScore(pair, newLoad, avgLoad, options, isNewEleveEnCours);
        
        // Amélioration?
        if (newScore < currentScore - 1) { // Seuil pour éviter les micro-optimisations
          // Appliquer le swap
          state.affectations.set(stage.stageId, ens.enseignantId);
          state.loads.set(currentEnsId, currentLoad - 1);
          state.loads.set(ens.enseignantId, newLoad + 1);
          state.totalCost = state.totalCost - currentScore + newScore;
          improved = true;
          break;
        }
      }
    }
  }
  
  if (options.verbose) {
    console.log(`[StageSolver] Local search: ${iterations} iterations`);
  }
  
  return state;
}

// ============================================================
// SOLVER PRINCIPAL
// ============================================================

/**
 * Résout l'affectation des stages aux enseignants
 */
export function solveStageMatching(
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[],
  pairs: TeacherStagePair[],
  options: Partial<StageMatchingOptions> = {}
): StageMatchingResult {
  const startTime = Date.now();
  const opts: StageMatchingOptions = { ...DEFAULT_STAGE_MATCHING_OPTIONS, ...options };
  
  if (opts.verbose) {
    console.log(`[StageSolver] Démarrage: ${stages.length} stages, ${enseignants.length} enseignants, ${pairs.length} paires`);
  }
  
  // Construire la map des paires
  const pairsMap = buildRoutePairsMap(pairs);
  
  // Phase 1: Affectation gloutonne
  let state = greedyAssignment(stages, enseignants, pairsMap, opts);
  
  if (opts.verbose) {
    console.log(`[StageSolver] Après glouton: ${state.affectations.size}/${stages.length} affectés`);
  }
  
  // Phase 2: Amélioration par recherche locale
  if (opts.useLocalSearch) {
    state = localSearch(state, stages, enseignants, pairsMap, opts);
  }
  
  // Construire le résultat
  const affectations: StageAffectationResult[] = [];
  const nonAffectes: Array<{ stageId: string; eleveId: string; raisons: string[] }> = [];
  
  let dureeTotale = 0;
  let distanceTotale = 0;
  
  for (const stage of stages) {
    const enseignantId = state.affectations.get(stage.stageId);
    
    if (enseignantId) {
      const pair = getRoutePair(pairsMap, stage.stageId, enseignantId);
      const ens = enseignants.find(e => e.enseignantId === enseignantId);
      
      if (pair && ens) {
        dureeTotale += pair.durationMin;
        distanceTotale += pair.distanceKm;

        const isEleveEnCours = isEleveEnCoursForEnseignant(stage.eleveClasse, ens.classesEnCharge);

        affectations.push({
          stageId: stage.stageId,
          eleveId: stage.eleveId,
          enseignantId,
          distanceKm: pair.distanceKm,
          durationMin: pair.durationMin,
          score: computeCandidateScore(
            pair,
            state.loads.get(enseignantId) || 0,
            enseignants.length > 0 ? stages.length / enseignants.length : 0,
            opts,
            isEleveEnCours
          ),
          explication: `${ens.prenom} ${ens.nom} - Trajet: ${Math.round(pair.distanceKm)}km, ${Math.round(pair.durationMin)}min`,
        });
      }
    } else {
      // Déterminer les raisons du non-affectation
      const raisons: string[] = [];
      let hasCandidates = false;
      
      for (const ens of enseignants) {
        const pair = getRoutePair(pairsMap, stage.stageId, ens.enseignantId);
        if (!pair) continue;
        hasCandidates = true;
        
        const currentLoad = state.loads.get(ens.enseignantId) || 0;
        const constraints = checkHardConstraints(ens, stage, pair, currentLoad, opts);
        
        if (!constraints.valid && constraints.reason) {
          if (!raisons.includes(constraints.reason)) {
            raisons.push(constraints.reason);
          }
        }
      }
      
      if (!hasCandidates) {
        raisons.push('Aucun trajet calculé pour ce stage');
      }
      if (raisons.length === 0) {
        raisons.push('Tous les enseignants ont atteint leur capacité maximale');
      }
      
      nonAffectes.push({
        stageId: stage.stageId,
        eleveId: stage.eleveId,
        raisons,
      });
    }
  }
  
  // Calculer les statistiques
  const chargeParEnseignant: Record<string, number> = {};
  for (const [ensId, load] of state.loads) {
    chargeParEnseignant[ensId] = load;
  }
  
  const loads = Array.from(state.loads.values());
  const avgLoad = loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const variance = loads.length > 0 
    ? loads.reduce((sum, l) => sum + Math.pow(l - avgLoad, 2), 0) / loads.length 
    : 0;
  const ecartType = Math.sqrt(variance);
  
  const result: StageMatchingResult = {
    affectations,
    nonAffectes,
    stats: {
      totalStages: stages.length,
      totalAffectes: affectations.length,
      totalNonAffectes: nonAffectes.length,
      dureeTotaleMin: dureeTotale,
      dureeMoyenneMin: affectations.length > 0 ? dureeTotale / affectations.length : 0,
      distanceTotaleKm: distanceTotale,
      distanceMoyenneKm: affectations.length > 0 ? distanceTotale / affectations.length : 0,
      chargeParEnseignant,
      ecartTypeCharge: ecartType,
    },
    tempsCalculMs: Date.now() - startTime,
  };
  
  if (opts.verbose) {
    console.log(`[StageSolver] Terminé en ${result.tempsCalculMs}ms`);
    console.log(`[StageSolver] ${affectations.length} affectés, ${nonAffectes.length} non affectés`);
    console.log(`[StageSolver] Durée moyenne: ${Math.round(result.stats.dureeMoyenneMin)}min, Distance moyenne: ${Math.round(result.stats.distanceMoyenneKm)}km`);
  }
  
  return result;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Convertit les données internes vers le format StageGeoInfo
 */
export function toStageGeoInfo(stage: {
  id: string;
  eleveId?: string;
  eleveClasse?: string;
  adresse: string;
  lat?: number;
  lon?: number;
  geoStatus: string;
  geoErrorMessage?: string;
  nomEntreprise?: string;
  tuteur?: string;
  dateDebut?: string;
  dateFin?: string;
}): StageGeoInfo {
  return {
    stageId: stage.id,
    eleveId: stage.eleveId || '',
    eleveClasse: stage.eleveClasse,
    address: stage.adresse,
    geo: stage.lat && stage.lon ? { lat: stage.lat, lon: stage.lon } : undefined,
    geoStatus: toGeoStatus(stage.geoStatus),
    geoErrorMessage: stage.geoErrorMessage,
    nomEntreprise: stage.nomEntreprise,
    tuteur: stage.tuteur,
    dateDebut: stage.dateDebut,
    dateFin: stage.dateFin,
  };
}

/**
 * Convertit les données enseignant vers le format EnseignantGeoInfo
 */
export function toEnseignantGeoInfo(ens: {
  id: string;
  nom: string;
  prenom: string;
  adresse?: string;
  lat?: number;
  lon?: number;
  geoStatus?: string;
  geoErrorMessage?: string;
  capaciteStage?: number;
  classesEnCharge?: string[];
  stageExclusions?: Array<{ type: string; value: string; reason?: string }>;
}): EnseignantGeoInfo {
  return {
    enseignantId: ens.id,
    nom: ens.nom,
    prenom: ens.prenom,
    homeAddress: ens.adresse,
    homeGeo: ens.lat && ens.lon ? { lat: ens.lat, lon: ens.lon } : undefined,
    homeGeoStatus: toGeoStatus(ens.geoStatus),
    homeGeoErrorMessage: ens.geoErrorMessage,
    capacityMax: ens.capaciteStage || 10,
    classesEnCharge: ens.classesEnCharge,
    exclusions: ens.stageExclusions?.map(e => ({
      type: toExclusionType(e.type),
      value: e.value,
      reason: e.reason,
    })),
  };
}
