// ============================================================
// TESTS — Les stores ne divergent jamais de la base
// ============================================================
//
// IndexedDB est la source de vérité : après chaque action d'un store, ce que
// le store montre doit être exactement ce que la base contient (donc ce qui
// sera rechargé au prochain démarrage). Données fictives, vraie base Dexie.

import { describe, it, expect, beforeEach } from 'vitest';
import type { Table } from 'dexie';
import { db } from '../infrastructure/database/db';
import { useEleveStore } from './eleveStore';
import { useEnseignantStore } from './enseignantStore';
import { useAffectationStore } from './affectationStore';
import { useScenarioStore } from './scenarioStore';
import { useGroupeStore } from './groupeStore';
import { useJuryStore } from './juryStore';
import { useStageStore } from './stageStore';
import { useFieldDefinitionStore } from './fieldDefinitionStore';
import { fakeEleve, fakeEnseignant, resetDatabase } from '../test/fixtures';

const sortById = <T extends { id: string }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.id.localeCompare(b.id));
const ids = (rows: readonly { id: string }[]): string[] => rows.map(r => r.id);

/** Le store montre exactement le contenu de la table. */
async function expectInSync<T extends { id: string }>(storeRows: readonly T[], table: Table<T, string>): Promise<void> {
  expect(sortById(storeRows)).toEqual(sortById(await table.toArray()));
}

const eleves = () => useEleveStore.getState();
const enseignants = () => useEnseignantStore.getState();
const affectations = () => useAffectationStore.getState();
const scenarios = () => useScenarioStore.getState();
const groupes = () => useGroupeStore.getState();
const jurys = () => useJuryStore.getState();
const stages = () => useStageStore.getState();
const fields = () => useFieldDefinitionStore.getState();

beforeEach(async () => {
  await resetDatabase();
  useEleveStore.setState({ eleves: [], selectedEleveIds: [], error: null });
  useEnseignantStore.setState({ enseignants: [], selectedEnseignantIds: [], error: null });
  useAffectationStore.setState({ affectations: [], error: null });
  useScenarioStore.setState({ scenarios: [], currentScenarioId: null, error: null });
  useGroupeStore.setState({ groupes: [], error: null });
  useJuryStore.setState({ jurys: [], error: null });
  useStageStore.setState({ stages: [], error: null });
  useFieldDefinitionStore.setState({ fieldDefinitions: [], error: null });
});

describe('élèves', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const created = await eleves().addEleves(Array.from({ length: 6 }, (_, i) => fakeEleve(i)));
    await expectInSync(eleves().eleves, db.eleves);
    expect(created.every(e => e.createdAt instanceof Date)).toBe(true);

    const single = await eleves().addEleve(fakeEleve(6));
    await expectInSync(eleves().eleves, db.eleves);
    expect(single.createdAt).toBeInstanceOf(Date);

    await eleves().updateEleve(created[0].id, { sujetOral: 'Les volcans', parcoursOral: 'Parcours Avenir' });
    await expectInSync(eleves().eleves, db.eleves);
    expect(eleves().getEleveById(created[0].id)?.sujetOral).toBe('Les volcans');

    await eleves().updateClasseForMany([created[1].id, created[2].id], '3C');
    await expectInSync(eleves().eleves, db.eleves);

    await eleves().addContrainte(created[3].id, { type: 'doit_etre_avec', cibleType: 'eleve', cibleId: created[4].id });
    await expectInSync(eleves().eleves, db.eleves);
    await eleves().removeContrainte(created[3].id, created[4].id);
    await expectInSync(eleves().eleves, db.eleves);

    await eleves().deleteEleve(created[5].id);
    await eleves().deleteEleves([created[0].id, created[1].id]);
    await expectInSync(eleves().eleves, db.eleves);
    expect(eleves().eleves).toHaveLength(4);

    await eleves().deleteAllEleves();
    await expectInSync(eleves().eleves, db.eleves);
    expect(eleves().eleves).toEqual([]);
  });

  it('garde l’ordre d’affichage quand une fiche est modifiée', async () => {
    const created = await eleves().addEleves(Array.from({ length: 4 }, (_, i) => fakeEleve(i)));
    const before = ids(eleves().eleves);

    await eleves().updateEleve(created[1].id, { classe: '3D' });

    expect(ids(eleves().eleves)).toEqual(before);
  });

  it('retire de la sélection les élèves supprimés', async () => {
    const created = await eleves().addEleves(Array.from({ length: 3 }, (_, i) => fakeEleve(i)));
    eleves().selectAllEleves();

    await eleves().deleteEleves([created[0].id]);

    expect(eleves().selectedEleveIds).toEqual([created[1].id, created[2].id]);
  });

  it('groupes d’oral : la base et la vue disent la même chose, y compris quand un groupe se vide', async () => {
    const [a, b, c, d] = await eleves().addEleves(Array.from({ length: 4 }, (_, i) => fakeEleve(i)));

    await eleves().setGroupeOral([a.id, b.id, c.id]);
    await expectInSync(eleves().eleves, db.eleves);
    const trio = eleves().getEleveById(a.id)?.groupeOralId;
    expect(trio).toBeTruthy();
    expect(eleves().eleves.filter(e => e.groupeOralId === trio)).toHaveLength(3);

    // Deux membres du trio partent former un binôme avec d : le troisième
    // se retrouve seul, son groupe est dissous — en base comme à l'écran.
    await eleves().setGroupeOral([a.id, b.id, d.id]);
    await expectInSync(eleves().eleves, db.eleves);
    expect(eleves().getEleveById(c.id)?.groupeOralId).toBeUndefined();
    expect((await db.eleves.get(c.id))?.groupeOralId).toBeUndefined();

    // Un membre quitte un trio : il reste un binôme.
    await eleves().removeFromGroupeOral(d.id);
    await expectInSync(eleves().eleves, db.eleves);
    expect(eleves().getEleveById(a.id)?.groupeOralId).toBe(eleves().getEleveById(b.id)?.groupeOralId);

    // Un membre quitte un binôme : le groupe est dissous.
    await eleves().removeFromGroupeOral(a.id);
    await expectInSync(eleves().eleves, db.eleves);
    expect(eleves().eleves.some(e => e.groupeOralId)).toBe(false);
  });
});

describe('enseignants', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const created = await enseignants().addEnseignants(Array.from({ length: 4 }, (_, i) => fakeEnseignant(i)));
    await enseignants().addEnseignant(fakeEnseignant(4));
    await expectInSync(enseignants().enseignants, db.enseignants);

    await enseignants().updateEnseignant(created[0].id, { adresse: '3 rue Imaginaire', commune: 'Villefictive', lat: 49.1, lon: 6.1, geoStatus: 'ok' });
    await expectInSync(enseignants().enseignants, db.enseignants);

    enseignants().selectAllEnseignants();
    await enseignants().deleteEnseignant(created[1].id);
    await enseignants().deleteEnseignants([created[2].id]);
    await expectInSync(enseignants().enseignants, db.enseignants);
    expect(enseignants().selectedEnseignantIds).not.toContain(created[1].id);
    expect(enseignants().selectedEnseignantIds).not.toContain(created[2].id);

    await enseignants().deleteAllEnseignants();
    await expectInSync(enseignants().enseignants, db.enseignants);
  });
});

describe('affectations', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const make = (i: number, scenarioId: string) => ({
      eleveId: `eleve-${i}`, enseignantId: `ens-${i % 2}`, scenarioId, type: 'oral_dnb' as const, metadata: {},
    });
    const created = await affectations().addAffectations([make(0, 's1'), make(1, 's1'), make(2, 's2')]);
    const single = await affectations().addAffectation(make(3, 's2'));
    await expectInSync(affectations().affectations, db.affectations);

    await affectations().updateAffectation(created[0].id, { enseignantId: 'ens-9', scoreTotal: 87 });
    await affectations().updateMetadata(created[1].id, { salle: 'B12', heureCreneau: '09:20' });
    await expectInSync(affectations().affectations, db.affectations);

    await affectations().deleteAffectation(single.id);
    await expectInSync(affectations().affectations, db.affectations);

    await affectations().deleteAffectationsByScenario('s1');
    await expectInSync(affectations().affectations, db.affectations);
    expect(ids(affectations().affectations)).toEqual([created[2].id]);

    await affectations().deleteAllAffectations();
    await expectInSync(affectations().affectations, db.affectations);
  });
});

describe('scénarios', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const oral = await scenarios().createDefaultScenario('Oral fictif', 'oral_dnb');
    const stage = await scenarios().createDefaultScenario('Stages fictifs', 'suivi_stage');
    await expectInSync(scenarios().scenarios, db.scenarios);

    await scenarios().updateScenario(oral.id, { nom: 'Oral fictif (juin)' });
    await scenarios().updateParametres(stage.id, { distanceMaxKm: 42 });
    await expectInSync(scenarios().scenarios, db.scenarios);
    expect(scenarios().getScenarioById(stage.id)?.parametres.distanceMaxKm).toBe(42);

    const critere = scenarios().getScenarioById(oral.id)!.parametres.criteres[0];
    if (critere) {
      await scenarios().updateCritere(oral.id, critere.id, { actif: !critere.actif });
      await expectInSync(scenarios().scenarios, db.scenarios);
    }

    const copie = await scenarios().duplicateScenario(oral.id, 'Oral fictif (copie)');
    await expectInSync(scenarios().scenarios, db.scenarios);
    expect(copie?.nom).toBe('Oral fictif (copie)');
  });

  it('supprimer un scénario retire aussi ses affectations, groupes et jurys des vues', async () => {
    const garde = await scenarios().createDefaultScenario('À garder', 'oral_dnb');
    const supprime = await scenarios().createDefaultScenario('À supprimer', 'oral_dnb');
    scenarios().setCurrentScenario(supprime.id);
    for (const s of [garde, supprime]) {
      await affectations().addAffectation({ eleveId: 'e1', enseignantId: 'p1', scenarioId: s.id, type: 'oral_dnb', metadata: {} });
      await groupes().addGroupe({ scenarioId: s.id, nom: 'Groupe', eleveIds: [], enseignantIds: [] });
      await jurys().addJury({ scenarioId: s.id, nom: 'Jury 1', enseignantIds: ['p1'], capaciteMax: 8 });
    }

    await scenarios().deleteScenario(supprime.id);

    await expectInSync(scenarios().scenarios, db.scenarios);
    await expectInSync(affectations().affectations, db.affectations);
    await expectInSync(groupes().groupes, db.groupes);
    await expectInSync(jurys().jurys, db.jurys);
    expect(affectations().affectations.every(a => a.scenarioId === garde.id)).toBe(true);
    expect(jurys().jurys).toHaveLength(1);
    expect(scenarios().currentScenarioId).toBe(garde.id);
  });
});

describe('groupes', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const g1 = await groupes().addGroupe({ scenarioId: 's1', nom: 'Groupe 1', eleveIds: [], enseignantIds: [] });
    const g2 = await groupes().addGroupe({ scenarioId: 's1', nom: 'Groupe 2', eleveIds: [], enseignantIds: [] });
    const g3 = await groupes().addGroupe({ scenarioId: 's2', nom: 'Autre scénario', eleveIds: [], enseignantIds: [] });
    await expectInSync(groupes().groupes, db.groupes);

    await groupes().addEleveToGroupe(g1.id, 'e1');
    await groupes().addEleveToGroupe(g1.id, 'e1'); // deux fois : pas de doublon
    await groupes().addEleveToGroupe(g1.id, 'e2');
    await groupes().addEnseignantToGroupe(g1.id, 'p1');
    await expectInSync(groupes().groupes, db.groupes);
    expect(groupes().getGroupeById(g1.id)?.eleveIds).toEqual(['e1', 'e2']);

    await groupes().moveEleveBetweenGroupes('e2', g1.id, g2.id);
    await groupes().removeEleveFromGroupe(g1.id, 'e1');
    await groupes().removeEnseignantFromGroupe(g1.id, 'p1');
    await groupes().updateGroupe(g2.id, { nom: 'Groupe 2 bis' });
    await expectInSync(groupes().groupes, db.groupes);

    await groupes().deleteGroupesByScenario('s1');
    await expectInSync(groupes().groupes, db.groupes);
    expect(ids(groupes().groupes)).toEqual([g3.id]);

    await groupes().deleteGroupe(g3.id);
    await expectInSync(groupes().groupes, db.groupes);
  });
});

describe('jurys', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const j1 = await jurys().addJury({ scenarioId: 's1', nom: 'Jury 1', enseignantIds: ['p1'], suppleantsIds: ['p3'], capaciteMax: 8 });
    const j2 = await jurys().addJury({ scenarioId: 's1', nom: 'Jury 2', enseignantIds: [], capaciteMax: 8 });
    await expectInSync(jurys().jurys, db.jurys);

    await jurys().addEnseignantToJury(j1, 'p2');
    await jurys().moveEnseignantBetweenJurys('p1', j1, j2); // titulaire
    await jurys().moveEnseignantBetweenJurys('p3', j1, j2); // suppléant, devient titulaire
    await expectInSync(jurys().jurys, db.jurys);
    expect(jurys().getJuryById(j2)?.enseignantIds).toEqual(['p1', 'p3']);
    expect(jurys().getJuryById(j1)?.suppleantsIds).toEqual([]);

    await jurys().removeEnseignantFromJury(j1, 'p2');
    await jurys().updateJury(j1, { salle: 'A04' });
    await jurys().updateJuryStats(j2, { nbElevesAffectes: 3, tauxRemplissage: 37.5, repartitionMatieres: { SVT: 2, Français: 1 }, matieresEnseignants: ['SVT'] });
    await expectInSync(jurys().jurys, db.jurys);

    await jurys().deleteJury(j1);
    await expectInSync(jurys().jurys, db.jurys);
  });

  it('la génération automatique remplace les jurys du scénario, en base comme dans la vue', async () => {
    const scenario = await scenarios().createDefaultScenario('Oral fictif', 'oral_dnb');
    const profs = await enseignants().addEnseignants(Array.from({ length: 6 }, (_, i) => fakeEnseignant(i)));
    await jurys().addJury({ scenarioId: scenario.id, nom: 'Ancien jury', enseignantIds: [profs[0].id], capaciteMax: 8 });
    const autre = await jurys().addJury({ scenarioId: 'autre-scenario', nom: 'Jury d’un autre scénario', enseignantIds: [], capaciteMax: 8 });

    await jurys().generateJurysAuto(scenario, profs, { nbJurys: 3, enseignantsParJury: 2 });

    await expectInSync(jurys().jurys, db.jurys);
    const generes = jurys().getJurysByScenario(scenario.id);
    expect(generes.map(j => j.nom)).toEqual(['Jury 1', 'Jury 2', 'Jury 3']);
    expect(jurys().getJuryById(autre)).toBeDefined();

    await jurys().clearJurysByScenario(scenario.id);
    await expectInSync(jurys().jurys, db.jurys);
    expect(ids(jurys().jurys)).toEqual([autre]);
  });
});

describe('stages', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const s1 = await stages().addStage({ eleveId: 'e1', nomEntreprise: 'Boulangerie fictive', adresse: '1 place Inventée' });
    await stages().bulkAddStages([
      { eleveId: 'e2', adresse: '2 place Inventée', scenarioId: 'sc1' },
      { eleveId: 'e3', adresse: '3 place Inventée', scenarioId: 'sc1' },
    ]);
    await expectInSync(stages().stages, db.stages);

    await stages().updateStage(s1.id, { tuteur: 'Mme Fictive' });
    await stages().updateStageGeo(s1.id, 49.12, 6.17, 'ok');
    await expectInSync(stages().stages, db.stages);
    await stages().setStageGeoError(s1.id, 'Adresse introuvable');
    await stages().updateStageGeoExtended(s1.id, 49.1, 6.2, 'ok', 'OK_CITY_FALLBACK', 'CITY', 'Villefictive');
    await expectInSync(stages().stages, db.stages);
    expect(stages().stages.find(s => s.id === s1.id)?.geoErrorMessage).toBeUndefined();

    const upserted = await stages().upsertStageForEleve('e1', { nomEntreprise: 'Librairie fictive' });
    expect(upserted.id).toBe(s1.id);
    const fresh = await stages().upsertStageForEleve('e9', { adresse: '9 place Inventée' });
    expect(fresh.geoStatus).toBe('pending');
    await expectInSync(stages().stages, db.stages);

    await stages().clearStagesByScenario('sc1');
    await expectInSync(stages().stages, db.stages);

    await stages().deleteStageByEleveId('e9');
    await stages().deleteStage(s1.id);
    await expectInSync(stages().stages, db.stages);
    expect(stages().stages).toEqual([]);
  });

  it('import en masse : met à jour l’existant, crée le reste, et les place en fin de liste', async () => {
    const a = await stages().addStage({ eleveId: 'e1', adresse: '1 place Inventée' });
    const b = await stages().addStage({ eleveId: 'e2', adresse: '2 place Inventée' });

    const result = await stages().bulkUpsertStagesForEleves([
      { eleveId: 'e1', adresse: '10 place Inventée' },
      { eleveId: 'e3', adresse: '3 place Inventée' },
    ]);

    expect(result).toEqual({ updated: 1, created: 1 });
    await expectInSync(stages().stages, db.stages);
    expect(stages().stages.map(s => s.eleveId)).toEqual(['e2', 'e1', 'e3']);
    expect(stages().stages.find(s => s.id === a.id)?.adresse).toBe('10 place Inventée');
    expect(stages().stages[0].id).toBe(b.id);
  });
});

describe('champs personnalisés', () => {
  it('reste aligné sur la base après chaque écriture', async () => {
    const f1 = await fields().addFieldDefinition({ entityType: 'eleve', label: 'Régime alimentaire', type: 'text' });
    const f2 = await fields().addFieldDefinition({ entityType: 'eleve', label: 'Transport', type: 'text' });
    const f3 = await fields().addFieldDefinition({ entityType: 'enseignant', label: 'Salle habituelle', type: 'text' });
    await expectInSync(fields().fieldDefinitions, db.fieldDefinitions);

    await fields().updateFieldDefinition(f1.id, { label: 'Régime' });
    await fields().reorderFieldDefinitions([f3.id, f1.id, f2.id]);
    await expectInSync(fields().fieldDefinitions, db.fieldDefinitions);
    expect(ids(fields().fieldDefinitions)).toEqual([f3.id, f1.id, f2.id]);

    await fields().deleteFieldDefinition(f2.id);
    await expectInSync(fields().fieldDefinitions, db.fieldDefinitions);
  });
});
