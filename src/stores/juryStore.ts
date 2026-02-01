// ============================================================
// JURY STORE - Gestion des jurys (Oral DNB)
// ============================================================

import { create } from 'zustand';
import type { Jury, JuryStats, Enseignant, Scenario } from '../domain/models';
import { MATIERES_HEURES_3E } from '../domain/models';
import { juryRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';

// ============================================================
// ALGORITHME DE GÉNÉRATION AUTOMATIQUE DES JURYS
// ============================================================

interface JuryGenerationOptions {
  nbJurys?: number; // Si non spécifié, calculé automatiquement
  capaciteParJury?: number;
  enseignantsParJury?: number; // Nombre cible d'enseignants par jury (défaut: 2)
  equilibrerMatieres?: boolean; // Essayer de diversifier les matières dans chaque jury
}

/**
 * Génère automatiquement une répartition des enseignants en jurys
 * Stratégie:
 * 1. Créer exactement nbJurys jurys
 * 2. Placer exactement enseignantsParJury enseignants dans chaque jury
 * 3. Les enseignants restants ne sont PAS assignés (restent disponibles)
 * 4. Essayer de diversifier les matières dans chaque jury si equilibrerMatieres=true
 */
function generateJurysDistribution(
  enseignants: Enseignant[],
  options: JuryGenerationOptions = {}
): { juryIndex: number; enseignantIds: string[] }[] {
  const {
    nbJurys: nbJurysRequested,
    enseignantsParJury = 2,
    equilibrerMatieres = true,
  } = options;

  if (enseignants.length === 0) return [];

  // Nombre de jurys à créer
  const nbJurys = nbJurysRequested || Math.max(1, Math.floor(enseignants.length / enseignantsParJury));
  
  // Initialiser les jurys vides
  const jurysDistrib: { juryIndex: number; enseignantIds: string[] }[] = [];
  for (let i = 0; i < nbJurys; i++) {
    jurysDistrib.push({ juryIndex: i, enseignantIds: [] });
  }

  // Préparer la liste des enseignants à distribuer
  let enseignantsPool: Enseignant[] = [];

  if (equilibrerMatieres) {
    // Grouper les enseignants par catégorie de matière
    const byCategorie: Record<string, Enseignant[]> = {};
    
    for (const ens of enseignants) {
      const matiereRef = MATIERES_HEURES_3E.find(m => 
        m.matiere.toLowerCase() === ens.matierePrincipale?.toLowerCase() ||
        ens.matierePrincipale?.toLowerCase().includes(m.matiere.toLowerCase())
      );
      const cat = matiereRef?.categorie || 'autre';
      if (!byCategorie[cat]) byCategorie[cat] = [];
      byCategorie[cat].push(ens);
    }

    // Mélanger les enseignants en alternant les catégories pour diversifier
    const categories = Object.keys(byCategorie).sort((a, b) => 
      byCategorie[b].length - byCategorie[a].length
    );
    
    // Round-robin sur les catégories pour créer une liste intercalée
    let hasMore = true;
    while (hasMore) {
      hasMore = false;
      for (const cat of categories) {
        if (byCategorie[cat].length > 0) {
          enseignantsPool.push(byCategorie[cat].shift()!);
          hasMore = true;
        }
      }
    }
  } else {
    enseignantsPool = [...enseignants];
  }

  // Distribution: on remplit chaque jury jusqu'à enseignantsParJury, puis on passe au suivant
  let poolIndex = 0;
  for (let juryIdx = 0; juryIdx < nbJurys && poolIndex < enseignantsPool.length; juryIdx++) {
    for (let slot = 0; slot < enseignantsParJury && poolIndex < enseignantsPool.length; slot++) {
      jurysDistrib[juryIdx].enseignantIds.push(enseignantsPool[poolIndex].id!);
      poolIndex++;
    }
  }

  // Filtrer les jurys vides (ne devrait pas arriver si nbJurys est bien calculé)
  return jurysDistrib.filter(j => j.enseignantIds.length > 0);
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
  generateJurysAuto: (
    scenario: Scenario,
    enseignants: Enseignant[],
    options?: JuryGenerationOptions
  ) => Promise<void>;
  
  // Queries
  getJurysByScenario: (scenarioId: string) => Jury[];
  getJuryById: (id: string) => Jury | undefined;
  
  // Bulk
  setJurys: (jurys: Jury[]) => void;
  clearJurysByScenario: (scenarioId: string) => Promise<void>;
  
  // Calcul des matières couvertes par un jury
  computeJuryMatieres: (jury: Jury, enseignants: Enseignant[]) => string[];
}

export const useJuryStore = create<JuryState>((set, get) => ({
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
      const newJury = await juryRepository.create(juryData);
      set(state => ({
        jurys: [...state.jurys, newJury]
      }));
      return newJury.id!;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateJury: async (id, updates) => {
    try {
      await juryRepository.update(id, updates);
      set(state => ({
        jurys: state.jurys.map(j => 
          j.id === id 
            ? { ...j, ...updates, updatedAt: new Date() }
            : j
        )
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteJury: async (id) => {
    try {
      await juryRepository.delete(id);
      set(state => ({
        jurys: state.jurys.filter(j => j.id !== id)
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  addEnseignantToJury: async (juryId, enseignantId) => {
    try {
      await juryRepository.addEnseignant(juryId, enseignantId);
      set(state => ({
        jurys: state.jurys.map(j => 
          j.id === juryId && !j.enseignantIds.includes(enseignantId)
            ? { ...j, enseignantIds: [...j.enseignantIds, enseignantId], updatedAt: new Date() }
            : j
        )
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  removeEnseignantFromJury: async (juryId, enseignantId) => {
    try {
      await juryRepository.removeEnseignant(juryId, enseignantId);
      set(state => ({
        jurys: state.jurys.map(j => 
          j.id === juryId
            ? { ...j, enseignantIds: j.enseignantIds.filter(id => id !== enseignantId), updatedAt: new Date() }
            : j
        )
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  moveEnseignantBetweenJurys: async (enseignantId, fromJuryId, toJuryId) => {
    try {
      // Retirer de l'ancien jury si spécifié
      if (fromJuryId) {
        await juryRepository.removeEnseignant(fromJuryId, enseignantId);
      }
      // Ajouter au nouveau jury si spécifié
      if (toJuryId) {
        await juryRepository.addEnseignant(toJuryId, enseignantId);
      }
      
      set(state => ({
        jurys: state.jurys.map(j => {
          if (j.id === fromJuryId) {
            return { ...j, enseignantIds: j.enseignantIds.filter(id => id !== enseignantId), updatedAt: new Date() };
          }
          if (j.id === toJuryId && !j.enseignantIds.includes(enseignantId)) {
            return { ...j, enseignantIds: [...j.enseignantIds, enseignantId], updatedAt: new Date() };
          }
          return j;
        })
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateJuryStats: async (juryId, stats) => {
    try {
      await juryRepository.update(juryId, { stats });
      set(state => ({
        jurys: state.jurys.map(j => 
          j.id === juryId
            ? { ...j, stats, updatedAt: new Date() }
            : j
        )
      }));
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

  setJurys: (jurys) => {
    set({ jurys });
  },

  clearJurysByScenario: async (scenarioId) => {
    try {
      await juryRepository.deleteByScenarioId(scenarioId);
      set(state => ({
        jurys: state.jurys.filter(j => j.scenarioId !== scenarioId)
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
    
    // Générer la distribution
    const distribution = generateJurysDistribution(enseignants, {
      ...options,
      enseignantsParJury: options.enseignantsParJury || 2,
    });
    
    // Créer les jurys
    for (let i = 0; i < distribution.length; i++) {
      const distrib = distribution[i];
      const newJury = await juryRepository.create({
        scenarioId,
        nom: `Jury ${i + 1}`,
        enseignantIds: distrib.enseignantIds,
        capaciteMax: capaciteParJury,
      });
      
      set(state => ({
        jurys: [...state.jurys, newJury]
      }));
    }
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
}));
