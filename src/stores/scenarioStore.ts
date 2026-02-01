// ============================================================
// ZUSTAND STORE - SCÉNARIOS
// ============================================================

import { create } from 'zustand';
import type { Scenario, ScenarioMode, ScenarioType, ScenarioParametres, CritereConfig } from '../domain/models';
import { scenarioRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';

interface ScenarioState {
  scenarios: Scenario[];
  currentScenarioId: string | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadScenarios: () => Promise<void>;
  ensureDefaults: () => Promise<void>;
  addScenario: (scenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Scenario>;
  createDefaultScenario: (nom: string, type: ScenarioType, mode?: ScenarioMode) => Promise<Scenario>;
  updateScenario: (id: string, updates: Partial<Scenario>) => Promise<void>;
  updateParametres: (id: string, parametres: Partial<ScenarioParametres>) => Promise<void>;
  updateCritere: (scenarioId: string, critereId: string, updates: Partial<CritereConfig>) => Promise<void>;
  duplicateScenario: (id: string, newNom: string) => Promise<Scenario | undefined>;
  deleteScenario: (id: string) => Promise<void>;
  
  // Sélection
  setCurrentScenario: (id: string | null) => void;
  setActiveScenario: (id: string) => Promise<void>;
  
  // Getters
  getCurrentScenario: () => Scenario | undefined;
  getActiveScenario: () => Scenario | undefined;
  getScenarioById: (id: string) => Scenario | undefined;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  currentScenarioId: null,
  loading: false,
  error: null,
  
  loadScenarios: async () => {
    set({ loading: true, error: null });
    try {
      const scenarios = await scenarioRepository.getAll();
      set({ scenarios, loading: false });
      
      // Sélectionner le premier scénario par défaut s'il y en a
      if (scenarios.length > 0 && !get().currentScenarioId) {
        set({ currentScenarioId: scenarios[0].id });
      }
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  ensureDefaults: async () => {
    try {
      await scenarioRepository.ensureDefaults();
      await get().loadScenarios();
    } catch (error) {
      set({ error: extractErrorMessage(error) });
    }
  },
  
  addScenario: async (scenario) => {
    try {
      const newScenario = await scenarioRepository.create(scenario);
      set(state => ({ scenarios: [...state.scenarios, newScenario] }));
      return newScenario;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  createDefaultScenario: async (nom, type, mode = 'matching') => {
    try {
      const newScenario = await scenarioRepository.createDefault(nom, type, mode);
      set(state => ({ scenarios: [...state.scenarios, newScenario] }));
      return newScenario;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  updateScenario: async (id, updates) => {
    try {
      await scenarioRepository.update(id, updates);
      set(state => ({
        scenarios: state.scenarios.map(s => 
          s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
        ),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  updateParametres: async (id, parametres) => {
    try {
      const scenario = get().getScenarioById(id);
      if (scenario) {
        const updatedParametres = { ...scenario.parametres, ...parametres };
        await scenarioRepository.update(id, { parametres: updatedParametres });
        set(state => ({
          scenarios: state.scenarios.map(s => 
            s.id === id ? { ...s, parametres: updatedParametres, updatedAt: new Date() } : s
          ),
        }));
      }
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  updateCritere: async (scenarioId, critereId, updates) => {
    try {
      const scenario = get().getScenarioById(scenarioId);
      if (scenario) {
        const criteres = scenario.parametres.criteres.map(c => 
          c.id === critereId ? { ...c, ...updates } : c
        );
        await get().updateParametres(scenarioId, { criteres });
      }
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  duplicateScenario: async (id, newNom) => {
    try {
      const newScenario = await scenarioRepository.duplicate(id, newNom);
      if (newScenario) {
        set(state => ({ scenarios: [...state.scenarios, newScenario] }));
      }
      return newScenario;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  deleteScenario: async (id) => {
    try {
      await scenarioRepository.delete(id);
      set(state => {
        const newScenarios = state.scenarios.filter(s => s.id !== id);
        const newCurrentId = state.currentScenarioId === id 
          ? (newScenarios.length > 0 ? newScenarios[0].id : null)
          : state.currentScenarioId;
        return {
          scenarios: newScenarios,
          currentScenarioId: newCurrentId,
        };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  setCurrentScenario: (id) => {
    set({ currentScenarioId: id });
  },

  setActiveScenario: async (id) => {
    try {
      // Simply set this scenario as the current one
      set({ currentScenarioId: id });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  
  getCurrentScenario: () => {
    const { scenarios, currentScenarioId } = get();
    return scenarios.find(s => s.id === currentScenarioId);
  },

  getActiveScenario: () => {
    const { scenarios, currentScenarioId } = get();
    return scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
  },
  
  getScenarioById: (id) => {
    return get().scenarios.find(s => s.id === id);
  },
}));
