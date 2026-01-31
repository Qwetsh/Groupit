// ============================================================
// TYPES POUR L'EXPORT DES RÉSULTATS D'AFFECTATION
// ============================================================



// ============================================================
// DONNÉES STRUCTURÉES POUR L'EXPORT
// ============================================================

/**
 * Représentation d'un élève affecté avec toutes les infos pour l'export
 */
export interface ExportEleveData {
  eleveId: string;
  nom: string;
  prenom: string;
  classe: string;
  matieresOral: string[];
  matiereAffectee: string | null; // Matière qui a justifié l'affectation
  
  // Champs futurs (placeholders)
  datePassage?: string;
  heurePassage?: string;
  salle?: string;
  sujetIntitule?: string;
}

/**
 * Représentation d'un enseignant pour l'export
 */
export interface ExportEnseignantData {
  enseignantId: string;
  nom: string;
  prenom: string;
  matierePrincipale: string;
}

/**
 * Représentation d'un jury avec ses élèves et enseignants
 */
export interface ExportJuryData {
  juryId: string;
  juryName: string;
  salle?: string;
  horaire?: string;
  
  enseignants: ExportEnseignantData[];
  eleves: ExportEleveData[];
  
  // Statistiques
  capaciteMax: number;
  nbAffectes: number;
  tauxRemplissage: number;
  nbMatchMatiere: number;
}

/**
 * Élève non affecté avec raisons
 */
export interface ExportUnassignedData {
  eleveId: string;
  nom: string;
  prenom: string;
  classe: string;
  matieresOral: string[];
  raisons: string[];
}

/**
 * Résultat complet d'affectation prêt pour l'export
 */
export interface ExportResultData {
  // Métadonnées du scénario
  scenarioId: string;
  scenarioName: string;
  scenarioType: string;
  dateExport: string;
  anneScolaire?: string;
  etablissement?: string;
  
  // Données
  jurys: ExportJuryData[];
  unassigned: ExportUnassignedData[];
  
  // Stats globales
  stats: {
    totalEleves: number;
    totalAffectes: number;
    totalNonAffectes: number;
    tauxAffectation: number;
    tauxMatchMatiere: number;
    nbJurys: number;
    nbEnseignants: number;
  };
}

// ============================================================
// OPTIONS D'EXPORT
// ============================================================

/**
 * Options pour l'export CSV
 */
export interface CsvExportOptions {
  // Colonnes à inclure
  includeScheduleColumns: boolean;  // datePassage, heurePassage
  includeTopicTitle: boolean;       // sujetIntitule
  includeSalle: boolean;            // salle
  includeScore: boolean;            // score d'affectation
  
  // Format
  separator: ',' | ';' | '\t';
  includeHeaders: boolean;
  includeUnassignedSheet: boolean;
  
  // Encodage
  encoding: 'utf-8' | 'latin1';
}

/**
 * Options pour l'export PDF
 */
export interface PdfExportOptions {
  // Colonnes du tableau élèves
  includeScheduleColumns: boolean;  // datePassage, heurePassage
  includeTopicTitle: boolean;       // sujetIntitule
  includeSalle: boolean;            // salle
  includeRubric: boolean;           // grille d'évaluation (future)

  // En-tête
  headerSchoolName?: string;
  headerYear?: string;
  headerScenarioName?: string;
  headerLogo?: string;              // Base64 ou URL (legacy, remplacé par logos)

  // Logos institutionnels
  showLogoAcademie: boolean;        // Logo Académie Grand Est (gauche)
  showLogoEducationNationale: boolean; // Logo Éducation Nationale (droite)

  // Contenu
  includeLetterText: boolean;       // Texte de lettre intro
  includeUnassignedPage: boolean;   // Page des non-affectés
  includeStatsPage: boolean;        // Page de statistiques

  // Mise en page
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'LETTER';
  fontSize: 'small' | 'medium' | 'large';
}

// ============================================================
// VALEURS PAR DÉFAUT
// ============================================================

export const DEFAULT_CSV_OPTIONS: CsvExportOptions = {
  includeScheduleColumns: false,
  includeTopicTitle: false,
  includeSalle: false,
  includeScore: true,
  separator: ';',
  includeHeaders: true,
  includeUnassignedSheet: true,
  encoding: 'utf-8',
};

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  includeScheduleColumns: false,
  includeTopicTitle: false,
  includeSalle: false,
  includeRubric: false,
  showLogoAcademie: true,
  showLogoEducationNationale: true,
  includeLetterText: true,
  includeUnassignedPage: true,
  includeStatsPage: false,
  orientation: 'portrait',
  pageSize: 'A4',
  fontSize: 'medium',
};
