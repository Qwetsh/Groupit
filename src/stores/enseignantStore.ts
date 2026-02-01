// ============================================================
// ZUSTAND STORE - ENSEIGNANTS
// ============================================================

import { create } from 'zustand';
import type { Enseignant, FilterEnseignants, CapaciteConfig } from '../domain/models';
import { enseignantRepository } from '../infrastructure/repositories';
import { enseignantBackupService } from '../services/backupService';
import { extractErrorMessage } from '../utils/errorUtils';

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

export const useEnseignantStore = create<EnseignantState>((set, get) => ({
  enseignants: [],
  loading: false,
  error: null,
  filters: defaultFilters,
  selectedEnseignantIds: [],
  
  loadEnseignants: async () => {
    set({ loading: true, error: null });
    try {
      // Charger et dédupliquer depuis la base
      let enseignants = await enseignantRepository.getAllAndDedupe();

      // Si la base est vide, tenter de restaurer depuis le backup
      if (enseignants.length === 0) {
        const backup = enseignantBackupService.restore();
        if (backup && backup.length > 0) {
          enseignants = await enseignantRepository.restoreFromBackup(backup);
          console.info(`[EnseignantStore] ${enseignants.length} enseignant(s) restauré(s) depuis le backup`);
        }
      }

      // Mettre à jour le backup
      enseignantBackupService.persist(enseignants);

      set({ enseignants, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },
  
  addEnseignant: async (enseignant) => {
    try {
      const newEnseignant = await enseignantRepository.create(enseignant);
      set(state => {
        const enseignants = [...state.enseignants, newEnseignant];
        enseignantBackupService.persist(enseignants);
        return { enseignants };
      });
      return newEnseignant;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addEnseignants: async (enseignants) => {
    try {
      const newEnseignants = await enseignantRepository.createMany(enseignants);
      set(state => {
        const allEnseignants = [...state.enseignants, ...newEnseignants];
        enseignantBackupService.persist(allEnseignants);
        return { enseignants: allEnseignants };
      });
      return newEnseignants;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateEnseignant: async (id, updates) => {
    try {
      await enseignantRepository.update(id, updates);
      set(state => {
        const enseignants = state.enseignants.map(e =>
          e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
        );
        enseignantBackupService.persist(enseignants);
        return { enseignants };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEnseignant: async (id) => {
    try {
      await enseignantRepository.delete(id);
      set(state => {
        const enseignants = state.enseignants.filter(e => e.id !== id);
        enseignantBackupService.persist(enseignants);
        return {
          enseignants,
          selectedEnseignantIds: state.selectedEnseignantIds.filter(i => i !== id),
        };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEnseignants: async (ids) => {
    try {
      await enseignantRepository.deleteMany(ids);
      set(state => {
        const enseignants = state.enseignants.filter(e => !ids.includes(e.id));
        enseignantBackupService.persist(enseignants);
        return {
          enseignants,
          selectedEnseignantIds: state.selectedEnseignantIds.filter(i => !ids.includes(i)),
        };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteAllEnseignants: async () => {
    try {
      await enseignantRepository.deleteAll();
      enseignantBackupService.clear();
      set({ enseignants: [], selectedEnseignantIds: [] });
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
}));
