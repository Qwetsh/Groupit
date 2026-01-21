// ============================================================
// SERVICES - Export centralisé
// ============================================================

export {
  buildArchiveFromCurrentState,
  formatArchiveDate,
  getScenarioTypeLabel,
  type ValidationInput,
  type ValidationResult,
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
