// ============================================================
// ALGORITHME - UTILITAIRES D'ÉQUILIBRAGE
// ============================================================
// Ce module fournit des fonctions pour calculer les pénalités
// d'équilibrage avec ou sans pondération par charge horaire.

/**
 * Représente un enseignant/jury pour le calcul d'équilibrage
 */
export interface BalancingEntity {
  id: string;
  currentLoad: number;        // Nombre actuel d'élèves/stages assignés
  heuresParSemaine: number;   // Heures avec les élèves concernés (ex: heures3e)
  capaciteMax?: number;       // Capacité maximale (optionnel)
}

/**
 * Options pour le calcul d'équilibrage
 */
export interface BalancingOptions {
  weightByHours: boolean;     // Pondérer par charge horaire
  totalToAssign: number;      // Nombre total d'élèves à assigner
  defaultHours: number;       // Heures par défaut si non renseigné (fallback)
}

/**
 * Résultat du calcul d'équilibrage pour une entité
 */
export interface BalancingResult {
  entityId: string;
  targetLoad: number;         // Cible théorique d'assignations
  currentLoad: number;        // Charge actuelle
  deviation: number;          // Écart à la cible (peut être négatif)
  penalty: number;            // Pénalité (0-100, 100 = très déséquilibré)
  isOverloaded: boolean;      // Au-dessus de la cible
  relativeLoad: number;       // Charge relative (pour comparaison)
}

/**
 * Calcule la cible d'assignation pour une entité
 * 
 * LOGIQUE:
 * - Sans pondération: cible = total / nombre d'entités (répartition égale)
 * - Avec pondération: cible proportionnelle aux heures
 *   → Un enseignant avec 4h reçoit 4x plus qu'un enseignant avec 1h
 *   → cible_i = (heures_i / somme_heures) * total
 * 
 * @param entity L'entité pour laquelle calculer la cible
 * @param allEntities Toutes les entités participant à l'équilibrage
 * @param options Options de calcul
 */
export function calculateTargetLoad(
  entity: BalancingEntity,
  allEntities: BalancingEntity[],
  options: BalancingOptions
): number {
  const { weightByHours, totalToAssign, defaultHours } = options;
  
  if (!weightByHours) {
    // Équilibrage simple: répartition égale
    return totalToAssign / Math.max(1, allEntities.length);
  }
  
  // Équilibrage pondéré par heures
  // 1. Calculer les heures effectives de chaque entité
  const getEffectiveHours = (e: BalancingEntity) => 
    e.heuresParSemaine > 0 ? e.heuresParSemaine : defaultHours;
  
  // 2. Somme totale des heures
  const totalHours = allEntities.reduce((sum, e) => sum + getEffectiveHours(e), 0);
  
  if (totalHours === 0) {
    // Fallback: répartition égale
    return totalToAssign / Math.max(1, allEntities.length);
  }
  
  // 3. Part proportionnelle
  const entityHours = getEffectiveHours(entity);
  const proportion = entityHours / totalHours;
  
  return proportion * totalToAssign;
}

/**
 * Calcule la charge relative d'une entité
 * 
 * LOGIQUE:
 * - Sans pondération: charge relative = currentLoad / moyenneLoad
 * - Avec pondération: charge relative = currentLoad / targetLoad
 *   → Permet de comparer équitablement des enseignants avec heures différentes
 *   → Un enseignant avec charge relative > 1 est "surchargé" par rapport à sa capacité
 * 
 * @returns Charge relative (1.0 = exactement à la cible)
 */
export function calculateRelativeLoad(
  entity: BalancingEntity,
  allEntities: BalancingEntity[],
  options: BalancingOptions
): number {
  const targetLoad = calculateTargetLoad(entity, allEntities, options);
  
  if (targetLoad === 0) return entity.currentLoad > 0 ? Infinity : 0;
  
  return entity.currentLoad / targetLoad;
}

/**
 * Calcule la pénalité d'équilibrage pour une entité
 * 
 * La pénalité est un score de 0 à 100:
 * - 0 = parfaitement équilibré (à la cible)
 * - 100 = très déséquilibré (2x ou plus au-dessus de la cible)
 * 
 * @returns Score de pénalité (0-100)
 */
export function calculateBalancingPenalty(
  entity: BalancingEntity,
  allEntities: BalancingEntity[],
  options: BalancingOptions
): BalancingResult {
  const targetLoad = calculateTargetLoad(entity, allEntities, options);
  const relativeLoad = calculateRelativeLoad(entity, allEntities, options);
  const deviation = entity.currentLoad - targetLoad;
  const isOverloaded = deviation > 0;
  
  // Calcul de la pénalité
  // On pénalise principalement les surcharges (deviation > 0)
  // La pénalité augmente avec l'écart relatif à la cible
  let penalty: number;
  
  if (targetLoad === 0) {
    // Pas de cible → pénalité basée sur la charge absolue
    penalty = Math.min(100, entity.currentLoad * 25);
  } else if (relativeLoad <= 1) {
    // En dessous ou à la cible → faible pénalité
    penalty = 0;
  } else {
    // Au-dessus de la cible → pénalité progressive
    // relativeLoad = 1.25 → penalty ≈ 25
    // relativeLoad = 1.5  → penalty ≈ 50
    // relativeLoad = 2.0  → penalty = 100
    penalty = Math.min(100, (relativeLoad - 1) * 100);
  }
  
  return {
    entityId: entity.id,
    targetLoad,
    currentLoad: entity.currentLoad,
    deviation,
    penalty,
    isOverloaded,
    relativeLoad,
  };
}

/**
 * Calcule un score d'équilibrage pour le scoring d'affectation
 * 
 * Inverse de la pénalité: plus le score est haut, mieux c'est
 * - 100 = entité peu chargée (favorable)
 * - 0 = entité surchargée (défavorable)
 * 
 * @param currentLoad Charge actuelle de l'entité
 * @param heuresParSemaine Heures de l'enseignant
 * @param allEntities Toutes les entités
 * @param options Options de calcul
 */
export function calculateBalancingScore(
  entityId: string,
  currentLoad: number,
  heuresParSemaine: number,
  allEntities: BalancingEntity[],
  options: BalancingOptions
): number {
  const entity: BalancingEntity = {
    id: entityId,
    currentLoad,
    heuresParSemaine,
  };
  
  const result = calculateBalancingPenalty(entity, allEntities, options);
  
  // Inverser: score = 100 - penalty
  return Math.max(0, 100 - result.penalty);
}

/**
 * Calcule le déséquilibre global d'un ensemble d'assignations
 * 
 * @returns Coefficient de variation des charges relatives (0 = parfait équilibre)
 */
export function calculateGlobalImbalance(
  entities: BalancingEntity[],
  options: BalancingOptions
): number {
  if (entities.length < 2) return 0;
  
  const relativeLoads = entities.map(e => 
    calculateRelativeLoad(e, entities, options)
  ).filter(rl => isFinite(rl));
  
  if (relativeLoads.length < 2) return 0;
  
  const mean = relativeLoads.reduce((a, b) => a + b, 0) / relativeLoads.length;
  const variance = relativeLoads.reduce((sum, rl) => sum + Math.pow(rl - mean, 2), 0) / relativeLoads.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient de variation (std / mean)
  return mean > 0 ? stdDev / mean : 0;
}

/**
 * Utilitaire: récupère les heures depuis un enseignant
 * Compatible avec le modèle Enseignant existant
 */
export function getEnseignantHeures(
  enseignant: { heuresParNiveau?: Record<string, number> },
  niveau: '3e' | '4e' | '5e' | '6e' = '3e',
  defaultValue: number = 1
): number {
  const heures = enseignant.heuresParNiveau?.[niveau];
  return heures != null && heures > 0 ? heures : defaultValue;
}

/**
 * Construit une liste d'entités d'équilibrage depuis les enseignants
 */
export function buildBalancingEntities(
  enseignants: Array<{ id: string; heuresParNiveau?: Record<string, number>; capaciteStage?: number }>,
  currentLoads: Map<string, number>,
  niveau: '3e' | '4e' | '5e' | '6e' = '3e',
  defaultHours: number = 1
): BalancingEntity[] {
  return enseignants.map(ens => ({
    id: ens.id,
    currentLoad: currentLoads.get(ens.id) ?? 0,
    heuresParSemaine: getEnseignantHeures(ens, niveau, defaultHours),
    capaciteMax: ens.capaciteStage,
  }));
}
