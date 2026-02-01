// ============================================================
// DOMAIN MODELS - Export centralisé
// ============================================================

// ============ CRITÈRES (depuis criteriaConfig) ============
export type {
  PriorityLevel,
  CritereDefinition,
  CritereInstance,
} from '../criteriaConfig';

export {
  CRITERE_DEFINITIONS,
  getCriteresForScenarioType,
  getForcedCriteresForScenarioType,
  getOptionalCriteresForScenarioType,
  createCritereInstance,
  createDefaultCriteres,
  getEffectiveCriteres,
  priorityToWeight,
  weightToPriority,
  getCritereDefinition,
  isCritereActive,
  getActiveCriteres,
} from '../criteriaConfig';

// ============ TYPES DE BASE ============
export type {
  Sexe,
  Niveau,
  ScenarioMode,
  ScenarioType,
  AffectationType,
  ContrainteType,
} from './types';

export { NIVEAUX, isNiveau, extractNiveau } from './types';

// ============ MATIÈRES ============
export type { MatiereHeuresRef } from './matieres';
export { MATIERES_HEURES_3E, getHeuresMatiere, getPoidsPedagogiqueNormalise } from './matieres';

// ============ CAPACITÉ ============
export {
  calculateCapacitesStage,
  getCapaciteStageCalculee,
  getEnseignantCapacite,
} from './capacite';

// ============ ÉLÈVE ============
export type { Contrainte, CreneauHoraire, EmploiDuTemps, Eleve } from './eleve';

// ============ ENSEIGNANT ============
export type { HeuresParNiveau, Enseignant } from './enseignant';

// ============ AFFECTATION ============
export type {
  MetadataSuiviStage,
  MetadataOralDNB,
  AffectationMetadata,
  AffectationExplication,
  Affectation,
} from './affectation';

// ============ STAGE ============
export type { GeoPrecision, GeoStatusExtended, Stage } from './stage';

// ============ GROUPE & JURY ============
export type { Groupe, GroupeContrainte, Jury, JuryStats } from './groupe';

// ============ SCÉNARIO ============
export type {
  CapaciteConfig,
  CritereConfig,
  ScenarioParametres,
  Scenario,
} from './scenario';

// ============ ARCHIVE ============
export type {
  ArchiveParticipant,
  ArchiveEleve,
  ArchiveAffectation,
  ScenarioArchive,
} from './archive';

// ============ MATCHING ============
export type {
  ConstraintViolation,
  MatchingResult,
  SolverResult,
  MatchingResultDNB,
  SolverResultDNB,
} from './matching';

// ============ IMPORT ============
export type { ColumnMapping, ImportResult, ImportMatiereOralResult } from './import';

// ============ FIELD DEFINITION ============
export type { FieldType, EntityType, FieldDefinition } from './field';

// ============ FILTRES UI ============
export type { FilterEleves, FilterEnseignants } from './filters';
