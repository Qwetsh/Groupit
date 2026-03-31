// ============================================================
// TESTS - SOLVEUR ORAL DNB (langue étrangère + groupes oraux)
// ============================================================

import { describe, it, expect } from 'vitest';
import { solveOralDnb, solveOralDnbComplete } from './solverDnb';
import type { Eleve, Enseignant, Jury, Scenario } from '../domain/models';

describe('Solveur Oral DNB', () => {
  // === HELPERS ===

  const createEleve = (id: string, overrides: Partial<Eleve> = {}): Eleve => ({
    id,
    nom: `Nom${id}`,
    prenom: `Prenom${id}`,
    classe: '3A',
    niveau: '3e',
    customFields: {},
    options: [],
    tags: [],
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
    classesEnCharge: ['3A'],
    estProfPrincipal: false,
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createJury = (id: string, scenarioId: string, enseignantIds: string[], overrides: Partial<Jury> = {}): Jury => ({
    id,
    scenarioId,
    nom: `Jury ${id}`,
    enseignantIds,
    capaciteMax: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
    id: 'scenario-1',
    nom: 'Test DNB',
    type: 'oral_dnb',
    parametres: {
      criteres: [],
      capaciteConfig: { capaciteBaseDefaut: 10 },
      oralDnb: {
        poidsMatiere: 70,
        criteresSecondaires: ['equilibrage'],
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // === TESTS LANGUE ÉTRANGÈRE ===

  describe('Scoring langue étrangère', () => {
    it('élève avec langue Anglais → affecté au jury avec prof d\'anglais', () => {
      const eleves = [
        createEleve('e1', { matieresOral: ['SVT'], langueEtrangere: 'Anglais' }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
        createEnseignant('ens2', { matierePrincipale: 'Anglais' }),
        createEnseignant('ens3', { matierePrincipale: 'Français' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1', 'ens3']),  // SVT + Français
        createJury('j2', scenario.id!, ['ens1', 'ens2']),  // SVT + Anglais
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(1);
      // Doit préférer j2 (SVT match + bonus langue anglais)
      expect(result.affectations[0].juryId).toBe('j2');
    });

    it('élève avec langue + aucun jury avec prof de cette langue → affecté quand même (fallback)', () => {
      const eleves = [
        createEleve('e1', { matieresOral: ['SVT'], langueEtrangere: 'Chinois' }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
        createEnseignant('ens2', { matierePrincipale: 'Français' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1', 'ens2']),
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(1);
      expect(result.nonAffectes).toHaveLength(0);
    });

    it('élève sans langue → scoring inchangé', () => {
      const eleves = [
        createEleve('e1', { matieresOral: ['SVT'] }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1']),
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(1);
      // Pas de scoreDetail.langue ou langue = 0
      const detail = result.affectations[0].scoreDetail;
      expect(detail['langue']).toBe(0);
    });

    it('2 élèves anglais + 1 seul jury anglais capacité 1 → 1 affecté là, l\'autre en fallback', () => {
      const eleves = [
        createEleve('e1', { matieresOral: ['SVT'], langueEtrangere: 'Anglais' }),
        createEleve('e2', { matieresOral: ['SVT'], langueEtrangere: 'Anglais' }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
        createEnseignant('ens2', { matierePrincipale: 'Anglais' }),
        createEnseignant('ens3', { matierePrincipale: 'Français' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1', 'ens2'], { capaciteMax: 1 }),  // SVT + Anglais, cap 1
        createJury('j2', scenario.id!, ['ens1', 'ens3'], { capaciteMax: 10 }), // SVT + Français
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(2);
      expect(result.nonAffectes).toHaveLength(0);

      // Un élève dans j1 (anglais), l'autre dans j2 (fallback)
      const inJ1 = result.affectations.filter(a => a.juryId === 'j1');
      const inJ2 = result.affectations.filter(a => a.juryId === 'j2');
      expect(inJ1).toHaveLength(1);
      expect(inJ2).toHaveLength(1);
    });
  });

  // === TESTS GROUPES ORAUX ===

  describe('Groupes oraux (binômes et trinômes)', () => {
    it('binôme (groupeOralId partagé) → même jury + 2 places consommées', () => {
      const groupId = 'group-1';
      const eleves = [
        createEleve('e1', { matieresOral: ['SVT'], groupeOralId: groupId }),
        createEleve('e2', { matieresOral: ['SVT'], groupeOralId: groupId }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1']),
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(2);
      // Les deux dans le même jury
      expect(result.affectations[0].juryId).toBe('j1');
      expect(result.affectations[1].juryId).toBe('j1');
    });

    it('trinôme (groupeOralId partagé) → même jury + 3 places consommées', () => {
      const groupId = 'group-tri';
      const eleves = [
        createEleve('e1', { matieresOral: ['Français'], groupeOralId: groupId }),
        createEleve('e2', { matieresOral: ['Français'], groupeOralId: groupId }),
        createEleve('e3', { matieresOral: ['Français'], groupeOralId: groupId }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'Français' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1']),
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(3);
      const juryIds = new Set(result.affectations.map(a => a.juryId));
      expect(juryIds.size).toBe(1); // Tous dans le même jury
    });

    it('groupe > capacité restante → tous les membres non affectés', () => {
      const groupId = 'group-big';
      const eleves = [
        createEleve('e1', { matieresOral: ['SVT'], groupeOralId: groupId }),
        createEleve('e2', { matieresOral: ['SVT'], groupeOralId: groupId }),
        createEleve('e3', { matieresOral: ['SVT'], groupeOralId: groupId }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1'], { capaciteMax: 2 }), // Cap 2 < groupe de 3
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      // Tous non affectés car le groupe entier ne rentre pas
      expect(result.affectations).toHaveLength(0);
      expect(result.nonAffectes).toHaveLength(3);
    });

    it('mix solos + binôme + trinôme → répartition correcte', () => {
      const eleves = [
        createEleve('solo1', { matieresOral: ['SVT'] }),
        createEleve('solo2', { matieresOral: ['Français'] }),
        createEleve('bin1', { matieresOral: ['SVT'], groupeOralId: 'g-bin' }),
        createEleve('bin2', { matieresOral: ['SVT'], groupeOralId: 'g-bin' }),
        createEleve('tri1', { matieresOral: ['Français'], groupeOralId: 'g-tri' }),
        createEleve('tri2', { matieresOral: ['Français'], groupeOralId: 'g-tri' }),
        createEleve('tri3', { matieresOral: ['Français'], groupeOralId: 'g-tri' }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
        createEnseignant('ens2', { matierePrincipale: 'Français' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1'], { capaciteMax: 10 }),
        createJury('j2', scenario.id!, ['ens2'], { capaciteMax: 10 }),
      ];

      const result = solveOralDnb(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(7);
      expect(result.nonAffectes).toHaveLength(0);

      // Binôme dans le même jury
      const bin1Jury = result.affectations.find(a => a.eleveId === 'bin1')!.juryId;
      const bin2Jury = result.affectations.find(a => a.eleveId === 'bin2')!.juryId;
      expect(bin1Jury).toBe(bin2Jury);

      // Trinôme dans le même jury
      const tri1Jury = result.affectations.find(a => a.eleveId === 'tri1')!.juryId;
      const tri2Jury = result.affectations.find(a => a.eleveId === 'tri2')!.juryId;
      const tri3Jury = result.affectations.find(a => a.eleveId === 'tri3')!.juryId;
      expect(tri1Jury).toBe(tri2Jury);
      expect(tri2Jury).toBe(tri3Jury);
    });
  });

  // === TESTS solveOralDnbComplete (greedy + swaps) ===

  describe('solveOralDnbComplete — swaps ne cassent pas les groupes', () => {
    it('binôme reste dans le même jury après amélioration par swaps', () => {
      // Scénario : binôme SVT dans jury Français, un solo Français dans jury SVT
      // Le swap voudrait échanger le solo mais NE DOIT PAS toucher au binôme
      const eleves = [
        createEleve('bin1', { matieresOral: ['SVT'], groupeOralId: 'g1' }),
        createEleve('bin2', { matieresOral: ['SVT'], groupeOralId: 'g1' }),
        createEleve('solo1', { matieresOral: ['Français'] }),
        createEleve('solo2', { matieresOral: ['SVT'] }),
        createEleve('solo3', { matieresOral: ['Français'] }),
        createEleve('solo4', { matieresOral: ['SVT'] }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
        createEnseignant('ens2', { matierePrincipale: 'Français' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1'], { capaciteMax: 10 }),
        createJury('j2', scenario.id!, ['ens2'], { capaciteMax: 10 }),
      ];

      const result = solveOralDnbComplete(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(6);

      // Le binôme DOIT rester dans le même jury après swaps
      const bin1Jury = result.affectations.find(a => a.eleveId === 'bin1')!.juryId;
      const bin2Jury = result.affectations.find(a => a.eleveId === 'bin2')!.juryId;
      expect(bin1Jury).toBe(bin2Jury);
    });

    it('trinôme reste dans le même jury après amélioration par swaps', () => {
      const eleves = [
        createEleve('tri1', { matieresOral: ['SVT'], groupeOralId: 'g-tri' }),
        createEleve('tri2', { matieresOral: ['SVT'], groupeOralId: 'g-tri' }),
        createEleve('tri3', { matieresOral: ['SVT'], groupeOralId: 'g-tri' }),
        createEleve('solo1', { matieresOral: ['Français'] }),
        createEleve('solo2', { matieresOral: ['SVT'] }),
      ];
      const enseignants = [
        createEnseignant('ens1', { matierePrincipale: 'SVT' }),
        createEnseignant('ens2', { matierePrincipale: 'Français' }),
      ];
      const scenario = createScenario();
      const jurys = [
        createJury('j1', scenario.id!, ['ens1'], { capaciteMax: 10 }),
        createJury('j2', scenario.id!, ['ens2'], { capaciteMax: 10 }),
      ];

      const result = solveOralDnbComplete(eleves, enseignants, jurys, scenario);

      expect(result.affectations).toHaveLength(5);

      // Trinôme doit rester ensemble
      const tri1Jury = result.affectations.find(a => a.eleveId === 'tri1')!.juryId;
      const tri2Jury = result.affectations.find(a => a.eleveId === 'tri2')!.juryId;
      const tri3Jury = result.affectations.find(a => a.eleveId === 'tri3')!.juryId;
      expect(tri1Jury).toBe(tri2Jury);
      expect(tri2Jury).toBe(tri3Jury);
    });
  });
});
