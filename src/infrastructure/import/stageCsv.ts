import Papa from 'papaparse';
import { detectEncoding, detectSeparator, decodeBuffer } from './csvParser';

const REQUIRED_HEADERS = ['nom', 'prenom', 'adresse', 'classe', 'entreprise'] as const;
const REQUIRED_VALUE_FIELDS = ['nom', 'prenom', 'adresse', 'classe'] as const;

export interface ParsedRow {
  nom: string;
  prenom: string;
  adresse: string;
  classe: string;
  entreprise?: string;
  nomEntreprise?: string;  // Alias du nouveau champ
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ImportStats {
  total: number;
  imported: number;
  rejected: number;
}

export interface ImportResult {
  rows: ParsedRow[];
  errors: ImportError[];
  stats: ImportStats;
}

type NormalizedHeader = typeof REQUIRED_HEADERS[number];
type HeaderMap = Map<NormalizedHeader, string>;

export async function importStagesCsv(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const encoding = detectEncoding(buffer);
  const content = decodeBuffer(buffer, encoding);
  const normalizedContent = normalizeContent(content);
  const separator = detectSeparator(normalizedContent);

  const parsed = Papa.parse<Record<string, string>>(normalizedContent, {
    header: true,
    delimiter: separator,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
    transformHeader: header => (header ?? '').trim(),
    transform: value => sanitizeValue(value),
  });

  const parserErrors = parsed.errors.map(error => ({
    line: resolveErrorLine(error.row),
    message: `Erreur de parsing: ${error.message}`,
  }));

  const headers = parsed.meta.fields ?? [];
  const headerMap = buildHeaderMap(headers);
  const missingHeaders = REQUIRED_HEADERS.filter(header => !headerMap.has(header));

  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [
        ...parserErrors,
        {
          line: 1,
          message: `Colonnes obligatoires manquantes: ${missingHeaders.join(', ')}`,
        },
      ],
      stats: { total: 0, imported: 0, rejected: 0 },
    };
  }

  const rows: ParsedRow[] = [];
  const errors: ImportError[] = [...parserErrors];

  parsed.data.forEach((rawRow, index) => {
    const mapped = mapRow(rawRow, headerMap);
    const issues = validateRow(mapped);

    if (issues.length > 0) {
      errors.push({
        line: index + 2,
        message: issues.join(' | '),
      });
      return;
    }

    rows.push(mapped);
  });

  const total = parsed.data.length;
  const imported = rows.length;
  const rejected = total - imported;

  return {
    rows,
    errors,
    stats: { total, imported, rejected },
  };
}

// decodeBuffer importé depuis csvParser

function normalizeContent(value: string): string {
  return value
    .replace(/^[\uFEFF\u0000]+/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function sanitizeValue(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value)
    .replace(/[\uFEFF\u0000]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

function resolveErrorLine(rowIndex: number | undefined): number {
  if (typeof rowIndex === 'number' && rowIndex >= 0) {
    return rowIndex + 2;
  }
  return 0;
}

function buildHeaderMap(headers: string[]): HeaderMap {
  const map = new Map<NormalizedHeader, string>();

  headers.forEach(header => {
    const normalized = normalizeHeaderName(header);
    if (isRecognizedHeader(normalized)) {
      map.set(normalized, header);
    }
  });

  return map;
}

function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isRecognizedHeader(value: string): value is NormalizedHeader {
  return (REQUIRED_HEADERS as readonly string[]).includes(value);
}

function mapRow(row: Record<string, string>, headerMap: HeaderMap): ParsedRow {
  const get = (key: NormalizedHeader) => {
    const header = headerMap.get(key);
    return sanitizeValue(header ? row[header] : '');
  };

  const entreprise = get('entreprise');

  return {
    nom: get('nom'),
    prenom: get('prenom'),
    adresse: get('adresse'),
    classe: get('classe'),
    entreprise: entreprise || undefined,
    nomEntreprise: entreprise || undefined,  // Alias pour le nouveau champ
  };
}

function validateRow(row: ParsedRow): string[] {
  const issues: string[] = [];

  REQUIRED_VALUE_FIELDS.forEach(field => {
    if (!row[field] || row[field].length === 0) {
      issues.push(`Champ "${field}" manquant`);
    }
  });

  if (row.adresse && !row.adresse.includes(',')) {
    issues.push('Adresse invalide : virgule avant le code postal manquante');
  }

  return issues;
}
