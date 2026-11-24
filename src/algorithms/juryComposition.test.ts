import { describe, it, expect } from 'vitest';
import { composerJurys } from './juryComposition';
import { solveOralDnbComplete } from './solverDnb';
import type { Jury, Scenario } from '../domain/models';
import type { Eleve, Enseignant } from '../domain/models';

const d = new Date('2026-01-01');

const prof = (id: string, matierePrincipale: string, indisponibilites: string[] = []): Enseignant => ({
  id,
  nom: `Nom${id}`,
  prenom: `Prenom${id}`,
  matierePrincipale,
  classesEnCharge: [],
  estProfPrincipal: false,
  indisponibilites,
  tags: [],
  customFields: {},
  createdAt: d,
  updatedAt: d,
});

const eleves = (n: number, matiere: string): Eleve[] => Array.from({ length: n }, (_, i) => ({
  id: `${matiere}${i}`,
  nom: 'N',
  prenom: 'P',
  classe: '3A',
  matieresOral: [matiere],
  customFields: {},
  options: [],
  tags: [],
  contraintes: [],
  createdAt: d,
  updatedAt: d,
}) as Eleve);

const matieresDesJurys = (r: ReturnType<typeof composerJurys>, profs: Enseignant[]) => {
  const parId = new Map(profs.map(p => [p.id, p.matierePrincipale]));
  return r.jurys.map(j => j.enseignantIds.map(id => parId.get(id)).sort());
};

describe('Composition automatique des jurys', () => {
  const profs = [
    prof('f1', 'Français'), prof('f2', 'Français'),
    prof('s1', 'SVT'), prof('s2', 'SVT'),
    prof('m1', 'Mathématiques'), prof('m2', 'Mathématiques'),
  ];

  it('fait siéger les matières choisies par les élèves', () => {
    const r = composerJurys(profs, {
      nbJurys: 2, enseignantsParJury: 2,
      eleves: [...eleves(15, 'SVT'), ...eleves(15, 'Mathématiques')],
    });
    // Personne n'a choisi le français : les quatre sièges vont à SVT et aux maths,
    // une matière de chaque par jury.
    expect(matieresDesJurys(r, profs)).toEqual([
      ['Mathématiques', 'SVT'],
      ['Mathématiques', 'SVT'],
    ]);
  });

  it('donne plus de sièges aux matières les plus demandées', () => {
    const r = composerJurys(profs, {
      nbJurys: 3, enseignantsParJury: 1,
      eleves: [...eleves(20, 'SVT'), ...eleves(10, 'Mathématiques'), ...eleves(1, 'Français')],
    });
    const sieges = matieresDesJurys(r, profs).flat();
    expect(sieges.filter(m => m === 'SVT')).toHaveLength(2);
    expect(sieges.filter(m => m === 'Mathématiques')).toHaveLength(1);
  });

  it('écarte un enseignant indisponible sur toutes les demi-journées de l\'oral', () => {
    const ps = [prof('a', 'SVT', ['jeudi_matin']), prof('b', 'Mathématiques'), prof('c', 'Français')];
    const r = composerJurys(ps, { nbJurys: 1, enseignantsParJury: 2, demiJournees: ['jeudi_matin'] });
    expect(r.indisponibles).toEqual(['a']);
    expect(r.jurys[0].enseignantIds).not.toContain('a');
    expect(r.jurys[0].enseignantIds).toHaveLength(2);
  });

  it('réunit dans un jury des enseignants disponibles en même temps', () => {
    const ps = [
      prof('matin1', 'SVT', ['jeudi_aprem']), prof('matin2', 'Français', ['jeudi_aprem']),
      prof('aprem1', 'Mathématiques', ['jeudi_matin']), prof('aprem2', 'Anglais', ['jeudi_matin']),
    ];
    const r = composerJurys(ps, { nbJurys: 2, enseignantsParJury: 2, demiJournees: ['jeudi_matin', 'jeudi_aprem'] });
    const groupes = r.jurys.map(j => j.enseignantIds.sort().join('+')).sort();
    expect(groupes).toEqual(['aprem1+aprem2', 'matin1+matin2']);
  });

  it('ne dépend pas de l\'ordre de la liste des enseignants', () => {
    const options = { nbJurys: 3, enseignantsParJury: 2, eleves: [...eleves(9, 'SVT'), ...eleves(6, 'Français')] };
    const a = composerJurys(profs, options);
    const b = composerJurys([...profs].reverse(), options);
    expect(b).toEqual(a);
  });

  it('sans matières côté élèves, diversifie les jurys', () => {
    const r = composerJurys(profs, { nbJurys: 3, enseignantsParJury: 2 });
    for (const matieres of matieresDesJurys(r, profs)) {
      expect(new Set(matieres).size).toBe(2);
    }
  });

  it('répartit les enseignants restants comme suppléants', () => {
    const r = composerJurys(profs, { nbJurys: 2, enseignantsParJury: 2, suppleantsParJury: 1 });
    expect(r.jurys.flatMap(j => j.suppleantsIds)).toHaveLength(2);
    const tous = r.jurys.flatMap(j => [...j.enseignantIds, ...j.suppleantsIds]);
    expect(new Set(tous).size).toBe(6);
  });

  it("compose des jurys où chaque élève peut avoir sa matière quand c'est possible", () => {
    // 6 matières × 10 élèves, 4 jurys de 2 titulaires et 15 places.
    // Deux matières auront 2 sièges : les mettre ensemble priverait 5 élèves
    // de leur matière ; les associer chacune à une matière à 1 siège donne 100 %.
    const matieres = ['SVT', 'Mathématiques', 'Français', 'Histoire-Géographie', 'Anglais', 'Physique-Chimie'];
    const ps = matieres.flatMap((m, i) => [prof(`a${i}`, m), prof(`b${i}`, m)]);
    const es = matieres.flatMap(m => eleves(10, m));
    const r = composerJurys(ps, { nbJurys: 4, enseignantsParJury: 2, eleves: es });
    const jurys: Jury[] = r.jurys.map(j => ({
      id: `J${j.juryIndex}`, scenarioId: 'sc', nom: `Jury ${j.juryIndex + 1}`,
      enseignantIds: j.enseignantIds, capaciteMax: 15, createdAt: d, updatedAt: d,
    }));
    const scenario = { id: 'sc', type: 'oral_dnb', parametres: { criteres: [] } } as unknown as Scenario;
    const resultat = solveOralDnbComplete(es, ps, jurys, scenario);
    expect(resultat.tauxMatchMatiere).toBe(100);
  });
});
