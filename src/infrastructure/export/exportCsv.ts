// ============================================================
// EXPORT CSV - Génération de fichiers CSV pour les résultats
// ============================================================

import type { ExportResultData, CsvExportOptions } from './types';
import { DEFAULT_CSV_OPTIONS } from './types';

/**
 * Échappe une valeur pour CSV (gère les guillemets et séparateurs)
 */
function escapeCSV(value: string | number | null | undefined, separator: string): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  
  // Si contient le séparateur, des guillemets ou des retours à la ligne, encadrer de guillemets
  if (str.includes(separator) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Génère une ligne CSV
 */
function csvLine(values: (string | number | null | undefined)[], separator: string): string {
  return values.map(v => escapeCSV(v, separator)).join(separator);
}

/**
 * Génère le CSV des élèves affectés
 */
function generateAffectedCSV(data: ExportResultData, options: CsvExportOptions): string {
  const { separator, includeHeaders, includeScheduleColumns, includeTopicTitle, includeSalle } = options;
  
  const lines: string[] = [];
  
  // En-têtes
  if (includeHeaders) {
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
    
    if (includeSalle) headers.push('Salle');
    if (includeScheduleColumns) {
      headers.push('Date Passage');
      headers.push('Heure Passage');
    }
    if (includeTopicTitle) headers.push('Sujet/Thème');
    
    lines.push(csvLine(headers, separator));
  }
  
  // Données
  for (const jury of data.jurys) {
    const enseignantNames = jury.enseignants.map(e => `${e.prenom} ${e.nom}`).join(', ');
    const enseignantMatieres = jury.enseignants.map(e => e.matierePrincipale).join(', ');
    
    for (const eleve of jury.eleves) {
      const row: (string | number | null | undefined)[] = [
        jury.juryName,
        enseignantNames,
        enseignantMatieres,
        eleve.nom,
        eleve.prenom,
        eleve.classe,
        eleve.matieresOral.join(', '),
        eleve.matiereAffectee,
      ];
      
      if (includeSalle) row.push(eleve.salle || jury.salle || '');
      if (includeScheduleColumns) {
        row.push(eleve.datePassage || '');
        row.push(eleve.heurePassage || '');
      }
      if (includeTopicTitle) row.push(eleve.sujetIntitule || '');
      
      lines.push(csvLine(row, separator));
    }
  }
  
  return lines.join('\n');
}

/**
 * Génère le CSV des élèves non affectés
 */
function generateUnassignedCSV(data: ExportResultData, options: CsvExportOptions): string {
  const { separator, includeHeaders } = options;
  
  const lines: string[] = [];
  
  // En-têtes
  if (includeHeaders) {
    lines.push(csvLine(['Nom', 'Prénom', 'Classe', 'Matière(s) Oral', 'Raison(s)'], separator));
  }
  
  // Données
  for (const eleve of data.unassigned) {
    lines.push(csvLine([
      eleve.nom,
      eleve.prenom,
      eleve.classe,
      eleve.matieresOral.join(', '),
      eleve.raisons.join('; '),
    ], separator));
  }
  
  return lines.join('\n');
}

/**
 * Génère le CSV des statistiques
 */
function generateStatsCSV(data: ExportResultData, options: CsvExportOptions): string {
  const { separator } = options;
  
  const lines: string[] = [
    csvLine(['Statistique', 'Valeur'], separator),
    csvLine(['Scénario', data.scenarioName], separator),
    csvLine(['Date export', new Date(data.dateExport).toLocaleDateString('fr-FR')], separator),
    csvLine(['', ''], separator),
    csvLine(['Total élèves', data.stats.totalEleves], separator),
    csvLine(['Élèves affectés', data.stats.totalAffectes], separator),
    csvLine(['Élèves non affectés', data.stats.totalNonAffectes], separator),
    csvLine(['Taux affectation', `${data.stats.tauxAffectation}%`], separator),
    csvLine(['Taux match matière', `${data.stats.tauxMatchMatiere}%`], separator),
    csvLine(['Nombre de jurys', data.stats.nbJurys], separator),
    csvLine(['Nombre enseignants', data.stats.nbEnseignants], separator),
  ];
  
  return lines.join('\n');
}

/**
 * Export principal: génère le contenu CSV complet
 * Retourne un objet avec les différentes feuilles si demandé
 */
export function exportCsvResults(
  data: ExportResultData,
  options: Partial<CsvExportOptions> = {}
): { affected: string; unassigned?: string; stats?: string } {
  const opts: CsvExportOptions = { ...DEFAULT_CSV_OPTIONS, ...options };
  
  const result: { affected: string; unassigned?: string; stats?: string } = {
    affected: generateAffectedCSV(data, opts),
  };
  
  if (opts.includeUnassignedSheet && data.unassigned.length > 0) {
    result.unassigned = generateUnassignedCSV(data, opts);
  }
  
  result.stats = generateStatsCSV(data, opts);
  
  return result;
}

/**
 * Crée un Blob CSV téléchargeable (UTF-8 avec BOM pour Excel)
 */
export function createCsvBlob(csvContent: string, options: Partial<CsvExportOptions> = {}): Blob {
  const opts: CsvExportOptions = { ...DEFAULT_CSV_OPTIONS, ...options };
  
  // Ajouter BOM UTF-8 pour que Excel reconnaisse l'encodage
  const bom = opts.encoding === 'utf-8' ? '\uFEFF' : '';
  
  return new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8',
  });
}

/**
 * Télécharge un fichier CSV
 */
export function downloadCsv(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export complet avec téléchargement
 */
export function downloadExportCsv(
  data: ExportResultData,
  baseFilename: string = 'export',
  options: Partial<CsvExportOptions> = {}
): void {
  const csvData = exportCsvResults(data, options);
  
  // Télécharger le fichier principal (affectations)
  const mainBlob = createCsvBlob(csvData.affected, options);
  downloadCsv(mainBlob, `${baseFilename}_affectations.csv`);
  
  // Télécharger les non-affectés si présents
  if (csvData.unassigned) {
    setTimeout(() => {
      const unassignedBlob = createCsvBlob(csvData.unassigned!, options);
      downloadCsv(unassignedBlob, `${baseFilename}_non_affectes.csv`);
    }, 500);
  }
}
