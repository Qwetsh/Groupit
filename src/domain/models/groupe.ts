// ============================================================
// GROUPE ET JURY - Modèles et types associés
// ============================================================

// ============ GROUPE ============

export interface Groupe {
  id: string;
  scenarioId: string;
  nom: string;
  tailleCible?: number;
  tailleMin?: number;
  tailleMax?: number;
  type?: string; // ex: "projet", "atelier"

  eleveIds: string[];
  enseignantIds: string[];

  contraintes?: GroupeContrainte[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupeContrainte {
  type: string;
  description: string;
  valeur: unknown;
}

// ============ JURY (Oral DNB) ============
// Un jury est un groupe d'enseignants qui évalue ensemble les élèves

export interface Jury {
  id: string;
  scenarioId: string;
  nom: string; // ex: "Jury 1", "Jury Sciences"

  // Enseignants du jury
  enseignantIds: string[];

  // Capacité
  capaciteMax: number; // Nombre max d'élèves que ce jury peut évaluer

  // Statistiques calculées (mise à jour après affectation)
  stats?: JuryStats;

  // Métadonnées optionnelles
  salle?: string;
  horaire?: string;
  notes?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface JuryStats {
  nbElevesAffectes: number;
  repartitionMatieres: Record<string, number>; // { "SVT": 3, "Français": 5 }
  tauxRemplissage: number; // 0-100%
  matieresEnseignants: string[]; // Matières couvertes par les enseignants du jury
}
