// ============================================================
// ÉLÈVE - Modèle et types associés
// ============================================================

import type { Sexe, ContrainteType } from './types';

// ============ CONTRAINTE RELATIONNELLE ============

export interface Contrainte {
  type: ContrainteType;
  cibleType: 'eleve' | 'enseignant';
  cibleId: string;
  raison?: string;
}

// ============ EMPLOI DU TEMPS ============

export interface CreneauHoraire {
  jour: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi';
  heureDebut: string; // "08:00"
  heureFin: string; // "09:00"
  matiere?: string;
  salle?: string;
}

export interface EmploiDuTemps {
  creneaux: CreneauHoraire[];
}

// ============ ÉLÈVE ============

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  classe: string; // OBLIGATOIRE
  dateNaissance?: string; // format ISO ou jj/mm/aaaa
  sexe?: Sexe;
  email?: string;
  options: string[]; // ex: ["Latin", "Allemand"]
  regime?: string; // ex: "Demi-pensionnaire", "Externe"
  tags: string[];
  contraintes: Contrainte[];

  // Champs personnalisés (colonnes dynamiques)
  customFields?: Record<string, unknown>;

  // V2 - Emploi du temps
  emploiDuTemps?: EmploiDuTemps;

  // Métadonnées import
  encouragementValorisation?: string;
  autresChamps?: Record<string, string>;

  // === ORAL DNB SPECIFIQUE ===
  // Parcours/thème choisi (EPI, Histoire des Sciences, Parcours Avenir, etc.)
  parcoursOral?: string;
  // Sujet libre de l'élève (titre du projet)
  sujetOral?: string;
  // Matière(s) associée(s) au sujet
  matieresOral?: string[];
  // Langue étrangère choisie pour l'oral (optionnel)
  langueEtrangere?: string;
  // Tiers temps (aménagement d'épreuve)
  tiersTemps?: boolean;

  // Groupe oral : UUID partagé par les membres du groupe (2 ou 3 élèves)
  groupeOralId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
