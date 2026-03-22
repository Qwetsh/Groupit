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
  /** Enseignants suppléants / réserve */
  suppleantsIds: string[];
  salle: string | null;
  /** Taille jury override (null = utilise le défaut global) */
  tailleJuryOverride: number | null;
  /** Nb réserves override (null = utilise le défaut global) */
  nbReservesOverride: number | null;
}

export interface LibreConfig {
  tailleJuryDefaut: number;
  nbReservesDefaut: number;
  showDistance: boolean;
}

export interface LibreState {
  groupes: LibreGroupe[];
  config: LibreConfig;
  /** Groupes de liaison élèves — chaque sous-tableau = élèves liés ensemble */
  eleveLinkGroups: string[][];
}

export interface LibreExport {
  version: 1;
  exportedAt: string;
  state: LibreState;
}

const STORAGE_KEY = 'groupit_libreMode';

const DEFAULT_CONFIG: LibreConfig = {
  tailleJuryDefaut: 2,
  nbReservesDefaut: 0,
  showDistance: false,
};

const DEFAULT_STATE: LibreState = {
  groupes: [],
  config: DEFAULT_CONFIG,
  eleveLinkGroups: [],
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
      // Ensure eleveLinkGroups exists (migration from v1 data)
      if (!parsed.eleveLinkGroups) parsed.eleveLinkGroups = [];
      // Ensure suppleantsIds exists on all groups
      for (const g of parsed.groupes) {
        if (!g.suppleantsIds) g.suppleantsIds = [];
        if (g.nbReservesOverride === undefined) g.nbReservesOverride = null;
      }
      // Ensure nbReservesDefaut exists
      if (parsed.config.nbReservesDefaut === undefined) parsed.config.nbReservesDefaut = 0;
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

  const setNbReservesDefaut = useCallback((n: number) => {
    setState(s => ({ ...s, config: { ...s.config, nbReservesDefaut: n } }));
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
      suppleantsIds: [],
      salle: null,
      tailleJuryOverride: null,
      nbReservesOverride: null,
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

  const updateGroupe = useCallback((groupeId: string, patch: Partial<Pick<LibreGroupe, 'nom' | 'salle' | 'tailleJuryOverride' | 'nbReservesOverride'>>) => {
    setState(s => ({
      ...s,
      groupes: s.groupes.map(g => g.id === groupeId ? { ...g, ...patch } : g),
    }));
  }, []);

  // --- Helper: get all linked eleveIds for a given eleveId ---

  const getLinkedEleveIds = useCallback((eleveId: string): string[] => {
    const group = stateRef.current.eleveLinkGroups.find(g => g.includes(eleveId));
    return group ? group.filter(id => id !== eleveId) : [];
  }, []);

  // --- Affectation élèves (moves linked élèves together) ---

  const addEleveToGroupe = useCallback((eleveId: string, groupeId: string) => {
    setState(s => {
      // Find all linked élèves to move together
      const linkGroup = s.eleveLinkGroups.find(g => g.includes(eleveId));
      const allIds = linkGroup ? linkGroup : [eleveId];

      // Remove from all groups first
      let groupes = s.groupes.map(g => ({
        ...g,
        eleveIds: g.eleveIds.filter(id => !allIds.includes(id)),
      }));
      // Add to target group
      groupes = groupes.map(g =>
        g.id === groupeId ? { ...g, eleveIds: [...g.eleveIds, ...allIds] } : g
      );
      return { ...s, groupes };
    });
  }, []);

  const removeEleveFromGroupe = useCallback((eleveId: string, groupeId: string) => {
    setState(s => {
      // Remove linked élèves together
      const linkGroup = s.eleveLinkGroups.find(g => g.includes(eleveId));
      const allIds = linkGroup ? linkGroup : [eleveId];

      return {
        ...s,
        groupes: s.groupes.map(g =>
          g.id === groupeId ? { ...g, eleveIds: g.eleveIds.filter(id => !allIds.includes(id)) } : g
        ),
      };
    });
  }, []);

  // --- Affectation enseignants ---

  const addEnseignantToGroupe = useCallback((enseignantId: string, groupeId: string) => {
    setState(s => {
      const groupe = s.groupes.find(g => g.id === groupeId);
      if (!groupe) return s;
      const maxSize = groupe.tailleJuryOverride ?? s.config.tailleJuryDefaut;
      if (groupe.enseignantIds.length >= maxSize) return s;

      const groupes = s.groupes.map(g => ({
        ...g,
        enseignantIds: g.enseignantIds.filter(id => id !== enseignantId),
        suppleantsIds: g.suppleantsIds.filter(id => id !== enseignantId),
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

  // --- Suppléants ---

  const addSuppleantToGroupe = useCallback((enseignantId: string, groupeId: string) => {
    setState(s => {
      const groupe = s.groupes.find(g => g.id === groupeId);
      if (!groupe) return s;
      const maxReserves = groupe.nbReservesOverride ?? s.config.nbReservesDefaut;
      if (maxReserves <= 0) return s;
      if (groupe.suppleantsIds.length >= maxReserves) return s;

      const groupes = s.groupes.map(g => ({
        ...g,
        enseignantIds: g.enseignantIds.filter(id => id !== enseignantId),
        suppleantsIds: g.suppleantsIds.filter(id => id !== enseignantId),
      }));
      return {
        ...s,
        groupes: groupes.map(g =>
          g.id === groupeId ? { ...g, suppleantsIds: [...g.suppleantsIds, enseignantId] } : g
        ),
      };
    });
  }, []);

  const removeSuppleantFromGroupe = useCallback((enseignantId: string, groupeId: string) => {
    setState(s => ({
      ...s,
      groupes: s.groupes.map(g =>
        g.id === groupeId ? { ...g, suppleantsIds: g.suppleantsIds.filter(id => id !== enseignantId) } : g
      ),
    }));
  }, []);

  // --- Élève link groups ---

  const linkEleves = useCallback((eleveIdA: string, eleveIdB: string) => {
    setState(s => {
      const groups = [...s.eleveLinkGroups];
      const groupA = groups.findIndex(g => g.includes(eleveIdA));
      const groupB = groups.findIndex(g => g.includes(eleveIdB));

      if (groupA >= 0 && groupB >= 0 && groupA === groupB) return s; // Already linked

      if (groupA >= 0 && groupB >= 0) {
        // Merge two groups
        const merged = [...groups[groupA], ...groups[groupB]];
        return {
          ...s,
          eleveLinkGroups: groups.filter((_, i) => i !== groupA && i !== groupB).concat([merged]),
        };
      } else if (groupA >= 0) {
        groups[groupA] = [...groups[groupA], eleveIdB];
        return { ...s, eleveLinkGroups: groups };
      } else if (groupB >= 0) {
        groups[groupB] = [...groups[groupB], eleveIdA];
        return { ...s, eleveLinkGroups: groups };
      } else {
        return { ...s, eleveLinkGroups: [...groups, [eleveIdA, eleveIdB]] };
      }
    });
  }, []);

  const unlinkEleve = useCallback((eleveId: string) => {
    setState(s => {
      const groups = s.eleveLinkGroups.map(g => g.filter(id => id !== eleveId)).filter(g => g.length >= 2);
      return { ...s, eleveLinkGroups: groups };
    });
  }, []);

  const getEleveLinkGroup = useCallback((eleveId: string): string[] | null => {
    const group = stateRef.current.eleveLinkGroups.find(g => g.includes(eleveId));
    return group ?? null;
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

  // --- Computed ---

  const assignedEleveIds = new Set(state.groupes.flatMap(g => g.eleveIds));
  const assignedEnseignantIds = new Set(state.groupes.flatMap(g => [...g.enseignantIds, ...g.suppleantsIds]));

  return {
    state,
    config: state.config,
    groupes: state.groupes,
    eleveLinkGroups: state.eleveLinkGroups,
    assignedEleveIds,
    assignedEnseignantIds,

    // Config
    setTailleJuryDefaut,
    setNbReservesDefaut,
    setShowDistance,

    // Groupes
    addGroupe,
    removeGroupe,
    updateGroupe,

    // Élèves
    addEleveToGroupe,
    removeEleveFromGroupe,
    getLinkedEleveIds,

    // Enseignants
    addEnseignantToGroupe,
    removeEnseignantFromGroupe,

    // Suppléants
    addSuppleantToGroupe,
    removeSuppleantFromGroupe,

    // Liaisons élèves
    linkEleves,
    unlinkEleve,
    getEleveLinkGroup,

    // JSON
    exportJSON,
    importJSON,

    // Reset
    resetAll,
  };
}
