// ============================================================
// TESTS — Les données existantes survivent au passage à la source unique
// ============================================================
//
// Avant : élèves et enseignants vivaient en trois exemplaires (IndexedDB,
// store, copie localStorage relue quand la base était vide).
// Après : IndexedDB seule. Ces tests rejouent les états dans lesquels un
// utilisateur peut se trouver au moment de la mise à jour, avec la vraie base
// Dexie (IndexedDB en mémoire) et des données fictives.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './db';
import { migrateLegacyBackups, LEGACY_BACKUP_KEYS } from './legacyBackupMigration';
import { useEleveStore } from '../../stores/eleveStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { fakeEleve, fakeEnseignant, resetDatabase, MemoryStorage } from '../../test/fixtures';
import type { Eleve, Enseignant } from '../../domain/models';

const CREATED = '2026-03-10T08:30:00.000Z';
const UPDATED = '2026-05-02T16:45:00.000Z';

/** Des élèves tels que l'ancienne version les sérialisait dans localStorage. */
function legacyEleves(count: number): Eleve[] {
  return Array.from({ length: count }, (_, i) => ({
    ...fakeEleve(i, { sujetOral: `Sujet ${i}`, groupeOralId: i < 2 ? 'groupe-fictif' : undefined }),
    id: `eleve-${i}`,
    createdAt: new Date(CREATED),
    updatedAt: new Date(UPDATED),
  }));
}

function legacyEnseignants(count: number): Enseignant[] {
  return Array.from({ length: count }, (_, i) => ({
    ...fakeEnseignant(i, { adresse: `${i + 1} rue Imaginaire`, commune: 'Villefictive', lat: 49 + i / 100, lon: 6 }),
    id: `ens-${i}`,
    createdAt: new Date(CREATED),
    updatedAt: new Date(UPDATED),
  }));
}

function storageWith(eleves?: Eleve[], enseignants?: Enseignant[]): MemoryStorage {
  const storage = new MemoryStorage();
  if (eleves) storage.setItem(LEGACY_BACKUP_KEYS.eleves, JSON.stringify(eleves));
  if (enseignants) storage.setItem(LEGACY_BACKUP_KEYS.enseignants, JSON.stringify(enseignants));
  return storage;
}

const sortById = <T extends { id: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.id.localeCompare(b.id));

beforeEach(async () => {
  await resetDatabase();
  useEleveStore.setState({ eleves: [], selectedEleveIds: [], error: null });
  useEnseignantStore.setState({ enseignants: [], selectedEnseignantIds: [], error: null });
});

describe('utilisateur dont les données ne sont plus que dans la copie localStorage', () => {
  it('retrouve tous ses élèves et enseignants en base, à l’identique', async () => {
    const eleves = legacyEleves(6);
    const enseignants = legacyEnseignants(4);
    const storage = storageWith(eleves, enseignants);

    const report = await migrateLegacyBackups(storage);

    expect(report).toEqual({ eleves: 'restauree', enseignants: 'restauree' });
    expect(sortById(await db.eleves.toArray())).toEqual(sortById(eleves));
    expect(sortById(await db.enseignants.toArray())).toEqual(sortById(enseignants));
  });

  it('rend des dates utilisables, pas des chaînes', async () => {
    await migrateLegacyBackups(storageWith(legacyEleves(1), legacyEnseignants(1)));

    const eleve = await db.eleves.get('eleve-0');
    expect(eleve?.createdAt).toBeInstanceOf(Date);
    expect(eleve?.createdAt.toISOString()).toBe(CREATED);
    expect(eleve?.updatedAt.toISOString()).toBe(UPDATED);
  });

  it('garde les identifiants : affectations, stages et jurys pointent toujours sur les bonnes personnes', async () => {
    const now = new Date();
    await db.affectations.add({
      id: 'aff-1', eleveId: 'eleve-2', enseignantId: 'ens-1', scenarioId: 'scenario-1',
      type: 'suivi_stage', metadata: {}, createdAt: now, updatedAt: now,
    });
    await db.stages.add({ id: 'stage-1', eleveId: 'eleve-2', adresse: '5 avenue Inventée', createdAt: now, updatedAt: now });
    await db.jurys.add({
      id: 'jury-1', scenarioId: 'scenario-1', nom: 'Jury 1', enseignantIds: ['ens-0', 'ens-1'],
      capaciteMax: 8, createdAt: now, updatedAt: now,
    });

    await migrateLegacyBackups(storageWith(legacyEleves(4), legacyEnseignants(2)));

    const affectation = await db.affectations.get('aff-1');
    expect(await db.eleves.get(affectation!.eleveId)).toMatchObject({ nom: 'TEST2' });
    expect(await db.enseignants.get(affectation!.enseignantId)).toMatchObject({ nom: 'PROF1' });
    const jury = await db.jurys.get('jury-1');
    expect((await db.enseignants.bulkGet(jury!.enseignantIds)).every(Boolean)).toBe(true);
    expect(await db.stages.get('stage-1')).toMatchObject({ eleveId: 'eleve-2' });
  });

  it('les voit dans l’application dès le premier chargement', async () => {
    await migrateLegacyBackups(storageWith(legacyEleves(6), legacyEnseignants(4)));

    await useEleveStore.getState().loadEleves();
    await useEnseignantStore.getState().loadEnseignants();

    expect(useEleveStore.getState().eleves).toHaveLength(6);
    expect(useEnseignantStore.getState().enseignants).toHaveLength(4);
  });

  it('ne retire la copie qu’une fois son contenu en base', async () => {
    const storage = storageWith(legacyEleves(3), legacyEnseignants(2));

    await migrateLegacyBackups(storage);

    expect(await db.eleves.count()).toBe(3);
    expect(await db.enseignants.count()).toBe(2);
    expect(storage.keys()).toEqual([]);
  });

  it('garde la copie si la reprise échoue, pour réessayer au démarrage suivant', async () => {
    const storage = storageWith(legacyEleves(3), legacyEnseignants(2));
    const failure = vi.spyOn(db.eleves, 'bulkPut').mockRejectedValueOnce(new Error('quota dépassé'));
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = await migrateLegacyBackups(storage);

    expect(first.eleves).toBe('echec');
    expect(storage.getItem(LEGACY_BACKUP_KEYS.eleves)).not.toBeNull();
    expect(first.enseignants).toBe('restauree');

    failure.mockRestore();
    silence.mockRestore();
    const second = await migrateLegacyBackups(storage);

    expect(second.eleves).toBe('restauree');
    expect(await db.eleves.count()).toBe(3);
    expect(storage.keys()).toEqual([]);
  });
});

describe('utilisateur dont la base IndexedDB est déjà remplie', () => {
  it('garde sa base intacte, même si la copie localStorage est plus ancienne ou différente', async () => {
    const enBase = legacyEleves(5).map(e => ({ ...e, sujetOral: 'Sujet corrigé depuis' }));
    await db.eleves.bulkAdd(enBase);
    const avant = sortById(await db.eleves.toArray());
    const storage = storageWith(legacyEleves(3), undefined);

    const report = await migrateLegacyBackups(storage);

    expect(report.eleves).toBe('base-deja-remplie');
    expect(sortById(await db.eleves.toArray())).toEqual(avant);
    expect(storage.keys()).toEqual([]);
  });

  it('ne ressuscite pas des élèves supprimés depuis', async () => {
    await db.eleves.bulkAdd(legacyEleves(2));
    await migrateLegacyBackups(storageWith(legacyEleves(6), undefined));

    await useEleveStore.getState().loadEleves();
    await useEleveStore.getState().deleteEleves(['eleve-0', 'eleve-1']);
    // Démarrage suivant : la base est vide, mais c'est voulu.
    await migrateLegacyBackups(new MemoryStorage());
    await useEleveStore.getState().loadEleves();

    expect(await db.eleves.count()).toBe(0);
    expect(useEleveStore.getState().eleves).toEqual([]);
  });

  it('ne touche à aucune des autres tables', async () => {
    const now = new Date();
    await db.scenarios.add({ id: 's1', nom: 'Oral fictif', mode: 'matching', type: 'oral_dnb', createdAt: now, updatedAt: now } as never);
    await db.groupes.add({ id: 'g1', scenarioId: 's1', nom: 'Groupe 1', eleveIds: [], enseignantIds: [], createdAt: now, updatedAt: now });
    await db.affectations.add({ id: 'a1', eleveId: 'eleve-0', enseignantId: 'ens-0', scenarioId: 's1', type: 'oral_dnb', metadata: {}, createdAt: now, updatedAt: now });
    await db.eleves.bulkAdd(legacyEleves(2));
    await db.enseignants.bulkAdd(legacyEnseignants(2));
    const snapshot = async () => Object.fromEntries(
      await Promise.all(db.tables.map(async table => [table.name, sortById(await table.toArray())]))
    );
    const avant = await snapshot();

    await migrateLegacyBackups(storageWith(legacyEleves(4), legacyEnseignants(4)));

    expect(await snapshot()).toEqual(avant);
  });
});

describe('cas limites', () => {
  it('sans ancienne copie, ne fait rien', async () => {
    const storage = new MemoryStorage();
    storage.setItem('groupit_currentScenarioId', 'scenario-1');

    const report = await migrateLegacyBackups(storage);

    expect(report).toEqual({ eleves: 'absente', enseignants: 'absente' });
    expect(storage.keys()).toEqual(['groupit_currentScenarioId']);
  });

  it('une copie illisible ne bloque pas le démarrage et ne touche pas à la base', async () => {
    await db.enseignants.bulkAdd(legacyEnseignants(2));
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_BACKUP_KEYS.eleves, '{"tronqué":');
    storage.setItem(LEGACY_BACKUP_KEYS.enseignants, '"pas un tableau"');

    const report = await migrateLegacyBackups(storage);

    expect(report).toEqual({ eleves: 'illisible', enseignants: 'illisible' });
    expect(await db.eleves.count()).toBe(0);
    expect(await db.enseignants.count()).toBe(2);
  });

  it('une copie vide est simplement retirée', async () => {
    const storage = storageWith([], []);

    const report = await migrateLegacyBackups(storage);

    expect(report).toEqual({ eleves: 'vide', enseignants: 'vide' });
    expect(storage.keys()).toEqual([]);
  });

  it('peut être rejouée sans effet (double démarrage)', async () => {
    const storage = storageWith(legacyEleves(3), legacyEnseignants(2));

    await migrateLegacyBackups(storage);
    const second = await migrateLegacyBackups(storage);

    expect(second).toEqual({ eleves: 'absente', enseignants: 'absente' });
    expect(await db.eleves.count()).toBe(3);
    expect(await db.enseignants.count()).toBe(2);
  });

  it('sans stockage disponible (navigation privée stricte), démarre quand même', async () => {
    expect(await migrateLegacyBackups(null)).toEqual({ eleves: 'absente', enseignants: 'absente' });
  });
});
