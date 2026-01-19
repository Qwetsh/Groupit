// ============================================================
// TYPES POUR L'EXPORT SUIVI DE STAGE
// ============================================================

// Types pour l'export Suivi de Stage

// ============================================================
// DONNÉES STRUCTURÉES POUR L'EXPORT STAGE
// ============================================================

/**
 * Représentation d'un élève avec son stage pour l'export
 */
export interface StageExportEleveData {
  eleveId: string;
  nom: string;
  prenom: string;
  classe: string;
  
  // Infos du stage
  stageId?: string;
  entreprise: string;
  adresseComplete: string;
  ville: string;
  codePostal?: string;
  tuteur?: string;
  tuteurEmail?: string;
  tuteurTel?: string;
  secteurActivite?: string;
  
  // Dates
  dateDebut?: string;
  dateFin?: string;
  
  // Géolocalisation & distance
  lat?: number;
  lon?: number;
  distanceKm?: number;
  dureeEstimeeMin?: number;
  isDistanceApprox: boolean;  // true si fallback ville utilisé
  geoPrecision?: 'FULL' | 'CITY' | 'TOWNHALL' | 'NONE';
  
  // Métadonnées pour extensions futures
  metadata?: Record<string, unknown>;
}

/**
 * Représentation d'un enseignant avec ses élèves suivis
 */
export interface StageExportEnseignantData {
  enseignantId: string;
  nom: string;
  prenom: string;
  matierePrincipale: string;
  email?: string;
  
  // Géolocalisation enseignant
  adresse?: string;
  commune?: string;
  lat?: number;
  lon?: number;
  
  // Élèves suivis
  eleves: StageExportEleveData[];
  
  // Statistiques
  nbEleves: number;
  distanceTotaleKm: number;
  distanceMoyenneKm: number;
  nbDistancesApprox: number;  // Combien de distances approximatives
}

/**
 * Élève/Stage non affecté
 */
export interface StageExportUnassignedData {
  eleveId: string;
  nom: string;
  prenom: string;
  classe: string;
  entreprise?: string;
  adresse?: string;
  ville?: string;
  raisons: string[];
}

/**
 * Résultat complet d'export pour suivi de stage
 */
export interface StageExportResultData {
  // Métadonnées
  scenarioId: string;
  scenarioName: string;
  dateExport: string;
  anneeScolaire?: string;
  etablissement?: string;
  
  // Données par enseignant
  enseignants: StageExportEnseignantData[];
  
  // Non affectés
  unassigned: StageExportUnassignedData[];
  
  // Stats globales
  stats: {
    totalStages: number;
    totalAffectes: number;
    totalNonAffectes: number;
    tauxAffectation: number;
    nbEnseignants: number;
    distanceTotaleGlobaleKm: number;
    distanceMoyenneGlobaleKm: number;
    nbDistancesApprox: number;
  };
}

// ============================================================
// OPTIONS D'EXPORT STAGE
// ============================================================

/**
 * Options pour l'export CSV Stage
 */
export interface StageCsvExportOptions {
  // Colonnes
  includeGeoDetails: boolean;      // lat/lon
  includeContactInfo: boolean;     // tuteur, email, tel
  includeDates: boolean;           // dateDebut, dateFin
  includeDistanceApproxFlag: boolean;
  
  // Format
  separator: ',' | ';' | '\t';
  includeHeaders: boolean;
  includeUnassignedSheet: boolean;
  encoding: 'utf-8' | 'latin1';
}

/**
 * Options pour l'export PDF Stage
 */
export interface StagePdfExportOptions {
  // En-tête
  headerSchoolName?: string;
  headerYear?: string;
  headerScenarioName?: string;
  collegeName?: string;
  collegeAddress?: string;
  
  // Contenu par enseignant
  includeLetterIntro: boolean;
  includeMap: boolean;             // Image carte statique (futur)
  includeContactInfo: boolean;
  includeDates: boolean;
  includeDistanceWarning: boolean; // Mention "distances indicatives"
  
  // Pages supplémentaires
  includeUnassignedPage: boolean;
  includeSummaryPage: boolean;
  
  // Mise en page
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'LETTER';
  fontSize: 'small' | 'medium' | 'large';
}

// ============================================================
// VALEURS PAR DÉFAUT
// ============================================================

export const DEFAULT_STAGE_CSV_OPTIONS: StageCsvExportOptions = {
  includeGeoDetails: false,
  includeContactInfo: true,
  includeDates: true,
  includeDistanceApproxFlag: true,
  separator: ';',
  includeHeaders: true,
  includeUnassignedSheet: true,
  encoding: 'utf-8',
};

export const DEFAULT_STAGE_PDF_OPTIONS: StagePdfExportOptions = {
  includeLetterIntro: true,
  includeMap: false,  // Désactivé - API carte statique non disponible
  includeContactInfo: true,
  includeDates: true,
  includeDistanceWarning: true,
  includeUnassignedPage: true,
  includeSummaryPage: false,
  orientation: 'portrait',
  pageSize: 'A4',
  fontSize: 'medium',
};
