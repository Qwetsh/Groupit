// ============================================================
// MODULE EXPORT - Point d'entrée principal
// ============================================================

// Types
export type {
  ExportResultData,
  ExportJuryData,
  ExportEleveData,
  ExportEnseignantData,
  ExportUnassignedData,
  CsvExportOptions,
  PdfExportOptions,
} from './types';

export {
  DEFAULT_CSV_OPTIONS,
  DEFAULT_PDF_OPTIONS,
} from './types';

// Data Mapper
export { mapToExportData } from './dataMapper';
export type { UnassignedReasons } from './dataMapper';

// CSV Export
export {
  exportCsvResults,
  createCsvBlob,
  downloadCsv,
  downloadExportCsv,
} from './exportCsv';

// PDF Export
export {
  exportPdfJuries,
  downloadPdf,
  downloadExportPdf,
  previewPdf,
} from './exportPdf';

// PDF Components (for advanced customization)
export { PdfJuryDocument } from './PdfComponents';

// ================= SUIVI DE STAGE =================
export type {
  StageExportResultData,
  StageExportEnseignantData,
  StageExportEleveData,
  StageExportUnassignedData,
  StageCsvExportOptions,
  StagePdfExportOptions,
} from './stageTypes';
export {
  DEFAULT_STAGE_CSV_OPTIONS,
  DEFAULT_STAGE_PDF_OPTIONS,
} from './stageTypes';
export {
  mapToStageExportData,
  flattenStageDataForCsv,
  flattenUnassignedForCsv,
} from './stageDataMapper';
export {
  generateStageCsv,
  downloadAllStageCsv,
  exportAndDownloadStageCsv,
  generateCsvPerEnseignant,
} from './exportStageCsv';
export {
  generateStagePdf,
  downloadStagePdf,
  exportStagePdf,
  previewStagePdf,
  generatePdfPerEnseignant,
  downloadAllIndividualPdfs,
} from './exportStagePdf';
export { StageExportDocument } from './stagePdfComponents';
