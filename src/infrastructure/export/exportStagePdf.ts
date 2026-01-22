// ============================================================
// EXPORT PDF - SUIVI DE STAGE
// ============================================================

import { pdf } from '@react-pdf/renderer';
import React from 'react';
import type { StageExportResultData, StagePdfExportOptions } from './stageTypes';
import { DEFAULT_STAGE_PDF_OPTIONS } from './stageTypes';
import { StageExportDocument } from './stagePdfComponents';
import { downloadBlob } from '../utils/download';

// ============================================================
// GÉNÉRATION DU PDF
// ============================================================

/**
 * Génère le blob PDF pour l'export Suivi de Stage
 */
export async function generateStagePdf(
  data: StageExportResultData,
  options: Partial<StagePdfExportOptions> = {}
): Promise<Blob> {
  const mergedOptions: StagePdfExportOptions = {
    ...DEFAULT_STAGE_PDF_OPTIONS,
    ...options,
  };

  const document = React.createElement(StageExportDocument, {
    data,
    options: mergedOptions,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(document as any).toBlob();
  return blob;
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Télécharge un blob PDF
 * @deprecated Utiliser downloadBlob de '../utils/download' directement
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}

/**
 * Génère et télécharge le PDF Suivi de Stage
 */
export async function downloadStagePdf(
  data: StageExportResultData,
  options: Partial<StagePdfExportOptions> = {}
): Promise<void> {
  const blob = await generateStagePdf(data, options);
  const filename = `suivi_stages_${sanitizeFilename(data.scenarioName)}.pdf`;
  downloadPdfBlob(blob, filename);
}

// ============================================================
// GÉNÉRATION PAR ENSEIGNANT (PDF INDIVIDUELS)
// ============================================================

export interface PerEnseignantPdfResult {
  enseignantId: string;
  enseignantName: string;
  filename: string;
  blob: Blob;
}

/**
 * Génère un PDF par enseignant (pour envoi individuel)
 */
export async function generatePdfPerEnseignant(
  data: StageExportResultData,
  options: Partial<StagePdfExportOptions> = {}
): Promise<PerEnseignantPdfResult[]> {
  const mergedOptions: StagePdfExportOptions = {
    ...DEFAULT_STAGE_PDF_OPTIONS,
    ...options,
    includeSummaryPage: false,
    includeUnassignedPage: false,
  };

  const results: PerEnseignantPdfResult[] = [];

  for (const enseignant of data.enseignants) {
    // Créer un sous-ensemble des données pour cet enseignant
    const singleEnseignantData: StageExportResultData = {
      ...data,
      enseignants: [enseignant],
      unassigned: [],
      stats: {
        ...data.stats,
        totalAffectes: enseignant.nbEleves,
        nbEnseignants: 1,
        distanceTotaleGlobaleKm: enseignant.distanceTotaleKm,
        distanceMoyenneGlobaleKm: enseignant.distanceMoyenneKm,
        nbDistancesApprox: enseignant.nbDistancesApprox,
      },
    };

    const document = React.createElement(StageExportDocument, {
      data: singleEnseignantData,
      options: mergedOptions,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(document as any).toBlob();
    const filename = `suivi_stage_${sanitizeFilename(enseignant.nom)}_${sanitizeFilename(enseignant.prenom)}.pdf`;

    results.push({
      enseignantId: enseignant.enseignantId,
      enseignantName: `${enseignant.prenom} ${enseignant.nom}`,
      filename,
      blob,
    });
  }

  return results;
}

/**
 * Télécharge tous les PDFs individuels (avec délai pour éviter blocage)
 */
export async function downloadAllIndividualPdfs(
  results: PerEnseignantPdfResult[],
  delayMs = 200
): Promise<void> {
  for (let i = 0; i < results.length; i++) {
    const { blob, filename } = results[i];
    downloadPdfBlob(blob, filename);
    
    // Délai entre chaque téléchargement
    if (i < results.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================================
// FONCTION PRINCIPALE D'EXPORT
// ============================================================

export type StageExportMode = 'combined' | 'individual';

export interface ExportStagePdfOptions extends Partial<StagePdfExportOptions> {
  mode?: StageExportMode;
}

/**
 * Export principal - mode combiné ou individuel
 */
export async function exportStagePdf(
  data: StageExportResultData,
  options: ExportStagePdfOptions = {}
): Promise<void> {
  const { mode = 'combined', ...pdfOptions } = options;

  if (mode === 'individual') {
    const results = await generatePdfPerEnseignant(data, pdfOptions);
    await downloadAllIndividualPdfs(results);
  } else {
    await downloadStagePdf(data, pdfOptions);
  }
}

// ============================================================
// PRÉVISUALISATION (ouvre dans un nouvel onglet)
// ============================================================

/**
 * Génère et ouvre le PDF dans un nouvel onglet pour prévisualisation
 */
export async function previewStagePdf(
  data: StageExportResultData,
  options: Partial<StagePdfExportOptions> = {}
): Promise<void> {
  const blob = await generateStagePdf(data, options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: Ne pas révoquer immédiatement car l'onglet a besoin de l'URL
  // Le navigateur nettoiera lors de la fermeture de l'onglet
}
