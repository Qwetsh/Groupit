// ============================================================
// CSV IMPORT - Parser & Utilities
// ============================================================

import Papa from 'papaparse';
import type { Eleve, ColumnMapping, ImportResult } from '../../domain/models';

// ============ TYPES ============

export interface ParsedCSVData {
  headers: string[];
  rows: Record<string, string>[];
  separator: string;
  encoding: string;
}

export interface MappingConfig {
  csvHeader: string;
  targetField: keyof Eleve | null;
  transform?: (value: string) => unknown;
}

// ============ KNOWN HEADERS MAPPING ============

// Map des en-têtes CSV connus vers les champs Eleve
export const KNOWN_HEADERS_MAP: Record<string, keyof Eleve> = {
  // Nom - variantes possibles
  'élèves': 'nom',
  'eleves': 'nom',
  'élève': 'nom',
  'eleve': 'nom',
  'nom': 'nom',
  'nom élève': 'nom',
  'nom eleve': 'nom',
  'nom de famille': 'nom',
  
  // Prénom
  'prénom': 'prenom',
  'prenom': 'prenom',
  'prénom élève': 'prenom',
  
  // Date de naissance
  'né(e) le': 'dateNaissance',
  'ne(e) le': 'dateNaissance',
  'date de naissance': 'dateNaissance',
  'date naissance': 'dateNaissance',
  'naissance': 'dateNaissance',
  
  // Sexe
  'sexe': 'sexe',
  'genre': 'sexe',
  
  // Email
  'adresse e-mail': 'email',
  'adresse email': 'email',
  'e-mail': 'email',
  'email': 'email',
  'mail': 'email',
  'courriel': 'email',
  
  // Régime
  'régime': 'regime',
  'regime': 'regime',
  
  // Encouragement/Valorisation -> champ spécial
  'encouragement/valorisation': 'encouragementValorisation',
  'encouragement': 'encouragementValorisation',
  'valorisation': 'encouragementValorisation',
};

// Colonnes à ignorer
export const IGNORED_COLUMNS = [
  'entrée',
  'entree',
  'sortie',
  'unnamed',
  '',
];

// ============ ENCODING DETECTION ============

/**
 * Détecte l'encodage d'un fichier
 * Priorité: UTF-8 BOM > UTF-16 LE/BE > UTF-8 > ISO-8859-1
 * Version unifiée pour tout le projet
 */
export function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, Math.min(4, buffer.byteLength)));

  // Check for UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8-sig';
  }

  // Check for UTF-16 LE BOM
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return 'utf-16le';
  }

  // Check for UTF-16 BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return 'utf-16be';
  }

  // Try UTF-8 decoding with fatal mode
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(buffer);
    return 'utf-8';
  } catch {
    // Fallback to ISO-8859-1 (Latin-1)
    return 'iso-8859-1';
  }
}

/**
 * Décode un buffer selon l'encodage détecté
 * Gère automatiquement le BOM UTF-8
 */
export function decodeBuffer(buffer: ArrayBuffer, encoding: string): string {
  const actualEncoding = encoding === 'utf-8-sig' ? 'utf-8' : encoding;
  const bufferToUse = encoding === 'utf-8-sig' ? buffer.slice(3) : buffer;
  const decoder = new TextDecoder(actualEncoding, { fatal: false });
  return decoder.decode(bufferToUse);
}

// ============ SEPARATOR DETECTION ============

/**
 * Détecte le séparateur CSV
 * Priorité: ; > , > \t
 */
export function detectSeparator(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;
  
  // Priorité au point-virgule (format français)
  if (semicolonCount >= commaCount && semicolonCount >= tabCount) {
    return ';';
  }
  
  if (commaCount >= tabCount) {
    return ',';
  }
  
  return '\t';
}

// ============ DATE PARSING ============

/**
 * Valide qu'une date existe vraiment (jour/mois/année cohérents)
 */
function isValidDate(day: number, month: number, year: number): boolean {
  // Vérifications de base
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > 2100) return false;

  // Créer un objet Date et vérifier que les valeurs correspondent
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Parse une date au format français (jj/mm/aaaa) ou ISO
 * Retourne undefined si le format n'est pas reconnu ou si la date est invalide
 */
export function parseDate(value: string): string | undefined {
  if (!value || value.trim() === '') return undefined;

  const trimmed = value.trim();

  // Format jj/mm/aaaa
  const frenchMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frenchMatch) {
    const [, dayStr, monthStr, yearStr] = frenchMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (!isValidDate(day, month, year)) return undefined;
    return `${year}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
  }

  // Format jj-mm-aaaa
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, dayStr, monthStr, yearStr] = dashMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (!isValidDate(day, month, year)) return undefined;
    return `${year}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;
  }

  // Format ISO yyyy-mm-dd
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yearStr, monthStr, dayStr] = isoMatch;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (!isValidDate(day, month, year)) return undefined;
    return trimmed;
  }

  // Format non reconnu
  return undefined;
}

// ============ NAME PARSING ============

/**
 * Extrait nom et prénom d'une chaîne "NOM Prénom" ou "Prénom NOM"
 */
export function parseFullName(value: string): { nom: string; prenom: string } {
  if (!value || value.trim() === '') {
    return { nom: '', prenom: '' };
  }
  
  const parts = value.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return { nom: parts[0], prenom: '' };
  }
  
  // Heuristique: si le premier mot est en majuscules, c'est le nom
  // Sinon, le dernier mot en majuscules est le nom
  const firstIsUppercase = parts[0] === parts[0].toUpperCase();
  
  if (firstIsUppercase) {
    // Format: NOM Prénom [Prénom2...]
    const nom = parts[0];
    const prenom = parts.slice(1).join(' ');
    return { nom, prenom };
  } else {
    // Format: Prénom [Prénom2...] NOM
    // Chercher le dernier mot en majuscules
    let nomIndex = parts.length - 1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) {
        nomIndex = i;
        break;
      }
    }
    
    const nom = parts[nomIndex];
    const prenom = [...parts.slice(0, nomIndex), ...parts.slice(nomIndex + 1)].join(' ');
    return { nom, prenom };
  }
}

// ============ CLASS EXTRACTION FROM FILENAME ============

/**
 * Extrait le nom de classe depuis le nom de fichier
 * Patterns: "3A.csv", "classe_3A.csv", "export_3eme_A.xlsx"
 */
export function extractClassFromFilename(filename: string): string | null {
  if (!filename) return null;
  
  // Pattern direct: 3A, 4B, 6C, etc.
  const directMatch = filename.match(/\b([3-6][A-Z])\b/i);
  if (directMatch) {
    return directMatch[1].toUpperCase();
  }
  
  // Pattern avec "eme": 3eme_A, 4ème_B
  const emeMatch = filename.match(/([3-6])(?:e|è|eme|ème)[_\s-]?([A-Z])/i);
  if (emeMatch) {
    return `${emeMatch[1]}${emeMatch[2].toUpperCase()}`;
  }
  
  // Pattern "classe_X"
  const classeMatch = filename.match(/classe[_\s-]?([3-6][A-Z])/i);
  if (classeMatch) {
    return classeMatch[1].toUpperCase();
  }
  
  return null;
}

// ============ CSV PARSING ============

/**
 * Parse un fichier CSV avec auto-détection
 */
export async function parseCSVFile(file: File): Promise<ParsedCSVData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const encoding = detectEncoding(buffer);
        
        // Décoder le contenu
        let content: string;
        if (encoding === 'utf-8-sig') {
          // Skip BOM
          const decoder = new TextDecoder('utf-8');
          content = decoder.decode(buffer.slice(3));
        } else {
          const decoder = new TextDecoder(encoding);
          content = decoder.decode(buffer);
        }
        
        const separator = detectSeparator(content);
        
        // Parse avec PapaParse
        const result = Papa.parse<Record<string, string>>(content, {
          header: true,
          delimiter: separator,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        });
        
        if (result.errors.length > 0) {
          console.warn('CSV parsing warnings:', result.errors);
        }
        
        // Nettoyer les headers
        const headers = result.meta.fields || [];
        const cleanedHeaders = headers.filter(h => {
          const lower = h.toLowerCase().trim();
          return !IGNORED_COLUMNS.some(ignored => 
            lower === ignored || lower.startsWith('unnamed')
          );
        });
        
        resolve({
          headers: cleanedHeaders,
          rows: result.data,
          separator,
          encoding,
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}

// ============ AUTO MAPPING ============

/**
 * Génère automatiquement le mapping des colonnes
 */
export function generateAutoMapping(headers: string[]): ColumnMapping[] {
  return headers.map(header => {
    const normalizedHeader = header.toLowerCase().trim();
    const targetField = KNOWN_HEADERS_MAP[normalizedHeader] || null;
    const isIgnored = IGNORED_COLUMNS.some(ignored => 
      normalizedHeader === ignored || normalizedHeader.startsWith('unnamed')
    );
    
    return {
      csvHeader: header,
      targetField: isIgnored ? null : targetField,
      isIgnored,
    };
  });
}

// ============ OPTIONS EXTRACTION ============

/**
 * Extrait les options depuis les colonnes Option 1, Option 2, etc.
 */
export function extractOptions(row: Record<string, string>, headers: string[]): string[] {
  const options: string[] = [];
  
  headers.forEach(header => {
    const lower = header.toLowerCase();
    if (lower.startsWith('option') && row[header] && row[header].trim() !== '') {
      options.push(row[header].trim());
    }
  });
  
  return options;
}

// ============ MAIN IMPORT FUNCTION ============

/**
 * Importe les élèves depuis les données CSV parsées
 */
export function importElevesFromCSV(
  data: ParsedCSVData,
  mappings: ColumnMapping[],
  defaultClasse: string
): ImportResult {
  const eleves: Partial<Eleve>[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Créer un map rapide des mappings
  const mappingMap = new Map<string, keyof Eleve | null>();
  mappings.forEach(m => {
    if (!m.isIgnored) {
      mappingMap.set(m.csvHeader, m.targetField);
    }
  });
  
  // Trouver la colonne "nom complet" si elle existe
  const nomCompletHeader = data.headers.find(h => {
    const lower = h.toLowerCase();
    return lower === 'élèves' || lower === 'eleves' || lower === 'élève' || lower === 'eleve';
  });
  
  data.rows.forEach((row, index) => {
    try {
      const eleve: Partial<Eleve> = {
        classe: defaultClasse,
        options: [],
        tags: [],
        contraintes: [],
        autresChamps: {},
      };
      
      // Si on a une colonne "nom complet", parser nom + prénom
      if (nomCompletHeader && row[nomCompletHeader]) {
        const { nom, prenom } = parseFullName(row[nomCompletHeader]);
        eleve.nom = nom;
        eleve.prenom = prenom;
      }
      
      // Appliquer les mappings
      mappings.forEach(mapping => {
        if (mapping.isIgnored || !mapping.targetField) return;
        
        const value = row[mapping.csvHeader];
        if (!value || value.trim() === '') return;
        
        const trimmedValue = value.trim();
        
        switch (mapping.targetField) {
          case 'nom':
            // Ne pas écraser si déjà défini par nom complet
            if (!eleve.nom) {
              eleve.nom = trimmedValue;
            }
            break;
          case 'prenom':
            if (!eleve.prenom) {
              eleve.prenom = trimmedValue;
            }
            break;
          case 'dateNaissance':
            eleve.dateNaissance = parseDate(trimmedValue);
            break;
          case 'sexe':
            const sexeValue = trimmedValue.toUpperCase();
            if (sexeValue === 'M' || sexeValue === 'MASCULIN' || sexeValue === 'GARÇON' || sexeValue === 'GARCON') {
              eleve.sexe = 'M';
            } else if (sexeValue === 'F' || sexeValue === 'FÉMININ' || sexeValue === 'FEMININ' || sexeValue === 'FILLE') {
              eleve.sexe = 'F';
            } else {
              eleve.sexe = 'Autre';
            }
            break;
          case 'email':
            eleve.email = trimmedValue;
            break;
          case 'regime':
            eleve.regime = trimmedValue;
            break;
          case 'encouragementValorisation':
            eleve.encouragementValorisation = trimmedValue;
            break;
          default:
            // Stocker dans autresChamps
            if (eleve.autresChamps) {
              eleve.autresChamps[mapping.csvHeader] = trimmedValue;
            }
        }
      });
      
      // Extraire les options
      eleve.options = extractOptions(row, data.headers);
      
      // Validation minimale
      if (!eleve.nom || eleve.nom.trim() === '') {
        warnings.push(`Ligne ${index + 2}: Nom manquant, ligne ignorée`);
        return;
      }
      
      eleves.push(eleve);
    } catch (error) {
      errors.push(`Ligne ${index + 2}: Erreur de parsing - ${error}`);
    }
  });
  
  return {
    success: errors.length === 0,
    eleves,
    errors,
    warnings,
    mappings,
  };
}
