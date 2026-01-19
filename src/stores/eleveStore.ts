// ============================================================
// ZUSTAND STORE - ÉLÈVES
// ============================================================

import { create } from 'zustand';
import type { Eleve, FilterEleves, Contrainte } from '../domain/models';
import { eleveRepository } from '../infrastructure/repositories';

// ============================================================
// Backup localStorage pour éviter la perte des données élèves
// en cas de changement d'origine (port) ou de reset IndexedDB.
// ============================================================
const ELEVE_LS_KEY = 'groupit-eleves-backup';

const persistElevesToLocalStorage = (eleves: Eleve[]) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ELEVE_LS_KEY, JSON.stringify(eleves));
  } catch (error) {
    console.warn('Impossible de sauvegarder les élèves dans localStorage', error);
  }
};

const loadElevesFromLocalStorage = (): Eleve[] => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(ELEVE_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Eleve[];
    // Reconvertir les dates
    return parsed.map(e => ({
      ...e,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    }));
  } catch (error) {
    console.warn('Impossible de charger les élèves depuis localStorage', error);
    return [];
  }
};

// Supprime les doublons en utilisant un key stable (nom+prenom+classe+dateNaissance)
// et retourne la liste nettoyée + les ids supprimés pour nettoyage DB.
const dedupeEleves = (eleves: Eleve[]): { clean: Eleve[]; removedIds: string[] } => {
  const seen = new Set<string>();
  const clean: Eleve[] = [];
  const removedIds: string[] = [];

  eleves.forEach(eleve => {
    const key = `${eleve.nom?.toLowerCase() || ''}|${eleve.prenom?.toLowerCase() || ''}|${eleve.classe || ''}|${eleve.dateNaissance || ''}`;
    if (seen.has(key)) {
      if (eleve.id) removedIds.push(eleve.id);
      return;
    }
    seen.add(key);
    clean.push(eleve);
  });

  return { clean, removedIds };
};

interface EleveState {
  eleves: Eleve[];
  loading: boolean;
  error: string | null;
  filters: FilterEleves;
  selectedEleveIds: string[];
  
  // Actions
  loadEleves: () => Promise<void>;
  addEleve: (eleve: Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Eleve>;
  addEleves: (eleves: Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<Eleve[]>;
  updateEleve: (id: string, updates: Partial<Eleve>) => Promise<void>;
  updateClasseForMany: (ids: string[], classe: string) => Promise<void>;
  deleteEleve: (id: string) => Promise<void>;
  deleteEleves: (ids: string[]) => Promise<void>;
  deleteAllEleves: () => Promise<void>;
  
  // Contraintes
  addContrainte: (eleveId: string, contrainte: Contrainte) => Promise<void>;
  removeContrainte: (eleveId: string, cibleId: string) => Promise<void>;
  
  // Filtres
  setFilters: (filters: Partial<FilterEleves>) => void;
  resetFilters: () => void;
  
  // Sélection
  selectEleve: (id: string) => void;
  deselectEleve: (id: string) => void;
  toggleSelectEleve: (id: string) => void;
  selectAllEleves: () => void;
  deselectAllEleves: () => void;
  
  // Getters
  getFilteredEleves: () => Eleve[];
  getEleveById: (id: string) => Eleve | undefined;
  getElevesByClasse: (classe: string) => Eleve[];
  getDistinctClasses: () => string[];
  getDistinctOptions: () => string[];
}

const defaultFilters: FilterEleves = {
  classe: undefined,
  option: undefined,
  nonAffectesOnly: false,
  recherche: '',
};

export const useEleveStore = create<EleveState>((set, get) => ({
  eleves: [],
  loading: false,
  error: null,
  filters: defaultFilters,
  selectedEleveIds: [],
  
  loadEleves: async () => {
    set({ loading: true, error: null });
    try {
      const eleves = await eleveRepository.getAll();
      // Si la base est vide mais qu'un backup existe, on restaure depuis localStorage
      if (eleves.length === 0) {
        const backup = loadElevesFromLocalStorage();
        if (backup.length > 0) {
          // Déduper AVANT d'insérer en base pour éviter les doublons
          const { clean } = dedupeEleves(backup);
          const created = await eleveRepository.createMany(
            clean.map(({ id: _id, createdAt: _c, updatedAt: _u, ...rest }) => rest)
          );
          persistElevesToLocalStorage(created);
          set({ eleves: created, loading: false });
          return;
        }
      }
      const { clean, removedIds } = dedupeEleves(eleves);
      if (removedIds.length > 0) {
        await eleveRepository.deleteMany(removedIds);
      }
      persistElevesToLocalStorage(clean);
      set({ eleves: clean, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },
  
  addEleve: async (eleve) => {
    try {
      const newEleve = await eleveRepository.create(eleve);
      set(state => {
        const eleves = [...state.eleves, newEleve];
        persistElevesToLocalStorage(eleves);
        return { eleves };
      });
      return newEleve;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  addEleves: async (eleves) => {
    try {
      const newEleves = await eleveRepository.createMany(eleves);
      set(state => {
        const merged = [...state.eleves, ...newEleves];
        const { clean } = dedupeEleves(merged);
        persistElevesToLocalStorage(clean);
        return { eleves: clean };
      });
      return newEleves;
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  updateEleve: async (id, updates) => {
    try {
      await eleveRepository.update(id, updates);
      set(state => {
        const eleves = state.eleves.map(e => 
          e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
        );
        persistElevesToLocalStorage(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  updateClasseForMany: async (ids, classe) => {
    try {
      await eleveRepository.updateClasseForMany(ids, classe);
      set(state => {
        const eleves = state.eleves.map(e => 
          ids.includes(e.id) ? { ...e, classe, updatedAt: new Date() } : e
        );
        persistElevesToLocalStorage(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  deleteEleve: async (id) => {
    try {
      await eleveRepository.delete(id);
      set(state => {
        const eleves = state.eleves.filter(e => e.id !== id);
        persistElevesToLocalStorage(eleves);
        return {
          eleves,
          selectedEleveIds: state.selectedEleveIds.filter(i => i !== id),
        };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  deleteEleves: async (ids) => {
    try {
      await eleveRepository.deleteMany(ids);
      set(state => {
        const eleves = state.eleves.filter(e => !ids.includes(e.id));
        persistElevesToLocalStorage(eleves);
        return {
          eleves,
          selectedEleveIds: state.selectedEleveIds.filter(i => !ids.includes(i)),
        };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  deleteAllEleves: async () => {
    try {
      await eleveRepository.deleteAll();
      set({ eleves: [], selectedEleveIds: [] });
      persistElevesToLocalStorage([]);
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  addContrainte: async (eleveId, contrainte) => {
    try {
      await eleveRepository.addContrainte(eleveId, contrainte);
      set(state => {
        const eleves = state.eleves.map(e => 
          e.id === eleveId 
            ? { ...e, contraintes: [...e.contraintes, contrainte], updatedAt: new Date() }
            : e
        );
        persistElevesToLocalStorage(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  removeContrainte: async (eleveId, cibleId) => {
    try {
      await eleveRepository.removeContrainte(eleveId, cibleId);
      set(state => {
        const eleves = state.eleves.map(e => 
          e.id === eleveId 
            ? { ...e, contraintes: e.contraintes.filter(c => c.cibleId !== cibleId), updatedAt: new Date() }
            : e
        );
        persistElevesToLocalStorage(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },
  
  setFilters: (filters) => {
    set(state => ({
      filters: { ...state.filters, ...filters },
    }));
  },
  
  resetFilters: () => {
    set({ filters: defaultFilters });
  },
  
  selectEleve: (id) => {
    set(state => ({
      selectedEleveIds: state.selectedEleveIds.includes(id) 
        ? state.selectedEleveIds 
        : [...state.selectedEleveIds, id],
    }));
  },
  
  deselectEleve: (id) => {
    set(state => ({
      selectedEleveIds: state.selectedEleveIds.filter(i => i !== id),
    }));
  },
  
  toggleSelectEleve: (id) => {
    set(state => ({
      selectedEleveIds: state.selectedEleveIds.includes(id)
        ? state.selectedEleveIds.filter(i => i !== id)
        : [...state.selectedEleveIds, id],
    }));
  },
  
  selectAllEleves: () => {
    const filteredEleves = get().getFilteredEleves();
    set({ selectedEleveIds: filteredEleves.map(e => e.id) });
  },
  
  deselectAllEleves: () => {
    set({ selectedEleveIds: [] });
  },
  
  getFilteredEleves: () => {
    const { eleves, filters } = get();
    
    return eleves.filter(eleve => {
      // Filtre classe
      if (filters.classe && eleve.classe !== filters.classe) {
        return false;
      }
      
      // Filtre option
      if (filters.option && !eleve.options.includes(filters.option)) {
        return false;
      }
      
      // Filtre recherche
      if (filters.recherche) {
        const search = filters.recherche.toLowerCase();
        const matchNom = eleve.nom.toLowerCase().includes(search);
        const matchPrenom = eleve.prenom.toLowerCase().includes(search);
        const matchClasse = eleve.classe.toLowerCase().includes(search);
        if (!matchNom && !matchPrenom && !matchClasse) {
          return false;
        }
      }
      
      return true;
    });
  },
  
  getEleveById: (id) => {
    return get().eleves.find(e => e.id === id);
  },
  
  getElevesByClasse: (classe) => {
    return get().eleves.filter(e => e.classe === classe);
  },
  
  getDistinctClasses: () => {
    const classes = new Set(get().eleves.map(e => e.classe));
    return Array.from(classes).sort();
  },
  
  getDistinctOptions: () => {
    const options = new Set<string>();
    get().eleves.forEach(e => e.options.forEach(o => options.add(o)));
    return Array.from(options).sort();
  },
}));
