// ============================================================
// FILTERING UTILS - Fonctions communes de filtrage élèves/enseignants
// ============================================================

import type { Eleve, Enseignant, Niveau } from '../domain/models';
import { extractNiveau } from '../domain/models';

/**
 * Filtres pour les élèves selon les paramètres d'un scénario
 */
export interface EleveFilters {
  niveaux?: Niveau[];
  classes?: string[];
}

/**
 * Filtres pour les enseignants selon les paramètres d'un scénario
 * (correspond à ScenarioParametres.filtresEnseignants)
 */
export interface EnseignantScenarioFilters {
  matieres?: string[];
  classesEnCharge?: string[];
  niveauxEnCharge?: Niveau[];
  ppOnly?: boolean;
  tags?: string[];
  enseignantIds?: string[];
}

/**
 * Filtre les élèves selon les critères niveau et classe
 */
export function filterEleves(
  eleves: Eleve[],
  filters: EleveFilters | undefined,
  defaultNiveaux: Niveau[] = ['3e']
): Eleve[] {
  if (!filters) return eleves;

  const niveauxFiltres = filters.niveaux?.length ? filters.niveaux : defaultNiveaux;
  const classesFiltres = filters.classes || [];

  return eleves.filter(e => {
    // Filtrer par niveau
    const niveau = extractNiveau(e.classe);
    const matchNiveau = niveau !== null && niveauxFiltres.includes(niveau);

    // Filtrer par classe (optionnel)
    const matchClasse = classesFiltres.length === 0 || classesFiltres.includes(e.classe);

    return matchNiveau && matchClasse;
  });
}

/**
 * Filtre les enseignants selon les critères du scénario
 */
export function filterEnseignants(
  enseignants: Enseignant[],
  filters: EnseignantScenarioFilters | undefined
): Enseignant[] {
  if (!filters) return enseignants;

  // Si sélection individuelle active, elle prend le dessus
  if (filters.enseignantIds && filters.enseignantIds.length > 0) {
    return enseignants.filter(e => filters.enseignantIds!.includes(e.id!));
  }

  return enseignants.filter(e => {
    // Filtre PP uniquement
    if (filters.ppOnly && !e.estProfPrincipal) return false;

    // Filtre par matières
    if (filters.matieres && filters.matieres.length > 0) {
      if (!filters.matieres.includes(e.matierePrincipale)) return false;
    }

    // Filtre par classes en charge
    if (filters.classesEnCharge && filters.classesEnCharge.length > 0) {
      const hasMatchingClass = e.classesEnCharge?.some(c =>
        filters.classesEnCharge!.includes(c)
      );
      if (!hasMatchingClass) return false;
    }

    // Filtre par niveaux en charge
    if (filters.niveauxEnCharge && filters.niveauxEnCharge.length > 0) {
      const hasMatchingNiveau = e.classesEnCharge?.some(c => {
        const niveau = extractNiveau(c);
        return niveau !== null && filters.niveauxEnCharge!.includes(niveau);
      });
      if (!hasMatchingNiveau) return false;
    }

    return true;
  });
}
