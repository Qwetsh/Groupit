// ============================================================
// ZUSTAND STORE - GROUPES
// ============================================================

import { create } from 'zustand';
import type { Groupe } from '../domain/models';
import { groupeRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';
import { reconcileRows, byIds } from './dbSync';

interface GroupeState {
  groupes: Groupe[];
  loading: boolean;
  error: string | null;
  
  // Actions
  loadGroupes: () => Promise<void>;
  loadGroupesByScenario: (scenarioId: string) => Promise<void>;
  addGroupe: (groupe: Omit<Groupe, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Groupe>;
  updateGroupe: (id: string, updates: Partial<Groupe>) => Promise<void>;
  deleteGroupe: (id: string) => Promise<void>;
  deleteGroupesByScenario: (scenarioId: string) => Promise<void>;
  
  // Gestion des membres
  addEleveToGroupe: (groupeId: string, eleveId: string) => Promise<void>;
  removeEleveFromGroupe: (groupeId: string, eleveId: string) => Promise<void>;
  moveEleveBetweenGroupes: (eleveId: string, fromGroupeId: string, toGroupeId: string) => Promise<void>;
  addEnseignantToGroupe: (groupeId: string, enseignantId: string) => Promise<void>;
  removeEnseignantFromGroupe: (groupeId: string, enseignantId: string) => Promise<void>;
  
  // Getters
  getGroupeById: (id: string) => Groupe | undefined;
  getGroupesByScenario: (scenarioId: string) => Groupe[];
  getGroupeByEleveId: (eleveId: string, scenarioId: string) => Groupe | undefined;
}

export const useGroupeStore = create<GroupeState>((set, get) => {
  /** Relit en base les groupes `ids` et aligne la vue en mémoire. */
  const syncFromDb = async (ids: readonly string[]): Promise<Groupe[]> => {
    const fresh = await groupeRepository.getByIds(ids);
    set(state => ({ groupes: reconcileRows(state.groupes, fresh, byIds(ids)) }));
    return fresh;
  };

  return {
  groupes: [],
  loading: false,
  error: null,
  
  loadGroupes: async () => {
    set({ loading: true, error: null });
    try {
      const groupes = await groupeRepository.getAll();
      set({ groupes, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  loadGroupesByScenario: async (scenarioId) => {
    set({ loading: true, error: null });
    try {
      const groupes = await groupeRepository.getByScenario(scenarioId);
      set({ groupes, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  addGroupe: async (groupe) => {
    try {
      const created = await groupeRepository.create(groupe);
      const [fresh] = await syncFromDb([created.id]);
      return fresh ?? created;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateGroupe: async (id, updates) => {
    try {
      await groupeRepository.update(id, updates);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteGroupe: async (id) => {
    try {
      await groupeRepository.delete(id);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteGroupesByScenario: async (scenarioId) => {
    try {
      await groupeRepository.deleteByScenario(scenarioId);
      const fresh = await groupeRepository.getByScenario(scenarioId);
      set(state => ({
        groupes: reconcileRows(state.groupes, fresh, g => g.scenarioId === scenarioId),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addEleveToGroupe: async (groupeId, eleveId) => {
    try {
      await groupeRepository.addEleve(groupeId, eleveId);
      await syncFromDb([groupeId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  removeEleveFromGroupe: async (groupeId, eleveId) => {
    try {
      await groupeRepository.removeEleve(groupeId, eleveId);
      await syncFromDb([groupeId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  moveEleveBetweenGroupes: async (eleveId, fromGroupeId, toGroupeId) => {
    try {
      await groupeRepository.moveEleveBetweenGroupes(eleveId, fromGroupeId, toGroupeId);
      await syncFromDb([fromGroupeId, toGroupeId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addEnseignantToGroupe: async (groupeId, enseignantId) => {
    try {
      await groupeRepository.addEnseignant(groupeId, enseignantId);
      await syncFromDb([groupeId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  removeEnseignantFromGroupe: async (groupeId, enseignantId) => {
    try {
      await groupeRepository.removeEnseignant(groupeId, enseignantId);
      await syncFromDb([groupeId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  getGroupeById: (id) => {
    return get().groupes.find(g => g.id === id);
  },
  
  getGroupesByScenario: (scenarioId) => {
    return get().groupes.filter(g => g.scenarioId === scenarioId);
  },
  
  getGroupeByEleveId: (eleveId, scenarioId) => {
    return get().groupes.find(g => 
      g.scenarioId === scenarioId && g.eleveIds.includes(eleveId)
    );
  },
  };
});
