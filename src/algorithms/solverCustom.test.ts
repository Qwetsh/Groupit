// ============================================================
// TESTS - SOLVEUR DU MODE PERSONNALISÉ
// ============================================================

import { describe, it, expect } from 'vitest';
import { solveCustom, type CustomSolverResult } from './solverCustom';
import type { Eleve, Enseignant, Scenario } from '../domain/models';
import { DEFAULT_CUSTOM_CONFIG, type CustomModeConfig } from '../stores/uiStore';

const d = new Date('2026-01-01');

const eleve = (i: number, overrides: Partial<Eleve> = {}): Eleve => ({
  id: `e${String(i).padStart(3, '0')}`,
  nom: `Nom${i}`,
  prenom: `Prenom${i}`,
  classe: `3${'ABCDEFGH'[i % 8]}`,
  sexe: i % 3 === 0 ? 'M' : 'F',
  options: i % 4 === 0 ? ['Allemand'] : ['Espagnol'],
  customFields: {},
  tags: [],
  contraintes: [],
  createdAt: d,
  updatedAt: d,
  ...overrides,
});

const prof = (i: number): Enseignant => ({
  id: `p${i}`,
  nom: `Prof${i}`,
  prenom: `Prenom${i}`,
  matierePrincipale: 'SVT',
  classesEnCharge: [`3${'ABCDEFGH'[i % 8]}`],
  estProfPrincipal: false,
  tags: [],
  customFields: {},
  createdAt: d,
  updatedAt: d,
});

const scenario = { id: 'sc', type: 'custom', parametres: { criteres: [] } } as unknown as Scenario;

const config = (eleves: Eleve[], profs: Enseignant[], overrides: Partial<CustomModeConfig> = {}): CustomModeConfig => ({
  ...DEFAULT_CUSTOM_CONFIG,
  selectedEleveIds: eleves.map(e => e.id),
  selectedEnseignantIds: profs.map(p => p.id),
  critereParity: 'high',
  critereEnseignantAEleve: 'prefer',
  critereMemeClasse: 'avoid',
  critereLV: 'mixed',
  ...overrides,
});

/** Composition des groupes, indépendante des identifiants techniques. */
const composition = (r: CustomSolverResult) =>
  r.groups.map(g => [...g.eleveIds].sort().join(',')).sort();

describe('Solveur du mode personnalisé', () => {
  const eleves = Array.from({ length: 250 }, (_, i) => eleve(i));
  const profs = Array.from({ length: 16 }, (_, i) => prof(i));

  it('répartit 250 élèves en moins d\'une seconde', () => {
    const start = performance.now();
    const r = solveCustom(eleves, profs, scenario, config(eleves, profs));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(r.affectations).toHaveLength(250);
    expect(r.nonAffectes).toHaveLength(0);
  });

  it('donne le même résultat d\'un lancement à l\'autre, quel que soit l\'ordre des élèves', () => {
    const a = solveCustom(eleves, profs, scenario, config(eleves, profs));
    const b = solveCustom([...eleves].reverse(), profs, scenario, config(eleves, profs));
    expect(composition(b)).toEqual(composition(a));
  });

  it('respecte la taille des groupes', () => {
    const r = solveCustom(eleves, profs, scenario, config(eleves, profs, { tailleGroupeMin: 12, tailleGroupeMax: 14 }));
    for (const g of r.groups) {
      expect(g.eleveIds.length).toBeLessThanOrEqual(g.capaciteMax);
      expect(g.eleveIds.length).toBeGreaterThanOrEqual(12);
    }
    expect(new Set(r.affectations.map(a => a.eleveId)).size).toBe(250);
  });

  it('équilibre filles et garçons quand la parité est demandée', () => {
    const r = solveCustom(eleves, profs, scenario, config(eleves, profs, {
      critereEnseignantAEleve: 'off', critereMemeClasse: 'off', critereLV: 'off', critereParity: 'required',
    }));
    const parId = new Map(eleves.map(e => [e.id, e]));
    for (const g of r.groups) {
      const filles = g.eleveIds.filter(id => parId.get(id)!.sexe === 'F').length;
      const part = filles / g.eleveIds.length;
      // 2/3 de filles au total : chaque groupe doit en être proche.
      expect(Math.abs(part - 2 / 3)).toBeLessThan(0.1);
    }
  });

  it('garde chaque score entre 0 et 100', () => {
    const r = solveCustom(eleves, profs, scenario, config(eleves, profs));
    for (const a of r.affectations) {
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
    }
  });
});
