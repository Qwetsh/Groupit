// ============================================================
// REPOSITORY REGISTRY - Injection de dépendances
// ============================================================
// Permet de remplacer les repositories pour les tests
// tout en gardant les singletons par défaut en production
// ============================================================

import { EleveRepository, eleveRepository } from './eleveRepository';
import { EnseignantRepository, enseignantRepository } from './enseignantRepository';
import { AffectationRepository, affectationRepository } from './affectationRepository';
import { ScenarioRepository, scenarioRepository } from './scenarioRepository';
import { GroupeRepository, groupeRepository } from './groupeRepository';
import { FieldDefinitionRepository, fieldDefinitionRepository } from './fieldDefinitionRepository';
import { juryRepository } from './juryRepository';
import { scenarioArchiveRepository } from './scenarioArchiveRepository';

// ============================================================
// Types des repositories (pour typage des mocks)
// ============================================================

export type JuryRepository = typeof juryRepository;
export type ScenarioArchiveRepository = typeof scenarioArchiveRepository;

export interface RepositoryMap {
  eleve: EleveRepository;
  enseignant: EnseignantRepository;
  affectation: AffectationRepository;
  scenario: ScenarioRepository;
  groupe: GroupeRepository;
  jury: JuryRepository;
  fieldDefinition: FieldDefinitionRepository;
  scenarioArchive: ScenarioArchiveRepository;
}

// ============================================================
// Registry
// ============================================================

class RepositoryRegistry {
  private overrides: Partial<RepositoryMap> = {};

  /**
   * Récupère un repository (override ou défaut)
   */
  get<K extends keyof RepositoryMap>(name: K): RepositoryMap[K] {
    if (this.overrides[name]) {
      return this.overrides[name] as RepositoryMap[K];
    }
    return this.getDefault(name);
  }

  /**
   * Récupère le repository par défaut (singleton)
   */
  private getDefault<K extends keyof RepositoryMap>(name: K): RepositoryMap[K] {
    const defaults: RepositoryMap = {
      eleve: eleveRepository,
      enseignant: enseignantRepository,
      affectation: affectationRepository,
      scenario: scenarioRepository,
      groupe: groupeRepository,
      jury: juryRepository,
      fieldDefinition: fieldDefinitionRepository,
      scenarioArchive: scenarioArchiveRepository,
    };
    return defaults[name];
  }

  /**
   * Remplace un repository (pour les tests)
   */
  override<K extends keyof RepositoryMap>(
    name: K,
    implementation: RepositoryMap[K]
  ): void {
    this.overrides[name] = implementation;
  }

  /**
   * Remplace plusieurs repositories à la fois
   */
  overrideMany(overrides: Partial<RepositoryMap>): void {
    this.overrides = { ...this.overrides, ...overrides };
  }

  /**
   * Réinitialise un repository à sa valeur par défaut
   */
  reset<K extends keyof RepositoryMap>(name: K): void {
    delete this.overrides[name];
  }

  /**
   * Réinitialise tous les repositories
   */
  resetAll(): void {
    this.overrides = {};
  }

  /**
   * Vérifie si un repository a été overridé
   */
  isOverridden<K extends keyof RepositoryMap>(name: K): boolean {
    return name in this.overrides;
  }
}

// Singleton du registry
export const repositoryRegistry = new RepositoryRegistry();

// ============================================================
// Accesseurs pratiques (raccourcis)
// ============================================================

export const repositories = {
  get eleve() {
    return repositoryRegistry.get('eleve');
  },
  get enseignant() {
    return repositoryRegistry.get('enseignant');
  },
  get affectation() {
    return repositoryRegistry.get('affectation');
  },
  get scenario() {
    return repositoryRegistry.get('scenario');
  },
  get groupe() {
    return repositoryRegistry.get('groupe');
  },
  get jury() {
    return repositoryRegistry.get('jury');
  },
  get fieldDefinition() {
    return repositoryRegistry.get('fieldDefinition');
  },
  get scenarioArchive() {
    return repositoryRegistry.get('scenarioArchive');
  },
};

// ============================================================
// Utilitaires pour les tests
// ============================================================

/**
 * Helper pour créer un mock de repository avec des méthodes vides
 * Usage: const mockRepo = createMockRepository<EleveRepository>({ getAll: async () => [] });
 */
export function createMockRepository<T>(
  overrides: Partial<T>
): T {
  return overrides as T;
}

/**
 * Helper pour les tests: configure les mocks et retourne une fonction de cleanup
 * Usage:
 *   const cleanup = setupTestRepositories({ eleve: mockEleveRepo });
 *   // ... tests ...
 *   cleanup();
 */
export function setupTestRepositories(
  overrides: Partial<RepositoryMap>
): () => void {
  repositoryRegistry.overrideMany(overrides);
  return () => repositoryRegistry.resetAll();
}
