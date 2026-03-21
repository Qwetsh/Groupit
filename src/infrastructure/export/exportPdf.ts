// ============================================================
// EXPORT PDF - Génération de documents PDF pour les jurys
// ============================================================

import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { PdfJuryDocument } from './PdfComponents';
import type { ExportResultData, PdfExportOptions } from './types';
import { DEFAULT_PDF_OPTIONS } from './types';
import { downloadBlob } from '../utils/download';
import { generateAllJuryQRCodes } from './qrcode';
import { uploadSessionToSupabase } from './supabaseUpload';

/**
 * Génère un Blob PDF à partir des données d'export
 */
export async function exportPdfJuries(
  data: ExportResultData,
  options: Partial<PdfExportOptions> = {}
): Promise<Blob> {
  const opts: PdfExportOptions = { ...DEFAULT_PDF_OPTIONS, ...options };

  // Générer les QR codes si un code session est fourni
  let qrCodes: Map<string, string> | undefined;
  if (opts.sessionCode) {
    const juryNames = data.jurys.map(j => j.juryName);
    qrCodes = await generateAllJuryQRCodes(opts.sessionCode, juryNames, opts.juryPwaUrl);
  }

  // Créer le document React PDF
  const document = React.createElement(PdfJuryDocument, { data, options: opts, qrCodes });

  // Générer le PDF en Blob
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(document as any).toBlob();

  return blob;
}

/**
 * Télécharge le PDF généré
 * @deprecated Utiliser downloadBlob de '../utils/download' directement
 */
export function downloadPdf(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
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
    // Upload vers Supabase si un code session est fourni (en parallèle du PDF)
    const opts = { ...DEFAULT_PDF_OPTIONS, ...options };
    let uploadPromise: Promise<unknown> | undefined;
    if (opts.sessionCode) {
      uploadPromise = uploadSessionToSupabase(data, opts as PdfExportOptions & { sessionCode: string })
        .then(result => {
          if (!result.success) {
            console.warn('[exportPdf] Upload Supabase échoué:', result.error);
          } else {
            console.log('[exportPdf] Session uploadée vers Supabase');
          }
        })
        .catch(err => console.warn('[exportPdf] Upload Supabase erreur:', err));
    }

    const blob = await exportPdfJuries(data, options);
    downloadPdf(blob, filename);

    // Attendre la fin de l'upload (non-bloquant pour le PDF)
    if (uploadPromise) await uploadPromise;
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
  // Ouvrir la fenêtre de façon synchrone (dans le geste utilisateur) pour éviter les popup blockers
  const win = window.open('', '_blank');
  try {
    const blob = await exportPdfJuries(data, options);
    const url = URL.createObjectURL(blob);
    if (win) {
      win.location.href = url;
    } else {
      // Fallback si popup bloqué
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (win) win.close();
    console.error('[exportPdf] Erreur prévisualisation PDF:', error);
    throw error;
  }
}
