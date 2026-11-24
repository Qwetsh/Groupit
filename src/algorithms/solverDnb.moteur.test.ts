// ============================================================
// TESTS - MOTEUR ORAL DNB : propriétés attendues
// ============================================================
//
// Ces tests décrivent ce que le moteur doit garantir, quel que soit
// l'algorithme : résultat optimal sur la correspondance des matières,
// indépendant de l'ordre de saisie, reproductible, scores bornés, et
// défauts signalés plutôt que passés sous silence.

import { describe, it, expect } from 'vitest';
import { solveOralDnbComplete } from './solverDnb';
import { MinCostFlow } from './minCostFlow';
import type { Eleve, Enseignant, Jury, Scenario, SolverResultDNB } from '../domain/models';

// === Fabriques de données fictives ===

const eleve = (id: string, overrides: Partial<Eleve> = {}): Eleve => ({
  id,
  nom: `Nom${id}`,
  prenom: `Prenom${id}`,
  classe: '3A',
  customFields: {},
  options: [],
  tags: [],
  contraintes: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const prof = (id: string, matierePrincipale: string, overrides: Partial<Enseignant> = {}): Enseignant => ({
  id,
  nom: `Prof${id}`,
  prenom: `Prenom${id}`,
  matierePrincipale,
  classesEnCharge: [],
  estProfPrincipal: false,
  tags: [],
  customFields: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const jury = (id: string, enseignantIds: string[], capaciteMax: number): Jury => ({
  id,
  scenarioId: 'sc',
  nom: `Jury ${id}`,
  enseignantIds,
  capaciteMax,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

const scenario = (): Scenario => ({
  id: 'sc',
  nom: 'Oral fictif',
  type: 'oral_dnb',
  parametres: {
    criteres: [],
    capaciteConfig: { capaciteBaseDefaut: 15 },
    oralDnb: { poidsMatiere: 50, criteresSecondaires: ['equilibrage'] },
  },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}) as unknown as Scenario;

/** Élève → jury, trié : pour comparer deux résultats indépendamment de l'ordre. */
const assignment = (r: SolverResultDNB): string[] =>
  r.affectations.map(a => `${a.eleveId}->${a.juryId}`).sort();

const juryOf = (r: SolverResultDNB, eleveId: string) =>
  r.affectations.find(a => a.eleveId === eleveId)?.juryId;

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
}

// ============================================================

describe('Moteur oral DNB — optimalité et ordre de saisie', () => {
  // s1 peut passer devant J1 (SVT) ou J2 (Maths) ; s2 seulement devant J1.
  // Un placement glouton qui met s1 en J1 prive s2 de sa matière.
  const profs = [prof('pSVT', 'SVT'), prof('pMath', 'Mathématiques')];
  const jurys = [jury('J1', ['pSVT'], 1), jury('J2', ['pMath'], 1)];
  const eleves = [
    eleve('s1', { matieresOral: ['SVT', 'Mathématiques'] }),
    eleve('s2', { matieresOral: ['SVT'] }),
  ];

  it('trouve la répartition qui donne sa matière à chaque élève, quel que soit l\'ordre', () => {
    const results = permutations(jurys).flatMap(js =>
      permutations(eleves).map(es => solveOralDnbComplete(es, profs, js, scenario())));

    for (const r of results) {
      expect(r.tauxMatchMatiere).toBe(100);
      expect(juryOf(r, 's2')).toBe('J1');
      expect(juryOf(r, 's1')).toBe('J2');
    }
  });

  it('chaîne de déplacements : libère une place en déplaçant un élève qui a une autre option', () => {
    // J1 (SVT) a 2 places, J2 (Maths) 1 place, J3 (Français) 2 places.
    // a et b ne vont qu'en J1 ; c va en J1 ou J2 ; d va en J2 ou J3.
    const ps = [prof('p1', 'SVT'), prof('p2', 'Mathématiques'), prof('p3', 'Français')];
    const js = [jury('J1', ['p1'], 2), jury('J2', ['p2'], 1), jury('J3', ['p3'], 2)];
    const es = [
      eleve('c', { matieresOral: ['SVT', 'Mathématiques'] }),
      eleve('d', { matieresOral: ['Mathématiques', 'Français'] }),
      eleve('a', { matieresOral: ['SVT'] }),
      eleve('b', { matieresOral: ['SVT'] }),
    ];
    const r = solveOralDnbComplete(es, ps, js, scenario());
    expect(r.tauxMatchMatiere).toBe(100);
    expect(juryOf(r, 'a')).toBe('J1');
    expect(juryOf(r, 'b')).toBe('J1');
    expect(juryOf(r, 'c')).toBe('J2');
    expect(juryOf(r, 'd')).toBe('J3');
  });

  it('place un binôme et un élève seul pour que tous aient leur matière', () => {
    const ps = [prof('p1', 'SVT'), prof('p2', 'Mathématiques')];
    const js = [jury('J1', ['p1'], 2), jury('J2', ['p2'], 3)];
    const es = [
      eleve('s3', { matieresOral: ['SVT', 'Mathématiques'] }),
      eleve('b1', { matieresOral: ['SVT'], groupeOralId: 'G' }),
      eleve('b2', { matieresOral: ['SVT'], groupeOralId: 'G' }),
    ];
    for (const order of permutations(es)) {
      const r = solveOralDnbComplete(order, ps, js, scenario());
      expect(r.tauxMatchMatiere).toBe(100);
      expect(juryOf(r, 'b1')).toBe('J1');
      expect(juryOf(r, 'b2')).toBe('J1');
      expect(juryOf(r, 's3')).toBe('J2');
    }
  });

  it('donne exactement le même résultat d\'un lancement à l\'autre', () => {
    const ps = Array.from({ length: 8 }, (_, i) =>
      prof(`p${i}`, ['SVT', 'Mathématiques', 'Français', 'Anglais'][i % 4]));
    const js = Array.from({ length: 4 }, (_, i) => jury(`J${i}`, [`p${2 * i}`, `p${2 * i + 1}`], 10));
    const es = Array.from({ length: 36 }, (_, i) => eleve(`e${i}`, {
      matieresOral: [['SVT', 'Mathématiques', 'Français', 'Histoire-Géographie'][i % 4]],
      sexe: i % 2 ? 'F' : 'M',
    }));
    const a = solveOralDnbComplete(es, ps, js, scenario());
    const b = solveOralDnbComplete([...es].reverse(), ps, [...js].reverse(), scenario());
    expect(assignment(b)).toEqual(assignment(a));
  });
});

describe('Moteur oral DNB — matières écrites différemment', () => {
  it.each([
    ['Arts plastiques', 'Arts Plastiques'],
    ['SVT ', 'SVT'],
    ['Mathematiques', 'Mathématiques'],
    ['Maths', 'Mathématiques'],
    ['Histoire-Géo', 'Histoire-Géographie'],
    ['Physique Chimie', 'Physique-Chimie'],
    ['Musique', 'Éducation Musicale'],
  ])('enseignant « %s » reconnu pour un élève « %s »', (matiereProf, matiereEleve) => {
    const r = solveOralDnbComplete(
      [eleve('e', { matieresOral: [matiereEleve] })],
      [prof('p', matiereProf), prof('q', 'Technologie')],
      [jury('Jautre', ['q'], 5), jury('J', ['p'], 5)],
      scenario());
    expect(juryOf(r, 'e')).toBe('J');
    expect(r.affectations[0].matiereMatch).toBe(true);
  });

  it('reconnaît la langue étrangère quelle que soit la casse', () => {
    const r = solveOralDnbComplete(
      [eleve('e', { langueEtrangere: 'Anglais' })],
      [prof('p', 'anglais'), prof('q', 'Technologie')],
      [jury('Jautre', ['q'], 5), jury('J', ['p'], 5)],
      scenario());
    expect(juryOf(r, 'e')).toBe('J');
  });
});

describe('Moteur oral DNB — scores et signalements', () => {
  it('garde chaque score entre 0 et 100', () => {
    const r = solveOralDnbComplete(
      [eleve('e', { matieresOral: ['Anglais'], langueEtrangere: 'Anglais', tiersTemps: true, sexe: 'F' })],
      [prof('p', 'Anglais')],
      [jury('J', ['p'], 5)],
      scenario());
    const a = r.affectations[0];
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.explication.score).toBeLessThanOrEqual(100);
    for (const v of Object.values(a.scoreDetail)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(r.scoreGlobal).toBeLessThanOrEqual(100);
  });

  it('équilibre les jurys quand rien d\'autre ne départage', () => {
    const es = Array.from({ length: 20 }, (_, i) => eleve(`e${i}`));
    const r = solveOralDnbComplete(es, [prof('p', 'SVT'), prof('q', 'SVT')],
      [jury('J1', ['p'], 15), jury('J2', ['q'], 15)], scenario());
    expect(r.statsParJury.J1.nbElevesAffectes).toBe(10);
    expect(r.statsParJury.J2.nbElevesAffectes).toBe(10);
  });

  it('ne compte pas comme « sans correspondance » un élève sans matière renseignée', () => {
    const r = solveOralDnbComplete(
      [eleve('sansMatiere'), eleve('svt', { matieresOral: ['SVT'] })],
      [prof('p', 'Mathématiques')], [jury('J', ['p'], 5)], scenario());
    expect(r.sansMatchMatiere).toEqual(['svt']);
  });

  it('signale les élèves non affectés faute de place', () => {
    const es = Array.from({ length: 5 }, (_, i) => eleve(`e${i}`));
    const r = solveOralDnbComplete(es, [prof('p', 'SVT')], [jury('J', ['p'], 3)], scenario());
    expect(r.nonAffectes).toHaveLength(2);
    expect(r.alertes?.some(a => a.type === 'capacite_insuffisante')).toBe(true);
  });

  it('signale une matière demandée qu\'aucun jury ne couvre', () => {
    const r = solveOralDnbComplete(
      [eleve('e1', { matieresOral: ['Latin'] }), eleve('e2', { matieresOral: ['Latin'] })],
      [prof('p', 'SVT')], [jury('J', ['p'], 5)], scenario());
    const alerte = r.alertes?.find(a => a.type === 'matiere_non_couverte');
    expect(alerte).toBeDefined();
    expect(alerte?.message).toContain('Latin');
  });
});

/**
 * Nombre minimal d'élèves privés de leur matière, calculé indépendamment du
 * moteur par un flot élève par élève (les binômes de ce jeu partagent leurs
 * matières : la contrainte « passer ensemble » ne change pas l'optimum).
 */
function minimumSansMatiere(eleves: Eleve[], jurys: Jury[], profs: Enseignant[]): number {
  const matiereProf = new Map(profs.map(p => [p.id, p.matierePrincipale]));
  const S = eleves.length, J = jurys.length, source = 0, puits = S + J + 1;
  const g = new MinCostFlow(S + J + 2);
  eleves.forEach((e, s) => {
    g.addEdge(source, 1 + s, 1, 0);
    jurys.forEach((j, k) => {
      const couvert = (e.matieresOral ?? []).some(m => j.enseignantIds.some(id => matiereProf.get(id) === m));
      g.addEdge(1 + s, 1 + S + k, 1, couvert ? 0 : 1);
    });
  });
  jurys.forEach((j, k) => g.addEdge(1 + S + k, puits, j.capaciteMax, 0));
  return g.run(source, puits).cost;
}

describe('Moteur oral DNB — volume', () => {
  it('répartit 250 élèves entre 17 jurys en moins de 2 secondes, au mieux possible', () => {
    const matieres = ['SVT', 'Mathématiques', 'Français', 'Histoire-Géographie', 'Anglais',
      'Physique-Chimie', 'Technologie', 'Arts Plastiques', 'EPS', 'Espagnol'];
    const ps = Array.from({ length: 34 }, (_, i) => prof(`p${i}`, matieres[i % matieres.length],
      { classesEnCharge: [`3${'ABCDEFGH'[i % 8]}`] }));
    const js = Array.from({ length: 17 }, (_, i) => jury(`J${String(i).padStart(2, '0')}`, [`p${2 * i}`, `p${2 * i + 1}`], 15));
    // Les deux membres d'un binôme (e0+e1, e25+e26…) préparent le même sujet.
    const sujet = (i: number) => (i % 25 === 1 ? i - 1 : i);
    const es = Array.from({ length: 250 }, (_, i) => eleve(`e${i}`, {
      classe: `3${'ABCDEFGH'[i % 8]}`,
      sexe: i % 3 ? 'F' : 'M',
      tiersTemps: i % 11 === 0,
      matieresOral: [matieres[(sujet(i) * 7) % matieres.length], matieres[(sujet(i) * 3 + 1) % matieres.length]],
      langueEtrangere: i % 5 === 0 ? 'Anglais' : undefined,
      groupeOralId: i % 25 === 0 ? `G${i}` : i % 25 === 1 ? `G${i - 1}` : undefined,
    }));

    const start = performance.now();
    const r = solveOralDnbComplete(es, ps, js, scenario());
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(r.affectations).toHaveLength(250);
    expect(r.sansMatchMatiere).toHaveLength(minimumSansMatiere(es, js, ps));
    // Les binômes restent ensemble.
    for (let g = 0; g < 250; g += 25) {
      expect(juryOf(r, `e${g}`)).toBe(juryOf(r, `e${g + 1}`));
    }
    // Aucun jury ne dépasse sa capacité.
    for (const stats of Object.values(r.statsParJury)) {
      expect(stats.nbElevesAffectes).toBeLessThanOrEqual(15);
    }
  });
});
