import { describe, it, expect } from 'vitest';
import { runOralDnbSolver, runCustomSolver } from './solverRunner';
import { solveOralDnbComplete } from './solverDnb';
import { DEFAULT_CUSTOM_CONFIG } from '../stores/uiStore';
import type { Eleve, Enseignant, Jury, Scenario } from '../domain/models';

const d = new Date('2026-01-01');
const eleves = Array.from({ length: 6 }, (_, i) => ({
  id: `e${i}`, nom: `N${i}`, prenom: 'P', classe: '3A', sexe: i % 2 ? 'F' : 'M', matieresOral: ['SVT'],
  options: [], tags: [], contraintes: [], customFields: {}, createdAt: d, updatedAt: d,
}) as unknown as Eleve);
const profs = [{ id: 'p', nom: 'P', prenom: 'Q', matierePrincipale: 'SVT', classesEnCharge: [], estProfPrincipal: false, tags: [], createdAt: d, updatedAt: d } as unknown as Enseignant];
const jurys = [{ id: 'J', scenarioId: 'sc', nom: 'Jury', enseignantIds: ['p'], capaciteMax: 10, createdAt: d, updatedAt: d } as Jury];
const scenario = { id: 'sc', type: 'oral_dnb', parametres: { criteres: [] } } as unknown as Scenario;

describe('Lancement des solveurs', () => {
  it('sans worker, calcule directement et donne le même résultat', async () => {
    const r = await runOralDnbSolver(eleves, profs, jurys, scenario);
    const direct = solveOralDnbComplete(eleves, profs, jurys, scenario);
    expect(r.affectations.map(a => a.juryId)).toEqual(direct.affectations.map(a => a.juryId));
  });

  it('lance aussi le mode personnalisé', async () => {
    const r = await runCustomSolver(eleves, profs, scenario, {
      ...DEFAULT_CUSTOM_CONFIG, selectedEleveIds: eleves.map(e => e.id), tailleGroupeMin: 3, tailleGroupeMax: 3, tailleGroupeFixe: true,
    });
    expect(r.groups).toHaveLength(2);
    expect(r.affectations).toHaveLength(6);
  });
});
