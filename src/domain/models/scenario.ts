// ============================================================
// SCÉNARIO - Modèle et types associés
// ============================================================

import type { CritereInstance as CritereInstanceType } from '../criteriaConfig';
import type { Niveau, ScenarioMode, ScenarioType } from './types';

// ============ CONFIGURATION CAPACITÉ ============

export interface CapaciteConfig {
  capaciteBaseDefaut: number;
  coefficients: {
    '6e': number;
    '5e': number;
    '4e': number;
    '3e': number;
  };
}

// ============ CRITÈRES (legacy) ============

// @deprecated - Utiliser CritereInstance à la place
export interface CritereConfig {
  id: string;
  nom: string;
  actif: boolean;
  poids: number; // 0-100
  estContrainteDure: boolean;
}

// ============ PARAMÈTRES SCÉNARIO ============

export interface ScenarioParametres {
  // Nouveau système de critères (priorité)
  criteresV2?: CritereInstanceType[];

  // @deprecated - Ancien système de critères (garde pour migration)
  criteres: CritereConfig[];

  capaciteConfig: CapaciteConfig;

  // Filtres élèves - qui inclure dans le matching
  filtresEleves?: {
    classes?: string[]; // ex: ["3A", "3B", "3C"]
    niveaux?: Niveau[]; // ex: ["3e"]
    options?: string[]; // ex: ["Latin"]
    tags?: string[]; // ex: ["prioritaire"]
  };

  // Filtres enseignants - qui peut recevoir des élèves
  filtresEnseignants?: {
    matieres?: string[]; // ex: ["SVT", "Physique-Chimie"]
    classesEnCharge?: string[]; // ex: ["3A", "3B"]
    niveauxEnCharge?: Niveau[]; // ex: ["3e", "4e"] - enseigne à ce niveau
    ppOnly?: boolean; // seulement les profs principaux
    tags?: string[]; // ex: ["disponible"]
    enseignantIds?: string[]; // sélection individuelle d'enseignants
  };

  // Paramètres legacy pour compatibilité
  matieresOralPossibles?: string[]; // @deprecated - utiliser oralDnb.matieresAutorisees
  distanceMaxKm?: number; // @deprecated - utiliser suiviStage.distanceMaxKm

  // === SPÉCIFIQUE ORAL DNB ===
  oralDnb?: {
    // Liste des matières possibles pour l'oral
    matieresAutorisees: string[];
    // Utiliser les jurys au lieu d'enseignants individuels
    utiliserJurys: boolean;
    // Poids du critère "matière correspondante" (0-100)
    poidsMatiere: number;
    // Critères de fallback quand matière ne match pas
    criteresSecondaires: ('equilibrage' | 'parite' | 'capacite')[];
    // Capacité par défaut d'un jury
    capaciteJuryDefaut: number;
  };

  // Spécifique suivi_stage
  suiviStage?: {
    distanceMaxKm: number;
    dureeMaxMin: number;
    prioriserPP: boolean;
    capaciteTuteurDefaut: number;
    /** Si true, utilise la capacité calculée pour chaque enseignant (basée sur heures × classes 3e) */
    utiliserCapaciteCalculee?: boolean;
  };

  // Spécifique custom (configuration libre)
  custom?: {
    /** Utiliser des jurys (groupes d'enseignants) au lieu d'enseignants individuels */
    utiliserJurys: boolean;
    /** Capacité par défaut (par jury ou par enseignant) */
    capaciteDefaut: number;
    /** Niveaux concernés */
    niveaux: Niveau[];
  };

  // Contraintes globales
  equilibrageActif: boolean;

  // Custom (legacy)
  autresParametres?: Record<string, unknown>;
}

// ============ SCÉNARIO ============

export interface Scenario {
  id: string;
  nom: string;
  mode: ScenarioMode;
  type: ScenarioType;
  parametres: ScenarioParametres;
  description?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
