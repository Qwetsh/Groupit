// ============================================================
// RÉSULTATS MATCHING - Types pour les algorithmes de résolution
// ============================================================

import type { AffectationExplication } from './affectation';
import type { JuryStats } from './groupe';

// ============ VIOLATIONS DE CONTRAINTES ============

export interface ConstraintViolation {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============ RÉSULTATS MATCHING STANDARD ============

// ============ RÉSULTATS MATCHING ORAL DNB ============

export interface MatchingResultDNB {
  eleveId: string;
  juryId: string;
  matiereEleve: string | null;
  matieresJury: string[];
  matiereMatch: boolean; // true si une matière de l'élève correspond au jury
  score: number;
  scoreDetail: Record<string, number>;
  explication: AffectationExplication;
}

/**
 * Problème que le moteur ne peut pas résoudre seul et que l'utilisateur doit
 * connaître (au lieu de le découvrir au moment de l'oral).
 */
export interface SolverAlerte {
  type:
    | 'aucun_jury'
    | 'capacite_insuffisante'
    | 'groupe_trop_grand'
    | 'matiere_non_couverte'
    | 'matiere_saturee'
    | 'langue_non_couverte'
    | 'langue_saturee';
  message: string;
  eleveIds?: string[];
}

export interface SolverResultDNB {
  /** Problèmes à signaler à l'utilisateur (vide si tout va bien). */
  alertes?: SolverAlerte[];
  affectations: MatchingResultDNB[];
  nonAffectes: string[]; // eleveIds sans affectation
  sansMatchMatiere: string[]; // eleveIds affectés mais sans correspondance matière
  statsParJury: Record<string, JuryStats>;
  scoreGlobal: number;
  tauxMatchMatiere: number; // % d'élèves avec matière respectée
  tempsCalculMs: number;
}
