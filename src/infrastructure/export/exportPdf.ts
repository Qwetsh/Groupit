// ============================================================
// EXPORT PDF - Génération de documents PDF pour les jurys
// ============================================================

import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { PdfJuryDocument } from './PdfComponents';
import type { ExportResultData, PdfExportOptions } from './types';
import { DEFAULT_PDF_OPTIONS } from './types';

/**
 * Génère un Blob PDF à partir des données d'export
 */
export async function exportPdfJuries(
  data: ExportResultData,
  options: Partial<PdfExportOptions> = {}
): Promise<Blob> {
  const opts: PdfExportOptions = { ...DEFAULT_PDF_OPTIONS, ...options };
  
  // Créer le document React PDF
  const document = React.createElement(PdfJuryDocument, { data, options: opts });
  
  // Générer le PDF en Blob (cast pour contourner les types strictes de @react-pdf/renderer)
  const blob = await pdf(document as any).toBlob();
  
  return blob;
}

/**
 * Télécharge le PDF généré
 */
export function downloadPdf(blob: Blob, filename: string): void {
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
export async function downloadExportPdf(
  data: ExportResultData,
  filename: string = 'export_jurys.pdf',
  options: Partial<PdfExportOptions> = {}
): Promise<void> {
  try {
    const blob = await exportPdfJuries(data, options);
    downloadPdf(blob, filename);
  } catch (error) {
    console.error('[exportPdf] Erreur génération PDF:', error);
    throw error;
  }
}

/**
 * Prévisualise le PDF dans un nouvel onglet
 */
export async function previewPdf(
  data: ExportResultData,
  options: Partial<PdfExportOptions> = {}
): Promise<void> {
  try {
    const blob = await exportPdfJuries(data, options);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Note: URL.revokeObjectURL sera appelé quand l'onglet sera fermé
  } catch (error) {
    console.error('[exportPdf] Erreur prévisualisation PDF:', error);
    throw error;
  }
}
