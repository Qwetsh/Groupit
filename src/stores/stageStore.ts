// ============================================================
// STAGE STORE - Gestion des stages (Zustand)
// ============================================================

import { create } from 'zustand';
import { db } from '../infrastructure/database/db';
import type { Stage, GeoPrecision, GeoStatusExtended } from '../domain/models';

interface StageState {
  stages: Stage[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadStages: () => Promise<void>;
  loadStagesByScenario: (scenarioId: string) => Promise<void>;
  addStage: (stage: Omit<Stage, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Stage>;
  updateStage: (id: string, updates: Partial<Stage>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  bulkAddStages: (stages: Array<Omit<Stage, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  clearStagesByScenario: (scenarioId: string) => Promise<void>;
  
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
  isLoading: false,
  error: null,
  
  loadStages: async () => {
    set({ isLoading: true, error: null });
    try {
      const stages = await db.stages.toArray();
      set({ stages, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  loadStagesByScenario: async (scenarioId: string) => {
    set({ isLoading: true, error: null });
    try {
      const stages = await db.stages.where('scenarioId').equals(scenarioId).toArray();
      set({ stages, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
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
