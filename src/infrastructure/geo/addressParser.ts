// ============================================================
// ADDRESS PARSER - Extraction ville/code postal depuis adresse
// Support France + Luxembourg
// ============================================================

/**
 * Résultat du parsing d'une adresse
 */
export interface ParsedAddress {
  /** Adresse complète normalisée */
  fullAddress: string;
  /** Partie rue/numéro */
  street?: string;
  /** Code postal extrait */
  codePostal?: string;
  /** Ville extraite */
  ville?: string;
  /** Pays détecté */
  pays?: 'FR' | 'LU' | 'BE' | 'DE' | 'unknown';
  /** True si on a pu extraire au moins la ville */
  hasCityInfo: boolean;
  /** Indicateur de qualité de l'adresse */
  quality: 'complete' | 'partial' | 'minimal' | 'invalid';
  /** Problèmes détectés */
  issues: string[];
}

/**
 * Normalise une chaîne (accents, espaces, casse)
 */
export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/\s+/g, ' ')            // Normalise les espaces
    .trim();
}

/**
 * Regex pour détecter un code postal français (5 chiffres, avec ou sans espaces)
 * Ex: 57140, 57 140
 */
const CODE_POSTAL_FR_REGEX = /\b(\d{2}\s?\d{3})\b/;

/**
 * Regex pour extraire "code postal + ville" en fin d'adresse (France)
 * Formats supportés:
 * - "..., 57190 Florange"
 * - "... 57190 Florange"
 * - "57190 Florange"
 * - "57 190 Florange" (avec espace dans le CP)
 * - "Florange (57190)"
 * - "..., Florange 57190" (ville avant CP)
 */
const CP_VILLE_PATTERN_FR = /(?:,\s*)?(\d{2}\s?\d{3})\s+([A-Za-zÀ-ÿ\-'\s]+)$/i;
const VILLE_CP_PATTERN_FR = /([A-Za-zÀ-ÿ\-'\s]+)\s*\((\d{2}\s?\d{3})\)$/i;
const VILLE_THEN_CP_PATTERN_FR = /(?:,\s*)?([A-Za-zÀ-ÿ\-'\s]+?)\s+(\d{2}\s?\d{3})$/i;

/**
 * Regex pour extraire "code postal + ville" (Luxembourg)
 * Ex: "L-3317 Bergem", "3317 Biergem Luxemburg"
 */
const CP_VILLE_PATTERN_LU = /(?:,\s*)?(?:L-?\s*)?(\d{4})\s+([A-Za-zÀ-ÿ\-'\s]+?)(?:\s+Luxemb(?:ourg|urg))?$/i;

/**
 * Mots-clés indiquant le Luxembourg
 */
const LUXEMBOURG_KEYWORDS = ['luxembourg', 'luxemburg', 'lëtzebuerg', 'letzebuerg'];

/**
 * Abréviations courantes à normaliser
 */
const ABBREVIATIONS: Record<string, string> = {
  'r.': 'rue',
  'r ': 'rue ',
  'av.': 'avenue',
  'av ': 'avenue ',
  'bd.': 'boulevard',
  'bd ': 'boulevard ',
  'pl.': 'place',
  'pl ': 'place ',
  'all.': 'allée',
  'all ': 'allée ',
  'imp.': 'impasse',
  'imp ': 'impasse ',
  'rte.': 'route',
  'rte ': 'route ',
  'ch.': 'chemin',
  'ch ': 'chemin ',
  'sq.': 'square',
  'sq ': 'square ',
};

/**
 * Pré-normalise une adresse (espaces dans CP, abréviations)
 */
function preNormalizeAddress(address: string): string {
  let normalized = address.trim();

  // Supprimer les espaces dans les codes postaux français (57 140 → 57140)
  normalized = normalized.replace(/(\d{2})\s+(\d{3})/g, '$1$2');

  // Normaliser les abréviations (insensible à la casse)
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(abbr.replace('.', '\\.'), 'gi');
    normalized = normalized.replace(regex, full);
  }

  return normalized;
}

/**
 * Détecte le pays depuis l'adresse
 */
function detectCountry(address: string): 'FR' | 'LU' | 'unknown' {
  const lower = address.toLowerCase();

  // Luxembourg
  if (LUXEMBOURG_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'LU';
  }
  if (/\bL-?\d{4}\b/i.test(address)) {
    return 'LU';
  }

  // France (code postal 5 chiffres)
  if (/\b\d{5}\b/.test(address)) {
    return 'FR';
  }

  // Luxembourg (code postal 4 chiffres sans L-)
  // Mais seulement si pas de CP français
  if (/\b\d{4}\b/.test(address) && !/\b\d{5}\b/.test(address)) {
    return 'LU';
  }

  return 'unknown';
}

/**
 * Évalue la qualité d'une adresse
 */
function evaluateAddressQuality(parsed: ParsedAddress): { quality: ParsedAddress['quality']; issues: string[] } {
  const issues: string[] = [];

  // Vérifier la présence des éléments
  const hasStreet = !!parsed.street && parsed.street.length > 3;
  const hasNumber = !!parsed.street && /\d+/.test(parsed.street);
  const hasCity = !!parsed.ville;
  const hasPostalCode = !!parsed.codePostal;

  if (!hasCity && !hasPostalCode) {
    issues.push('Ville et code postal manquants');
    return { quality: 'invalid', issues };
  }

  if (!hasCity) {
    issues.push('Ville manquante');
  }
  if (!hasPostalCode) {
    issues.push('Code postal manquant');
  }
  if (!hasStreet) {
    issues.push('Rue manquante ou incomplète');
  }
  if (!hasNumber) {
    issues.push('Numéro de rue manquant');
  }

  // Calculer la qualité
  if (hasStreet && hasNumber && hasCity && hasPostalCode) {
    return { quality: 'complete', issues };
  }
  if (hasCity && hasPostalCode) {
    return { quality: 'partial', issues };
  }
  if (hasCity || hasPostalCode) {
    return { quality: 'minimal', issues };
  }

  return { quality: 'invalid', issues };
}

/**
 * Parse une adresse française ou luxembourgeoise pour extraire code postal et ville
 *
 * @param address - Adresse brute (ex: "10 rue de la gare, 57190 Florange")
 * @returns ParsedAddress avec les composants extraits
 */
export function parseAddress(address: string): ParsedAddress {
  if (!address || typeof address !== 'string') {
    return {
      fullAddress: '',
      hasCityInfo: false,
      quality: 'invalid',
      issues: ['Adresse vide'],
    };
  }

  // Pré-normaliser l'adresse
  const normalized = preNormalizeAddress(address);
  const pays = detectCountry(normalized);

  const result: ParsedAddress = {
    fullAddress: normalized,
    hasCityInfo: false,
    pays,
    quality: 'invalid',
    issues: [],
  };

  // ============================================================
  // PARSING LUXEMBOURG
  // ============================================================
  if (pays === 'LU') {
    const luMatch = normalized.match(CP_VILLE_PATTERN_LU);
    if (luMatch) {
      result.codePostal = luMatch[1];
      result.ville = cleanVilleName(luMatch[2]);
      result.street = normalized.replace(CP_VILLE_PATTERN_LU, '').replace(/,\s*$/, '').trim();
      result.hasCityInfo = true;
    } else {
      // Essayer d'extraire juste la ville si "Luxembourg" est mentionné
      const villeMatch = normalized.match(/([A-Za-zÀ-ÿ\-'\s]+?)(?:\s+Luxemb(?:ourg|urg))/i);
      if (villeMatch) {
        result.ville = cleanVilleName(villeMatch[1]);
        result.hasCityInfo = true;
      }
    }

    const { quality, issues } = evaluateAddressQuality(result);
    result.quality = quality;
    result.issues = issues;
    return result;
  }

  // ============================================================
  // PARSING FRANCE (par défaut)
  // ============================================================

  // Tentative 1: Pattern "..., CP Ville" ou "... CP Ville"
  const cpVilleMatch = normalized.match(CP_VILLE_PATTERN_FR);
  if (cpVilleMatch) {
    result.codePostal = cpVilleMatch[1].replace(/\s/g, '');
    result.ville = cleanVilleName(cpVilleMatch[2]);
    result.street = normalized.replace(CP_VILLE_PATTERN_FR, '').replace(/,\s*$/, '').trim();
    result.hasCityInfo = true;
    result.pays = 'FR';

    const { quality, issues } = evaluateAddressQuality(result);
    result.quality = quality;
    result.issues = issues;
    return result;
  }

  // Tentative 2: Pattern "Ville (CP)"
  const villeCpMatch = normalized.match(VILLE_CP_PATTERN_FR);
  if (villeCpMatch) {
    result.ville = cleanVilleName(villeCpMatch[1]);
    result.codePostal = villeCpMatch[2].replace(/\s/g, '');
    result.street = normalized.replace(VILLE_CP_PATTERN_FR, '').replace(/,\s*$/, '').trim();
    result.hasCityInfo = true;
    result.pays = 'FR';

    const { quality, issues } = evaluateAddressQuality(result);
    result.quality = quality;
    result.issues = issues;
    return result;
  }

  // Tentative 2b: Pattern "Ville CP" (ex: "Rombas 57120")
  const villeThenCpMatch = normalized.match(VILLE_THEN_CP_PATTERN_FR);
  if (villeThenCpMatch) {
    result.ville = cleanVilleName(villeThenCpMatch[1]);
    result.codePostal = villeThenCpMatch[2].replace(/\s/g, '');
    result.street = normalized.replace(VILLE_THEN_CP_PATTERN_FR, '').replace(/,\s*$/, '').trim();
    result.hasCityInfo = true;
    result.pays = 'FR';

    const { quality, issues } = evaluateAddressQuality(result);
    result.quality = quality;
    result.issues = issues;
    return result;
  }

  // Tentative 3: Extraire juste le code postal si présent
  const cpMatch = normalized.match(CODE_POSTAL_FR_REGEX);
  if (cpMatch) {
    result.codePostal = cpMatch[1].replace(/\s/g, '');
    result.pays = 'FR';
    // Essayer d'extraire la ville après le code postal
    const cpIndex = normalized.indexOf(cpMatch[0]);
    const afterCp = normalized.substring(cpIndex + cpMatch[0].length).trim();
    if (afterCp) {
      // Prendre le premier "mot" (ville) après le CP
      const villeMatch = afterCp.match(/^([A-Za-zÀ-ÿ\-'\s]+?)(?:\s*,|$)/i);
      if (villeMatch) {
        result.ville = cleanVilleName(villeMatch[1]);
        result.hasCityInfo = true;
      }
    }
    result.street = normalized.substring(0, cpIndex).replace(/,\s*$/, '').trim();

    const { quality, issues } = evaluateAddressQuality(result);
    result.quality = quality;
    result.issues = issues;
    return result;
  }

  // Tentative 4: Dernière partie après virgule = ville potentielle
  const parts = normalized.split(',');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    // Vérifier que c'est bien un nom de ville (pas de chiffres, pas trop long)
    if (lastPart && !/\d/.test(lastPart) && lastPart.length <= 50) {
      result.ville = cleanVilleName(lastPart);
      result.street = parts.slice(0, -1).join(',').trim();
      result.hasCityInfo = true;
    }
  }

  const { quality, issues } = evaluateAddressQuality(result);
  result.quality = quality;
  result.issues = issues;
  return result;
}

/**
 * Nettoie un nom de ville
 */
function cleanVilleName(ville: string): string {
  return ville
    .trim()
    .replace(/\s+/g, ' ')
    // Supprimer les suffixes courants
    .replace(/\s+(cedex|cedex\s*\d+|bp\s*\d+)$/i, '')
    // Capitaliser correctement
    .split(/[\s-]+/)
    .map(word => {
      // Garder les prépositions en minuscules
      const lower = word.toLowerCase();
      if (['de', 'du', 'des', 'le', 'la', 'les', 'sur', 'sous', 'en', 'et', 'l'].includes(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\s-\s/g, '-')
    .replace(/(\s)(l)(\s)/gi, '$1l\'');
}

/**
 * Construit une requête de géocodage pour la ville
 * @param parsed - Résultat du parsing
 * @returns Query pour géocoder la ville (ex: "57190 Florange" ou "Florange, Luxembourg")
 */
export function buildCityQuery(parsed: ParsedAddress): string | null {
  if (!parsed.ville) return null;

  // Luxembourg: ajouter le pays
  if (parsed.pays === 'LU') {
    if (parsed.codePostal) {
      return `${parsed.codePostal} ${parsed.ville}, Luxembourg`;
    }
    return `${parsed.ville}, Luxembourg`;
  }

  // France (défaut)
  if (parsed.codePostal) {
    return `${parsed.codePostal} ${parsed.ville}`;
  }
  return parsed.ville;
}

/**
 * Construit une requête de géocodage pour la mairie / hôtel de ville
 * @param parsed - Résultat du parsing
 * @returns Query pour géocoder la mairie (ex: "Mairie de Florange")
 */
export function buildTownhallQuery(parsed: ParsedAddress): string | null {
  if (!parsed.ville) return null;

  // Luxembourg: "Administration communale de X" ou juste le centre
  if (parsed.pays === 'LU') {
    return `${parsed.ville}, Luxembourg`;
  }

  // France
  return `Mairie de ${parsed.ville}`;
}

/**
 * Construit plusieurs variantes de requêtes pour le géocodage
 * Utilisé pour le fallback multi-tentatives
 */
export function buildGeocodingQueries(parsed: ParsedAddress): string[] {
  const queries: string[] = [];

  // 1. Adresse complète
  if (parsed.fullAddress) {
    queries.push(parsed.fullAddress);
  }

  // 2. Rue + Ville + CP (sans numéro si présent)
  if (parsed.street && parsed.ville && parsed.codePostal) {
    // Essayer aussi sans le numéro de rue
    const streetWithoutNumber = parsed.street.replace(/^\d+\s*[a-z]?\s*,?\s*/i, '').trim();
    if (streetWithoutNumber && streetWithoutNumber !== parsed.street) {
      const suffix = parsed.pays === 'LU' ? ', Luxembourg' : '';
      queries.push(`${streetWithoutNumber}, ${parsed.codePostal} ${parsed.ville}${suffix}`);
    }
  }

  // 3. Ville + CP
  const cityQuery = buildCityQuery(parsed);
  if (cityQuery && !queries.includes(cityQuery)) {
    queries.push(cityQuery);
  }

  // 4. Mairie/Centre
  const townhallQuery = buildTownhallQuery(parsed);
  if (townhallQuery && !queries.includes(townhallQuery)) {
    queries.push(townhallQuery);
  }

  return queries;
}

/**
 * Extrait ville et code postal depuis champs séparés ou adresse combinée
 */
export function extractCityInfo(
  address?: string,
  codePostal?: string,
  ville?: string
): { codePostal?: string; ville?: string } {
  // Si on a déjà les champs séparés, les utiliser
  if (ville) {
    return { codePostal, ville: cleanVilleName(ville) };
  }
  
  // Sinon, parser l'adresse
  if (address) {
    const parsed = parseAddress(address);
    return {
      codePostal: codePostal || parsed.codePostal,
      ville: parsed.ville,
    };
  }
  
  return {};
}
