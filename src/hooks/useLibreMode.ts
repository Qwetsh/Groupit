// ============================================================
// HOOK - MODE LIBRE (état local + localStorage)
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';

// ============ TYPES ============

export interface LibreGroupe {
  id: string;
  nom: string;
  eleveIds: string[];
  enseignantIds: string[];
  salle: string | null;
  /** Taille jury override (null = utilise le défaut global) */
  tailleJuryOverride: number | null;
}

export interface LibreConfig {
  tailleJuryDefaut: number;
  showDistance: boolean;
}

export interface LibreState {
  groupes: LibreGroupe[];
  config: LibreConfig;
}

export interface LibreExport {
  version: 1;
  exportedAt: string;
  state: LibreState;
}

const STORAGE_KEY = 'groupit_libreMode';

const DEFAULT_CONFIG: LibreConfig = {
  tailleJuryDefaut: 2,
  showDistance: false,
};

const DEFAULT_STATE: LibreState = {
  groupes: [],
  config: DEFAULT_CONFIG,
};

let groupeCounter = 0;

function generateGroupeId(): string {
  return `libre-g-${Date.now()}-${++groupeCounter}`;
}

function loadFromStorage(): LibreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LibreState;
      // Re-sync counter
      for (const g of parsed.groupes) {
        const match = g.id.match(/-(\d+)$/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > groupeCounter) groupeCounter = n;
        }
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return DEFAULT_STATE;
}

function saveToStorage(state: LibreState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ============ HOOK ============

export function useLibreMode() {
  const [state, setState] = useState<LibreState>(loadFromStorage);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // --- Config ---

  const setTailleJuryDefaut = useCallback((n: number) => {
    setState(s => ({ ...s, config: { ...s.config, tailleJuryDefaut: n } }));
  }, []);

  const setShowDistance = useCallback((show: boolean) => {
    setState(s => ({ ...s, config: { ...s.config, showDistance: show } }));
  }, []);

  // --- Groupes CRUD ---

  const addGroupe = useCallback((nom?: string): string => {
    const id = generateGroupeId();
    const num = stateRef.current.groupes.length + 1;
    const groupe: LibreGroupe = {
      id,
      nom: nom ?? `Groupe ${num}`,
      eleveIds: [],
      enseignantIds: [],
      salle: null,
      tailleJuryOverride: null,
    };
    setState(s => ({ ...s, groupes: [...s.groupes, groupe] }));
    return id;
  }, []);

  const removeGroupe = useCallback((groupeId: string) => {
    setState(s => ({
      ...s,
      groupes: s.groupes.filter(g => g.id !== groupeId),
    }));
  }, []);

  const updateGroupe = useCallback((groupeId: string, patch: Partial<Pick<LibreGroupe, 'nom' | 'salle' | 'tailleJuryOverride'>>) => {
    setState(s => ({
      ...s,
      groupes: s.groupes.map(g => g.id === groupeId ? { ...g, ...patch } : g),
    }));
  }, []);

  // --- Affectation élèves ---

  const addEleveToGroupe = useCallback((eleveId: string, groupeId: string) => {
    setState(s => {
      // Retirer de tout autre groupe d'abord
      const groupes = s.groupes.map(g => ({
        ...g,
        eleveIds: g.eleveIds.filter(id => id !== eleveId),
      }));
      return {
        ...s,
        groupes: groupes.map(g =>
          g.id === groupeId ? { ...g, eleveIds: [...g.eleveIds, eleveId] } : g
        ),
      };
    });
  }, []);

  const removeEleveFromGroupe = useCallback((eleveId: string, groupeId: string) => {
    setState(s => ({
      ...s,
      groupes: s.groupes.map(g =>
        g.id === groupeId ? { ...g, eleveIds: g.eleveIds.filter(id => id !== eleveId) } : g
      ),
    }));
  }, []);

  // --- Affectation enseignants ---

  const addEnseignantToGroupe = useCallback((enseignantId: string, groupeId: string) => {
    setState(s => {
      const groupe = s.groupes.find(g => g.id === groupeId);
      if (!groupe) return s;
      const maxSize = groupe.tailleJuryOverride ?? s.config.tailleJuryDefaut;
      if (groupe.enseignantIds.length >= maxSize) return s;

      // Retirer de tout autre groupe d'abord
      const groupes = s.groupes.map(g => ({
        ...g,
        enseignantIds: g.enseignantIds.filter(id => id !== enseignantId),
      }));
      return {
        ...s,
        groupes: groupes.map(g =>
          g.id === groupeId ? { ...g, enseignantIds: [...g.enseignantIds, enseignantId] } : g
        ),
      };
    });
  }, []);

  const removeEnseignantFromGroupe = useCallback((enseignantId: string, groupeId: string) => {
    setState(s => ({
      ...s,
      groupes: s.groupes.map(g =>
        g.id === groupeId ? { ...g, enseignantIds: g.enseignantIds.filter(id => id !== enseignantId) } : g
      ),
    }));
  }, []);

  // --- Export / Import JSON ---

  const exportJSON = useCallback((): LibreExport => {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      state: stateRef.current,
    };
  }, []);

  const importJSON = useCallback((data: LibreExport) => {
    if (data.version !== 1) throw new Error('Version non supportée');
    setState(data.state);
  }, []);

  // --- Reset ---

  const resetAll = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // --- Computed: sets of assigned IDs ---

  const assignedEleveIds = new Set(state.groupes.flatMap(g => g.eleveIds));
  const assignedEnseignantIds = new Set(state.groupes.flatMap(g => g.enseignantIds));

  return {
    state,
    config: state.config,
    groupes: state.groupes,
    assignedEleveIds,
    assignedEnseignantIds,

    // Config
    setTailleJuryDefaut,
    setShowDistance,

    // Groupes
    addGroupe,
    removeGroupe,
    updateGroupe,

    // Élèves
    addEleveToGroupe,
    removeEleveFromGroupe,

    // Enseignants
    addEnseignantToGroupe,
    removeEnseignantFromGroupe,

    // JSON
    exportJSON,
    importJSON,

    // Reset
    resetAll,
  };
}
