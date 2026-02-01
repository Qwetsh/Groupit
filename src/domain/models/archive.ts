// ============================================================
// SCENARIO ARCHIVE - Historique persistant des enseignants
// ============================================================

import type { ScenarioType } from './types';

export interface ArchiveParticipant {
  enseignantId: string;
  enseignantNom: string;
  enseignantPrenom: string;
  role: 'membre_jury' | 'referent_stage' | 'tuteur' | 'examinateur' | 'autre';
  roleLabel?: string; // ex: "Jury 3", "Référent stage"
}

export interface ArchiveEleve {
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  eleveClasse: string;
  // Métadonnées contextuelles selon le type de scénario
  matiereOral?: string; // Pour oral_dnb
  adresseStage?: string; // Pour suivi_stage
  entreprise?: string; // Pour suivi_stage
  distanceKm?: number; // Pour suivi_stage
  dureeMin?: number; // Pour suivi_stage
}

export interface ArchiveAffectation {
  enseignantId: string;
  eleves: ArchiveEleve[];
  juryId?: string;
  juryNom?: string;
  scoreTotal?: number;
}

export interface ScenarioArchive {
  id: string;
  scenarioId: string;
  scenarioNom: string;
  scenarioType: ScenarioType;

  // Date de l'archivage (validation/enregistrement)
  archivedAt: Date;

  // Snapshot des participants (enseignants)
  participants: ArchiveParticipant[];

  // Snapshot des affectations (pour requêtes par enseignantId)
  affectations: ArchiveAffectation[];

  // Statistiques globales
  stats: {
    nbEnseignants: number;
    nbEleves: number;
    nbAffectations: number;
    scoreGlobal?: number;
    tauxAffectation?: number;
  };

  // Métadonnées spécifiques au type
  metadata?: {
    // Oral DNB
    jurys?: Array<{ id: string; nom: string; enseignantIds: string[] }>;
    // Suivi Stage
    distanceMoyenneKm?: number;
    dureeMoyenneMin?: number;
  };

  // Timestamps
  createdAt: Date;
}
