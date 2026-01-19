// ============================================================
// EXPORT CSV - SUIVI DE STAGE
// ============================================================

import type { StageExportResultData, StageCsvExportOptions } from './stageTypes';
import { flattenStageDataForCsv, flattenUnassignedForCsv } from './stageDataMapper';

// ============================================================
// HELPERS
// ============================================================

/**
 * Échappe une valeur pour CSV (guillemets et séparateurs)
 */
function escapeCsvValue(value: string | number | undefined | null, separator: string): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  // Si contient des guillemets, séparateur ou retours à la ligne, encadrer de guillemets
  if (str.includes('"') || str.includes(separator) || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Génère une ligne CSV
 */
function toCsvLine(values: (string | number | undefined | null)[], separator: string): string {
  return values.map(v => escapeCsvValue(v, separator)).join(separator);
}

// ============================================================
// GÉNÉRATION CSV AFFECTATIONS
// ============================================================

/**
 * En-têtes pour l'export des non-affectés
 */
const HEADERS_UNASSIGNED = [
  'Nom',
  'Prénom',
  'Classe',
  'Entreprise',
  'Adresse',
  'Ville',
  'Raisons',
];

export interface StageCsvExportResult {
  affectationsCsv: string;
  unassignedCsv?: string;
  filename: string;
  unassignedFilename?: string;
}

/**
 * Génère le CSV des affectations de stage
 */
export function generateStageCsv(
  data: StageExportResultData,
  options: Partial<StageCsvExportOptions> = {}
): StageCsvExportResult {
  const opts: StageCsvExportOptions = {
    includeGeoDetails: options.includeGeoDetails ?? false,
    includeContactInfo: options.includeContactInfo ?? true,
    includeDates: options.includeDates ?? true,
    includeDistanceApproxFlag: options.includeDistanceApproxFlag ?? true,
    separator: options.separator ?? ';',
    includeHeaders: options.includeHeaders ?? true,
    includeUnassignedSheet: options.includeUnassignedSheet ?? true,
    encoding: options.encoding ?? 'utf-8',
  };

  const sep = opts.separator;
  const rows: string[] = [];

  // === FICHIER PRINCIPAL: AFFECTATIONS ===
  const flatData = flattenStageDataForCsv(data);

  // En-têtes
  if (opts.includeHeaders) {
    const headers: string[] = [];
    
    // Toujours inclus
    headers.push(
      'Enseignant Nom',
      'Enseignant Prénom',
      'Matière',
      'Commune enseignant',
      'Élève Nom',
      'Élève Prénom',
      'Classe',
      'Entreprise',
      'Adresse complète',
      'Ville',
      'Distance (km)',
      'Durée estimée (min)'
    );

    // Optionnels
    if (opts.includeDistanceApproxFlag) {
      headers.push('Précision géo', 'Distance approximative');
    }
    if (opts.includeDates) {
      headers.push('Date début', 'Date fin');
    }
    if (opts.includeContactInfo) {
      headers.push('Tuteur', 'Email tuteur', 'Tél tuteur', 'Secteur d\'activité');
    }

    rows.push(toCsvLine(headers, sep));
  }

  // Données
  for (const row of flatData) {
    const values: (string | number | undefined)[] = [
      row.enseignantNom,
      row.enseignantPrenom,
      row.enseignantMatiere,
      row.enseignantCommune,
      row.eleveNom,
      row.elevePrenom,
      row.eleveClasse,
      row.entreprise,
      row.adresse,
      row.ville,
      row.distanceKm,
      row.dureeMin,
    ];

    if (opts.includeDistanceApproxFlag) {
      values.push(row.precisionGeo, row.isDistanceApprox);
    }
    if (opts.includeDates) {
      values.push(row.dateDebut, row.dateFin);
    }
    if (opts.includeContactInfo) {
      values.push(row.tuteur, row.tuteurEmail, row.tuteurTel, row.secteur);
    }

    rows.push(toCsvLine(values, sep));
  }

  const affectationsCsv = rows.join('\n');

  // === FICHIER SECONDAIRE: NON AFFECTÉS ===
  let unassignedCsv: string | undefined;
  let unassignedFilename: string | undefined;

  if (opts.includeUnassignedSheet && data.unassigned.length > 0) {
    const unassignedRows: string[] = [];

    if (opts.includeHeaders) {
      unassignedRows.push(toCsvLine(HEADERS_UNASSIGNED, sep));
    }

    const flatUnassigned = flattenUnassignedForCsv(data);
    for (const u of flatUnassigned) {
      unassignedRows.push(toCsvLine([
        u.nom,
        u.prenom,
        u.classe,
        u.entreprise,
        u.adresse,
        u.ville,
        u.raisons,
      ], sep));
    }

    unassignedCsv = unassignedRows.join('\n');
    unassignedFilename = `stages_non_affectes_${sanitizeFilename(data.scenarioName)}.csv`;
  }

  return {
    affectationsCsv,
    unassignedCsv,
    filename: `suivi_stages_${sanitizeFilename(data.scenarioName)}.csv`,
    unassignedFilename,
  };
}

// ============================================================
// GÉNÉRATION CSV PAR ENSEIGNANT (1 fichier par tuteur)
// ============================================================

export interface PerEnseignantCsvResult {
  filename: string;
  content: string;
  enseignantName: string;
}

/**
 * Génère un CSV par enseignant (utile pour envoi individuel)
 */
export function generateCsvPerEnseignant(
  data: StageExportResultData,
  options: Partial<StageCsvExportOptions> = {}
): PerEnseignantCsvResult[] {
  const sep = options.separator ?? ';';
  const results: PerEnseignantCsvResult[] = [];

  for (const ens of data.enseignants) {
    const rows: string[] = [];

    // En-tête
    rows.push(toCsvLine([
      'Élève Nom',
      'Élève Prénom',
      'Classe',
      'Entreprise',
      'Adresse',
      'Ville',
      'Distance (km)',
      'Durée estimée (min)',
      'Tuteur',
      'Tél tuteur',
    ], sep));

    // Données
    for (const eleve of ens.eleves) {
      rows.push(toCsvLine([
        eleve.nom,
        eleve.prenom,
        eleve.classe,
        eleve.entreprise,
        eleve.adresseComplete,
        eleve.ville,
        eleve.distanceKm,
        eleve.dureeEstimeeMin,
        eleve.tuteur,
        eleve.tuteurTel,
      ], sep));
    }

    const filename = `stages_${sanitizeFilename(ens.nom)}_${sanitizeFilename(ens.prenom)}.csv`;

    results.push({
      filename,
      content: rows.join('\n'),
      enseignantName: `${ens.prenom} ${ens.nom}`,
    });
  }

  return results;
}

// ============================================================
// TÉLÉCHARGEMENT
// ============================================================

/**
 * Nettoie un nom de fichier
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Télécharge un fichier CSV
 */
export function downloadCsv(content: string, filename: string): void {
  // Ajouter BOM UTF-8 pour Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Télécharge tous les CSV générés (affectations + non-affectés si présent)
 */
export function downloadAllStageCsv(result: StageCsvExportResult): void {
  // Fichier principal
  downloadCsv(result.affectationsCsv, result.filename);

  // Fichier non-affectés si présent
  if (result.unassignedCsv && result.unassignedFilename) {
    // Petit délai pour éviter le blocage navigateur
    setTimeout(() => {
      downloadCsv(result.unassignedCsv!, result.unassignedFilename!);
    }, 100);
  }
}

/**
 * Export et téléchargement en une seule fonction
 */
export function exportAndDownloadStageCsv(
  data: StageExportResultData,
  options?: Partial<StageCsvExportOptions>
): void {
  const result = generateStageCsv(data, options);
  downloadAllStageCsv(result);
}
