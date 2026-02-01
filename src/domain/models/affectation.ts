// ============================================================
// AFFECTATION - Modèle et types associés
// ============================================================

import type { AffectationType } from './types';

// ============ METADATA AFFECTATION ============

export interface MetadataSuiviStage {
  lieuStageNom?: string;
  adresseStage?: string;
  latStage?: number;
  lonStage?: number;
  entreprise?: string;
  tuteur?: string;
  dateDebut?: string;
  dateFin?: string;
}

export interface MetadataOralDNB {
  theme?: string;
  matiereOralChoisieParEleve?: string;
  dateCreneau?: string;
  heureCreneau?: string;
  salle?: string;
}

export type AffectationMetadata = MetadataSuiviStage | MetadataOralDNB | Record<string, unknown>;

// ============ EXPLICATION ============

export interface AffectationExplication {
  raisonPrincipale: string; // ex: "Matière correspondante (SVT)"
  criteresUtilises: string[]; // ex: ["matiere_match", "equilibrage"]
  matiereRespectee: boolean; // true si la matière de l'élève correspond à un enseignant du jury
  score: number;
  detailScores?: Record<string, number>; // ex: { matiere: 100, equilibrage: 75 }
}

// ============ AFFECTATION ============

export interface Affectation {
  id: string;
  eleveId: string;
  enseignantId: string; // Pour compatibilité - peut être vide si juryId utilisé
  juryId?: string; // ID du jury (pour oral_dnb)
  scenarioId: string;
  type: AffectationType;
  metadata: AffectationMetadata;
  scoreDetail?: Record<string, number>; // ex: { distance: 8, capacite: 7, matiere: 10 }
  scoreTotal?: number;

  // Explication de l'affectation (pourquoi cet élève dans ce jury)
  explication?: AffectationExplication;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
