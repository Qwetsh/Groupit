// ============================================================
// DEXIE DATABASE CONFIGURATION
// ============================================================

import Dexie, { type Table } from 'dexie';
import type {
  Eleve,
  Enseignant,
  Affectation,
  Scenario,
  Groupe,
  Jury,
  Stage,
  FieldDefinition,
  ScenarioArchive,
} from '../../domain/models';
import type { GeoCacheEntry, RouteCacheEntry } from '../geo/types';

export class GroupitDB extends Dexie {
  eleves!: Table<Eleve, string>;
  enseignants!: Table<Enseignant, string>;
  affectations!: Table<Affectation, string>;
  scenarios!: Table<Scenario, string>;
  groupes!: Table<Groupe, string>;
  jurys!: Table<Jury, string>;
  stages!: Table<Stage, string>;
  geoCache!: Table<GeoCacheEntry, string>;
  routeCache!: Table<RouteCacheEntry, string>;
  fieldDefinitions!: Table<FieldDefinition, string>;
  scenarioArchives!: Table<ScenarioArchive, string>;

  constructor() {
    super('GroupitDB');

    // Version 1 - Schema initial
    this.version(1).stores({
      eleves: 'id, nom, prenom, classe, email, *options, *tags, createdAt',
      enseignants: 'id, nom, prenom, matierePrincipale, estProfPrincipal, classePP, *classesEnCharge, *tags, createdAt',
      affectations: 'id, eleveId, enseignantId, scenarioId, type, createdAt',
      scenarios: 'id, nom, mode, type, createdAt',
      groupes: 'id, scenarioId, nom, createdAt',
      historiqueRuns: 'id, scenarioId, dateRun',
    });

    // Version 2 - Ajout indices pour recherche
    this.version(2).stores({
      eleves: 'id, nom, prenom, classe, email, *options, *tags, createdAt, [nom+prenom]',
      enseignants: 'id, nom, prenom, matierePrincipale, estProfPrincipal, classePP, *classesEnCharge, *tags, createdAt, [nom+prenom]',
      affectations: 'id, eleveId, enseignantId, scenarioId, type, createdAt, [scenarioId+eleveId]',
      scenarios: 'id, nom, mode, type, createdAt',
      groupes: 'id, scenarioId, nom, createdAt',
      historiqueRuns: 'id, scenarioId, dateRun',
    });

    // Version 3 - Ajout table jurys pour Oral DNB
    this.version(3).stores({
      eleves: 'id, nom, prenom, classe, email, *options, *tags, createdAt, [nom+prenom]',
      enseignants: 'id, nom, prenom, matierePrincipale, estProfPrincipal, classePP, *classesEnCharge, *tags, createdAt, [nom+prenom]',
      affectations: 'id, eleveId, enseignantId, juryId, scenarioId, type, createdAt, [scenarioId+eleveId], [scenarioId+juryId]',
      scenarios: 'id, nom, mode, type, createdAt',
      groupes: 'id, scenarioId, nom, createdAt',
      historiqueRuns: 'id, scenarioId, dateRun',
      jurys: 'id, scenarioId, nom, createdAt, *enseignantIds',
    });

    // Version 4 - Ajout tables cache géocodage et routing + stages
    this.version(4).stores({
      eleves: 'id, nom, prenom, classe, email, *options, *tags, createdAt, [nom+prenom]',
      enseignants: 'id, nom, prenom, matierePrincipale, estProfPrincipal, classePP, *classesEnCharge, *tags, createdAt, [nom+prenom]',
      affectations: 'id, eleveId, enseignantId, juryId, scenarioId, type, createdAt, [scenarioId+eleveId], [scenarioId+juryId]',
      scenarios: 'id, nom, mode, type, createdAt',
      groupes: 'id, scenarioId, nom, createdAt',
      historiqueRuns: 'id, scenarioId, dateRun',
      jurys: 'id, scenarioId, nom, createdAt, *enseignantIds',
      stages: 'id, eleveId, scenarioId, geoStatus, createdAt, [scenarioId+eleveId]',
      geoCache: 'id, addressHash, provider, status, updatedAt',
      routeCache: 'id, routeKeyHash, provider, updatedAt',
    });

    // Version 5 - Ajout table fieldDefinitions pour colonnes dynamiques
    this.version(5).stores({
      eleves: 'id, nom, prenom, classe, email, *options, *tags, createdAt, [nom+prenom]',
      enseignants: 'id, nom, prenom, matierePrincipale, estProfPrincipal, classePP, *classesEnCharge, *tags, createdAt, [nom+prenom]',
      affectations: 'id, eleveId, enseignantId, juryId, scenarioId, type, createdAt, [scenarioId+eleveId], [scenarioId+juryId]',
      scenarios: 'id, nom, mode, type, createdAt',
      groupes: 'id, scenarioId, nom, createdAt',
      historiqueRuns: 'id, scenarioId, dateRun',
      jurys: 'id, scenarioId, nom, createdAt, *enseignantIds',
      stages: 'id, eleveId, scenarioId, geoStatus, createdAt, [scenarioId+eleveId]',
      geoCache: 'id, addressHash, provider, status, updatedAt',
      routeCache: 'id, routeKeyHash, provider, updatedAt',
      fieldDefinitions: 'id, entityType, key, label, type, order, createdAt',
    });

    // Version 6 - Ajout table scenarioArchives pour historique enseignants
    this.version(6).stores({
      eleves: 'id, nom, prenom, classe, email, *options, *tags, createdAt, [nom+prenom]',
      enseignants: 'id, nom, prenom, matierePrincipale, estProfPrincipal, classePP, *classesEnCharge, *tags, createdAt, [nom+prenom]',
      affectations: 'id, eleveId, enseignantId, juryId, scenarioId, type, createdAt, [scenarioId+eleveId], [scenarioId+juryId]',
      scenarios: 'id, nom, mode, type, createdAt',
      groupes: 'id, scenarioId, nom, createdAt',
      historiqueRuns: 'id, scenarioId, dateRun',
      jurys: 'id, scenarioId, nom, createdAt, *enseignantIds',
      stages: 'id, eleveId, scenarioId, geoStatus, createdAt, [scenarioId+eleveId]',
      geoCache: 'id, addressHash, provider, status, updatedAt',
      routeCache: 'id, routeKeyHash, provider, updatedAt',
      fieldDefinitions: 'id, entityType, key, label, type, order, createdAt',
      scenarioArchives: 'id, scenarioId, scenarioType, archivedAt, createdAt',
    });

    // Version 7 - Ajout index geoStatusExtended pour filtrage optimisé
    this.version(7).stores({
      eleves: 'id, nom, prenom, classe, email, *options, *tags, createdAt, [nom+prenom]',
      enseignants: 'id, nom, prenom, matierePrincipale, estProfPrincipal, classePP, *classesEnCharge, *tags, createdAt, [nom+prenom]',
      affectations: 'id, eleveId, enseignantId, juryId, scenarioId, type, createdAt, [scenarioId+eleveId], [scenarioId+juryId]',
      scenarios: 'id, nom, mode, type, createdAt',
      groupes: 'id, scenarioId, nom, createdAt',
      historiqueRuns: 'id, scenarioId, dateRun',
      jurys: 'id, scenarioId, nom, createdAt, *enseignantIds',
      stages: 'id, eleveId, scenarioId, geoStatus, geoStatusExtended, createdAt, [scenarioId+eleveId]',
      geoCache: 'id, addressHash, provider, status, updatedAt',
      routeCache: 'id, routeKeyHash, provider, updatedAt',
      fieldDefinitions: 'id, entityType, key, label, type, order, createdAt',
      scenarioArchives: 'id, scenarioId, scenarioType, archivedAt, createdAt',
    });

    // Version 8 - Suppression table historiqueRuns (code mort)
    this.version(8).stores({
      historiqueRuns: null, // Supprime la table
    });

    // Hooks pour mise à jour automatique des timestamps
    this.eleves.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.eleves.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.enseignants.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.enseignants.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.affectations.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.affectations.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.scenarios.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.scenarios.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.groupes.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.groupes.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.jurys.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.jurys.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.fieldDefinitions.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.fieldDefinitions.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.stages.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.stages.hook('updating', (modifications) => {
      return { ...modifications, updatedAt: new Date() };
    });

    this.scenarioArchives.hook('creating', (_primKey, obj) => {
      obj.createdAt = new Date();
    });
  }
}

// Instance singleton de la base de données
export const db = new GroupitDB();

// Export des fonctions utilitaires
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [
    db.eleves,
    db.enseignants,
    db.affectations,
    db.scenarios,
    db.groupes,
    db.jurys,
    db.stages,
    db.fieldDefinitions,
    db.scenarioArchives,
  ], async () => {
    await db.eleves.clear();
    await db.enseignants.clear();
    await db.affectations.clear();
    await db.scenarios.clear();
    await db.groupes.clear();
    await db.jurys.clear();
    await db.stages.clear();
    await db.fieldDefinitions.clear();
    await db.scenarioArchives.clear();
  });
}

/** Efface uniquement les caches de géocodage et routage */
export async function clearGeoCache(): Promise<void> {
  await db.transaction('rw', [db.geoCache, db.routeCache], async () => {
    await db.geoCache.clear();
    await db.routeCache.clear();
  });
}

export interface ExportedData {
  eleves: Eleve[];
  enseignants: Enseignant[];
  affectations: Affectation[];
  scenarios: Scenario[];
  groupes: Groupe[];
  jurys: Jury[];
  stages: Stage[];
  fieldDefinitions: FieldDefinition[];
  scenarioArchives: ScenarioArchive[];
}

export async function exportAllData(): Promise<ExportedData> {
  return {
    eleves: await db.eleves.toArray(),
    enseignants: await db.enseignants.toArray(),
    affectations: await db.affectations.toArray(),
    scenarios: await db.scenarios.toArray(),
    groupes: await db.groupes.toArray(),
    jurys: await db.jurys.toArray(),
    stages: await db.stages.toArray(),
    fieldDefinitions: await db.fieldDefinitions.toArray(),
    scenarioArchives: await db.scenarioArchives.toArray(),
  };
}

export async function importAllData(data: Partial<ExportedData>): Promise<void> {
  await db.transaction('rw', [
    db.eleves,
    db.enseignants,
    db.affectations,
    db.scenarios,
    db.groupes,
    db.jurys,
    db.stages,
    db.fieldDefinitions,
    db.scenarioArchives,
  ], async () => {
    if (data.eleves) await db.eleves.bulkPut(data.eleves);
    if (data.enseignants) await db.enseignants.bulkPut(data.enseignants);
    if (data.affectations) await db.affectations.bulkPut(data.affectations);
    if (data.scenarios) await db.scenarios.bulkPut(data.scenarios);
    if (data.groupes) await db.groupes.bulkPut(data.groupes);
    if (data.jurys) await db.jurys.bulkPut(data.jurys);
    if (data.stages) await db.stages.bulkPut(data.stages);
    if (data.fieldDefinitions) await db.fieldDefinitions.bulkPut(data.fieldDefinitions);
    if (data.scenarioArchives) await db.scenarioArchives.bulkPut(data.scenarioArchives);
  });
}
