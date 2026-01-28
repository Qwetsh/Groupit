// ============================================================
// CONFIGURATION CENTRALISÉE DES CRITÈRES
// ============================================================
// Ce fichier définit tous les critères disponibles, leur comportement,
// et leur applicabilité selon le type de scénario.

import type { ScenarioType } from './models';

// ============ TYPES ============

export type PriorityLevel = 'off' | 'low' | 'normal' | 'high';

export interface CritereDefinition {
  id: string;
  nom: string;
  description: string;
  
  // Applicabilité
  scenarioTypes: ScenarioType[];      // Types de scénario où ce critère est disponible
  isForced: boolean;                   // Critère forcé (invisible par défaut)
  
  // Comportement
  canBeHardConstraint: boolean;        // Peut être une contrainte dure
  defaultPriority: PriorityLevel;      // Priorité par défaut
  defaultHardConstraint: boolean;      // Contrainte dure par défaut
  
  // Options avancées
  hasWeightByHoursOption?: boolean;    // Affiche l'option "pondérer par charge horaire"
  
  // Mapping vers le moteur
  engineKey: string;                   // Clé utilisée dans le moteur d'affectation
}

export interface CritereInstance {
  id: string;                          // Référence vers CritereDefinition.id
  priority: PriorityLevel;             // Priorité choisie par l'utilisateur
  isHardConstraint: boolean;           // Est une contrainte dure
  isForced: boolean;                   // Est un critère forcé (ne peut pas être désactivé)
  
  // Options spécifiques au critère "equilibrage"
  weightByHours?: boolean;             // Si true, pondère par la charge horaire de l'enseignant
}

// ============ DÉFINITIONS DES CRITÈRES ============

export const CRITERE_DEFINITIONS: CritereDefinition[] = [
  // ========== CRITÈRES FORCÉS ==========
  
  // Oral DNB - Correspondance matière (FORCÉ)
  {
    id: 'matiere_match',
    nom: 'Correspondance matière',
    description: 'Priorité aux jurys dont un enseignant enseigne la matière de l\'oral de l\'élève',
    scenarioTypes: ['oral_dnb'],
    isForced: true,
    canBeHardConstraint: false,        // Soft constraint car fallback autorisé
    defaultPriority: 'high',
    defaultHardConstraint: false,
    engineKey: 'matiere',
  },
  
  // Suivi Stage - Distance/Temps de trajet (FORCÉ)
  {
    id: 'distance_trajet',
    nom: 'Distance / Temps de trajet',
    description: 'Minimise le temps de trajet entre le domicile de l\'enseignant et le lieu de stage',
    scenarioTypes: ['suivi_stage'],
    isForced: true,
    canBeHardConstraint: true,         // Peut imposer une distance max
    defaultPriority: 'high',
    defaultHardConstraint: false,
    engineKey: 'distance',
  },
  
  // ========== CRITÈRES OPTIONNELS ==========
  
  // Équilibrage (commun aux deux)
  {
    id: 'equilibrage',
    nom: 'Équilibrage des charges',
    description: 'Répartit équitablement les élèves entre enseignants/jurys',
    scenarioTypes: ['oral_dnb', 'suivi_stage'],
    isForced: false,
    canBeHardConstraint: false,
    defaultPriority: 'normal',
    defaultHardConstraint: false,
    hasWeightByHoursOption: true,       // Option pondération par heures
    engineKey: 'equilibrage',
  },
  
  // Mixité (commun aux deux)
  {
    id: 'mixite',
    nom: 'Mixité filles/garçons',
    description: 'Équilibre la répartition par sexe dans chaque groupe/jury',
    scenarioTypes: ['oral_dnb', 'suivi_stage'],
    isForced: false,
    canBeHardConstraint: false,
    defaultPriority: 'off',
    defaultHardConstraint: false,
    engineKey: 'parite',
  },
  
  // Professeur principal (Stage seulement)
  {
    id: 'prof_principal',
    nom: 'Professeur principal',
    description: 'Favorise l\'affectation de l\'élève à son professeur principal',
    scenarioTypes: ['suivi_stage'],
    isForced: false,
    canBeHardConstraint: false,
    defaultPriority: 'low',
    defaultHardConstraint: false,
    engineKey: 'profPrincipal',
  },

  // Élèves en cours (Stage et Oral DNB)
  {
    id: 'eleves_en_cours',
    nom: 'Élèves en cours',
    description: 'Favorise l\'affectation aux enseignants qui ont l\'élève dans une de leurs classes',
    scenarioTypes: ['suivi_stage', 'oral_dnb'],
    isForced: false,
    canBeHardConstraint: false,
    defaultPriority: 'normal',
    defaultHardConstraint: false,
    engineKey: 'elevesEnCours',
  },
  
  // Poids pédagogique (Oral DNB seulement)
  {
    id: 'poids_pedagogique',
    nom: 'Poids pédagogique',
    description: 'Pondère par le nombre d\'heures hebdomadaires de la matière (ex: Français > Arts plastiques)',
    scenarioTypes: ['oral_dnb'],
    isForced: false,
    canBeHardConstraint: false,
    defaultPriority: 'off',
    defaultHardConstraint: false,
    engineKey: 'poidsPedagogique',
  },
  
  // Capacité restante (Oral DNB seulement)
  {
    id: 'capacite',
    nom: 'Capacité restante',
    description: 'Favorise les jurys ayant plus de places disponibles',
    scenarioTypes: ['oral_dnb'],
    isForced: false,
    canBeHardConstraint: false,
    defaultPriority: 'normal',
    defaultHardConstraint: false,
    engineKey: 'capacite',
  },
];

// ============ FONCTIONS UTILITAIRES ============

/**
 * Récupère les critères disponibles pour un type de scénario
 */
export function getCriteresForScenarioType(
  scenarioType: ScenarioType,
  includeForced: boolean = true
): CritereDefinition[] {
  return CRITERE_DEFINITIONS.filter(c => {
    const matchType = c.scenarioTypes.includes(scenarioType);
    const matchForced = includeForced || !c.isForced;
    return matchType && matchForced;
  });
}

/**
 * Récupère les critères forcés pour un type de scénario
 */
export function getForcedCriteresForScenarioType(
  scenarioType: ScenarioType
): CritereDefinition[] {
  return CRITERE_DEFINITIONS.filter(c => 
    c.scenarioTypes.includes(scenarioType) && c.isForced
  );
}

/**
 * Récupère les critères optionnels pour un type de scénario
 */
export function getOptionalCriteresForScenarioType(
  scenarioType: ScenarioType
): CritereDefinition[] {
  return CRITERE_DEFINITIONS.filter(c => 
    c.scenarioTypes.includes(scenarioType) && !c.isForced
  );
}

/**
 * Crée une instance de critère avec les valeurs par défaut
 */
export function createCritereInstance(definition: CritereDefinition): CritereInstance {
  const instance: CritereInstance = {
    id: definition.id,
    priority: definition.defaultPriority,
    isHardConstraint: definition.defaultHardConstraint,
    isForced: definition.isForced,
  };
  
  // Initialiser les options spécifiques
  if (definition.hasWeightByHoursOption) {
    instance.weightByHours = false; // Désactivé par défaut
  }
  
  return instance;
}

/**
 * Crée la liste des critères par défaut pour un type de scénario
 */
export function createDefaultCriteres(scenarioType: ScenarioType): CritereInstance[] {
  const definitions = getCriteresForScenarioType(scenarioType, true);
  return definitions.map(createCritereInstance);
}

/**
 * Récupère les critères effectifs pour un scénario
 * - Injecte les critères forcés s'ils sont absents
 * - Filtre les critères non applicables au type de scénario
 */
export function getEffectiveCriteres(
  scenarioType: ScenarioType,
  userCriteres: CritereInstance[]
): CritereInstance[] {
  const forcedDefs = getForcedCriteresForScenarioType(scenarioType);
  const allowedIds = getCriteresForScenarioType(scenarioType).map(c => c.id);
  
  // Filtrer les critères utilisateur pour ne garder que ceux autorisés
  const filtered = userCriteres.filter(c => allowedIds.includes(c.id));
  
  // Ajouter les critères forcés s'ils sont absents
  const result = [...filtered];
  for (const forcedDef of forcedDefs) {
    if (!result.some(c => c.id === forcedDef.id)) {
      result.push(createCritereInstance(forcedDef));
    }
  }
  
  // S'assurer que les critères forcés ne peuvent pas être désactivés
  return result.map(c => {
    const def = CRITERE_DEFINITIONS.find(d => d.id === c.id);
    if (def?.isForced && c.priority === 'off') {
      return { ...c, priority: 'high' as PriorityLevel, isForced: true };
    }
    return { ...c, isForced: def?.isForced || false };
  });
}

/**
 * Convertit un niveau de priorité en poids numérique (0-100)
 */
export function priorityToWeight(priority: PriorityLevel): number {
  switch (priority) {
    case 'off': return 0;
    case 'low': return 25;
    case 'normal': return 50;
    case 'high': return 100;
    default: return 50;
  }
}

/**
 * Convertit un poids numérique en niveau de priorité
 */
export function weightToPriority(weight: number): PriorityLevel {
  if (weight <= 0) return 'off';
  if (weight <= 30) return 'low';
  if (weight <= 70) return 'normal';
  return 'high';
}

// ============ CONVERSION VERS OPTIONS DES MOTEURS ============

/**
 * Options pour l'algorithme de matching stage
 */
export interface StageMatchingOptionsFromCriteria {
  poidsDuree: number;
  poidsDistance: number;
  poidsEquilibrage: number;
  poidsProfssPrincipal: number;
  poidsElevesEnCours: number;
  distanceMaxKm?: number;
  dureeMaxMin?: number;
  // Option équilibrage pondéré
  equilibrageWeightByHours: boolean;
}

/**
 * Convertit les critères V2 en options pour le moteur de matching Stage
 */
export function criteresToStageOptions(
  criteres: CritereInstance[],
  stageConfig?: { distanceMaxKm?: number; dureeMaxMin?: number }
): StageMatchingOptionsFromCriteria {
  // Récupérer les critères actifs
  const getCritereWeight = (id: string): number => {
    const critere = criteres.find(c => c.id === id);
    if (!critere || critere.priority === 'off') return 0;
    return priorityToWeight(critere.priority);
  };
  
  // Le critère forcé "distance_trajet" mappe vers duree + distance
  const poidsDistanceTrajet = getCritereWeight('distance_trajet');
  
  // Récupérer l'option weightByHours pour l'équilibrage
  const equilibrageCritere = criteres.find(c => c.id === 'equilibrage');
  
  return {
    // Distance/durée sont regroupés sous "distance_trajet"
    poidsDuree: poidsDistanceTrajet * 0.6, // 60% pour la durée
    poidsDistance: poidsDistanceTrajet * 0.4, // 40% pour la distance
    poidsEquilibrage: getCritereWeight('equilibrage'),
    poidsProfssPrincipal: getCritereWeight('prof_principal'),
    poidsElevesEnCours: getCritereWeight('eleves_en_cours'),
    // Contraintes dures depuis la config
    distanceMaxKm: stageConfig?.distanceMaxKm,
    dureeMaxMin: stageConfig?.dureeMaxMin,
    // Option équilibrage pondéré
    equilibrageWeightByHours: equilibrageCritere?.weightByHours ?? false,
  };
}

/**
 * Options pour l'algorithme de matching Oral DNB
 */
export interface OralDnbOptionsFromCriteria {
  poidsMatiereMatch: number;
  poidsEquilibrage: number;
  poidsMixite: number;
  poidsPedagogique: number;
  poidsCapacite: number;
  poidsElevesEnCours: number;
  // Option équilibrage pondéré
  equilibrageWeightByHours: boolean;
}

// Alias plus court pour utilisation dans le solver
export type OralDnbOptions = OralDnbOptionsFromCriteria;

/**
 * Convertit les critères V2 en options pour le moteur Oral DNB
 */
export function criteresToOralDnbOptions(
  criteres: CritereInstance[]
): OralDnbOptionsFromCriteria {
  const getCritereWeight = (id: string): number => {
    const critere = criteres.find(c => c.id === id);
    if (!critere || critere.priority === 'off') return 0;
    return priorityToWeight(critere.priority);
  };
  
  // Récupérer l'option weightByHours pour l'équilibrage
  const equilibrageCritere = criteres.find(c => c.id === 'equilibrage');
  
  return {
    poidsMatiereMatch: getCritereWeight('matiere_match'),
    poidsEquilibrage: getCritereWeight('equilibrage'),
    poidsMixite: getCritereWeight('mixite'),
    poidsPedagogique: getCritereWeight('poids_pedagogique'),
    poidsCapacite: getCritereWeight('capacite'),
    poidsElevesEnCours: getCritereWeight('eleves_en_cours'),
    // Option équilibrage pondéré
    equilibrageWeightByHours: equilibrageCritere?.weightByHours ?? false,
  };
}

/**
 * Récupère une définition de critère par son ID
 */
export function getCritereDefinition(id: string): CritereDefinition | undefined {
  return CRITERE_DEFINITIONS.find(c => c.id === id);
}

/**
 * Vérifie si un critère est actif (priority !== 'off')
 */
export function isCritereActive(critere: CritereInstance): boolean {
  return critere.priority !== 'off';
}

/**
 * Récupère les critères actifs uniquement
 */
export function getActiveCriteres(criteres: CritereInstance[]): CritereInstance[] {
  return criteres.filter(isCritereActive);
}
