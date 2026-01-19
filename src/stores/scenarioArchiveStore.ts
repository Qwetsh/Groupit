// ============================================================
// SCENARIO ARCHIVE STORE
// Gestion de l'historique des scénarios (Zustand)
// ============================================================

import { create } from 'zustand';
import { 
  scenarioArchiveRepository, 
  type EnseignantHistoryEntry 
} from '../infrastructure/repositories/scenarioArchiveRepository';
import type { 
  ScenarioArchive, 
  ScenarioType
} from '../domain/models';

// ============================================================
// TYPES
// ============================================================

interface ScenarioArchiveState {
  // State
  archives: ScenarioArchive[];
  isLoading: boolean;
  error: string | null;
  
  // Cache pour l'historique enseignant (évite les requêtes répétées)
  enseignantHistoryCache: Map<string, EnseignantHistoryEntry[]>;
  
  // Actions
  loadArchives: () => Promise<void>;
  loadArchivesByType: (type: ScenarioType) => Promise<void>;
  
  // Historique enseignant
  getEnseignantHistory: (enseignantId: string) => Promise<EnseignantHistoryEntry[]>;
  getEnseignantHistoryByType: (enseignantId: string, type: ScenarioType) => Promise<EnseignantHistoryEntry[]>;
  countEnseignantParticipations: (enseignantId: string) => Promise<number>;
  countEnseignantParticipationsByType: (enseignantId: string) => Promise<Record<ScenarioType, number>>;
  
  // CRUD
  createArchive: (archive: Omit<ScenarioArchive, 'id' | 'createdAt'>) => Promise<string>;
  deleteArchive: (id: string) => Promise<void>;
  deleteArchivesByScenario: (scenarioId: string) => Promise<void>;
  
  // Cache
  clearCache: () => void;
  invalidateEnseignantCache: (enseignantId: string) => void;
}

// ============================================================
// STORE
// ============================================================

export const useScenarioArchiveStore = create<ScenarioArchiveState>((set, get) => ({
  // Initial state
  archives: [],
  isLoading: false,
  error: null,
  enseignantHistoryCache: new Map(),

  // Load all archives
  loadArchives: async () => {
    set({ isLoading: true, error: null });
    try {
      const archives = await scenarioArchiveRepository.getAll();
      set({ archives, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  // Load archives by type
  loadArchivesByType: async (type: ScenarioType) => {
    set({ isLoading: true, error: null });
    try {
      const archives = await scenarioArchiveRepository.getByType(type);
      set({ archives, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  // Get enseignant history (with cache)
  getEnseignantHistory: async (enseignantId: string) => {
    const cache = get().enseignantHistoryCache;
    
    // Check cache first
    if (cache.has(enseignantId)) {
      return cache.get(enseignantId)!;
    }
    
    // Fetch from repository
    const history = await scenarioArchiveRepository.getHistoryForEnseignant(enseignantId);
    
    // Update cache
    const newCache = new Map(cache);
    newCache.set(enseignantId, history);
    set({ enseignantHistoryCache: newCache });
    
    return history;
  },

  // Get enseignant history filtered by type
  getEnseignantHistoryByType: async (enseignantId: string, type: ScenarioType) => {
    const history = await get().getEnseignantHistory(enseignantId);
    return history.filter(h => h.scenarioType === type);
  },

  // Count participations
  countEnseignantParticipations: async (enseignantId: string) => {
    const history = await get().getEnseignantHistory(enseignantId);
    return history.length;
  },

  // Count participations by type
  countEnseignantParticipationsByType: async (enseignantId: string) => {
    const history = await get().getEnseignantHistory(enseignantId);
    const counts: Record<ScenarioType, number> = {
      oral_dnb: 0,
      suivi_stage: 0,
      custom: 0,
    };
    
    for (const entry of history) {
      counts[entry.scenarioType]++;
    }
    
    return counts;
  },

  // Create archive
  createArchive: async (archive) => {
    set({ isLoading: true, error: null });
    try {
      const id = await scenarioArchiveRepository.create(archive);
      
      // Reload archives and clear cache
      await get().loadArchives();
      get().clearCache();
      
      return id;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  // Delete archive
  deleteArchive: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await scenarioArchiveRepository.delete(id);
      await get().loadArchives();
      get().clearCache();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  // Delete archives by scenario
  deleteArchivesByScenario: async (scenarioId: string) => {
    set({ isLoading: true, error: null });
    try {
      await scenarioArchiveRepository.deleteByScenarioId(scenarioId);
      await get().loadArchives();
      get().clearCache();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  // Clear all cache
  clearCache: () => {
    set({ enseignantHistoryCache: new Map() });
  },

  // Invalidate specific enseignant cache
  invalidateEnseignantCache: (enseignantId: string) => {
    const cache = get().enseignantHistoryCache;
    const newCache = new Map(cache);
    newCache.delete(enseignantId);
    set({ enseignantHistoryCache: newCache });
  },
}));
