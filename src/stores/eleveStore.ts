// ============================================================
// ZUSTAND STORE - ÉLÈVES
// ============================================================

import { create } from 'zustand';
import type { Eleve, FilterEleves, Contrainte } from '../domain/models';
import { repositories } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';
import { reconcileRows, byIds } from './dbSync';

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

  // Groupes oraux
  setGroupeOral: (eleveIds: string[]) => Promise<void>;
  removeFromGroupeOral: (eleveId: string) => Promise<void>;

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

export const useEleveStore = create<EleveState>((set, get) => {
  /**
   * Relit en base les élèves `ids` et aligne la vue en mémoire : la base est
   * la source de vérité, le store n'en garde qu'une copie de lecture.
   */
  const syncFromDb = async (ids: readonly string[]): Promise<Eleve[]> => {
    const fresh = await getRepo().getByIds(ids);
    set(state => ({ eleves: reconcileRows(state.eleves, fresh, byIds(ids)) }));
    return fresh;
  };

  return {
  eleves: [],
  loading: false,
  error: null,
  filters: defaultFilters,
  selectedEleveIds: [],

  loadEleves: async () => {
    set({ loading: true, error: null });
    try {
      // Charger et dédupliquer depuis la base
      const eleves = await getRepo().getAllAndDedupe();
      set({ eleves, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },

  addEleve: async (eleve) => {
    try {
      const created = await getRepo().create(eleve);
      const [fresh] = await syncFromDb([created.id]);
      return fresh ?? created;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addEleves: async (eleves) => {
    try {
      const created = await getRepo().createMany(eleves);
      const fresh = await syncFromDb(created.map(e => e.id));
      return fresh.length === created.length ? fresh : created;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateEleve: async (id, updates) => {
    try {
      await getRepo().update(id, updates);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateClasseForMany: async (ids, classe) => {
    try {
      await getRepo().updateClasseForMany(ids, classe);
      await syncFromDb(ids);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEleve: async (id) => {
    try {
      await getRepo().delete(id);
      await syncFromDb([id]);
      set(state => ({
        selectedEleveIds: state.selectedEleveIds.filter(i => i !== id),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteEleves: async (ids) => {
    try {
      await getRepo().deleteMany(ids);
      await syncFromDb(ids);
      set(state => ({
        selectedEleveIds: state.selectedEleveIds.filter(i => !ids.includes(i)),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteAllEleves: async () => {
    try {
      await getRepo().deleteAll();
      set({ eleves: await getRepo().getAll(), selectedEleveIds: [] });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addContrainte: async (eleveId, contrainte) => {
    try {
      await getRepo().addContrainte(eleveId, contrainte);
      await syncFromDb([eleveId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  removeContrainte: async (eleveId, cibleId) => {
    try {
      await getRepo().removeContrainte(eleveId, cibleId);
      await syncFromDb([eleveId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  setGroupeOral: async (eleveIds) => {
    try {
      const stateNow = get();
      const moving = new Set(eleveIds);

      // Groupes que quittent les élèves regroupés
      const leftGroups = new Set<string>();
      for (const eleve of stateNow.eleves) {
        if (moving.has(eleve.id) && eleve.groupeOralId) leftGroups.add(eleve.groupeOralId);
      }

      // Un seul calcul de l'état visé, écrit en base puis relu : les élèves
      // regroupés reçoivent le nouvel identifiant, et un ancien groupe réduit
      // à un seul membre est dissous.
      const groupeId = crypto.randomUUID();
      const updates: { id: string; groupeOralId: string | undefined }[] = [];
      for (const eleve of stateNow.eleves) {
        if (moving.has(eleve.id)) continue;
        if (!eleve.groupeOralId || !leftGroups.has(eleve.groupeOralId)) continue;
        const others = stateNow.eleves.filter(
          m => m.groupeOralId === eleve.groupeOralId && !moving.has(m.id) && m.id !== eleve.id
        );
        if (others.length === 0) updates.push({ id: eleve.id, groupeOralId: undefined });
      }
      for (const id of eleveIds) {
        updates.push({ id, groupeOralId: groupeId });
      }

      // Execute all updates — if any fails, stop and report
      for (const upd of updates) {
        await getRepo().update(upd.id, { groupeOralId: upd.groupeOralId });
      }

      await syncFromDb(updates.map(u => u.id));
    } catch (error) {
      // On failure, reload from DB to ensure consistent state
      await get().loadEleves();
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  removeFromGroupeOral: async (eleveId) => {
    try {
      const eleve = get().eleves.find(e => e.id === eleveId);
      if (!eleve?.groupeOralId) return;
      const groupeId = eleve.groupeOralId;
      const members = get().eleves.filter(e => e.groupeOralId === groupeId);
      const touched = [eleveId];

      // Remove this eleve from group
      await getRepo().update(eleveId, { groupeOralId: undefined });

      // If only 1 member remains, dissolve the group
      const remaining = members.filter(e => e.id !== eleveId);
      if (remaining.length === 1) {
        await getRepo().update(remaining[0]!.id!, { groupeOralId: undefined });
        touched.push(remaining[0]!.id);
      }

      await syncFromDb(touched);
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

      // Filtre nonAffectesOnly est géré au niveau du composant (nécessite les affectations)

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
  };
});
