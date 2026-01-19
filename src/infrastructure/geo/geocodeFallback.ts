// ============================================================
// GEOCODE WITH FALLBACK - Géocodage avec stratégie de repli
// ============================================================

import type { 
  GeoPoint, 
  GeoStatus, 
  GeoPrecision, 
  GeoStatusExtended,
  GeoConfidence 
} from './types';
import { getGeoProvider } from './geocode';
import { 
  getGeoCacheByAddress, 
  upsertGeoCache 
} from './cacheRepo';
import { parseAddress, buildCityQuery, buildTownhallQuery } from './addressParser';

// ============================================================
// TYPES
// ============================================================

/**
 * Résultat du géocodage avec fallback
 */
export interface GeocodeFallbackResult {
  success: boolean;
  point?: GeoPoint;
  status: GeoStatusExtended;
  precision: GeoPrecision;
  /** Requête qui a abouti */
  queryUsed?: string;
  /** Message d'erreur si échec */
  errorMessage?: string;
  /** Provider utilisé */
  provider: string;
  /** Confidence du résultat */
  confidence: GeoConfidence;
  /** Indique si le résultat vient du cache */
  fromCache: boolean;
}

/**
 * Options pour le géocodage avec fallback
 */
export interface GeocodeFallbackOptions {
  /** Délai entre tentatives (ms) */
  delayBetweenAttempts?: number;
  /** Forcer le re-géocodage même si en cache */
  forceRefresh?: boolean;
  /** Code postal fourni séparément */
  codePostal?: string;
  /** Ville fournie séparément */
  ville?: string;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Délai async
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convertit GeoStatusExtended vers l'ancien GeoStatus (rétrocompatibilité)
 */
export function toGeoStatus(extended: GeoStatusExtended): GeoStatus {
  switch (extended) {
    case 'OK_FULL':
    case 'OK_CITY_FALLBACK':
    case 'OK_TOWNHALL_FALLBACK':
      return 'ok';
    case 'PENDING':
      return 'pending';
    case 'ERROR':
    default:
      return 'error';
  }
}

/**
 * Convertit GeoPrecision vers GeoStatusExtended
 */
function precisionToStatus(precision: GeoPrecision): GeoStatusExtended {
  switch (precision) {
    case 'FULL': return 'OK_FULL';
    case 'CITY': return 'OK_CITY_FALLBACK';
    case 'TOWNHALL': return 'OK_TOWNHALL_FALLBACK';
    default: return 'ERROR';
  }
}

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Géocode une adresse avec stratégie de fallback automatique
 * 
 * Ordre des tentatives:
 * 1. Adresse complète → OK_FULL
 * 2. Code postal + Ville → OK_CITY_FALLBACK
 * 3. Mairie de {Ville} → OK_TOWNHALL_FALLBACK
 * 4. Échec → ERROR
 * 
 * @param address - Adresse à géocoder
 * @param options - Options de géocodage
 * @returns Résultat avec coordonnées et niveau de précision
 */
export async function geocodeWithFallback(
  address: string,
  options: GeocodeFallbackOptions = {}
): Promise<GeocodeFallbackResult> {
  // DEBUG - Ce log doit TOUJOURS apparaître
  console.log('🚀 geocodeWithFallback APPELÉ avec:', address);
  
  const { 
    delayBetweenAttempts = 300, 
    forceRefresh = false,
    codePostal,
    ville 
  } = options;

  // Résultat par défaut (échec)
  const failResult: GeocodeFallbackResult = {
    success: false,
    status: 'ERROR',
    precision: 'NONE',
    errorMessage: 'Adresse vide',
    provider: 'none',
    confidence: 'unknown',
    fromCache: false,
  };

  if (!address || address.trim() === '') {
    console.log('⚠️ Adresse vide!');
    return failResult;
  }

  const trimmedAddress = address.trim();
  const provider = getGeoProvider();

  console.log(`[Geocode] Début géocodage: "${trimmedAddress}"`);

  // ============================================================
  // VÉRIFICATION DU CACHE (adresse complète)
  // ============================================================
  
  if (!forceRefresh) {
    const cached = await getGeoCacheByAddress(trimmedAddress);
    // Ne retourner le cache que si c'est un succès (ok)
    // Les erreurs en cache doivent être re-tentées avec fallback
    if (cached && cached.status === 'ok') {
      return {
        success: true,
        point: { lat: cached.lat, lon: cached.lon },
        status: cached.precision ? precisionToStatus(cached.precision) : 'OK_FULL',
        precision: cached.precision || 'FULL',
        queryUsed: cached.queryUsed || cached.originalAddress,
        provider: cached.provider,
        confidence: cached.confidence,
        fromCache: true,
      };
    }
    // Si erreur en cache, on continue pour retenter avec fallback (le cache sera mis à jour si succès)
    if (cached && (cached.status === 'error' || cached.status === 'not_found')) {
      // Le cache error sera écrasé par upsertGeoCache si le fallback réussit
    }
  }

  // ============================================================
  // TENTATIVE 1: ADRESSE COMPLÈTE
  // ============================================================
  
  const fullResult = await provider.geocode(trimmedAddress);
  
  if (fullResult.success && fullResult.point) {
    console.log(`[Geocode] ✅ Succès adresse complète: (${fullResult.point.lat}, ${fullResult.point.lon})`);
    // Succès avec adresse complète
    await upsertGeoCache(trimmedAddress, {
      lat: fullResult.point.lat,
      lon: fullResult.point.lon,
      provider: fullResult.provider,
      confidence: fullResult.confidence,
      status: 'ok',
      normalizedAddress: fullResult.normalizedAddress,
      precision: 'FULL',
      queryUsed: trimmedAddress,
    });

    return {
      success: true,
      point: fullResult.point,
      status: 'OK_FULL',
      precision: 'FULL',
      queryUsed: trimmedAddress,
      provider: fullResult.provider,
      confidence: fullResult.confidence,
      fromCache: false,
    };
  }

  console.log(`[Geocode] ⚠️ Adresse exacte non trouvée, tentative fallback...`);

  // ============================================================
  // PARSING POUR EXTRAIRE VILLE/CP
  // ============================================================
  
  const parsed = parseAddress(trimmedAddress);
  // Override avec les champs fournis séparément
  if (codePostal) parsed.codePostal = codePostal;
  if (ville) parsed.ville = ville;

  // Debug: afficher ce qui a été extrait
  console.log(`[Geocode] Parsing: ville="${parsed.ville || 'N/A'}", CP="${parsed.codePostal || 'N/A'}", hasCityInfo=${parsed.hasCityInfo}`);

  if (!parsed.hasCityInfo && !parsed.ville) {
    // Impossible d'extraire la ville, échec
    return {
      ...failResult,
      errorMessage: `Adresse non trouvée et impossible d'extraire la ville: ${fullResult.errorMessage || 'Aucun résultat'}`,
      queryUsed: trimmedAddress,
      provider: fullResult.provider,
    };
  }

  // ============================================================
  // TENTATIVE 2: VILLE (+ CODE POSTAL)
  // ============================================================
  
  await delay(delayBetweenAttempts);
  
  const cityQuery = buildCityQuery(parsed);
  if (cityQuery) {
    console.log(`[Geocode] Tentative 2: Ville "${cityQuery}"`);
    const cityResult = await provider.geocode(cityQuery);
    
    if (cityResult.success && cityResult.point) {
      console.log(`[Geocode] ✅ Succès fallback CITY: (${cityResult.point.lat}, ${cityResult.point.lon})`);
      // Succès avec fallback ville
      await upsertGeoCache(trimmedAddress, {
        lat: cityResult.point.lat,
        lon: cityResult.point.lon,
        provider: cityResult.provider,
        confidence: 'low', // Confiance basse car approximatif
        status: 'ok',
        normalizedAddress: cityResult.normalizedAddress,
        precision: 'CITY',
        queryUsed: cityQuery,
      });

      return {
        success: true,
        point: cityResult.point,
        status: 'OK_CITY_FALLBACK',
        precision: 'CITY',
        queryUsed: cityQuery,
        provider: cityResult.provider,
        confidence: 'low',
        fromCache: false,
      };
    }
  }

  // ============================================================
  // TENTATIVE 3: MAIRIE DE {VILLE}
  // ============================================================
  
  await delay(delayBetweenAttempts);
  
  const townhallQuery = buildTownhallQuery(parsed);
  if (townhallQuery) {
    console.log(`[Geocode] Tentative 3: Mairie "${townhallQuery}"`);
    const townhallResult = await provider.geocode(townhallQuery);
    
    if (townhallResult.success && townhallResult.point) {
      console.log(`[Geocode] ✅ Succès fallback TOWNHALL: (${townhallResult.point.lat}, ${townhallResult.point.lon})`);
      // Succès avec fallback mairie
      await upsertGeoCache(trimmedAddress, {
        lat: townhallResult.point.lat,
        lon: townhallResult.point.lon,
        provider: townhallResult.provider,
        confidence: 'low',
        status: 'ok',
        normalizedAddress: townhallResult.normalizedAddress,
        precision: 'TOWNHALL',
        queryUsed: townhallQuery,
      });

      return {
        success: true,
        point: townhallResult.point,
        status: 'OK_TOWNHALL_FALLBACK',
        precision: 'TOWNHALL',
        queryUsed: townhallQuery,
        provider: townhallResult.provider,
        confidence: 'low',
        fromCache: false,
      };
    }
  }

  // ============================================================
  // ÉCHEC TOTAL
  // ============================================================
  
  console.log(`[Geocode] ❌ Échec total pour "${trimmedAddress}"`);
  
  return {
    success: false,
    status: 'ERROR',
    precision: 'NONE',
    errorMessage: `Géocodage échoué pour toutes les tentatives: ${fullResult.errorMessage || 'Adresse non trouvée'}`,
    queryUsed: trimmedAddress,
    provider: provider.name,
    confidence: 'unknown',
    fromCache: false,
  };
}

/**
 * Géocode un lot d'adresses avec fallback
 */
export async function geocodeBatchWithFallback(
  items: Array<{ id: string; address: string; codePostal?: string; ville?: string }>,
  options?: {
    onProgress?: (current: number, total: number, item: string) => void;
    delayBetweenItems?: number;
    abortSignal?: AbortSignal;
  }
): Promise<Map<string, GeocodeFallbackResult>> {
  const results = new Map<string, GeocodeFallbackResult>();
  const delayMs = options?.delayBetweenItems ?? 500;

  for (let i = 0; i < items.length; i++) {
    if (options?.abortSignal?.aborted) break;

    const item = items[i];
    options?.onProgress?.(i + 1, items.length, item.address);

    const result = await geocodeWithFallback(item.address, {
      codePostal: item.codePostal,
      ville: item.ville,
    });

    results.set(item.id, result);

    // Délai entre items (sauf pour le dernier)
    if (i < items.length - 1 && !result.fromCache) {
      await delay(delayMs);
    }
  }

  return results;
}
