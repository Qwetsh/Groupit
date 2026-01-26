// ============================================================
// TESTS - SOLVEUR GREEDY + AMÉLIORATION LOCALE
// ============================================================

import { describe, it, expect } from 'vitest';
import { solveGreedy, improveWithLocalSearch, solveMatching, convertToAffectations } from './solver';
import type { Eleve, Enseignant, Scenario, MatchingResult } from '../domain/models';

describe('Solver Utilities', () => {
  // === HELPERS ===

  const createEleve = (id: string, overrides: Partial<Eleve> = {}): Eleve => ({
    id,
    nom: `Nom${id}`,
    prenom: `Prenom${id}`,
    classe: '3A',
    niveau: '3e',
    customFields: {},
    options: [],
    contraintes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createEnseignant = (id: string, overrides: Partial<Enseignant> = {}): Enseignant => ({
    id,
    nom: `Prof${id}`,
    prenom: `Prenom${id}`,
    matierePrincipale: 'Mathématiques',
    classesPrincipales: ['3A'],
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
    id: 'scenario-1',
    nom: 'Test Scenario',
    type: 'suivi_stage',
    parametres: {
      criteres: [
        { id: 'capacite', nom: 'Capacité', actif: true, poids: 1, estContrainteDure: true },
        { id: 'equilibrage', nom: 'Équilibrage', actif: true, poids: 1, estContrainteDure: false },
      ],
      capaciteConfig: {
        capaciteBaseDefaut: 5,
        coefficients: { '6e': 1, '5e': 1, '4e': 1, '3e': 1 },
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // === TESTS solveGreedy ===

  describe('solveGreedy', () => {
    it('affecte tous les élèves si capacité suffisante', () => {
      const eleves = [createEleve('e1'), createEleve('e2'), createEleve('e3')];
      const enseignants = [
        createEnseignant('ens1'),
        createEnseignant('ens2'),
      ];
      const scenario = createScenario();

      const result = solveGreedy(eleves, enseignants, scenario);

      expect(result.affectations).toHaveLength(3);
      expect(result.nonAffectes).toHaveLength(0);
      expect(result.scoreGlobal).toBeGreaterThan(0);
    });

    it('gère les élèves non affectables (capacité insuffisante)', () => {
      const eleves = [
        createEleve('e1'),
        createEleve('e2'),
        createEleve('e3'),
        createEleve('e4'),
        createEleve('e5'),
        createEleve('e6'), // 6 élèves
      ];
      const enseignants = [createEnseignant('ens1')]; // 1 enseignant, capacité 5
      const scenario = createScenario();

      const result = solveGreedy(eleves, enseignants, scenario);

      expect(result.affectations).toHaveLength(5);
      expect(result.nonAffectes).toHaveLength(1);
    });

    it('équilibre la charge entre enseignants', () => {
      // 6 élèves, 2 enseignants avec capacité 5 chacun
      const eleves = Array.from({ length: 6 }, (_, i) => createEleve(`e${i}`));
      const enseignants = [
        createEnseignant('ens1'),
        createEnseignant('ens2'),
      ];
      const scenario = createScenario();

      const result = solveGreedy(eleves, enseignants, scenario);

      // Compter les affectations par enseignant
      const countByEns = new Map<string, number>();
      result.affectations.forEach(a => {
        const count = countByEns.get(a.enseignantId) || 0;
        countByEns.set(a.enseignantId, count + 1);
      });

      // Vérifier que les deux enseignants ont reçu des élèves
      expect(countByEns.size).toBe(2);

      // Vérifier que la charge est raisonnablement distribuée
      const counts = Array.from(countByEns.values());
      const minCount = Math.min(...counts);

      // Au moins 1 élève par enseignant (pas tout sur un seul)
      expect(minCount).toBeGreaterThanOrEqual(1);
    });

    it('respecte les contraintes relationnelles dures', () => {
      const eleve = createEleve('e1', {
        contraintes: [
          { type: 'ne_doit_pas_etre_avec', cibleType: 'enseignant', cibleId: 'ens1' },
        ],
      });
      const enseignants = [
        createEnseignant('ens1'),
        createEnseignant('ens2'),
      ];
      const scenario = createScenario({
        parametres: {
          criteres: [
            { id: 'contraintes_relationnelles', nom: 'Relations', actif: true, poids: 1, estContrainteDure: true },
            { id: 'capacite', nom: 'Capacité', actif: true, poids: 1, estContrainteDure: true },
          ],
          capaciteConfig: { capaciteBaseDefaut: 5 },
        },
      });

      const result = solveGreedy([eleve], enseignants, scenario);

      expect(result.affectations).toHaveLength(1);
      expect(result.affectations[0].enseignantId).toBe('ens2'); // Pas ens1
    });

    it('retourne temps de calcul', () => {
      const eleves = [createEleve('e1')];
      const enseignants = [createEnseignant('ens1')];
      const scenario = createScenario();

      const result = solveGreedy(eleves, enseignants, scenario);

      expect(result.tempsCalculMs).toBeDefined();
      expect(result.tempsCalculMs).toBeGreaterThanOrEqual(0);
    });

    it('retourne le nombre d\'itérations', () => {
      const eleves = [createEleve('e1'), createEleve('e2')];
      const enseignants = [createEnseignant('ens1')];
      const scenario = createScenario();

      const result = solveGreedy(eleves, enseignants, scenario);

      expect(result.iterations).toBeDefined();
      expect(result.iterations).toBeGreaterThanOrEqual(eleves.length);
    });

    it('gère liste vide d\'élèves', () => {
      const enseignants = [createEnseignant('ens1')];
      const scenario = createScenario();

      const result = solveGreedy([], enseignants, scenario);

      expect(result.affectations).toHaveLength(0);
      expect(result.nonAffectes).toHaveLength(0);
      expect(result.scoreGlobal).toBe(0);
    });

    it('gère liste vide d\'enseignants', () => {
      const eleves = [createEleve('e1')];
      const scenario = createScenario();

      const result = solveGreedy(eleves, [], scenario);

      expect(result.affectations).toHaveLength(0);
      expect(result.nonAffectes).toHaveLength(1);
    });
  });

  // === TESTS improveWithLocalSearch ===

  describe('improveWithLocalSearch', () => {
    it('ne dégrade pas le score initial', () => {
      const eleves = Array.from({ length: 4 }, (_, i) => createEleve(`e${i}`));
      const enseignants = [
        createEnseignant('ens1'),
        createEnseignant('ens2'),
      ];
      const scenario = createScenario();

      const initial = solveGreedy(eleves, enseignants, scenario);
      const improved = improveWithLocalSearch(initial, eleves, enseignants, scenario);

      expect(improved.scoreGlobal).toBeGreaterThanOrEqual(initial.scoreGlobal);
    });

    it('retourne le résultat initial si pas d\'amélioration possible', () => {
      // Cas simple avec 1 élève, pas de swap possible
      const eleves = [createEleve('e1')];
      const enseignants = [createEnseignant('ens1')];
      const scenario = createScenario();

      const initial = solveGreedy(eleves, enseignants, scenario);
      const improved = improveWithLocalSearch(initial, eleves, enseignants, scenario);

      expect(improved.affectations.length).toBe(initial.affectations.length);
    });
  });

  // === TESTS solveMatching (wrapper complet) ===

  describe('solveMatching', () => {
    it('combine greedy + amélioration locale', () => {
      const eleves = Array.from({ length: 5 }, (_, i) => createEleve(`e${i}`));
      const enseignants = [
        createEnseignant('ens1'),
        createEnseignant('ens2'),
      ];
      const scenario = createScenario();

      const result = solveMatching(eleves, enseignants, scenario);

      expect(result.affectations).toHaveLength(5);
      expect(result.scoreGlobal).toBeGreaterThan(0);
      expect(result.tempsCalculMs).toBeDefined();
    });
  });

  // === TESTS convertToAffectations ===

  describe('convertToAffectations', () => {
    it('convertit MatchingResult[] en Affectation[]', () => {
      const matchingResults: MatchingResult[] = [
        {
          eleveId: 'e1',
          enseignantId: 'ens1',
          score: 85,
          scoreDetail: { equilibrage: 90, capacite: 80 },
          violations: [],
          isValid: true,
        },
        {
          eleveId: 'e2',
          enseignantId: 'ens2',
          score: 75,
          scoreDetail: { equilibrage: 70, capacite: 80 },
          violations: [],
          isValid: true,
        },
      ];
      const scenario = createScenario();

      const affectations = convertToAffectations(matchingResults, scenario);

      expect(affectations).toHaveLength(2);
      expect(affectations[0].eleveId).toBe('e1');
      expect(affectations[0].enseignantId).toBe('ens1');
      expect(affectations[0].scenarioId).toBe(scenario.id);
      expect(affectations[0].scoreTotal).toBe(85);
      expect(affectations[0].scoreDetail).toEqual({ equilibrage: 90, capacite: 80 });
    });

    it('utilise le type du scenario', () => {
      const matchingResults: MatchingResult[] = [
        { eleveId: 'e1', enseignantId: 'ens1', score: 100, scoreDetail: {}, violations: [], isValid: true },
      ];

      const stageScenario = createScenario({ type: 'suivi_stage' });
      const dnbScenario = createScenario({ type: 'oral_dnb' });

      const stageAffectations = convertToAffectations(matchingResults, stageScenario);
      const dnbAffectations = convertToAffectations(matchingResults, dnbScenario);

      expect(stageAffectations[0].type).toBe('suivi_stage');
      expect(dnbAffectations[0].type).toBe('oral_dnb');
    });
  });

  // === TESTS de performance ===

  describe('Performance', () => {
    it('gère 100 élèves en moins de 1 seconde', () => {
      const eleves = Array.from({ length: 100 }, (_, i) => createEleve(`e${i}`));
      const enseignants = Array.from({ length: 10 }, (_, i) => createEnseignant(`ens${i}`));
      const scenario = createScenario({
        parametres: {
          criteres: [
            { id: 'capacite', nom: 'Capacité', actif: true, poids: 1, estContrainteDure: true },
            { id: 'equilibrage', nom: 'Équilibrage', actif: true, poids: 1, estContrainteDure: false },
          ],
          capaciteConfig: { capaciteBaseDefaut: 15 },
        },
      });

      const startTime = performance.now();
      const result = solveMatching(eleves, enseignants, scenario);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // < 1 seconde
      expect(result.affectations.length).toBeGreaterThan(0);
    });
  });
});
