// ============================================================
// STAGE STORE - Gestion des stages (Zustand)
// ============================================================

import { create } from 'zustand';
import { db } from '../infrastructure/database/db';
import type { Stage, GeoPrecision, GeoStatusExtended } from '../domain/models';
import { extractErrorMessage } from '../utils/errorUtils';
import { reconcileRows, byIds } from './dbSync';

interface StageState {
  stages: Stage[];
  loading: boolean;
  error: string | null;

  // Actions
  loadStages: () => Promise<void>;
  loadStagesByScenario: (scenarioId: string) => Promise<void>;
  loadGlobalStages: () => Promise<void>; // Stages sans scenarioId
  addStage: (stage: Omit<Stage, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Stage>;
  updateStage: (id: string, updates: Partial<Stage>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  bulkAddStages: (stages: Array<Omit<Stage, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  clearStagesByScenario: (scenarioId: string) => Promise<void>;

  // Méthodes pour gestion par élève
  getStageByEleveId: (eleveId: string) => Stage | undefined;
  upsertStageForEleve: (eleveId: string, data: Partial<Stage>) => Promise<Stage>;
  bulkUpsertStagesForEleves: (stagesData: Array<{ eleveId: string } & Partial<Stage>>) => Promise<{ updated: number; created: number }>;
  deleteStageByEleveId: (eleveId: string) => Promise<void>;

  // Geo status updates
  updateStageGeo: (id: string, lat: number, lon: number, status: Stage['geoStatus']) => Promise<void>;
  setStageGeoError: (id: string, errorMessage: string) => Promise<void>;

  // Extended geo updates (with fallback precision)
  updateStageGeoExtended: (
    id: string,
    lat: number,
    lon: number,
    geoStatus: Stage['geoStatus'],
    geoStatusExtended: GeoStatusExtended,
    geoPrecision: GeoPrecision,
    geoQueryUsed?: string
  ) => Promise<void>;
}

function generateId(): string {
  return `stage_${crypto.randomUUID()}`;
}

/** Relit en base les stages `ids` ; ceux qui n'existent plus sont omis. */
async function readStages(ids: readonly string[]): Promise<Stage[]> {
  const rows = await db.stages.bulkGet([...ids]);
  return rows.filter((row): row is Stage => row !== undefined);
}

export const useStageStore = create<StageState>((set) => {
  /**
   * Relit en base les stages `ids` et aligne la vue en mémoire : la base est
   * la source de vérité, le store n'en garde qu'une copie de lecture.
   */
  const syncFromDb = async (ids: readonly string[]): Promise<Stage[]> => {
    const fresh = await readStages(ids);
    set(state => ({ stages: reconcileRows(state.stages, fresh, byIds(ids)) }));
    return fresh;
  };

  return {
  stages: [],
  loading: false,
  error: null,
  
  loadStages: async () => {
    set({ loading: true, error: null });
    try {
      const stages = await db.stages.toArray();
      set({ stages, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  loadStagesByScenario: async (scenarioId: string) => {
    set({ loading: true, error: null });
    try {
      const stages = await db.stages.where('scenarioId').equals(scenarioId).toArray();
      set({ stages, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },

  loadGlobalStages: async () => {
    set({ loading: true, error: null });
    try {
      // Charger les stages sans scenarioId (stages globaux liés aux élèves)
      const allStages = await db.stages.toArray();
      const globalStages = allStages.filter(s => !s.scenarioId);
      set({ stages: globalStages, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  addStage: async (stageData) => {
    try {
      const now = new Date();
      const stage: Stage = {
        ...stageData,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      await db.stages.add(stage);
      const [fresh] = await syncFromDb([stage.id]);
      return fresh ?? stage;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  updateStage: async (id, updates) => {
    try {
      const now = new Date();
      await db.stages.update(id, { ...updates, updatedAt: now });
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  deleteStage: async (id) => {
    try {
      await db.stages.delete(id);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  bulkAddStages: async (stagesData) => {
    try {
      const now = new Date();
      const stages: Stage[] = stagesData.map(data => ({
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }));
      await db.stages.bulkAdd(stages);
      await syncFromDb(stages.map(s => s.id));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  clearStagesByScenario: async (scenarioId) => {
    await db.stages.where('scenarioId').equals(scenarioId).delete();
    const fresh = await db.stages.where('scenarioId').equals(scenarioId).toArray();
    set(state => ({
      stages: reconcileRows(state.stages, fresh, s => s.scenarioId === scenarioId)
    }));
  },
  getStageByEleveId: (eleveId: string): Stage | undefined => {
    const { stages } = useStageStore.getState() as StageState;
    // Priorité aux stages globaux (sans scenarioId)
    return stages.find((s: Stage) => s.eleveId === eleveId && !s.scenarioId)
      || stages.find((s: Stage) => s.eleveId === eleveId);
  },

  upsertStageForEleve: async (eleveId: string, data: Partial<Stage>) => {
    const now = new Date();
    // Chercher un stage global existant pour cet élève
    const existingStage = await db.stages
      .filter(s => s.eleveId === eleveId && !s.scenarioId)
      .first();
    if (existingStage) {
      // Mise à jour
      const updates = { ...data, updatedAt: now };
      await db.stages.update(existingStage.id, updates);
      const [fresh] = await syncFromDb([existingStage.id]);
      return fresh ?? { ...existingStage, ...updates };
    } else {
      // Création
      const stage = {
        ...data,
        id: generateId(),
        eleveId,
        geoStatus: data.geoStatus ?? (data.adresse ? 'pending' as const : undefined),
        createdAt: now,
        updatedAt: now,
      } satisfies Omit<Stage, 'id' | 'createdAt' | 'updatedAt'> & { id: string; createdAt: Date; updatedAt: Date } as Stage;
      await db.stages.add(stage);
      const [fresh] = await syncFromDb([stage.id]);
      return fresh ?? stage;
    }
  },
  bulkUpsertStagesForEleves: async (stagesData) => {
    const now = new Date();
    let updated = 0;
    let created = 0;
    // Charger tous les stages globaux existants
    const existingStages = await db.stages
      .filter(s => !s.scenarioId)
      .toArray();
    const existingByEleveId = new Map(
      existingStages.map(s => [s.eleveId, s])
    );
    const toUpdate: Stage[] = [];
    const toCreate: Stage[] = [];
    for (const data of stagesData) {
      const existing = existingByEleveId.get(data.eleveId);
      if (existing) {
        toUpdate.push({ ...existing, ...data, updatedAt: now });
        updated++;
      } else {
        toCreate.push({
          ...data,
          id: generateId(),
          geoStatus: data.geoStatus ?? (data.adresse ? 'pending' as const : undefined),
          createdAt: now,
          updatedAt: now,
        } satisfies Omit<Stage, 'id' | 'createdAt' | 'updatedAt'> & { id: string; createdAt: Date; updatedAt: Date } as Stage);
        created++;
      }
    }
    // Bulk update
    if (toUpdate.length > 0) {
      await db.transaction('rw', db.stages, async () => {
        for (const stage of toUpdate) {
          await db.stages.update(stage.id, stage);
        }
      });
    }
    // Bulk create
    if (toCreate.length > 0) {
      await db.stages.bulkAdd(toCreate);
    }
    // Relire la base ; comme avant, les stages touchés passent en fin de liste
    // (mis à jour, puis créés).
    const touchedIds = [...toUpdate, ...toCreate].map(s => s.id);
    const fresh = await readStages(touchedIds);
    const touched = new Set(touchedIds);
    set(state => ({
      stages: [...state.stages.filter(s => !touched.has(s.id)), ...fresh],
    }));
    return { updated, created };
  },
  deleteStageByEleveId: async (eleveId: string) => {
    // Supprimer uniquement le stage global
    const stage = await db.stages
      .filter(s => s.eleveId === eleveId && !s.scenarioId)
      .first();
    if (stage) {
      await db.stages.delete(stage.id);
      await syncFromDb([stage.id]);
    }
  },
  updateStageGeo: async (id, lat, lon, status) => {
    const now = new Date();
    await db.stages.update(id, { lat, lon, geoStatus: status, geoErrorMessage: undefined, updatedAt: now });
    await syncFromDb([id]);
  },
  setStageGeoError: async (id, errorMessage) => {
    const now = new Date();
    await db.stages.update(id, { geoStatus: 'error', geoErrorMessage: errorMessage, updatedAt: now });
    await syncFromDb([id]);
  },
  updateStageGeoExtended: async (id, lat, lon, geoStatus, geoStatusExtended, geoPrecision, geoQueryUsed) => {
    const now = new Date();
    const updates = {
      lat,
      lon,
      geoStatus,
      geoStatusExtended,
      geoPrecision,
      geoQueryUsed,
      geoErrorMessage: undefined,
      updatedAt: now
    };
    await db.stages.update(id, updates);
    await syncFromDb([id]);
  },
  };
});

