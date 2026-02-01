// ============================================================
// EXEMPLE DE TEST AVEC LE REPOSITORY REGISTRY
// ============================================================
// Ce fichier montre comment utiliser l'injection de dépendances
// pour tester du code qui dépend des repositories.
//
// Renommer en .test.ts et adapter selon votre framework de test.
// ============================================================

import {
  repositoryRegistry,
  repositories,
  createMockRepository,
  setupTestRepositories,
  type EleveRepository,
} from './index';

// ============================================================
// Exemple 1: Mock simple d'un repository
// ============================================================

function exampleSimpleMock() {
  // Créer un mock partiel
  const mockEleveRepo = createMockRepository<EleveRepository>({
    getAll: async () => [
      {
        id: 'test-1',
        nom: 'Dupont',
        prenom: 'Jean',
        classe: '3A',
        options: [],
        tags: [],
        contraintes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    count: async () => 1,
  });

  // Configurer le mock
  repositoryRegistry.override('eleve', mockEleveRepo);

  // Utiliser le repository (retourne le mock)
  const repo = repositories.eleve;
  void repo; // Exemple - dans un vrai test: await repo.getAll()

  // Cleanup
  repositoryRegistry.reset('eleve');
}

// ============================================================
// Exemple 2: Test avec setup/cleanup automatique
// ============================================================

function exampleWithSetupCleanup() {
  // Setup: configure les mocks et récupère la fonction de cleanup
  const cleanup = setupTestRepositories({
    eleve: createMockRepository<EleveRepository>({
      getAll: async () => [],
      count: async () => 0,
    }),
  });

  try {
    // ... exécuter les tests ...
    const repo = repositories.eleve;
    void repo; // Exemple - dans un vrai test: await repo.getAll()
  } finally {
    // Cleanup: restaure les repositories par défaut
    cleanup();
  }
}

// ============================================================
// Exemple 3: Test d'un store avec repository mocké
// ============================================================

async function exampleTestStore() {
  // Mock data
  const mockEleves = [
    {
      id: '1',
      nom: 'Martin',
      prenom: 'Alice',
      classe: '3B',
      options: ['Latin'],
      tags: [],
      contraintes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Setup mock
  const cleanup = setupTestRepositories({
    eleve: createMockRepository<EleveRepository>({
      getAllAndDedupe: async () => mockEleves,
      create: async (data) => ({
        ...data,
        id: 'new-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    }),
  });

  try {
    // Importer et tester le store
    // Note: le store doit utiliser `repositories.eleve` au lieu de `eleveRepository`
    // pour que l'injection fonctionne

    // const { useEleveStore } = await import('../../stores/eleveStore');
    // await useEleveStore.getState().loadEleves();
    // expect(useEleveStore.getState().eleves).toHaveLength(1);
  } finally {
    cleanup();
  }
}

// ============================================================
// Exemple 4: Mock avec Jest/Vitest spies
// ============================================================

function exampleWithSpies() {
  // Avec Vitest ou Jest, vous pouvez créer des spies
  const getAllSpy = /* vi.fn() ou jest.fn() */ async () => [];
  const createSpy = /* vi.fn() ou jest.fn() */ async (data: unknown) => ({
    ...(data as object),
    id: 'created-id',
  });

  const mockRepo = createMockRepository<EleveRepository>({
    getAll: getAllSpy,
    create: createSpy as EleveRepository['create'],
  });

  repositoryRegistry.override('eleve', mockRepo);

  // Après les tests, vérifier les appels
  // expect(getAllSpy).toHaveBeenCalledTimes(1);
  // expect(createSpy).toHaveBeenCalledWith({ nom: 'Test' });

  repositoryRegistry.resetAll();
}

// ============================================================
// Notes d'intégration
// ============================================================
//
// Pour utiliser l'injection dans les stores existants, modifier:
//
// AVANT:
//   import { eleveRepository } from '../infrastructure/repositories';
//   // ... utilise eleveRepository directement
//
// APRÈS:
//   import { repositories } from '../infrastructure/repositories';
//   // ... utilise repositories.eleve
//
// Cette modification permet aux tests de remplacer le repository
// via le registry.
//
// En production, le comportement est identique car le registry
// retourne les singletons par défaut.
// ============================================================

export {
  exampleSimpleMock,
  exampleWithSetupCleanup,
  exampleTestStore,
  exampleWithSpies,
};
