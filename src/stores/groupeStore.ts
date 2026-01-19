// ============================================================
// ZUSTAND STORE - GROUPES
// ============================================================

import { create } from 'zustand';
import type { Groupe } from '../domain/models';
import { groupeRepository } from '../infrastructure/repositories';

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

export const useGroupeStore = create<GroupeState>((set, get) => ({
  groupes: [],
  loading: false,
  error: null,
  
  loadGroupes: async () => {
    set({ loading: true, error: null });
    try {
      const groupes = await groupeRepository.getAll();
      set({ groupes, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },
  
  loadGroupesByScenario: async (scenarioId) => {
    set({ loading: true, error: null });
    try {
      const groupes = await groupeRepository.getByScenario(scenarioId);
      set({ groupes, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },
  
  addGroupe: async (groupe) => {
    try {
      const newGroupe = await groupeRepository.create(groupe);
      set(state => ({ groupes: [...state.groupes, newGroupe] }));
      return newGroupe;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  updateGroupe: async (id, updates) => {
    try {
      await groupeRepository.update(id, updates);
      set(state => ({
        groupes: state.groupes.map(g => 
          g.id === id ? { ...g, ...updates, updatedAt: new Date() } : g
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  deleteGroupe: async (id) => {
    try {
      await groupeRepository.delete(id);
      set(state => ({
        groupes: state.groupes.filter(g => g.id !== id),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  deleteGroupesByScenario: async (scenarioId) => {
    try {
      await groupeRepository.deleteByScenario(scenarioId);
      set(state => ({
        groupes: state.groupes.filter(g => g.scenarioId !== scenarioId),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  addEleveToGroupe: async (groupeId, eleveId) => {
    try {
      await groupeRepository.addEleve(groupeId, eleveId);
      set(state => ({
        groupes: state.groupes.map(g => 
          g.id === groupeId && !g.eleveIds.includes(eleveId)
            ? { ...g, eleveIds: [...g.eleveIds, eleveId], updatedAt: new Date() }
            : g
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  removeEleveFromGroupe: async (groupeId, eleveId) => {
    try {
      await groupeRepository.removeEleve(groupeId, eleveId);
      set(state => ({
        groupes: state.groupes.map(g => 
          g.id === groupeId
            ? { ...g, eleveIds: g.eleveIds.filter(id => id !== eleveId), updatedAt: new Date() }
            : g
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  moveEleveBetweenGroupes: async (eleveId, fromGroupeId, toGroupeId) => {
    try {
      await groupeRepository.moveEleveBetweenGroupes(eleveId, fromGroupeId, toGroupeId);
      set(state => ({
        groupes: state.groupes.map(g => {
          if (g.id === fromGroupeId) {
            return { ...g, eleveIds: g.eleveIds.filter(id => id !== eleveId), updatedAt: new Date() };
          }
          if (g.id === toGroupeId && !g.eleveIds.includes(eleveId)) {
            return { ...g, eleveIds: [...g.eleveIds, eleveId], updatedAt: new Date() };
          }
          return g;
        }),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  addEnseignantToGroupe: async (groupeId, enseignantId) => {
    try {
      await groupeRepository.addEnseignant(groupeId, enseignantId);
      set(state => ({
        groupes: state.groupes.map(g => 
          g.id === groupeId && !g.enseignantIds.includes(enseignantId)
            ? { ...g, enseignantIds: [...g.enseignantIds, enseignantId], updatedAt: new Date() }
            : g
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  removeEnseignantFromGroupe: async (groupeId, enseignantId) => {
    try {
      await groupeRepository.removeEnseignant(groupeId, enseignantId);
      set(state => ({
        groupes: state.groupes.map(g => 
          g.id === groupeId
            ? { ...g, enseignantIds: g.enseignantIds.filter(id => id !== enseignantId), updatedAt: new Date() }
            : g
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
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
}));
