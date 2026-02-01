// ============================================================
// ENSEIGNANT - Modèle et types associés
// ============================================================

import type { EmploiDuTemps } from './eleve';

export interface HeuresParNiveau {
  '6e': number;
  '5e': number;
  '4e': number;
  '3e': number;
}

export interface Enseignant {
  id: string;
  nom: string;
  prenom: string;
  matierePrincipale: string; // ex: "SVT", "Histoire-Géo"
  matiereSecondaire?: string[]; // matières secondaires enseignées
  classesEnCharge: string[]; // ex: ["3A", "3D", "4B"]
  estProfPrincipal: boolean;
  classePP?: string; // si PP, sa classe principale

  // Localisation (domicile pour suivi de stage)
  adresse?: string;
  commune?: string;
  lat?: number;
  lon?: number;
  geoStatus?: 'pending' | 'ok' | 'error' | 'manual' | 'not_found';
  geoErrorMessage?: string;

  // Capacité selon le type de scénario
  heuresParNiveau?: HeuresParNiveau;
  capaciteBase?: number; // Oral DNB: nb max d'élèves par enseignant/jury
  capaciteStage?: number; // Suivi Stage: nb max de stages à encadrer

  // Heures réelles avec les 3èmes (override du calcul automatique)
  // Utile pour les profs de langues avec groupes multi-classes
  heures3eReelles?: number;

  // Exclusions pour suivi de stage
  stageExclusions?: Array<{
    type: 'classe' | 'zone' | 'eleve' | 'secteur';
    value: string;
    reason?: string;
  }>;

  tags: string[];

  // Champs personnalisés (colonnes dynamiques)
  customFields?: Record<string, unknown>;

  // V2 - Emploi du temps
  emploiDuTemps?: EmploiDuTemps;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
