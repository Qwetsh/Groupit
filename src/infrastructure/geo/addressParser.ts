// ============================================================
// ADDRESS PARSER - Extraction ville/code postal depuis adresse
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
  /** True si on a pu extraire au moins la ville */
  hasCityInfo: boolean;
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
 * Regex pour détecter un code postal français (5 chiffres)
 */
const CODE_POSTAL_REGEX = /\b(\d{5})\b/;

/**
 * Regex pour extraire "code postal + ville" en fin d'adresse
 * Formats supportés:
 * - "..., 57190 Florange"
 * - "... 57190 Florange"
 * - "57190 Florange"
 * - "Florange (57190)"
 * - "..., Florange 57190" (ville avant CP)
 */
const CP_VILLE_PATTERN = /(?:,\s*)?(\d{5})\s+([A-Za-zÀ-ÿ\-'\s]+)$/i;
const VILLE_CP_PATTERN = /([A-Za-zÀ-ÿ\-'\s]+)\s*\((\d{5})\)$/i;
const VILLE_THEN_CP_PATTERN = /(?:,\s*)?([A-Za-zÀ-ÿ\-'\s]+?)\s+(\d{5})$/i;

/**
 * Parse une adresse française pour extraire code postal et ville
 * 
 * @param address - Adresse brute (ex: "10 rue de la gare, 57190 Florange")
 * @returns ParsedAddress avec les composants extraits
 */
export function parseAddress(address: string): ParsedAddress {
  if (!address || typeof address !== 'string') {
    return { fullAddress: '', hasCityInfo: false };
  }

  const normalized = address.trim();
  const result: ParsedAddress = {
    fullAddress: normalized,
    hasCityInfo: false,
  };

  // Tentative 1: Pattern "..., CP Ville" ou "... CP Ville"
  const cpVilleMatch = normalized.match(CP_VILLE_PATTERN);
  if (cpVilleMatch) {
    result.codePostal = cpVilleMatch[1];
    result.ville = cleanVilleName(cpVilleMatch[2]);
    result.street = normalized.replace(CP_VILLE_PATTERN, '').replace(/,\s*$/, '').trim();
    result.hasCityInfo = true;
    return result;
  }

  // Tentative 2: Pattern "Ville (CP)"
  const villeCpMatch = normalized.match(VILLE_CP_PATTERN);
  if (villeCpMatch) {
    result.ville = cleanVilleName(villeCpMatch[1]);
    result.codePostal = villeCpMatch[2];
    result.street = normalized.replace(VILLE_CP_PATTERN, '').replace(/,\s*$/, '').trim();
    result.hasCityInfo = true;
    return result;
  }

  // Tentative 2b: Pattern "Ville CP" (ex: "Rombas 57120")
  const villeThenCpMatch = normalized.match(VILLE_THEN_CP_PATTERN);
  if (villeThenCpMatch) {
    result.ville = cleanVilleName(villeThenCpMatch[1]);
    result.codePostal = villeThenCpMatch[2];
    result.street = normalized.replace(VILLE_THEN_CP_PATTERN, '').replace(/,\s*$/, '').trim();
    result.hasCityInfo = true;
    return result;
  }

  // Tentative 3: Extraire juste le code postal si présent
  const cpMatch = normalized.match(CODE_POSTAL_REGEX);
  if (cpMatch) {
    result.codePostal = cpMatch[1];
    // Essayer d'extraire la ville après le code postal
    const afterCp = normalized.substring(normalized.indexOf(cpMatch[1]) + 5).trim();
    if (afterCp) {
      // Prendre le premier "mot" (ville) après le CP
      const villeMatch = afterCp.match(/^([A-Za-zÀ-ÿ\-'\s]+?)(?:\s*,|$)/i);
      if (villeMatch) {
        result.ville = cleanVilleName(villeMatch[1]);
        result.hasCityInfo = true;
      }
    }
    result.street = normalized.substring(0, normalized.indexOf(cpMatch[1])).replace(/,\s*$/, '').trim();
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
 * @returns Query pour géocoder la ville (ex: "57190 Florange" ou "Florange")
 */
export function buildCityQuery(parsed: ParsedAddress): string | null {
  if (!parsed.ville) return null;
  
  if (parsed.codePostal) {
    return `${parsed.codePostal} ${parsed.ville}`;
  }
  return parsed.ville;
}

/**
 * Construit une requête de géocodage pour la mairie
 * @param parsed - Résultat du parsing
 * @returns Query pour géocoder la mairie (ex: "Mairie de Florange")
 */
export function buildTownhallQuery(parsed: ParsedAddress): string | null {
  if (!parsed.ville) return null;
  return `Mairie de ${parsed.ville}`;
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
