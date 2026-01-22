// ============================================================
// EXPORT EXCEL - Génération de fichiers Excel pour les résultats
// ============================================================

import * as XLSX from 'xlsx';
import type { ExportResultData, CsvExportOptions } from './types';
import type { StageExportResultData, StageCsvExportOptions } from './stageTypes';
import { DEFAULT_CSV_OPTIONS } from './types';
import { DEFAULT_STAGE_CSV_OPTIONS } from './stageTypes';

// ============================================================
// TYPES
// ============================================================

export interface ExcelExportOptions extends Omit<CsvExportOptions, 'separator' | 'encoding'> {
  // Options spécifiques Excel
  sheetName?: string;
  autoWidth?: boolean;
  headerStyle?: boolean;
}

export const DEFAULT_EXCEL_OPTIONS: ExcelExportOptions = {
  includeScheduleColumns: DEFAULT_CSV_OPTIONS.includeScheduleColumns,
  includeTopicTitle: DEFAULT_CSV_OPTIONS.includeTopicTitle,
  includeSalle: DEFAULT_CSV_OPTIONS.includeSalle,
  includeScore: DEFAULT_CSV_OPTIONS.includeScore,
  includeHeaders: true,
  includeUnassignedSheet: true,
  sheetName: 'Affectations',
  autoWidth: true,
  headerStyle: true,
};

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

/**
 * Calcule la largeur optimale des colonnes
 */
function calculateColumnWidths(data: unknown[][]): number[] {
  if (data.length === 0) return [];

  const maxCols = Math.max(...data.map(row => row.length));
  const widths: number[] = new Array(maxCols).fill(10);

  for (const row of data) {
    for (let i = 0; i < row.length; i++) {
      const cellValue = String(row[i] ?? '');
      const cellWidth = Math.min(50, Math.max(10, cellValue.length + 2));
      widths[i] = Math.max(widths[i], cellWidth);
    }
  }

  return widths;
}

/**
 * Options communes pour la création de feuilles Excel
 */
interface WorksheetOptions {
  autoWidth?: boolean;
}

/**
 * Crée une feuille Excel à partir de données 2D
 */
function createWorksheet(data: unknown[][], options: WorksheetOptions): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Appliquer la largeur automatique des colonnes
  if (options.autoWidth) {
    const colWidths = calculateColumnWidths(data);
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
  }

  return ws;
}

// ============================================================
// EXPORT ORAL DNB / JURYS
// ============================================================

/**
 * Génère les données pour la feuille des affectations (Oral DNB)
 */
function generateAffectedData(data: ExportResultData, options: ExcelExportOptions): unknown[][] {
  const rows: unknown[][] = [];

  // En-têtes
  if (options.includeHeaders) {
    const headers: string[] = [
      'Jury',
      'Enseignant(s)',
      'Matières Enseignants',
      'Nom Élève',
      'Prénom Élève',
      'Classe',
      'Matière(s) Oral',
      'Matière Affectée',
    ];

    if (options.includeSalle) headers.push('Salle');
    if (options.includeScheduleColumns) {
      headers.push('Date Passage');
      headers.push('Heure Passage');
    }
    if (options.includeTopicTitle) headers.push('Sujet/Thème');

    rows.push(headers);
  }

  // Données
  for (const jury of data.jurys) {
    const enseignantNames = jury.enseignants.map(e => `${e.prenom} ${e.nom}`).join(', ');
    const enseignantMatieres = jury.enseignants.map(e => e.matierePrincipale).join(', ');

    for (const eleve of jury.eleves) {
      const row: unknown[] = [
        jury.juryName,
        enseignantNames,
        enseignantMatieres,
        eleve.nom,
        eleve.prenom,
        eleve.classe,
        eleve.matieresOral.join(', '),
        eleve.matiereAffectee,
      ];

      if (options.includeSalle) row.push(eleve.salle || jury.salle || '');
      if (options.includeScheduleColumns) {
        row.push(eleve.datePassage || '');
        row.push(eleve.heurePassage || '');
      }
      if (options.includeTopicTitle) row.push(eleve.sujetIntitule || '');

      rows.push(row);
    }
  }

  return rows;
}

/**
 * Génère les données pour la feuille des non-affectés
 */
function generateUnassignedData(data: ExportResultData, options: ExcelExportOptions): unknown[][] {
  const rows: unknown[][] = [];

  // En-têtes
  if (options.includeHeaders) {
    rows.push(['Nom', 'Prénom', 'Classe', 'Matière(s) Oral', 'Raison(s)']);
  }

  // Données
  for (const eleve of data.unassigned) {
    rows.push([
      eleve.nom,
      eleve.prenom,
      eleve.classe,
      eleve.matieresOral.join(', '),
      eleve.raisons.join('; '),
    ]);
  }

  return rows;
}

/**
 * Génère les données pour la feuille des statistiques
 */
function generateStatsData(data: ExportResultData): unknown[][] {
  return [
    ['Statistique', 'Valeur'],
    ['Scénario', data.scenarioName],
    ['Date export', new Date(data.dateExport).toLocaleDateString('fr-FR')],
    ['', ''],
    ['Total élèves', data.stats.totalEleves],
    ['Élèves affectés', data.stats.totalAffectes],
    ['Élèves non affectés', data.stats.totalNonAffectes],
    ['Taux affectation', `${data.stats.tauxAffectation}%`],
    ['Taux match matière', `${data.stats.tauxMatchMatiere}%`],
    ['Nombre de jurys', data.stats.nbJurys],
    ['Nombre enseignants', data.stats.nbEnseignants],
  ];
}

/**
 * Export principal Oral DNB : génère un workbook Excel complet
 */
export function exportExcelResults(
  data: ExportResultData,
  options: Partial<ExcelExportOptions> = {}
): XLSX.WorkBook {
  const opts: ExcelExportOptions = { ...DEFAULT_EXCEL_OPTIONS, ...options };

  const wb = XLSX.utils.book_new();

  // Feuille principale - Affectations
  const affectedData = generateAffectedData(data, opts);
  const wsAffected = createWorksheet(affectedData, opts);
  XLSX.utils.book_append_sheet(wb, wsAffected, opts.sheetName || 'Affectations');

  // Feuille des non-affectés (si activée)
  if (opts.includeUnassignedSheet && data.unassigned.length > 0) {
    const unassignedData = generateUnassignedData(data, opts);
    const wsUnassigned = createWorksheet(unassignedData, opts);
    XLSX.utils.book_append_sheet(wb, wsUnassigned, 'Non-affectés');
  }

  // Feuille des statistiques
  const statsData = generateStatsData(data);
  const wsStats = createWorksheet(statsData, opts);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');

  return wb;
}

/**
 * Télécharge un fichier Excel
 */
export function downloadExcel(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename);
}

/**
 * Export complet avec téléchargement (Oral DNB)
 */
export function downloadExportExcel(
  data: ExportResultData,
  baseFilename: string = 'export',
  options: Partial<ExcelExportOptions> = {}
): void {
  const wb = exportExcelResults(data, options);
  downloadExcel(wb, `${baseFilename}.xlsx`);
}

// ============================================================
// EXPORT SUIVI DE STAGE
// ============================================================

export interface StageExcelExportOptions extends Omit<StageCsvExportOptions, 'separator' | 'encoding'> {
  sheetName?: string;
  autoWidth?: boolean;
  headerStyle?: boolean;
}

export const DEFAULT_STAGE_EXCEL_OPTIONS: StageExcelExportOptions = {
  // From StageCsvExportOptions
  includeGeoDetails: DEFAULT_STAGE_CSV_OPTIONS.includeGeoDetails,
  includeContactInfo: DEFAULT_STAGE_CSV_OPTIONS.includeContactInfo,
  includeDates: DEFAULT_STAGE_CSV_OPTIONS.includeDates,
  includeDistanceApproxFlag: DEFAULT_STAGE_CSV_OPTIONS.includeDistanceApproxFlag,
  includeDistance: DEFAULT_STAGE_CSV_OPTIONS.includeDistance,
  includeDuration: DEFAULT_STAGE_CSV_OPTIONS.includeDuration,
  includeAdresse: DEFAULT_STAGE_CSV_OPTIONS.includeAdresse,
  includeHeaders: DEFAULT_STAGE_CSV_OPTIONS.includeHeaders,
  includeUnassignedSheet: DEFAULT_STAGE_CSV_OPTIONS.includeUnassignedSheet,
  // Excel-specific
  sheetName: 'Affectations Stages',
  autoWidth: true,
  headerStyle: true,
};

/**
 * Génère les données pour la feuille des affectations de stage
 */
function generateStageAffectedData(data: StageExportResultData, options: StageExcelExportOptions): unknown[][] {
  const rows: unknown[][] = [];

  // En-têtes
  if (options.includeHeaders) {
    const headers: string[] = [
      'Enseignant',
      'Nom Élève',
      'Prénom Élève',
      'Classe',
      'Entreprise',
    ];

    if (options.includeAdresse) headers.push('Adresse Stage');
    if (options.includeDistance) headers.push('Distance (km)');
    if (options.includeDuration) headers.push('Durée (min)');

    rows.push(headers);
  }

  // Données
  for (const enseignant of data.enseignants) {
    const enseignantName = `${enseignant.prenom} ${enseignant.nom}`;

    for (const eleve of enseignant.eleves) {
      const row: unknown[] = [
        enseignantName,
        eleve.nom,
        eleve.prenom,
        eleve.classe,
        eleve.entreprise || '',
      ];

      if (options.includeAdresse) row.push(eleve.adresseStage || '');
      if (options.includeDistance) row.push(eleve.distanceKm ?? '');
      if (options.includeDuration) row.push(eleve.dureeMin ?? '');

      rows.push(row);
    }
  }

  return rows;
}

/**
 * Génère les données pour la feuille des stages non-affectés
 */
function generateStageUnassignedData(data: StageExportResultData, options: StageExcelExportOptions): unknown[][] {
  const rows: unknown[][] = [];

  // En-têtes
  if (options.includeHeaders) {
    rows.push(['Nom', 'Prénom', 'Classe', 'Entreprise', 'Adresse', 'Raison(s)']);
  }

  // Données
  for (const eleve of data.unassigned) {
    rows.push([
      eleve.nom,
      eleve.prenom,
      eleve.classe,
      eleve.entreprise || '',
      eleve.adresseStage || '',
      eleve.raisons.join('; '),
    ]);
  }

  return rows;
}

/**
 * Génère les données pour la feuille des statistiques de stage
 */
function generateStageStatsData(data: StageExportResultData): unknown[][] {
  const rows: unknown[][] = [
    ['Statistique', 'Valeur'],
    ['Scénario', data.scenarioName],
    ['Date export', new Date(data.dateExport).toLocaleDateString('fr-FR')],
    ['', ''],
    ['Total stages', data.stats.totalStages],
    ['Stages affectés', data.stats.totalAffectes],
    ['Stages non affectés', data.stats.totalNonAffectes],
    ['Taux affectation', `${data.stats.tauxAffectation}%`],
  ];

  // Ajouter les stats optionnelles si disponibles
  if (data.stats.distanceMoyenneKm !== undefined) {
    rows.push(['Distance moyenne', `${data.stats.distanceMoyenneKm.toFixed(1)} km`]);
  }
  if (data.stats.distanceMaxKm !== undefined) {
    rows.push(['Distance max', `${data.stats.distanceMaxKm.toFixed(1)} km`]);
  }
  if (data.stats.dureeMoyenneMin !== undefined) {
    rows.push(['Durée moyenne', `${data.stats.dureeMoyenneMin.toFixed(0)} min`]);
  }
  if (data.stats.nbTuteurs !== undefined) {
    rows.push(['Nombre tuteurs', data.stats.nbTuteurs]);
  }

  return rows;
}

/**
 * Export principal Suivi de Stage : génère un workbook Excel complet
 */
export function exportStageExcelResults(
  data: StageExportResultData,
  options: Partial<StageExcelExportOptions> = {}
): XLSX.WorkBook {
  const opts: StageExcelExportOptions = { ...DEFAULT_STAGE_EXCEL_OPTIONS, ...options };

  const wb = XLSX.utils.book_new();

  // Feuille principale - Affectations
  const affectedData = generateStageAffectedData(data, opts);
  const wsAffected = createWorksheet(affectedData, opts);
  XLSX.utils.book_append_sheet(wb, wsAffected, opts.sheetName || 'Affectations Stages');

  // Feuille des non-affectés (si activée)
  if (opts.includeUnassignedSheet && data.unassigned.length > 0) {
    const unassignedData = generateStageUnassignedData(data, opts);
    const wsUnassigned = createWorksheet(unassignedData, opts);
    XLSX.utils.book_append_sheet(wb, wsUnassigned, 'Non-affectés');
  }

  // Feuille des statistiques
  const statsData = generateStageStatsData(data);
  const wsStats = createWorksheet(statsData, opts);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');

  return wb;
}

/**
 * Export complet avec téléchargement (Suivi de Stage)
 */
export function downloadStageExportExcel(
  data: StageExportResultData,
  baseFilename: string = 'export_stages',
  options: Partial<StageExcelExportOptions> = {}
): void {
  const wb = exportStageExcelResults(data, options);
  downloadExcel(wb, `${baseFilename}.xlsx`);
}
