// ============================================================
// ZUSTAND STORE - ENSEIGNANTS
// ============================================================

import { create } from 'zustand';
import type { Enseignant, FilterEnseignants, CapaciteConfig } from '../domain/models';
import { enseignantRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';
import { reconcileRows, byIds } from './dbSync';

interface EnseignantState {
  enseignants: Enseignant[];
  loading: boolean;
  error: string | null;
  filters: FilterEnseignants;
  selectedEnseignantIds: string[];
  
  // Actions
  loadEnseignants: () => Promise<void>;
  addEnseignant: (enseignant: Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Enseignant>;
  addEnseignants: (enseignants: Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<Enseignant[]>;
  updateEnseignant: (id: string, updates: Partial<Enseignant>) => Promise<void>;
  deleteEnseignant: (id: string) => Promise<void>;
  deleteEnseignants: (ids: string[]) => Promise<void>;
  deleteAllEnseignants: () => Promise<void>;
  
  // Filtres
  setFilters: (filters: Partial<FilterEnseignants>) => void;
  resetFilters: () => void;
  
  // Sélection
  selectEnseignant: (id: string) => void;
  deselectEnseignant: (id: string) => void;
  toggleSelectEnseignant: (id: string) => void;
  selectAllEnseignants: () => void;
  deselectAllEnseignants: () => void;
  
  // Getters
  getFilteredEnseignants: () => Enseignant[];
  getEnseignantById: (id: string) => Enseignant | undefined;
  getEnseignantsByMatiere: (matiere: string) => Enseignant[];
  getDistinctMatieres: () => string[];
  calculateCapacity: (enseignant: Enseignant, config: CapaciteConfig) => number;
}

const defaultFilters: FilterEnseignants = {
  matiere: undefined,
  ppOnly: false,
  classePP: undefined,
  classeEnCharge: undefined,
  recherche: '',
};

export const useEnseignantStore = create<EnseignantState>((set, get) => {
  /**
   * Relit en base les enseignants `ids` et aligne la vue en mémoire : la base
   * est la source de vérité, le store n'en garde qu'une copie de lecture.
   */
  const syncFromDb = async (ids: readonly string[]): Promise<Enseignant[]> => {
    const fresh = await enseignantRepository.getByIds(ids);
    set(state => ({ enseignants: reconcileRows(state.enseignants, fresh, byIds(ids)) }));
    return fresh;
  };

  return {
  enseignants: [],
  loading: false,
  error: null,
  filters: defaultFilters,
  selectedEnseignantIds: [],
  
  loadEnseignants: async () => {
    set({ loading: true, error: null });
    try {
      // Charger et dédupliquer depuis la base
      const enseignants = await enseignantRepository.getAllAndDedupe();
      set({ enseignants, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },

  addEnseignant: async (enseignant) => {
    try {
      const created = await enseignantRepository.create(enseignant);
      const [fresh] = await syncFromDb([created.id]);
      return fresh ?? created;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addEnseignants: async (enseignants) => {
    try {
      const created = await enseignantRepository.createMany(enseignants);
      const fresh = await syncFromDb(created.map(e => e.id));
      return fresh.length === created.length ? fresh : created;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateEnseignant: async (id, updates) => {
    try {
      await enseignantRepository.update(id, updates);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEnseignant: async (id) => {
    try {
      await enseignantRepository.delete(id);
      await syncFromDb([id]);
      set(state => ({
        selectedEnseignantIds: state.selectedEnseignantIds.filter(i => i !== id),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEnseignants: async (ids) => {
    try {
      await enseignantRepository.deleteMany(ids);
      await syncFromDb(ids);
      set(state => ({
        selectedEnseignantIds: state.selectedEnseignantIds.filter(i => !ids.includes(i)),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteAllEnseignants: async () => {
    try {
      await enseignantRepository.deleteAll();
      set({ enseignants: await enseignantRepository.getAll(), selectedEnseignantIds: [] });
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
  
  selectEnseignant: (id) => {
    set(state => ({
      selectedEnseignantIds: state.selectedEnseignantIds.includes(id) 
        ? state.selectedEnseignantIds 
        : [...state.selectedEnseignantIds, id],
    }));
  },
  
  deselectEnseignant: (id) => {
    set(state => ({
      selectedEnseignantIds: state.selectedEnseignantIds.filter(i => i !== id),
    }));
  },
  
  toggleSelectEnseignant: (id) => {
    set(state => ({
      selectedEnseignantIds: state.selectedEnseignantIds.includes(id)
        ? state.selectedEnseignantIds.filter(i => i !== id)
        : [...state.selectedEnseignantIds, id],
    }));
  },
  
  selectAllEnseignants: () => {
    const filteredEnseignants = get().getFilteredEnseignants();
    set({ selectedEnseignantIds: filteredEnseignants.map(e => e.id) });
  },
  
  deselectAllEnseignants: () => {
    set({ selectedEnseignantIds: [] });
  },
  
  getFilteredEnseignants: () => {
    const { enseignants, filters } = get();
    
    return enseignants.filter(enseignant => {
      // Filtre matière
      if (filters.matiere && enseignant.matierePrincipale !== filters.matiere) {
        return false;
      }
      
      // Filtre PP only
      if (filters.ppOnly && !enseignant.estProfPrincipal) {
        return false;
      }
      
      // Filtre classePP
      if (filters.classePP && enseignant.classePP !== filters.classePP) {
        return false;
      }
      
      // Filtre classeEnCharge
      if (filters.classeEnCharge && !enseignant.classesEnCharge.includes(filters.classeEnCharge)) {
        return false;
      }
      
      // Filtre recherche
      if (filters.recherche) {
        const search = filters.recherche.toLowerCase();
        const matchNom = enseignant.nom.toLowerCase().includes(search);
        const matchPrenom = enseignant.prenom.toLowerCase().includes(search);
        const matchMatiere = enseignant.matierePrincipale.toLowerCase().includes(search);
        if (!matchNom && !matchPrenom && !matchMatiere) {
          return false;
        }
      }
      
      return true;
    });
  },
  
  getEnseignantById: (id) => {
    return get().enseignants.find(e => e.id === id);
  },
  
  getEnseignantsByMatiere: (matiere) => {
    return get().enseignants.filter(e => e.matierePrincipale === matiere);
  },
  
  getDistinctMatieres: () => {
    const matieres = new Set(get().enseignants.map(e => e.matierePrincipale));
    return Array.from(matieres).sort();
  },
  
  calculateCapacity: (enseignant, config) => {
    return enseignantRepository.calculateCapacity(enseignant, config);
  },
  };
});
