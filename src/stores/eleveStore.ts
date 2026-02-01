// ============================================================
// ZUSTAND STORE - ÉLÈVES
// ============================================================

import { create } from 'zustand';
import type { Eleve, FilterEleves, Contrainte } from '../domain/models';
import { repositories } from '../infrastructure/repositories';
import { eleveBackupService } from '../services/backupService';
import { extractErrorMessage } from '../utils/errorUtils';

// Utilise le registry pour permettre l'injection en tests
const getRepo = () => repositories.eleve;

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
      // Charger et dédupliquer depuis la base
      let eleves = await getRepo().getAllAndDedupe();

      // Si la base est vide, tenter de restaurer depuis le backup
      if (eleves.length === 0) {
        const backup = eleveBackupService.restore();
        if (backup && backup.length > 0) {
          eleves = await getRepo().restoreFromBackup(backup);
          console.info(`[EleveStore] ${eleves.length} élève(s) restauré(s) depuis le backup`);
        }
      }

      // Mettre à jour le backup avec les données actuelles
      eleveBackupService.persist(eleves);

      set({ eleves, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },

  addEleve: async (eleve) => {
    try {
      const newEleve = await getRepo().create(eleve);
      set(state => {
        const eleves = [...state.eleves, newEleve];
        eleveBackupService.persist(eleves);
        return { eleves };
      });
      return newEleve;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addEleves: async (eleves) => {
    try {
      const newEleves = await getRepo().createMany(eleves);
      set(state => {
        const allEleves = [...state.eleves, ...newEleves];
        eleveBackupService.persist(allEleves);
        return { eleves: allEleves };
      });
      return newEleves;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateEleve: async (id, updates) => {
    try {
      await getRepo().update(id, updates);
      set(state => {
        const eleves = state.eleves.map(e =>
          e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
        );
        eleveBackupService.persist(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateClasseForMany: async (ids, classe) => {
    try {
      await getRepo().updateClasseForMany(ids, classe);
      set(state => {
        const eleves = state.eleves.map(e =>
          ids.includes(e.id) ? { ...e, classe, updatedAt: new Date() } : e
        );
        eleveBackupService.persist(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEleve: async (id) => {
    try {
      await getRepo().delete(id);
      set(state => {
        const eleves = state.eleves.filter(e => e.id !== id);
        eleveBackupService.persist(eleves);
        return {
          eleves,
          selectedEleveIds: state.selectedEleveIds.filter(i => i !== id),
        };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEleves: async (ids) => {
    try {
      await getRepo().deleteMany(ids);
      set(state => {
        const eleves = state.eleves.filter(e => !ids.includes(e.id));
        eleveBackupService.persist(eleves);
        return {
          eleves,
          selectedEleveIds: state.selectedEleveIds.filter(i => !ids.includes(i)),
        };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteAllEleves: async () => {
    try {
      await getRepo().deleteAll();
      eleveBackupService.clear();
      set({ eleves: [], selectedEleveIds: [] });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addContrainte: async (eleveId, contrainte) => {
    try {
      await getRepo().addContrainte(eleveId, contrainte);
      set(state => {
        const eleves = state.eleves.map(e =>
          e.id === eleveId
            ? { ...e, contraintes: [...e.contraintes, contrainte], updatedAt: new Date() }
            : e
        );
        eleveBackupService.persist(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  removeContrainte: async (eleveId, cibleId) => {
    try {
      await getRepo().removeContrainte(eleveId, cibleId);
      set(state => {
        const eleves = state.eleves.map(e =>
          e.id === eleveId
            ? { ...e, contraintes: e.contraintes.filter(c => c.cibleId !== cibleId), updatedAt: new Date() }
            : e
        );
        eleveBackupService.persist(eleves);
        return { eleves };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
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
