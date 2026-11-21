// ============================================================
// ZUSTAND STORE - SCÉNARIOS
// ============================================================

import { create } from 'zustand';
import type { Scenario, ScenarioMode, ScenarioType, ScenarioParametres, CritereConfig } from '../domain/models';
import { scenarioRepository, affectationRepository, groupeRepository, juryRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';

// Le scénario courant est mémorisé pour qu'un rechargement de la page rouvre
// l'affectation en cours, et non le premier scénario de la liste.
const CURRENT_SCENARIO_KEY = 'groupit_currentScenarioId';

function readSavedScenarioId(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(CURRENT_SCENARIO_KEY);
  } catch {
    return null;
  }
}

function saveScenarioId(id: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (id) localStorage.setItem(CURRENT_SCENARIO_KEY, id);
    else localStorage.removeItem(CURRENT_SCENARIO_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : la sélection reste en mémoire.
  }
}

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
  setActiveScenario: (id: string) => void;

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

      // Reprendre le scénario mémorisé s'il existe encore, sinon le premier
      if (scenarios.length > 0 && !get().currentScenarioId) {
        const savedId = readSavedScenarioId();
        const saved = scenarios.find(s => s.id === savedId);
        set({ currentScenarioId: saved ? saved.id : scenarios[0].id });
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
    const deletedSteps: string[] = [];
    try {
      // Cascade: supprimer les données liées avant le scénario
      await affectationRepository.deleteByScenario(id);
      deletedSteps.push('affectations');
      await groupeRepository.deleteByScenario(id);
      deletedSteps.push('groupes');
      await juryRepository.deleteByScenarioId(id);
      deletedSteps.push('jurys');
      await scenarioRepository.delete(id);
      deletedSteps.push('scenario');
      set(state => {
        const newScenarios = state.scenarios.filter(s => s.id !== id);
        const newCurrentId = state.currentScenarioId === id
          ? (newScenarios.length > 0 ? newScenarios[0].id : null)
          : state.currentScenarioId;
        if (newCurrentId !== state.currentScenarioId) saveScenarioId(newCurrentId);
        return {
          scenarios: newScenarios,
          currentScenarioId: newCurrentId,
        };
      });
    } catch (error) {
      console.error(
        `[ScenarioStore] Cascade delete failed for scenario ${id}. ` +
        `Already deleted: [${deletedSteps.join(', ')}]. ` +
        `Error:`, error
      );
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  setCurrentScenario: (id) => {
    saveScenarioId(id);
    set({ currentScenarioId: id });
  },

  setActiveScenario: (id) => {
    saveScenarioId(id);
    set({ currentScenarioId: id });
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
