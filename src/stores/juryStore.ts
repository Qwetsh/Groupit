// ============================================================
// JURY STORE - Gestion des jurys (Oral DNB)
// ============================================================

import { create } from 'zustand';
import type { Jury, JuryStats, Enseignant, Scenario } from '../domain/models';
import { composerJurys, type JuryCompositionOptions, type JuryComposition } from '../algorithms/juryComposition';
import { juryRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';
import { reconcileRows, byIds } from './dbSync';

// ============================================================
// GÉNÉRATION AUTOMATIQUE DES JURYS
// ============================================================
// L'algorithme vit dans algorithms/juryComposition.ts (testé à part).

interface JuryGenerationOptions extends JuryCompositionOptions {
  capaciteParJury?: number;
}

// ============================================================
// INTERFACE DU STORE
// ============================================================

interface JuryState {
  jurys: Jury[];
  loading: boolean;
  error: string | null;
  
  // Actions CRUD
  loadJurys: () => Promise<void>;
  addJury: (jury: Omit<Jury, 'id' | 'createdAt' | 'updatedAt' | 'stats'>) => Promise<string>;
  updateJury: (id: string, updates: Partial<Jury>) => Promise<void>;
  deleteJury: (id: string) => Promise<void>;
  
  // Actions spécifiques
  addEnseignantToJury: (juryId: string, enseignantId: string) => Promise<void>;
  removeEnseignantFromJury: (juryId: string, enseignantId: string) => Promise<void>;
  moveEnseignantBetweenJurys: (enseignantId: string, fromJuryId: string | null, toJuryId: string | null) => Promise<void>;
  updateJuryStats: (juryId: string, stats: JuryStats) => Promise<void>;
  
  // Génération automatique
  /** Compose les jurys ; renvoie les enseignants écartés car indisponibles. */
  generateJurysAuto: (
    scenario: Scenario,
    enseignants: Enseignant[],
    options?: JuryGenerationOptions
  ) => Promise<Pick<JuryComposition, 'indisponibles'>>;
  
  // Queries
  getJurysByScenario: (scenarioId: string) => Jury[];
  getJuryById: (id: string) => Jury | undefined;
  
  // Bulk
  clearJurysByScenario: (scenarioId: string) => Promise<void>;
  
  // Calcul des matières couvertes par un jury
  computeJuryMatieres: (jury: Jury, enseignants: Enseignant[]) => string[];
}

export const useJuryStore = create<JuryState>((set, get) => {
  /** Relit en base les jurys `ids` et aligne la vue en mémoire. */
  const syncFromDb = async (ids: readonly string[]): Promise<void> => {
    const fresh = await juryRepository.getByIds(ids);
    set(state => ({ jurys: reconcileRows(state.jurys, fresh, byIds(ids)) }));
  };

  return {
  jurys: [],
  loading: false,
  error: null,

  loadJurys: async () => {
    set({ loading: true, error: null });
    try {
      const jurys = await juryRepository.getAll();
      set({ jurys, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },

  addJury: async (juryData) => {
    try {
      const created = await juryRepository.create(juryData);
      await syncFromDb([created.id]);
      return created.id!;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  updateJury: async (id, updates) => {
    try {
      await juryRepository.update(id, updates);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  deleteJury: async (id) => {
    try {
      await juryRepository.delete(id);
      await syncFromDb([id]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  addEnseignantToJury: async (juryId, enseignantId) => {
    try {
      await juryRepository.addEnseignant(juryId, enseignantId);
      await syncFromDb([juryId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  removeEnseignantFromJury: async (juryId, enseignantId) => {
    try {
      await juryRepository.removeEnseignant(juryId, enseignantId);
      await syncFromDb([juryId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  moveEnseignantBetweenJurys: async (enseignantId, fromJuryId, toJuryId) => {
    try {
      // Retirer de l'ancien jury si spécifié (titulaire OU suppléant)
      if (fromJuryId) {
        const fromJury = get().jurys.find(j => j.id === fromJuryId);
        if (fromJury?.suppleantsIds?.includes(enseignantId)) {
          // C'est un suppléant
          await juryRepository.update(fromJuryId, {
            suppleantsIds: fromJury.suppleantsIds.filter(id => id !== enseignantId),
          });
        } else {
          await juryRepository.removeEnseignant(fromJuryId, enseignantId);
        }
      }
      // Ajouter au nouveau jury si spécifié (en tant que titulaire)
      if (toJuryId) {
        await juryRepository.addEnseignant(toJuryId, enseignantId);
      }
      await syncFromDb([fromJuryId, toJuryId].filter((id): id is string => !!id));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },
  updateJuryStats: async (juryId, stats) => {
    try {
      await juryRepository.update(juryId, { stats });
      await syncFromDb([juryId]);
    } catch (error) {
      set({ error: extractErrorMessage(error) });
    }
  },
  getJurysByScenario: (scenarioId) => {
    return get().jurys.filter(j => j.scenarioId === scenarioId);
  },

  getJuryById: (id) => {
    return get().jurys.find(j => j.id === id);
  },

  clearJurysByScenario: async (scenarioId) => {
    try {
      await juryRepository.deleteByScenarioId(scenarioId);
      const fresh = await juryRepository.getByScenarioId(scenarioId);
      set(state => ({
        jurys: reconcileRows(state.jurys, fresh, j => j.scenarioId === scenarioId)
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
    }
  },
  generateJurysAuto: async (scenario, enseignants, options = {}) => {
    const scenarioId = scenario.id!;
    const capaciteParJury = options.capaciteParJury || scenario.parametres.oralDnb?.capaciteJuryDefaut || 8;
    // Supprimer les jurys existants pour ce scénario
    await get().clearJurysByScenario(scenarioId);
    // Composer les jurys
    const { jurys: distribution, indisponibles } = composerJurys(enseignants, {
      ...options,
      enseignantsParJury: options.enseignantsParJury || 2,
      demiJournees: options.demiJournees ?? scenario.parametres.oralDnb?.demiJourneesOral,
    });
    // Créer tous les jurys puis mettre à jour le state en une seule fois
    const createdIds: string[] = [];
    for (let i = 0; i < distribution.length; i++) {
      const distrib = distribution[i];
      const newJury = await juryRepository.create({
        scenarioId,
        nom: `Jury ${i + 1}`,
        enseignantIds: distrib.enseignantIds,
        suppleantsIds: distrib.suppleantsIds,
        capaciteMax: capaciteParJury,
      });
      createdIds.push(newJury.id);
    }
    await syncFromDb(createdIds);
    return { indisponibles };
  },
  computeJuryMatieres: (jury, enseignants) => {
    const matieres = new Set<string>();
    jury.enseignantIds.forEach(ensId => {
      const ens = enseignants.find(e => e.id === ensId);
      if (ens?.matierePrincipale) {
        matieres.add(ens.matierePrincipale);
      }
    });
    return Array.from(matieres);
  },
  };
});
