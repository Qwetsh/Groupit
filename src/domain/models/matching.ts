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

export interface SolverResultDNB {
  affectations: MatchingResultDNB[];
  nonAffectes: string[]; // eleveIds sans affectation
  sansMatchMatiere: string[]; // eleveIds affectés mais sans correspondance matière
  statsParJury: Record<string, JuryStats>;
  scoreGlobal: number;
  tauxMatchMatiere: number; // % d'élèves avec matière respectée
  tempsCalculMs: number;
}
