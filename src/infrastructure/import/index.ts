// ============================================================
// CSV IMPORT - Export Module
// ============================================================

export {
  parseCSVFile,
  generateAutoMapping,
  importElevesFromCSV,
  extractClassFromFilename,
  parseDate,
  parseFullName,
  detectSeparator,
  detectEncoding,
  decodeBuffer,
  KNOWN_HEADERS_MAP,
  IGNORED_COLUMNS,
  type ParsedCSVData,
  type MappingConfig,
} from './csvParser';

export {
  importStagesCsv,
  type ParsedRow as StageCsvRow,
  type ImportError as StageCsvImportError,
  type ImportStats as StageCsvImportStats,
  type ImportResult as StageCsvImportResult,
} from './stageCsv';
