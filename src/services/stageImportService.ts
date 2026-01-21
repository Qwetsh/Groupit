// ============================================================
// STAGE IMPORT SERVICE - Version améliorée
// Matching souple avec support CSV/XLSX
// ============================================================

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Eleve, Stage } from '../domain/models';

// ============================================================
// TYPES
// ============================================================

export interface StageImportRow {
  nom: string;
  prenom: string;
  classe?: string;
  entreprise?: string;
  adresse?: string;
  telephone?: string;
  tuteur?: string;
  tuteurEmail?: string;
  dateDebut?: string;
  dateFin?: string;
  // Champ optionnel si nom complet dans une seule colonne
  nomComplet?: string;
}

export interface MatchedStageRow extends StageImportRow {
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  eleveClasse: string;
  matchScore: number;
  matchMethod: MatchMethod;
}

export interface AmbiguousStageRow extends StageImportRow {
  candidates: Array<{
    eleve: Eleve;
    score: number;
    method: MatchMethod;
  }>;
  reason: string;
}

export interface UnmatchedStageRow extends StageImportRow {
  reason: string;
  suggestions?: string[];
}

export type MatchMethod =
  | 'exact_with_class'
  | 'exact_normalized'
  | 'inverted_order'
  | 'full_name_split'
  | 'approximate';

export interface StageImportResult {
  matched: MatchedStageRow[];
  ambiguous: AmbiguousStageRow[];
  unmatched: UnmatchedStageRow[];
  errors: StageImportError[];
  stats: {
    total: number;
    matched: number;
    ambiguous: number;
    unmatched: number;
    errors: number;
  };
}

export interface StageImportError {
  line: number;
  message: string;
}

// ============================================================
// NORMALISATION FORTE
// ============================================================

/**
 * Normalise un token de nom/prénom pour comparaison.
 * - trim + lowercase
 * - supprime accents (NFD + diacritics)
 * - remplace apostrophes typographiques par '
 * - supprime apostrophes
 * - remplace tirets et multiples espaces par espace unique
 * - supprime ponctuation
 */
export function normalizePersonToken(str: string): string {
  if (!str) return '';

  return str
    .trim()
    .toLowerCase()
    // Normalisation Unicode NFD pour séparer les diacritiques
    .normalize('NFD')
    // Supprimer les diacritiques (accents)
    .replace(/[\u0300-\u036f]/g, '')
    // Remplacer apostrophes typographiques par apostrophe simple
    .replace(/[''`ʼ]/g, "'")
    // Supprimer les apostrophes (O'Neill -> oneill)
    .replace(/'/g, '')
    // Remplacer tirets par espaces
    .replace(/[-–—]/g, ' ')
    // Supprimer ponctuation autre
    .replace(/[.,;:!?()[\]{}]/g, '')
    // Réduire espaces multiples en un seul
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcule la similarité de Levenshtein entre deux chaînes (0-1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[b.length][a.length];
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

// ============================================================
// INDEXATION DES ÉLÈVES
// ============================================================

interface EleveIndex {
  // Index principal: nom|prenom -> élèves
  byNomPrenom: Map<string, Eleve[]>;
  // Index avec classe: nom|prenom|classe -> élève
  byNomPrenomClasse: Map<string, Eleve>;
  // Index inversé: prenom|nom -> élèves
  byPrenomNom: Map<string, Eleve[]>;
  // Index nom complet normalisé: "nomprenom" sans séparateur
  byFullNameCompact: Map<string, Eleve[]>;
  // Liste pour recherche approximative
  allEleves: Eleve[];
  // Tokens pour recherche approximative
  allTokens: Map<string, Set<Eleve>>;
}

/**
 * Construit l'index des élèves pour recherche rapide O(1)
 */
export function buildEleveIndex(eleves: Eleve[]): EleveIndex {
  const index: EleveIndex = {
    byNomPrenom: new Map(),
    byNomPrenomClasse: new Map(),
    byPrenomNom: new Map(),
    byFullNameCompact: new Map(),
    allEleves: eleves,
    allTokens: new Map(),
  };

  for (const eleve of eleves) {
    const nomNorm = normalizePersonToken(eleve.nom);
    const prenomNorm = normalizePersonToken(eleve.prenom || '');
    const classeNorm = normalizePersonToken(eleve.classe || '');

    // Index nom|prénom
    const keyNomPrenom = `${nomNorm}|${prenomNorm}`;
    if (!index.byNomPrenom.has(keyNomPrenom)) {
      index.byNomPrenom.set(keyNomPrenom, []);
    }
    index.byNomPrenom.get(keyNomPrenom)!.push(eleve);

    // Index nom|prénom|classe
    if (classeNorm) {
      const keyFull = `${nomNorm}|${prenomNorm}|${classeNorm}`;
      index.byNomPrenomClasse.set(keyFull, eleve);
    }

    // Index prénom|nom (inversé)
    const keyInverse = `${prenomNorm}|${nomNorm}`;
    if (!index.byPrenomNom.has(keyInverse)) {
      index.byPrenomNom.set(keyInverse, []);
    }
    index.byPrenomNom.get(keyInverse)!.push(eleve);

    // Index nom complet compact (sans séparateur)
    const fullCompact = `${nomNorm}${prenomNorm}`;
    if (!index.byFullNameCompact.has(fullCompact)) {
      index.byFullNameCompact.set(fullCompact, []);
    }
    index.byFullNameCompact.get(fullCompact)!.push(eleve);

    // Index inverse: compact prenom+nom
    const fullCompactInverse = `${prenomNorm}${nomNorm}`;
    if (fullCompactInverse !== fullCompact) {
      if (!index.byFullNameCompact.has(fullCompactInverse)) {
        index.byFullNameCompact.set(fullCompactInverse, []);
      }
      index.byFullNameCompact.get(fullCompactInverse)!.push(eleve);
    }

    // Index par tokens individuels pour recherche approximative
    for (const token of [nomNorm, prenomNorm]) {
      if (token) {
        if (!index.allTokens.has(token)) {
          index.allTokens.set(token, new Set());
        }
        index.allTokens.get(token)!.add(eleve);
      }
    }
  }

  return index;
}

// ============================================================
// MATCHING MULTI-ÉTAPES
// ============================================================

interface MatchCandidate {
  eleve: Eleve;
  score: number;
  method: MatchMethod;
}

/**
 * Trouve l'élève correspondant avec stratégie multi-étapes
 */
function findMatchingEleve(
  row: StageImportRow,
  index: EleveIndex
): { match: MatchCandidate | null; ambiguous: MatchCandidate[]; reason: string } {
  const nomNorm = normalizePersonToken(row.nom);
  const prenomNorm = normalizePersonToken(row.prenom);
  const classeNorm = row.classe ? normalizePersonToken(row.classe) : '';
  const nomCompletNorm = row.nomComplet ? normalizePersonToken(row.nomComplet) : '';

  // ============================================================
  // Étape 1: Match exact avec classe (score = 1.0)
  // ============================================================
  if (classeNorm) {
    const keyFull = `${nomNorm}|${prenomNorm}|${classeNorm}`;
    const exactMatch = index.byNomPrenomClasse.get(keyFull);
    if (exactMatch) {
      return {
        match: { eleve: exactMatch, score: 1.0, method: 'exact_with_class' },
        ambiguous: [],
        reason: '',
      };
    }
  }

  // ============================================================
  // Étape 2: Match exact sans classe (score = 0.95)
  // ============================================================
  const keyNomPrenom = `${nomNorm}|${prenomNorm}`;
  const candidatesExact = index.byNomPrenom.get(keyNomPrenom) || [];

  if (candidatesExact.length === 1) {
    return {
      match: { eleve: candidatesExact[0], score: 0.95, method: 'exact_normalized' },
      ambiguous: [],
      reason: '',
    };
  }

  if (candidatesExact.length > 1) {
    // Essayer de départager par classe
    if (classeNorm) {
      const byClasse = candidatesExact.find(
        e => normalizePersonToken(e.classe || '') === classeNorm
      );
      if (byClasse) {
        return {
          match: { eleve: byClasse, score: 0.9, method: 'exact_normalized' },
          ambiguous: [],
          reason: '',
        };
      }
    }
    // Plusieurs candidats, retourner comme ambigu
    return {
      match: null,
      ambiguous: candidatesExact.map(e => ({
        eleve: e,
        score: 0.85,
        method: 'exact_normalized' as MatchMethod,
      })),
      reason: `Plusieurs élèves "${row.prenom} ${row.nom}" - précisez la classe`,
    };
  }

  // ============================================================
  // Étape 3: Match ordre inversé (prénom/nom) (score = 0.85)
  // ============================================================
  const keyInverse = `${prenomNorm}|${nomNorm}`;
  const candidatesInverse = index.byPrenomNom.get(keyInverse) || [];

  if (candidatesInverse.length === 1) {
    return {
      match: { eleve: candidatesInverse[0], score: 0.85, method: 'inverted_order' },
      ambiguous: [],
      reason: '',
    };
  }

  if (candidatesInverse.length > 1) {
    if (classeNorm) {
      const byClasse = candidatesInverse.find(
        e => normalizePersonToken(e.classe || '') === classeNorm
      );
      if (byClasse) {
        return {
          match: { eleve: byClasse, score: 0.8, method: 'inverted_order' },
          ambiguous: [],
          reason: '',
        };
      }
    }
    return {
      match: null,
      ambiguous: candidatesInverse.map(e => ({
        eleve: e,
        score: 0.75,
        method: 'inverted_order' as MatchMethod,
      })),
      reason: `Plusieurs élèves avec prénom/nom inversés`,
    };
  }

  // ============================================================
  // Étape 4: Nom complet dans une seule cellule
  // ============================================================
  // Si nomComplet est fourni, ou si row.nom contient un espace (tout dans une colonne)
  const fullName = nomCompletNorm || (row.nom.includes(' ') ? normalizePersonToken(row.nom) : '');

  if (fullName) {
    // Essayer différentes stratégies de split
    const tokens = fullName.split(' ').filter(t => t.length > 0);

    if (tokens.length >= 2) {
      // Stratégie A: dernier token = nom, reste = prénom
      const lastAsNom = tokens[tokens.length - 1];
      const restAsPrenom = tokens.slice(0, -1).join('');

      const keyA = `${lastAsNom}|${restAsPrenom}`;
      const candidatesA = index.byNomPrenom.get(keyA) || [];

      if (candidatesA.length === 1) {
        return {
          match: { eleve: candidatesA[0], score: 0.8, method: 'full_name_split' },
          ambiguous: [],
          reason: '',
        };
      }

      // Stratégie B: premier token = nom, reste = prénom
      const firstAsNom = tokens[0];
      const restAsPrenom2 = tokens.slice(1).join('');

      const keyB = `${firstAsNom}|${restAsPrenom2}`;
      const candidatesB = index.byNomPrenom.get(keyB) || [];

      if (candidatesB.length === 1) {
        return {
          match: { eleve: candidatesB[0], score: 0.8, method: 'full_name_split' },
          ambiguous: [],
          reason: '',
        };
      }

      // Stratégie C: nom complet compact
      const compact = tokens.join('');
      const candidatesCompact = index.byFullNameCompact.get(compact) || [];

      if (candidatesCompact.length === 1) {
        return {
          match: { eleve: candidatesCompact[0], score: 0.75, method: 'full_name_split' },
          ambiguous: [],
          reason: '',
        };
      }

      if (candidatesCompact.length > 1) {
        return {
          match: null,
          ambiguous: candidatesCompact.map(e => ({
            eleve: e,
            score: 0.7,
            method: 'full_name_split' as MatchMethod,
          })),
          reason: `Plusieurs élèves correspondent au nom complet`,
        };
      }
    }
  }

  // ============================================================
  // Étape 5: Matching approximatif (Levenshtein) - SAFE
  // ============================================================
  const SIMILARITY_THRESHOLD = 0.88; // Seuil élevé pour éviter les faux positifs
  const approximateCandidates: MatchCandidate[] = [];

  const searchKey = `${nomNorm} ${prenomNorm}`;

  for (const eleve of index.allEleves) {
    const eleveKey = `${normalizePersonToken(eleve.nom)} ${normalizePersonToken(eleve.prenom || '')}`;
    const similarity = levenshteinSimilarity(searchKey, eleveKey);

    if (similarity >= SIMILARITY_THRESHOLD) {
      approximateCandidates.push({
        eleve,
        score: similarity,
        method: 'approximate',
      });
    }

    // Essayer aussi avec l'ordre inversé
    const eleveKeyInverse = `${normalizePersonToken(eleve.prenom || '')} ${normalizePersonToken(eleve.nom)}`;
    const similarityInverse = levenshteinSimilarity(searchKey, eleveKeyInverse);

    if (similarityInverse >= SIMILARITY_THRESHOLD && similarityInverse > similarity) {
      // Ne pas dupliquer si déjà ajouté
      const existing = approximateCandidates.find(c => c.eleve.id === eleve.id);
      if (!existing) {
        approximateCandidates.push({
          eleve,
          score: similarityInverse,
          method: 'approximate',
        });
      } else if (similarityInverse > existing.score) {
        existing.score = similarityInverse;
      }
    }
  }

  // Trier par score décroissant
  approximateCandidates.sort((a, b) => b.score - a.score);

  // Si un seul candidat avec score très élevé (>= 0.92), on l'accepte
  if (approximateCandidates.length === 1 && approximateCandidates[0].score >= 0.92) {
    return {
      match: approximateCandidates[0],
      ambiguous: [],
      reason: '',
    };
  }

  // Si plusieurs candidats proches, retourner comme ambigu
  if (approximateCandidates.length > 0) {
    // Prendre les candidats dont le score est proche du meilleur (écart < 0.05)
    const bestScore = approximateCandidates[0].score;
    const closeCandidates = approximateCandidates.filter(c => bestScore - c.score < 0.05);

    if (closeCandidates.length === 1 && closeCandidates[0].score >= 0.90) {
      return {
        match: closeCandidates[0],
        ambiguous: [],
        reason: '',
      };
    }

    return {
      match: null,
      ambiguous: closeCandidates.slice(0, 5), // Max 5 suggestions
      reason: `Correspondances approximatives trouvées`,
    };
  }

  // ============================================================
  // Aucun match trouvé
  // ============================================================
  return {
    match: null,
    ambiguous: [],
    reason: `Élève non trouvé: "${row.prenom} ${row.nom}"${row.classe ? ` (${row.classe})` : ''}`,
  };
}

// ============================================================
// HEADER MAPPING - ENRICHI
// ============================================================

const HEADER_ALIASES: Record<string, string[]> = {
  nom: [
    'nom', 'name', 'nom_eleve', 'nom elève', 'nomeleve', 'last_name', 'lastname',
    'nom de famille', 'family_name', 'surname', 'nom_famille', 'nom élève',
    'élève', 'eleve', 'student', 'nom etudiant', 'nom_etudiant',
  ],
  prenom: [
    'prenom', 'prénom', 'firstname', 'first_name', 'prenom_eleve', 'prénom élève',
    'given_name', 'prénoms', 'prenoms', 'prénom élève', 'prenom eleve',
  ],
  nomComplet: [
    'nom complet', 'nomcomplet', 'nom_complet', 'full_name', 'fullname',
    'nom et prenom', 'nom et prénom', 'eleve', 'élève', 'student_name',
    'nom prénom', 'nom prenom', 'identite', 'identité',
  ],
  classe: [
    'classe', 'class', 'niveau', 'division', 'groupe', 'grade', 'section',
    'classe_eleve', 'classe eleve', 'group', 'level',
  ],
  entreprise: [
    'entreprise', 'societe', 'société', 'company', 'nom_entreprise', 'nomentreprise',
    'employeur', 'organization', 'organisation', 'raison_sociale', 'raison sociale',
    'nom entreprise', 'structure', 'etablissement', 'établissement',
  ],
  adresse: [
    'adresse', 'address', 'adresse_stage', 'adressestage', 'lieu', 'lieu_stage',
    'adresse entreprise', 'adresse_entreprise', 'location', 'localisation',
    'adresse du stage', 'lieu du stage', 'adresse complete', 'adresse_complete',
  ],
  telephone: [
    'telephone', 'téléphone', 'tel', 'phone', 'tel_entreprise', 'telephone_entreprise',
    'tel entreprise', 'téléphone entreprise', 'contact_tel', 'num_tel', 'numero',
    'numéro', 'phone_number', 'mobile', 'portable', 'fixe',
  ],
  tuteur: [
    'tuteur', 'responsable', 'maitre_stage', 'maitre de stage', 'contact',
    'maître de stage', 'tuteur_nom', 'nom_tuteur', 'supervisor', 'encadrant',
    'responsable stage', 'nom du tuteur', 'maitre stage', 'tuteur entreprise',
  ],
  tuteurEmail: [
    'tuteur_email', 'email_tuteur', 'email_entreprise', 'email', 'mail',
    'courriel', 'e-mail', 'adresse_email', 'email tuteur', 'mail tuteur',
    'email_contact', 'contact_email',
  ],
  dateDebut: [
    'date_debut', 'datedebut', 'debut', 'start_date', 'date début', 'start',
    'date de début', 'beginning', 'commencement', 'from', 'du',
  ],
  dateFin: [
    'date_fin', 'datefin', 'fin', 'end_date', 'date fin', 'end',
    'date de fin', 'ending', 'to', 'au', 'jusquau', "jusqu'au",
  ],
};

// ============================================================
// PARSING FUNCTIONS
// ============================================================

/**
 * Détecte si le fichier est Excel ou CSV
 */
function isExcelFile(file: File): boolean {
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'xlsx' || ext === 'xls' || ext === 'xlsm';
}

/**
 * Parse un fichier Excel et retourne les lignes brutes
 */
async function parseExcelFile(file: File): Promise<{ rows: Record<string, string>[]; headers: string[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Prendre la première feuille
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convertir en JSON
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    raw: false,
    defval: '',
  });

  // Extraire les headers et normaliser les valeurs
  const headers: string[] = [];
  if (jsonData.length > 0) {
    Object.keys(jsonData[0]).forEach(key => {
      headers.push(String(key).trim());
    });
  }

  const rows = jsonData.map(row => {
    const normalizedRow: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalizedRow[String(key).trim()] = sanitizeValue(value);
    }
    return normalizedRow;
  });

  return { rows, headers };
}

/**
 * Parse un fichier CSV et retourne les lignes brutes
 */
async function parseCsvFile(file: File): Promise<{ rows: Record<string, string>[]; headers: string[]; errors: StageImportError[] }> {
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

  const errors: StageImportError[] = parsed.errors.map(error => ({
    line: typeof error.row === 'number' ? error.row + 2 : 0,
    message: `Erreur de parsing: ${error.message}`,
  }));

  return {
    rows: parsed.data,
    headers: parsed.meta.fields ?? [],
    errors,
  };
}

/**
 * Parse un fichier CSV/Excel et retourne les lignes brutes
 */
export async function parseStageFile(file: File): Promise<{ rows: StageImportRow[]; errors: StageImportError[] }> {
  const errors: StageImportError[] = [];
  let rawRows: Record<string, string>[] = [];
  let headers: string[] = [];

  try {
    if (isExcelFile(file)) {
      const result = await parseExcelFile(file);
      rawRows = result.rows;
      headers = result.headers;
    } else {
      const result = await parseCsvFile(file);
      rawRows = result.rows;
      headers = result.headers;
      errors.push(...result.errors);
    }
  } catch (error) {
    errors.push({
      line: 0,
      message: `Erreur lecture fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
    });
    return { rows: [], errors };
  }

  const headerMap = buildHeaderMap(headers);

  // Vérifier qu'on a au moins une façon d'identifier l'élève
  const hasNomPrenom = headerMap.has('nom') && headerMap.has('prenom');
  const hasNomComplet = headerMap.has('nomComplet');
  const hasNomOnly = headerMap.has('nom') && !headerMap.has('prenom');

  if (!hasNomPrenom && !hasNomComplet && !hasNomOnly) {
    errors.push({
      line: 1,
      message: 'Colonnes d\'identification élève non trouvées. Attendu: "nom" + "prenom", ou "nom complet"',
    });
    return { rows: [], errors };
  }

  const rows: StageImportRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const mapped = mapRow(rawRow, headerMap);

    // Si on a un nom complet mais pas de nom/prénom séparés
    if (!mapped.nom && !mapped.prenom && mapped.nomComplet) {
      // Essayer de split le nom complet
      const parts = mapped.nomComplet.trim().split(/\s+/);
      if (parts.length >= 2) {
        // Heuristique: dernier = nom, reste = prénom
        mapped.nom = parts[parts.length - 1];
        mapped.prenom = parts.slice(0, -1).join(' ');
      } else if (parts.length === 1) {
        mapped.nom = parts[0];
        mapped.prenom = '';
      }
    }

    // Si on a seulement nom avec espace dedans (tout dans une colonne)
    if (mapped.nom && !mapped.prenom && mapped.nom.includes(' ')) {
      mapped.nomComplet = mapped.nom;
      const parts = mapped.nom.trim().split(/\s+/);
      if (parts.length >= 2) {
        mapped.nom = parts[parts.length - 1];
        mapped.prenom = parts.slice(0, -1).join(' ');
      }
    }

    // Validation minimale
    if (!mapped.nom && !mapped.prenom && !mapped.nomComplet) {
      errors.push({
        line: index + 2,
        message: `Ligne ${index + 2}: identification élève manquante (nom, prénom ou nom complet)`,
      });
      return;
    }

    rows.push(mapped);
  });

  return { rows, errors };
}

/**
 * Match les lignes importées avec les élèves existants
 */
export function matchStageRowsWithEleves(
  rows: StageImportRow[],
  eleves: Eleve[]
): { matched: MatchedStageRow[]; ambiguous: AmbiguousStageRow[]; unmatched: UnmatchedStageRow[] } {
  const matched: MatchedStageRow[] = [];
  const ambiguous: AmbiguousStageRow[] = [];
  const unmatched: UnmatchedStageRow[] = [];

  // Construire l'index des élèves
  const index = buildEleveIndex(eleves);

  for (const row of rows) {
    const result = findMatchingEleve(row, index);

    if (result.match) {
      matched.push({
        ...row,
        eleveId: result.match.eleve.id!,
        eleveNom: result.match.eleve.nom,
        elevePrenom: result.match.eleve.prenom || '',
        eleveClasse: result.match.eleve.classe || '',
        matchScore: result.match.score,
        matchMethod: result.match.method,
      });
    } else if (result.ambiguous.length > 0) {
      ambiguous.push({
        ...row,
        candidates: result.ambiguous,
        reason: result.reason,
      });
    } else {
      // Générer des suggestions pour les non trouvés
      const suggestions = generateSuggestions(row, index);
      unmatched.push({
        ...row,
        reason: result.reason,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      });
    }
  }

  return { matched, ambiguous, unmatched };
}

/**
 * Génère des suggestions pour un élève non trouvé
 */
function generateSuggestions(row: StageImportRow, index: EleveIndex): string[] {
  const suggestions: string[] = [];
  const nomNorm = normalizePersonToken(row.nom);
  const prenomNorm = normalizePersonToken(row.prenom);

  // Chercher des élèves avec le même nom
  for (const eleve of index.allEleves) {
    if (normalizePersonToken(eleve.nom) === nomNorm) {
      suggestions.push(`${eleve.prenom} ${eleve.nom} (${eleve.classe})`);
    }
    // Ou même prénom
    else if (normalizePersonToken(eleve.prenom || '') === prenomNorm) {
      suggestions.push(`${eleve.prenom} ${eleve.nom} (${eleve.classe})`);
    }

    if (suggestions.length >= 3) break;
  }

  return suggestions;
}

/**
 * Import complet : parse le fichier et match avec les élèves
 */
export async function importStagesFromFile(
  file: File,
  eleves: Eleve[]
): Promise<StageImportResult> {
  const { rows, errors } = await parseStageFile(file);

  if (rows.length === 0) {
    return {
      matched: [],
      ambiguous: [],
      unmatched: [],
      errors,
      stats: { total: 0, matched: 0, ambiguous: 0, unmatched: 0, errors: errors.length },
    };
  }

  const { matched, ambiguous, unmatched } = matchStageRowsWithEleves(rows, eleves);

  return {
    matched,
    ambiguous,
    unmatched,
    errors,
    stats: {
      total: rows.length,
      matched: matched.length,
      ambiguous: ambiguous.length,
      unmatched: unmatched.length,
      errors: errors.length,
    },
  };
}

/**
 * Convertit les lignes matchées en données Stage
 */
export function convertMatchedRowsToStageData(
  matched: MatchedStageRow[]
): Array<{ eleveId: string } & Partial<Stage>> {
  return matched.map(row => ({
    eleveId: row.eleveId,
    eleveNom: row.eleveNom,
    elevePrenom: row.elevePrenom,
    eleveClasse: row.eleveClasse,
    nomEntreprise: row.entreprise,
    adresse: row.adresse,
    tuteurTel: row.telephone ? normalizePhone(row.telephone) : undefined,
    tuteur: row.tuteur,
    tuteurEmail: row.tuteurEmail,
    dateDebut: row.dateDebut,
    dateFin: row.dateFin,
  }));
}

/**
 * Résout manuellement un cas ambigu en sélectionnant un candidat
 */
export function resolveAmbiguousMatch(
  ambiguous: AmbiguousStageRow,
  selectedEleveId: string
): MatchedStageRow | null {
  const selected = ambiguous.candidates.find(c => c.eleve.id === selectedEleveId);
  if (!selected) return null;

  return {
    ...ambiguous,
    eleveId: selected.eleve.id!,
    eleveNom: selected.eleve.nom,
    elevePrenom: selected.eleve.prenom || '',
    eleveClasse: selected.eleve.classe || '',
    matchScore: selected.score,
    matchMethod: selected.method,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer.slice(0, 4));

  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8-sig';
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return 'utf-16le';
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return 'utf-16be';
  }

  const sample = new Uint8Array(buffer.slice(0, Math.min(1000, buffer.byteLength)));
  const hasHighBytes = sample.some(b => b > 127);

  if (!hasHighBytes) {
    return 'utf-8';
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(buffer);
    return 'utf-8';
  } catch {
    return 'iso-8859-1';
  }
}

function decodeBuffer(buffer: ArrayBuffer, encoding: string): string {
  const decoder = new TextDecoder(encoding === 'utf-8-sig' ? 'utf-8' : encoding, { fatal: false });
  return decoder.decode(encoding === 'utf-8-sig' ? buffer.slice(3) : buffer);
}

function normalizeContent(value: string): string {
  return value
    .replace(/^[\uFEFF\u0000]+/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function detectSeparator(content: string): string {
  const firstLine = content.split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (semicolons >= commas && semicolons >= tabs) return ';';
  if (tabs >= commas) return '\t';
  return ',';
}

function sanitizeValue(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/[\uFEFF\u0000]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

function buildHeaderMap(headers: string[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const header of headers) {
    const normalized = normalizeHeaderName(header);

    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some(alias => normalizeHeaderName(alias) === normalized)) {
        if (!map.has(field)) {
          map.set(field, header);
        }
        break;
      }
    }
  }

  return map;
}

function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function mapRow(row: Record<string, string>, headerMap: Map<string, string>): StageImportRow {
  const get = (key: string) => {
    const header = headerMap.get(key);
    return header ? sanitizeValue(row[header]) : '';
  };

  return {
    nom: get('nom'),
    prenom: get('prenom'),
    nomComplet: get('nomComplet') || undefined,
    classe: get('classe') || undefined,
    entreprise: get('entreprise') || undefined,
    adresse: get('adresse') || undefined,
    telephone: get('telephone') || undefined,
    tuteur: get('tuteur') || undefined,
    tuteurEmail: get('tuteurEmail') || undefined,
    dateDebut: get('dateDebut') || undefined,
    dateFin: get('dateFin') || undefined,
  };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }

  if (digits.length === 9 && !digits.startsWith('0')) {
    return ('0' + digits).replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }

  return phone;
}
