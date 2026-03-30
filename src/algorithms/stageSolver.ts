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
// HELPERS GÉOMÉTRIQUES
// ============================================================

/**
 * Calcule le bearing (direction) en degrés de point1 vers point2
 * Retourne un angle entre 0 et 360°
 */
function calculateBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = toDeg(Math.atan2(x, y));
  return (bearing + 360) % 360; // Normaliser entre 0 et 360
}

/**
 * Calcule la distance entre deux points en km (formule Haversine)
 */
function calculateDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Vérifie si un stage est dans le cône directionnel depuis le collège vers le domicile de l'enseignant
 * @param collegeGeo Position du collège
 * @param enseignantGeo Position du domicile de l'enseignant
 * @param stageGeo Position du stage
 * @param maxAngleDeg Demi-angle du cône (ex: 45° pour un cône de 90°)
 */
function isInDirectionalCone(
  collegeGeo: { lat: number; lon: number },
  enseignantGeo: { lat: number; lon: number },
  stageGeo: { lat: number; lon: number },
  maxAngleDeg: number
): boolean {
  // Calculer le bearing collège → enseignant (direction de référence)
  const bearingToEnseignant = calculateBearing(
    collegeGeo.lat, collegeGeo.lon,
    enseignantGeo.lat, enseignantGeo.lon
  );

  // Calculer le bearing collège → stage
  const bearingToStage = calculateBearing(
    collegeGeo.lat, collegeGeo.lon,
    stageGeo.lat, stageGeo.lon
  );

  // Calculer la différence d'angle (prendre le plus petit angle)
  let angleDiff = Math.abs(bearingToEnseignant - bearingToStage);
  if (angleDiff > 180) {
    angleDiff = 360 - angleDiff;
  }

  return angleDiff <= maxAngleDeg;
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

/**
 * Matières considérées comme des "options" nécessitant une correspondance avec les options de l'élève.
 * Un prof de ces matières ne peut encadrer que les élèves ayant cette option.
 */
const MATIERES_OPTIONS = [
  'espagnol',
  'allemand',
  'italien',
  'chinois',
  'portugais',
  'arabe',
  'russe',
  'latin',
  'grec',
];

/**
 * Vérifie si une matière est une matière "option" (langue, latin, etc.)
 */
function isMatiereOption(matiere: string | undefined): boolean {
  if (!matiere) return false;
  return MATIERES_OPTIONS.some(m => matiere.toLowerCase().includes(m));
}

/**
 * Vérifie si l'élève a l'option correspondant à la matière de l'enseignant.
 * Retourne true si :
 * - La matière de l'enseignant n'est pas une option (pas de vérification nécessaire)
 * - OU l'élève a cette option dans ses options
 */
function isEleveOptionCompatible(
  eleveOptions: string[] | undefined,
  enseignantMatiere: string | undefined
): { compatible: boolean; reason?: string } {
  // Si la matière n'est pas une option, pas de contrainte
  if (!isMatiereOption(enseignantMatiere)) {
    return { compatible: true };
  }

  // Si l'enseignant enseigne une option, l'élève doit l'avoir
  if (!eleveOptions || eleveOptions.length === 0) {
    return {
      compatible: false,
      reason: `L'élève n'a pas l'option ${enseignantMatiere}`
    };
  }

  // Vérifier si l'élève a l'option correspondante
  const matiereNormalized = enseignantMatiere!.toLowerCase();
  const hasOption = eleveOptions.some(opt =>
    opt.toLowerCase().includes(matiereNormalized) ||
    matiereNormalized.includes(opt.toLowerCase())
  );

  if (!hasOption) {
    return {
      compatible: false,
      reason: `L'élève n'a pas l'option ${enseignantMatiere} (options: ${eleveOptions.join(', ')})`
    };
  }

  return { compatible: true };
}

// ============================================================
// SCORING
// ============================================================

interface ScoringContext {
  isEleveEnCours?: boolean;
  isProfPrincipal?: boolean;
  targetLoad?: number; // Charge cible pondérée par heures (si activé)
}

/**
 * Calcule le score d'un candidat (plus petit = meilleur)
 */
function computeCandidateScore(
  pair: TeacherStagePair,
  currentLoad: number,
  avgLoad: number,
  options: StageMatchingOptions,
  ctx: ScoringContext = {}
): number {
  const {
    poidsDuree, poidsDistance, poidsEquilibrage,
    poidsElevesEnCours = 0, poidsProfPrincipal = 0,
  } = options;
  const totalPoids = poidsDuree + poidsDistance + poidsEquilibrage + poidsElevesEnCours + poidsProfPrincipal;

  if (totalPoids === 0) return 0;

  const wDuree = poidsDuree / totalPoids;
  const wDistance = poidsDistance / totalPoids;
  const wEquilibrage = poidsEquilibrage / totalPoids;
  const wElevesEnCours = poidsElevesEnCours / totalPoids;
  const wPP = poidsProfPrincipal / totalPoids;

  // Score durée (normalisé sur 60 min max)
  const scoreDuree = Math.min(pair.durationMin / 60, 1) * 100;

  // Score distance (normalisé sur 50 km max)
  const scoreDistance = Math.min(pair.distanceKm / 50, 1) * 100;

  // Score équilibrage — pondéré par heures si activé
  let scoreEquilibrage: number;
  if (ctx.targetLoad && ctx.targetLoad > 0) {
    // Charge relative : currentLoad / targetLoad (1.0 = parfait)
    const relativeLoad = currentLoad / ctx.targetLoad;
    scoreEquilibrage = Math.max(0, relativeLoad - 1) * 50;
  } else {
    const loadDiff = Math.max(0, currentLoad - avgLoad);
    scoreEquilibrage = loadDiff * 20;
  }

  // Score élèves en cours (0 = bonus, 100 = neutre)
  const scoreElevesEnCours = ctx.isEleveEnCours ? 0 : 100;

  // Score prof principal (0 = bonus PP de l'élève, 100 = neutre)
  const scorePP = ctx.isProfPrincipal ? 0 : 100;

  return wDuree * scoreDuree
    + wDistance * scoreDistance
    + wEquilibrage * scoreEquilibrage
    + wElevesEnCours * scoreElevesEnCours
    + wPP * scorePP;
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

  // Vérification option/matière (un prof de langue ne peut encadrer que ses élèves)
  const optionCheck = isEleveOptionCompatible(stage.eleveOptions, enseignant.matierePrincipale);
  if (!optionCheck.compatible) {
    return { valid: false, reason: optionCheck.reason };
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
// CLUSTERING - Regrouper les stages proches (<1km)
// ============================================================

interface StageCluster {
  id: string;            // ID du cluster (= stageId du représentant)
  stages: StageGeoInfo[];
  representative: StageGeoInfo; // Stage utilisé pour le scoring
}

/**
 * Regroupe les stages géographiquement proches (< clusterDistanceKm).
 * Les stages d'un même cluster seront affectés au même enseignant.
 */
function buildClusters(stages: StageGeoInfo[], maxDistanceKm: number): StageCluster[] {
  const clusters: StageCluster[] = [];
  const assigned = new Set<string>();

  for (const stage of stages) {
    if (assigned.has(stage.stageId)) continue;

    const cluster: StageGeoInfo[] = [stage];
    assigned.add(stage.stageId);

    // Chercher les stages proches pas encore assignés
    if (stage.geo) {
      for (const other of stages) {
        if (assigned.has(other.stageId) || !other.geo) continue;
        const dist = calculateDistanceKm(
          stage.geo.lat, stage.geo.lon,
          other.geo.lat, other.geo.lon
        );
        if (dist <= maxDistanceKm) {
          cluster.push(other);
          assigned.add(other.stageId);
        }
      }
    }

    clusters.push({
      id: stage.stageId,
      stages: cluster,
      representative: stage,
    });
  }

  return clusters;
}

// ============================================================
// CHARGES CIBLES PONDÉRÉES PAR HEURES
// ============================================================

/**
 * Calcule la charge cible par enseignant en fonction de leurs heures 3e.
 * Si un prof a 4h et un autre 2h, le premier aura 2x plus de stages.
 */
function computeTargetLoads(
  enseignants: EnseignantGeoInfo[],
  totalStages: number,
  weightByHours: boolean
): Map<string, number> {
  const targets = new Map<string, number>();

  if (!weightByHours) {
    const avg = enseignants.length > 0 ? totalStages / enseignants.length : 0;
    for (const e of enseignants) targets.set(e.enseignantId, avg);
    return targets;
  }

  // Heures totales
  const totalHours = enseignants.reduce((sum, e) => sum + (e.heures3e || 1), 0);
  for (const e of enseignants) {
    const hours = e.heures3e || 1;
    const target = (hours / totalHours) * totalStages;
    targets.set(e.enseignantId, target);
  }
  return targets;
}

// ============================================================
// ALGORITHME GLOUTON (avec clustering)
// ============================================================

/**
 * Construit le contexte de scoring pour un enseignant/stage donné
 */
function buildScoringCtx(
  stage: StageGeoInfo,
  ens: EnseignantGeoInfo,
  targetLoads: Map<string, number>,
  options: StageMatchingOptions
): ScoringContext {
  const isEleveEnCours = isEleveEnCoursForEnseignant(stage.eleveClasse, ens.classesEnCharge);
  const isProfPrincipal = !!(ens.estProfPrincipal && ens.classePP && stage.eleveClasse === ens.classePP);
  return {
    isEleveEnCours,
    isProfPrincipal,
    targetLoad: options.equilibrageWeightByHours ? targetLoads.get(ens.enseignantId) : undefined,
  };
}

/**
 * Affectation gloutonne par clusters: chaque cluster est affecté au même enseignant
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

  for (const ens of enseignants) {
    state.loads.set(ens.enseignantId, 0);
  }

  const avgLoad = enseignants.length > 0 ? stages.length / enseignants.length : 0;
  const targetLoads = computeTargetLoads(enseignants, stages.length, !!options.equilibrageWeightByHours);
  const clusterDist = options.clusterDistanceKm ?? 1;

  // Construire les clusters
  const clusters = buildClusters(stages, clusterDist);

  if (options.verbose && clusters.length < stages.length) {
    console.log(`[StageSolver] Clustering: ${stages.length} stages → ${clusters.length} clusters (distance < ${clusterDist}km)`);
  }

  // Pré-calculer le nombre de candidats par cluster (basé sur le représentant)
  const candidateCountByCluster = new Map<string, number>();
  for (const cluster of clusters) {
    let count = 0;
    for (const ens of enseignants) {
      if (pairsMap.has(`${cluster.representative.stageId}:${ens.enseignantId}`)) count++;
    }
    candidateCountByCluster.set(cluster.id, count);
  }

  // Trier par contrainte (clusters les plus contraints d'abord)
  const sortedClusters = [...clusters].sort((a, b) => {
    return (candidateCountByCluster.get(a.id) || 0) - (candidateCountByCluster.get(b.id) || 0);
  });

  for (const cluster of sortedClusters) {
    const rep = cluster.representative;
    let bestCandidate: CandidateScore | null = null;

    for (const ens of enseignants) {
      const pair = getRoutePair(pairsMap, rep.stageId, ens.enseignantId);
      if (!pair) continue;

      const currentLoad = state.loads.get(ens.enseignantId) || 0;

      // Vérifier que l'enseignant a la capacité pour TOUT le cluster
      if (currentLoad + cluster.stages.length > ens.capacityMax) continue;

      // Vérifier contraintes dures sur le représentant
      const constraints = checkHardConstraints(ens, rep, pair, currentLoad, options);
      if (!constraints.valid) continue;

      // Vérifier compatibilité options pour tous les stages du cluster
      const allCompatible = cluster.stages.every(s => {
        const optCheck = isEleveOptionCompatible(s.eleveOptions, ens.matierePrincipale);
        return optCheck.compatible;
      });
      if (!allCompatible) continue;

      const ctx = buildScoringCtx(rep, ens, targetLoads, options);
      const score = computeCandidateScore(pair, currentLoad, avgLoad, options, ctx);

      if (!bestCandidate || score < bestCandidate.totalScore) {
        bestCandidate = {
          enseignantId: ens.enseignantId,
          stageId: rep.stageId,
          durationMin: pair.durationMin,
          distanceKm: pair.distanceKm,
          loadPenalty: 0,
          totalScore: score,
          isValid: true,
        };
      }
    }

    if (bestCandidate) {
      // Affecter TOUS les stages du cluster au même enseignant
      for (const s of cluster.stages) {
        state.affectations.set(s.stageId, bestCandidate.enseignantId);
      }
      state.loads.set(
        bestCandidate.enseignantId,
        (state.loads.get(bestCandidate.enseignantId) || 0) + cluster.stages.length
      );
      state.totalCost += bestCandidate.totalScore * cluster.stages.length;
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

  const avgLoad = enseignants.length > 0 ? stages.length / enseignants.length : 0;
  const targetLoads = computeTargetLoads(enseignants, stages.length, !!options.equilibrageWeightByHours);
  const ensMap = new Map(enseignants.map(e => [e.enseignantId, e]));

  while (improved && iterations < maxIterations) {
    if (performance.now() - startTime > timeoutMs) {
      if (options.verbose) {
        console.log(`[StageSolver] Local search timeout après ${iterations} itérations`);
      }
      break;
    }

    improved = false;
    iterations++;

    for (const stage of stages) {
      const currentEnsId = state.affectations.get(stage.stageId);
      if (!currentEnsId) continue;

      const currentPair = getRoutePair(pairsMap, stage.stageId, currentEnsId);
      if (!currentPair) continue;

      const currentEns = ensMap.get(currentEnsId);
      if (!currentEns) continue;

      const currentLoad = state.loads.get(currentEnsId) || 0;
      const currentCtx = buildScoringCtx(stage, currentEns, targetLoads, options);
      const currentScore = computeCandidateScore(currentPair, currentLoad - 1, avgLoad, options, currentCtx);

      for (const ens of enseignants) {
        if (ens.enseignantId === currentEnsId) continue;

        const pair = getRoutePair(pairsMap, stage.stageId, ens.enseignantId);
        if (!pair) continue;

        const newLoad = state.loads.get(ens.enseignantId) || 0;

        const constraints = checkHardConstraints(ens, stage, pair, newLoad, options);
        if (!constraints.valid) continue;

        const newCtx = buildScoringCtx(stage, ens, targetLoads, options);
        const newScore = computeCandidateScore(pair, newLoad, avgLoad, options, newCtx);

        if (newScore < currentScore - 1) {
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
// FALLBACK COLLÈGE - Phase 3
// ============================================================

/**
 * Affecte les stages non affectés aux enseignants avec places restantes
 * en utilisant un cône directionnel depuis le collège vers leur domicile.
 * Priorité aux stages les plus proches du collège.
 */
function fallbackCollegeAssignment(
  state: SolverState,
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[],
  options: StageMatchingOptions
): { state: SolverState; fallbackCollegeCount: number } {
  if (!options.collegeGeo || options.fallbackCollegeActif === false) {
    return { state, fallbackCollegeCount: 0 };
  }

  const collegeGeo = options.collegeGeo;
  const maxAngleDeg = options.fallbackAngleMaxDeg ?? 45;
  let fallbackCollegeCount = 0;

  // Stages non affectés avec géolocalisation, triés par distance au collège (plus proches d'abord)
  const unassignedStages = stages
    .filter(s => !state.affectations.has(s.stageId) && s.geo)
    .map(s => ({
      stage: s,
      distanceFromCollege: calculateDistanceKm(collegeGeo.lat, collegeGeo.lon, s.geo!.lat, s.geo!.lon),
    }))
    .sort((a, b) => a.distanceFromCollege - b.distanceFromCollege);

  if (unassignedStages.length === 0) {
    return { state, fallbackCollegeCount: 0 };
  }

  if (options.verbose) {
    console.log(`[StageSolver] Fallback collège: ${unassignedStages.length} stages non affectés`);
  }

  // Pour chaque stage non affecté (du plus proche au plus loin du collège)
  for (const { stage, distanceFromCollege } of unassignedStages) {
    // Trouver les enseignants avec places, dont le cône contient ce stage
    const candidats = enseignants
      .filter(e => {
        if (!e.homeGeo) return false;
        const currentLoad = state.loads.get(e.enseignantId) || 0;
        if (currentLoad >= e.capacityMax) return false;

        // Vérifier compatibilité options
        const optionCheck = isEleveOptionCompatible(stage.eleveOptions, e.matierePrincipale);
        if (!optionCheck.compatible) return false;

        // Vérifier si dans le cône
        return isInDirectionalCone(collegeGeo, e.homeGeo, stage.geo!, maxAngleDeg);
      })
      .map(e => ({
        enseignant: e,
        currentLoad: state.loads.get(e.enseignantId) || 0,
        remaining: e.capacityMax - (state.loads.get(e.enseignantId) || 0),
      }))
      // Prioriser ceux avec le plus de places restantes
      .sort((a, b) => b.remaining - a.remaining);

    if (candidats.length > 0) {
      const best = candidats[0];
      state.affectations.set(stage.stageId, best.enseignant.enseignantId);
      state.loads.set(best.enseignant.enseignantId, best.currentLoad + 1);
      fallbackCollegeCount++;

      if (options.verbose) {
        console.log(`[StageSolver] Fallback collège: ${stage.stageId} -> ${best.enseignant.enseignantId} (${distanceFromCollege.toFixed(1)}km du collège)`);
      }
    }
  }

  if (options.verbose) {
    console.log(`[StageSolver] Fallback collège: ${fallbackCollegeCount} affectations`);
  }

  return { state, fallbackCollegeCount };
}

// ============================================================
// FALLBACK ALÉATOIRE - Phase 4
// ============================================================

/**
 * Affecte les stages restants aux enseignants avec places disponibles,
 * sans critère géographique (distribution équilibrée).
 */
function fallbackRandomAssignment(
  state: SolverState,
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[],
  options: StageMatchingOptions
): { state: SolverState; fallbackRandomCount: number } {
  let fallbackRandomCount = 0;

  // Stages non affectés (avec ou sans géolocalisation)
  const unassignedStages = stages.filter(s => !state.affectations.has(s.stageId));

  if (unassignedStages.length === 0) {
    return { state, fallbackRandomCount: 0 };
  }

  if (options.verbose) {
    console.log(`[StageSolver] Fallback aléatoire: ${unassignedStages.length} stages restants`);
  }

  for (const stage of unassignedStages) {
    // Trouver les enseignants avec places, triés par charge (moins chargés d'abord pour équilibrer)
    const candidats = enseignants
      .filter(e => {
        const currentLoad = state.loads.get(e.enseignantId) || 0;
        if (currentLoad >= e.capacityMax) return false;

        // Vérifier compatibilité options
        const optionCheck = isEleveOptionCompatible(stage.eleveOptions, e.matierePrincipale);
        return optionCheck.compatible;
      })
      .map(e => ({
        enseignant: e,
        currentLoad: state.loads.get(e.enseignantId) || 0,
      }))
      // Prioriser les moins chargés pour équilibrer
      .sort((a, b) => a.currentLoad - b.currentLoad);

    if (candidats.length > 0) {
      const best = candidats[0];
      state.affectations.set(stage.stageId, best.enseignant.enseignantId);
      state.loads.set(best.enseignant.enseignantId, best.currentLoad + 1);
      fallbackRandomCount++;

      if (options.verbose) {
        console.log(`[StageSolver] Fallback aléatoire: ${stage.stageId} -> ${best.enseignant.enseignantId}`);
      }
    }
  }

  if (options.verbose) {
    console.log(`[StageSolver] Fallback aléatoire: ${fallbackRandomCount} affectations`);
  }

  return { state, fallbackRandomCount };
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

  // Phase 3: Fallback collège - stages dans le cône directionnel collège → domicile enseignant
  const affectationsAvantFallback = new Set(state.affectations.keys());
  let fallbackCollegeCount = 0;
  let fallbackRandomCount = 0;

  if (opts.collegeGeo) {
    const collegeResult = fallbackCollegeAssignment(state, stages, enseignants, opts);
    state = collegeResult.state;
    fallbackCollegeCount = collegeResult.fallbackCollegeCount;

    if (opts.verbose && fallbackCollegeCount > 0) {
      console.log(`[StageSolver] Après fallback collège: ${state.affectations.size}/${stages.length} affectés (+${fallbackCollegeCount})`);
    }
  }

  // Tracker les stages après fallback collège (pour distinguer des fallback aléatoires)
  const affectationsApresCollegeFallback = new Set(state.affectations.keys());

  // Phase 4: Fallback aléatoire - stages restants distribués aux enseignants avec places
  const randomResult = fallbackRandomAssignment(state, stages, enseignants, opts);
  state = randomResult.state;
  fallbackRandomCount = randomResult.fallbackRandomCount;

  if (opts.verbose && fallbackRandomCount > 0) {
    console.log(`[StageSolver] Après fallback aléatoire: ${state.affectations.size}/${stages.length} affectés (+${fallbackRandomCount})`);
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
      const isNormalAffectation = affectationsAvantFallback.has(stage.stageId);
      const isFallbackCollege = !isNormalAffectation && affectationsApresCollegeFallback.has(stage.stageId);
      const isFallbackRandom = !isNormalAffectation && !isFallbackCollege;

      if (ens) {
        // Cas normal avec paire existante (proximité domicile)
        if (pair && isNormalAffectation) {
          dureeTotale += pair.durationMin;
          distanceTotale += pair.distanceKm;

          const targetLoads = computeTargetLoads(enseignants, stages.length, !!opts.equilibrageWeightByHours);
          const ctx = buildScoringCtx(stage, ens, targetLoads, opts);

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
              ctx
            ),
            explication: `${ens.prenom} ${ens.nom} - Trajet: ${Math.round(pair.distanceKm)}km, ${Math.round(pair.durationMin)}min`,
          });
        }
        // Cas fallback collège (dans le cône directionnel)
        else if (isFallbackCollege && opts.collegeGeo && stage.geo) {
          const distanceFromCollege = calculateDistanceKm(
            opts.collegeGeo.lat, opts.collegeGeo.lon,
            stage.geo.lat, stage.geo.lon
          );

          affectations.push({
            stageId: stage.stageId,
            eleveId: stage.eleveId,
            enseignantId,
            distanceKm: Math.round(distanceFromCollege * 10) / 10,
            durationMin: 0, // Non pertinent pour fallback
            score: 80, // Score élevé = moins bon (fallback)
            explication: `${ens.prenom} ${ens.nom} - 📍 Proche collège (${Math.round(distanceFromCollege)}km)`,
          });
        }
        // Cas fallback aléatoire (distribution équilibrée)
        else if (isFallbackRandom && stage.geo) {
          affectations.push({
            stageId: stage.stageId,
            eleveId: stage.eleveId,
            enseignantId,
            distanceKm: 0,
            durationMin: 0,
            score: 95, // Score élevé = moins bon (dernier recours)
            explication: `${ens.prenom} ${ens.nom} - 🎲 Affectation équilibrée`,
          });
        }
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
  eleveOptions?: string[];
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
    eleveOptions: stage.eleveOptions,
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
  matierePrincipale?: string;
  adresse?: string;
  lat?: number;
  lon?: number;
  geoStatus?: string;
  geoErrorMessage?: string;
  capaciteStage?: number;
  classesEnCharge?: string[];
  estProfPrincipal?: boolean;
  classePP?: string;
  heures3eReelles?: number;
  heuresParNiveau?: { '3e': number };
  stageExclusions?: Array<{ type: string; value: string; reason?: string }>;
}): EnseignantGeoInfo {
  return {
    enseignantId: ens.id,
    nom: ens.nom,
    prenom: ens.prenom,
    matierePrincipale: ens.matierePrincipale,
    homeAddress: ens.adresse,
    homeGeo: ens.lat && ens.lon ? { lat: ens.lat, lon: ens.lon } : undefined,
    homeGeoStatus: toGeoStatus(ens.geoStatus),
    homeGeoErrorMessage: ens.geoErrorMessage,
    capacityMax: ens.capaciteStage || 10,
    classesEnCharge: ens.classesEnCharge,
    estProfPrincipal: ens.estProfPrincipal,
    classePP: ens.classePP,
    heures3e: ens.heures3eReelles ?? ens.heuresParNiveau?.['3e'],
    exclusions: ens.stageExclusions?.map(e => ({
      type: toExclusionType(e.type),
      value: e.value,
      reason: e.reason,
    })),
  };
}
