// ============================================================
// SERVICES - Export centralisé
// ============================================================

export {
  createBackupService,
  eleveBackupService,
  enseignantBackupService,
  type BackupService,
} from './backupService';

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
