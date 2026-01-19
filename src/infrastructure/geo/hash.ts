// ============================================================
// GEO HASH - Fonctions de hachage stables pour le cache
// ============================================================

/**
 * Normalise une adresse pour générer un hash stable
 * - Minuscules
 * - Suppression accents
 * - Suppression ponctuation superflue
 * - Normalisation espaces
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  return address
    // Minuscules
    .toLowerCase()
    // Normalisation unicode (décompose accents)
    .normalize('NFD')
    // Suppression des diacritiques (accents)
    .replace(/[\u0300-\u036f]/g, '')
    // Suppression ponctuation sauf virgule et tiret
    .replace(/[^\w\s,\-]/g, '')
    // Normalisation espaces multiples
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Génère un hash stable d'une chaîne (FNV-1a 32 bits)
 * Rapide et suffisant pour le cache local
 */
function fnv1aHash(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, force unsigned
  }
  return hash;
}

/**
 * Convertit un hash numérique en string hexadécimal
 */
function toHex(num: number): string {
  return num.toString(16).padStart(8, '0');
}

/**
 * Génère un hash stable pour une adresse (pour le cache géocodage)
 */
export function hashAddress(address: string): string {
  const normalized = normalizeAddress(address);
  const hash = fnv1aHash(normalized);
  return `addr_${toHex(hash)}`;
}

/**
 * Arrondit une coordonnée à une précision donnée (pour le cache routing)
 * Précision par défaut: 5 décimales (~1m)
 */
export function roundCoord(coord: number, precision: number = 5): number {
  const factor = Math.pow(10, precision);
  return Math.round(coord * factor) / factor;
}

/**
 * Génère une clé de cache pour un trajet routier
 * Format: route_{provider}_{fromLat}_{fromLon}_{toLat}_{toLon}
 */
export function hashRouteKey(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  provider: string
): string {
  // Arrondir à 5 décimales (~1m de précision)
  const fLat = roundCoord(fromLat);
  const fLon = roundCoord(fromLon);
  const tLat = roundCoord(toLat);
  const tLon = roundCoord(toLon);
  
  // Créer une clé déterministe
  const keyString = `${provider}|${fLat}|${fLon}|${tLat}|${tLon}`;
  const hash = fnv1aHash(keyString);
  
  return `route_${provider}_${toHex(hash)}`;
}

/**
 * Calcule la distance approximative entre deux points (formule de Haversine)
 * Utile pour un pré-filtrage rapide avant le routing exact
 * @returns Distance en kilomètres
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calcule une bounding box autour d'un point
 * @param lat Latitude du centre
 * @param lon Longitude du centre
 * @param radiusKm Rayon en kilomètres
 * @returns {minLat, maxLat, minLon, maxLon}
 */
export function getBoundingBox(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  // Approximation: 1 degré de latitude ≈ 111 km
  const latDelta = radiusKm / 111;
  // 1 degré de longitude varie selon la latitude
  const lonDelta = radiusKm / (111 * Math.cos(toRadians(lat)));
  
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

/**
 * Vérifie si un point est dans une bounding box
 */
export function isInBoundingBox(
  lat: number,
  lon: number,
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number }
): boolean {
  return lat >= box.minLat && lat <= box.maxLat &&
         lon >= box.minLon && lon <= box.maxLon;
}

/**
 * Filtre les points proches d'un point de référence
 * Utile pour limiter les calculs de routing
 */
export function filterNearbyPoints<T extends { lat: number; lon: number }>(
  refLat: number,
  refLon: number,
  points: T[],
  maxDistanceKm: number
): T[] {
  // D'abord filtrage par bounding box (très rapide)
  const box = getBoundingBox(refLat, refLon, maxDistanceKm);
  const inBox = points.filter(p => isInBoundingBox(p.lat, p.lon, box));
  
  // Puis filtrage exact par Haversine
  return inBox.filter(p => 
    haversineDistance(refLat, refLon, p.lat, p.lon) <= maxDistanceKm
  );
}

/**
 * Trie les points par distance croissante d'un point de référence
 */
export function sortByDistance<T extends { lat: number; lon: number }>(
  refLat: number,
  refLon: number,
  points: T[]
): T[] {
  return [...points].sort((a, b) => {
    const distA = haversineDistance(refLat, refLon, a.lat, a.lon);
    const distB = haversineDistance(refLat, refLon, b.lat, b.lon);
    return distA - distB;
  });
}

/**
 * Retourne les N points les plus proches d'un point de référence
 */
export function getNearestPoints<T extends { lat: number; lon: number }>(
  refLat: number,
  refLon: number,
  points: T[],
  n: number
): T[] {
  return sortByDistance(refLat, refLon, points).slice(0, n);
}
