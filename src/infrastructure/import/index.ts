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
  type EnseignantImportResult,
} from './csvParser';

