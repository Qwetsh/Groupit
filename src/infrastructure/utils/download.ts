// ============================================================
// DOWNLOAD UTILITIES - Fonctions centralisées de téléchargement
// ============================================================

/**
 * Télécharge un Blob en tant que fichier
 * Gère correctement la libération de mémoire avec URL.revokeObjectURL
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
 * Télécharge du contenu texte en tant que fichier CSV
 * Ajoute automatiquement le BOM UTF-8 pour compatibilité Excel
 */
export function downloadCsvContent(content: string, filename: string): void {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Télécharge un Blob CSV
 */
export function downloadCsvBlob(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}

/**
 * Télécharge un Blob PDF
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}
