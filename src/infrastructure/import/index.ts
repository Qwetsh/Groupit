// ============================================================
// CSV IMPORT - Export Module
// ============================================================

export {
  parseCSVFile,
  generateAutoMapping,
  generateAutoMappingEnseignants,
  importElevesFromCSV,
  importEnseignantsFromCSV,
  extractClassFromFilename,
  parseDate,
  parseFullName,
  detectSeparator,
  detectEncoding,
  decodeBuffer,
  KNOWN_HEADERS_MAP,
  KNOWN_HEADERS_MAP_ENSEIGNANT,
  IGNORED_COLUMNS,
  type ParsedCSVData,
  type MappingConfig,
  type EnseignantImportResult,
} from './csvParser';

export {
  importStagesCsv,
  type ParsedRow as StageCsvRow,
  type ImportError as StageCsvImportError,
  type ImportStats as StageCsvImportStats,
  type ImportResult as StageCsvImportResult,
} from './stageCsv';
