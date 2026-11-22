// ============================================================
// SERVICES - Export centralisé
// ============================================================

export {
  formatArchiveDate,
  getScenarioTypeLabel,
} from './validationService';

export {
  parseStageFile,
  matchStageRowsWithEleves,
  importStagesFromFile,
  convertMatchedRowsToStageData,
  type StageImportRow,
  type MatchedStageRow,
  type UnmatchedStageRow,
  type StageImportResult,
  type StageImportError,
} from './stageImportService';
