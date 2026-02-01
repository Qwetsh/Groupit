// ============================================================
// REPOSITORIES INDEX - Export centralisé
// ============================================================

// Singletons (usage direct - backward compatible)
export { eleveRepository, EleveRepository } from './eleveRepository';
export { enseignantRepository, EnseignantRepository } from './enseignantRepository';
export { affectationRepository, AffectationRepository } from './affectationRepository';
export { scenarioRepository, ScenarioRepository, getDefaultParametres } from './scenarioRepository';
export { groupeRepository, GroupeRepository } from './groupeRepository';
export { juryRepository } from './juryRepository';
export { fieldDefinitionRepository, FieldDefinitionRepository } from './fieldDefinitionRepository';
export { scenarioArchiveRepository } from './scenarioArchiveRepository';
export type { EnseignantHistoryEntry } from './scenarioArchiveRepository';

// Registry pour injection de dépendances (tests)
export {
  repositoryRegistry,
  repositories,
  createMockRepository,
  setupTestRepositories,
  type RepositoryMap,
  type JuryRepository,
  type ScenarioArchiveRepository,
} from './registry';
