// ============================================================
// TESTS - SCORING & CONTRAINTES
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  validateHardConstraints,
  scorePair,
  findBestMatchesForEleve,
  type ScoringContext,
  type ScoreResult,
} from './scoring';
import type { Eleve, Enseignant, Scenario, MatchingResult } from '../domain/models';

describe('Scoring Utilities', () => {
  // === DONNÉES DE TEST ===

  const createEleve = (overrides: Partial<Eleve> = {}): Eleve => ({
    id: 'eleve-1',
    nom: 'Dupont',
    prenom: 'Marie',
    classe: '3A',
    niveau: '3e',
    customFields: {},
    options: [],
    contraintes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createEnseignant = (overrides: Partial<Enseignant> = {}): Enseignant => ({
    id: 'enseignant-1',
    nom: 'Martin',
    prenom: 'Jean',
    matierePrincipale: 'Mathématiques',
    classesPrincipales: ['3A', '3B'],
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
    id: 'scenario-1',
    nom: 'Scénario Test',
    type: 'suivi_stage',
    parametres: {
      criteres: [
        { id: 'capacite', nom: 'Capacité', actif: true, poids: 1, estContrainteDure: true },
        { id: 'equilibrage', nom: 'Équilibrage', actif: true, poids: 1, estContrainteDure: false },
      ],
      capaciteConfig: { capaciteBaseDefaut: 5 },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createContext = (
    scenario: Scenario,
    charges: Map<string, number> = new Map(),
    capacites: Map<string, number> = new Map()
  ): ScoringContext => ({
    scenario,
    chargesActuelles: charges,
    capacites,
  });

  // === TESTS validateHardConstraints ===

  describe('validateHardConstraints', () => {
    it('valide si capacité disponible', () => {
      const eleve = createEleve();
      const enseignant = createEnseignant();
      const scenario = createScenario();

      const charges = new Map([['enseignant-1', 3]]);
      const capacites = new Map([['enseignant-1', 5]]);
      const context = createContext(scenario, charges, capacites);

      const result = validateHardConstraints(eleve, enseignant, context);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('invalide si capacité atteinte', () => {
      const eleve = createEleve();
      const enseignant = createEnseignant();
      const scenario = createScenario();

      const charges = new Map([['enseignant-1', 5]]);
      const capacites = new Map([['enseignant-1', 5]]);
      const context = createContext(scenario, charges, capacites);

      const result = validateHardConstraints(eleve, enseignant, context);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('capacite');
    });

    it('valide contrainte relationnelle "ne doit pas être avec"', () => {
      const enseignant = createEnseignant({ id: 'ens-blocked' });
      const eleve = createEleve({
        contraintes: [
          { type: 'ne_doit_pas_etre_avec', cibleType: 'enseignant', cibleId: 'ens-blocked', raison: 'conflit' },
        ],
      });
      const scenario = createScenario({
        parametres: {
          criteres: [
            { id: 'contraintes_relationnelles', nom: 'Relations', actif: true, poids: 1, estContrainteDure: true },
          ],
          capaciteConfig: { capaciteBaseDefaut: 5 },
        },
      });

      const context = createContext(scenario);
      const result = validateHardConstraints(eleve, enseignant, context);

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.type === 'contrainte_relationnelle')).toBe(true);
    });

    it('valide si pas de critère actif', () => {
      const eleve = createEleve();
      const enseignant = createEnseignant();
      const scenario = createScenario({
        parametres: {
          criteres: [], // Aucun critère
          capaciteConfig: { capaciteBaseDefaut: 5 },
        },
      });

      const context = createContext(scenario);
      const result = validateHardConstraints(eleve, enseignant, context);

      expect(result.isValid).toBe(true);
    });
  });

  // === TESTS scorePair ===

  describe('scorePair', () => {
    it('retourne score 50 par défaut (neutre)', () => {
      const eleve = createEleve();
      const enseignant = createEnseignant();
      const scenario = createScenario({
        parametres: {
          criteres: [], // Pas de critères de scoring
          capaciteConfig: { capaciteBaseDefaut: 5 },
        },
      });

      const context = createContext(scenario);
      const result = scorePair(eleve, enseignant, context);

      expect(result.score).toBe(50);
    });

    it('calcule score équilibrage: sous-chargé = 100', () => {
      const eleve = createEleve();
      const enseignant = createEnseignant();
      const scenario = createScenario({
        parametres: {
          criteres: [
            { id: 'equilibrage', nom: 'Équilibrage', actif: true, poids: 1, estContrainteDure: false },
          ],
          capaciteConfig: { capaciteBaseDefaut: 5 },
        },
      });

      // Enseignant avec 1 élève sur capacité de 5 (20% = sous-chargé)
      const charges = new Map([['enseignant-1', 1]]);
      const capacites = new Map([['enseignant-1', 5]]);
      const context = createContext(scenario, charges, capacites);

      const result = scorePair(eleve, enseignant, context);

      expect(result.score).toBe(100);
      expect(result.breakdown.equilibrage).toBe(100);
    });

    it('calcule score équilibrage: très chargé = 30', () => {
      const eleve = createEleve();
      const enseignant = createEnseignant();
      const scenario = createScenario({
        parametres: {
          criteres: [
            { id: 'equilibrage', nom: 'Équilibrage', actif: true, poids: 1, estContrainteDure: false },
          ],
          capaciteConfig: { capaciteBaseDefaut: 5 },
        },
      });

      // Enseignant avec 4 élèves sur 5 (80%)
      const charges = new Map([['enseignant-1', 4]]);
      const capacites = new Map([['enseignant-1', 5]]);
      const context = createContext(scenario, charges, capacites);

      const result = scorePair(eleve, enseignant, context);

      expect(result.score).toBe(30);
      expect(result.breakdown.equilibrage).toBe(30);
    });

    it('pondère les scores selon les poids', () => {
      const eleve = createEleve();
      const enseignant = createEnseignant();
      const scenario = createScenario({
        parametres: {
          criteres: [
            { id: 'equilibrage', nom: 'Équilibrage', actif: true, poids: 2, estContrainteDure: false },
            { id: 'capacite', nom: 'Capacité', actif: true, poids: 1, estContrainteDure: false },
          ],
          capaciteConfig: { capaciteBaseDefaut: 5 },
        },
      });

      const charges = new Map([['enseignant-1', 1]]);
      const capacites = new Map([['enseignant-1', 5]]);
      const context = createContext(scenario, charges, capacites);

      const result = scorePair(eleve, enseignant, context);

      // Vérifier que le score est bien pondéré
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(Object.keys(result.breakdown)).toContain('equilibrage');
      expect(Object.keys(result.breakdown)).toContain('capacite');
    });
  });

  // === TESTS findBestMatchesForEleve ===

  describe('findBestMatchesForEleve', () => {
    const createResult = (eleveId: string, enseignantId: string, score: number, isValid = true): MatchingResult => ({
      eleveId,
      enseignantId,
      score,
      scoreDetail: {},
      violations: [],
      isValid,
    });

    it('retourne les meilleurs matches triés par score', () => {
      const results: MatchingResult[] = [
        createResult('e1', 'ens1', 70),
        createResult('e1', 'ens2', 90),
        createResult('e1', 'ens3', 50),
        createResult('e1', 'ens4', 80),
      ];

      const best = findBestMatchesForEleve('e1', results, 3);

      expect(best).toHaveLength(3);
      expect(best[0].enseignantId).toBe('ens2'); // Score 90
      expect(best[1].enseignantId).toBe('ens4'); // Score 80
      expect(best[2].enseignantId).toBe('ens1'); // Score 70
    });

    it('exclut les résultats invalides', () => {
      const results: MatchingResult[] = [
        createResult('e1', 'ens1', 100, false), // Invalide
        createResult('e1', 'ens2', 50, true),
        createResult('e1', 'ens3', 60, true),
      ];

      const best = findBestMatchesForEleve('e1', results, 5);

      expect(best).toHaveLength(2);
      expect(best.some(r => r.enseignantId === 'ens1')).toBe(false);
    });

    it('filtre par eleveId', () => {
      const results: MatchingResult[] = [
        createResult('e1', 'ens1', 90),
        createResult('e2', 'ens1', 100), // Autre élève
        createResult('e1', 'ens2', 80),
      ];

      const best = findBestMatchesForEleve('e1', results, 5);

      expect(best).toHaveLength(2);
      expect(best.every(r => r.eleveId === 'e1')).toBe(true);
    });

    it('respecte la limite', () => {
      const results: MatchingResult[] = [
        createResult('e1', 'ens1', 90),
        createResult('e1', 'ens2', 80),
        createResult('e1', 'ens3', 70),
        createResult('e1', 'ens4', 60),
        createResult('e1', 'ens5', 50),
      ];

      const best = findBestMatchesForEleve('e1', results, 2);

      expect(best).toHaveLength(2);
    });

    it('retourne tableau vide si aucun résultat valide', () => {
      const results: MatchingResult[] = [
        createResult('e1', 'ens1', 100, false),
        createResult('e1', 'ens2', 90, false),
      ];

      const best = findBestMatchesForEleve('e1', results, 5);

      expect(best).toHaveLength(0);
    });
  });

  // === TESTS Oral DNB spécifiques ===

  describe('Oral DNB - Validation matière', () => {
    it('valide si élève et enseignant ont matière compatible', () => {
      const eleve = createEleve({ matieresOral: ['Mathématiques'] });
      const enseignant = createEnseignant({ matierePrincipale: 'Mathématiques' });
      const scenario = createScenario({
        type: 'oral_dnb',
        parametres: {
          criteres: [
            { id: 'matiere', nom: 'Matière', actif: true, poids: 1, estContrainteDure: true },
          ],
          capaciteConfig: { capaciteBaseDefaut: 5 },
          matieresOralPossibles: ['Mathématiques', 'Français', 'Histoire'],
        },
      });

      const context = createContext(scenario);
      const result = validateHardConstraints(eleve, enseignant, context);

      expect(result.isValid).toBe(true);
    });

    it('invalide si matière enseignant pas dans oral autorisées', () => {
      const eleve = createEleve({ matieresOral: ['Mathématiques'] });
      const enseignant = createEnseignant({ matierePrincipale: 'EPS' });
      const scenario = createScenario({
        type: 'oral_dnb',
        parametres: {
          criteres: [
            { id: 'matiere', nom: 'Matière', actif: true, poids: 1, estContrainteDure: true },
          ],
          capaciteConfig: { capaciteBaseDefaut: 5 },
          matieresOralPossibles: ['Mathématiques', 'Français'], // Pas EPS
        },
      });

      const context = createContext(scenario);
      const result = validateHardConstraints(eleve, enseignant, context);

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.type === 'matiere')).toBe(true);
    });
  });
});
