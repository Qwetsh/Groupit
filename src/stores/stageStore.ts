// ============================================================
// STAGE STORE - Gestion des stages (Zustand)
// ============================================================

import { create } from 'zustand';
import { db } from '../infrastructure/database/db';
import type { Stage, GeoPrecision, GeoStatusExtended } from '../domain/models';
import { extractErrorMessage } from '../utils/errorUtils';

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
  return `stage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useStageStore = create<StageState>((set) => ({
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
    const now = new Date();
    const stage: Stage = {
      ...stageData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    
    await db.stages.add(stage);
    set(state => ({ stages: [...state.stages, stage] }));
    return stage;
  },
  
  updateStage: async (id, updates) => {
    const now = new Date();
    await db.stages.update(id, { ...updates, updatedAt: now });
    set(state => ({
      stages: state.stages.map(s => 
        s.id === id ? { ...s, ...updates, updatedAt: now } : s
      ),
    }));
  },
  
  deleteStage: async (id) => {
    await db.stages.delete(id);
    set(state => ({ stages: state.stages.filter(s => s.id !== id) }));
  },
  
  bulkAddStages: async (stagesData) => {
    const now = new Date();
    const stages: Stage[] = stagesData.map(data => ({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }));
    
    await db.stages.bulkAdd(stages);
    set(state => ({ stages: [...state.stages, ...stages] }));
  },
  
  clearStagesByScenario: async (scenarioId) => {
    await db.stages.where('scenarioId').equals(scenarioId).delete();
    set(state => ({
      stages: state.stages.filter(s => s.scenarioId !== scenarioId)
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
      set(state => ({
        stages: state.stages.map(s =>
          s.id === existingStage.id ? { ...s, ...updates } : s
        ),
      }));
      return { ...existingStage, ...updates };
    } else {
      // Création
      const stage: Stage = {
        ...data,
        id: generateId(),
        eleveId,
        geoStatus: data.geoStatus ?? (data.adresse ? 'pending' : undefined),
        createdAt: now,
        updatedAt: now,
      } as Stage;

      await db.stages.add(stage);
      set(state => ({ stages: [...state.stages, stage] }));
      return stage;
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
          geoStatus: data.geoStatus ?? (data.adresse ? 'pending' : undefined),
          createdAt: now,
          updatedAt: now,
        } as Stage);
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

    // Mettre à jour le state
    set(state => {
      const updatedIds = new Set(toUpdate.map(s => s.id));
      const filteredStages = state.stages.filter(s => !updatedIds.has(s.id));
      return { stages: [...filteredStages, ...toUpdate, ...toCreate] };
    });

    return { updated, created };
  },

  deleteStageByEleveId: async (eleveId: string) => {
    // Supprimer uniquement le stage global
    const stage = await db.stages
      .filter(s => s.eleveId === eleveId && !s.scenarioId)
      .first();

    if (stage) {
      await db.stages.delete(stage.id);
      set(state => ({ stages: state.stages.filter(s => s.id !== stage.id) }));
    }
  },
  
  updateStageGeo: async (id, lat, lon, status) => {
    const now = new Date();
    await db.stages.update(id, { lat, lon, geoStatus: status, geoErrorMessage: undefined, updatedAt: now });
    set(state => ({
      stages: state.stages.map(s => 
        s.id === id 
          ? { ...s, lat, lon, geoStatus: status, geoErrorMessage: undefined, updatedAt: now } 
          : s
      ),
    }));
  },
  
  setStageGeoError: async (id, errorMessage) => {
    const now = new Date();
    await db.stages.update(id, { geoStatus: 'error', geoErrorMessage: errorMessage, updatedAt: now });
    set(state => ({
      stages: state.stages.map(s => 
        s.id === id 
          ? { ...s, geoStatus: 'error', geoErrorMessage: errorMessage, updatedAt: now } 
          : s
      ),
    }));
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
    set(state => ({
      stages: state.stages.map(s => 
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },
}));
