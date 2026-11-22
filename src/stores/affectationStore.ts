// ============================================================
// ZUSTAND STORE - AFFECTATIONS
// ============================================================

import { create } from 'zustand';
import type { Affectation, AffectationMetadata } from '../domain/models';
import { affectationRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';
import { reconcileRows, byIds } from './dbSync';

interface AffectationState {
  affectations: Affectation[];
  loading: boolean;
  error: string | null;
  
  // Actions
  loadAffectations: () => Promise<void>;
  loadAffectationsByScenario: (scenarioId: string) => Promise<void>;
  addAffectation: (affectation: Omit<Affectation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Affectation>;
  addAffectations: (affectations: Omit<Affectation, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<Affectation[]>;
  updateAffectation: (id: string, updates: Partial<Affectation>) => Promise<void>;
  updateMetadata: (id: string, metadata: AffectationMetadata) => Promise<void>;
  deleteAffectation: (id: string) => Promise<void>;
  deleteAffectationsByScenario: (scenarioId: string) => Promise<void>;
  deleteAllAffectations: () => Promise<void>;
  
  // Getters
  getAffectationById: (id: string) => Affectation | undefined;
  getAffectationsByScenario: (scenarioId: string) => Affectation[];
  getAffectationsByEleve: (eleveId: string) => Affectation[];
  getAffectationsByEnseignant: (enseignantId: string) => Affectation[];
  getAffectationByEleveAndScenario: (eleveId: string, scenarioId: string) => Affectation | undefined;
  getChargeByEnseignant: (scenarioId: string) => Map<string, number>;
  getUnassignedEleveIds: (scenarioId: string, allEleveIds: string[]) => string[];
}

export const useAffectationStore = create<AffectationState>((set, get) => {
  /** Relit en base les affectations `ids` et aligne la vue en mémoire. */
  const syncFromDb = async (ids: readonly string[]): Promise<Affectation[]> => {
    const fresh = await affectationRepository.getByIds(ids);
    set(state => ({ affectations: reconcileRows(state.affectations, fresh, byIds(ids)) }));
    return fresh;
  };

  /** Relit en base toutes les affectations d'un scénario. */
  const syncScenarioFromDb = async (scenarioId: string): Promise<void> => {
    const fresh = await affectationRepository.getByScenario(scenarioId);
    set(state => ({
      affectations: reconcileRows(state.affectations, fresh, a => a.scenarioId === scenarioId),
    }));
  };

  return {
  affectations: [],
  loading: false,
  error: null,
  
  loadAffectations: async () => {
    set({ loading: true, error: null });
    try {
      const affectations = await affectationRepository.getAll();
      set({ affectations, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  loadAffectationsByScenario: async (scenarioId) => {
    set({ loading: true, error: null });
    try {
      const affectations = await affectationRepository.getByScenario(scenarioId);
      set({ affectations, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  addAffectation: async (affectation) => {
    try {
      const created = await affectationRepository.create(affectation);
      const [fresh] = await syncFromDb([created.id]);
      return fresh ?? created;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addAffectations: async (affectations) => {
    try {
      const created = await affectationRepository.createMany(affectations);
      const fresh = await syncFromDb(created.map(a => a.id));
      return fresh.length === created.length ? fresh : created;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateAffectation: async (id, updates) => {
    try {
      await affectationRepository.update(id, updates);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateMetadata: async (id, metadata) => {
    try {
      await affectationRepository.updateMetadata(id, metadata);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteAffectation: async (id) => {
    try {
      await affectationRepository.delete(id);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteAffectationsByScenario: async (scenarioId) => {
    try {
      await affectationRepository.deleteByScenario(scenarioId);
      await syncScenarioFromDb(scenarioId);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteAllAffectations: async () => {
    try {
      await affectationRepository.deleteAll();
      set({ affectations: await affectationRepository.getAll() });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  getAffectationById: (id) => {
    return get().affectations.find(a => a.id === id);
  },
  
  getAffectationsByScenario: (scenarioId) => {
    return get().affectations.filter(a => a.scenarioId === scenarioId);
  },
  
  getAffectationsByEleve: (eleveId) => {
    return get().affectations.filter(a => a.eleveId === eleveId);
  },
  
  getAffectationsByEnseignant: (enseignantId) => {
    return get().affectations.filter(a => a.enseignantId === enseignantId);
  },
  
  getAffectationByEleveAndScenario: (eleveId, scenarioId) => {
    return get().affectations.find(a => a.eleveId === eleveId && a.scenarioId === scenarioId);
  },
  
  getChargeByEnseignant: (scenarioId) => {
    const affectations = get().getAffectationsByScenario(scenarioId);
    const charge = new Map<string, number>();
    
    affectations.forEach(a => {
      const current = charge.get(a.enseignantId) || 0;
      charge.set(a.enseignantId, current + 1);
    });
    
    return charge;
  },
  
  getUnassignedEleveIds: (scenarioId, allEleveIds) => {
    const affectations = get().getAffectationsByScenario(scenarioId);
    const assignedIds = new Set(affectations.map(a => a.eleveId));
    return allEleveIds.filter(id => !assignedIds.has(id));
  },
  };
});
