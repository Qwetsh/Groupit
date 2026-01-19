// ============================================================
// GEO CACHE REPOSITORY - Persistance locale du cache géo
// ============================================================

import { db } from '../database/db';
import type { 
  GeoCacheEntry, 
  RouteCacheEntry, 
  GeoPoint, 
  GeoStatus, 
  GeoConfidence,
  RouteMetrics 
} from './types';
import { hashAddress, hashRouteKey, normalizeAddress } from './hash';

// ============================================================
// CACHE GÉOCODAGE
// ============================================================

/**
 * Génère un ID unique pour une entrée de cache
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Recherche une adresse dans le cache
 */
export async function getGeoCacheByAddress(address: string): Promise<GeoCacheEntry | null> {
  const hash = hashAddress(address);
  const entry = await db.geoCache.where('addressHash').equals(hash).first();
  return entry || null;
}

/**
 * Recherche par hash direct
 */
export async function getGeoCacheByHash(addressHash: string): Promise<GeoCacheEntry | null> {
  const entry = await db.geoCache.where('addressHash').equals(addressHash).first();
  return entry || null;
}

/**
 * Ajoute ou met à jour une entrée de cache géo
 */
export async function upsertGeoCache(
  address: string,
  data: {
    lat: number;
    lon: number;
    provider: string;
    confidence: GeoConfidence;
    status: GeoStatus;
    normalizedAddress?: string;
    errorMessage?: string;
    precision?: 'FULL' | 'CITY' | 'TOWNHALL' | 'NONE';
    queryUsed?: string;
  }
): Promise<GeoCacheEntry> {
  const hash = hashAddress(address);
  const normalized = data.normalizedAddress || normalizeAddress(address);
  const now = new Date();
  
  const existing = await getGeoCacheByHash(hash);
  
  if (existing) {
    // Ne pas écraser un résultat FULL par un fallback
    if (existing.precision === 'FULL' && data.precision && data.precision !== 'FULL') {
      return existing;
    }
    
    // Mise à jour
    const updated: GeoCacheEntry = {
      ...existing,
      lat: data.lat,
      lon: data.lon,
      provider: data.provider,
      confidence: data.confidence,
      status: data.status,
      normalizedAddress: normalized,
      errorMessage: data.errorMessage,
      precision: data.precision,
      queryUsed: data.queryUsed,
      updatedAt: now,
    };
    await db.geoCache.put(updated);
    return updated;
  } else {
    // Création
    const entry: GeoCacheEntry = {
      id: generateId(),
      addressHash: hash,
      originalAddress: address,
      normalizedAddress: normalized,
      lat: data.lat,
      lon: data.lon,
      provider: data.provider,
      confidence: data.confidence,
      status: data.status,
      errorMessage: data.errorMessage,
      precision: data.precision,
      queryUsed: data.queryUsed,
      createdAt: now,
      updatedAt: now,
    };
    await db.geoCache.add(entry);
    return entry;
  }
}

/**
 * Marque une adresse comme en erreur dans le cache
 */
export async function setGeoCacheError(
  address: string,
  provider: string,
  errorMessage: string
): Promise<GeoCacheEntry> {
  return upsertGeoCache(address, {
    lat: 0,
    lon: 0,
    provider,
    confidence: 'unknown',
    status: 'error',
    errorMessage,
  });
}

/**
 * Ajoute des coordonnées manuelles
 */
export async function setManualGeoCache(
  address: string,
  lat: number,
  lon: number
): Promise<GeoCacheEntry> {
  return upsertGeoCache(address, {
    lat,
    lon,
    provider: 'manual',
    confidence: 'high',
    status: 'manual',
  });
}

/**
 * Supprime une entrée du cache géo
 */
export async function deleteGeoCache(addressHash: string): Promise<void> {
  await db.geoCache.where('addressHash').equals(addressHash).delete();
}

/**
 * Récupère toutes les entrées du cache géo
 */
export async function getAllGeoCache(): Promise<GeoCacheEntry[]> {
  return db.geoCache.toArray();
}

/**
 * Récupère les entrées par statut
 */
export async function getGeoCacheByStatus(status: GeoStatus): Promise<GeoCacheEntry[]> {
  return db.geoCache.where('status').equals(status).toArray();
}

/**
 * Compte les entrées par statut
 */
export async function countGeoCacheByStatus(): Promise<Record<GeoStatus, number>> {
  const all = await db.geoCache.toArray();
  const counts: Record<GeoStatus, number> = {
    pending: 0,
    ok: 0,
    error: 0,
    manual: 0,
    not_found: 0,
  };
  for (const entry of all) {
    counts[entry.status] = (counts[entry.status] || 0) + 1;
  }
  return counts;
}

/**
 * Vide le cache géo
 */
export async function clearGeoCache(): Promise<void> {
  await db.geoCache.clear();
}

// ============================================================
// CACHE ROUTING
// ============================================================

/**
 * Recherche un trajet dans le cache
 */
export async function getRouteCache(
  from: GeoPoint,
  to: GeoPoint,
  provider: string
): Promise<RouteCacheEntry | null> {
  const hash = hashRouteKey(from.lat, from.lon, to.lat, to.lon, provider);
  const entry = await db.routeCache.where('routeKeyHash').equals(hash).first();
  return entry || null;
}

/**
 * Recherche par hash direct
 */
export async function getRouteCacheByHash(routeKeyHash: string): Promise<RouteCacheEntry | null> {
  const entry = await db.routeCache.where('routeKeyHash').equals(routeKeyHash).first();
  return entry || null;
}

/**
 * Ajoute ou met à jour une entrée de cache routing
 */
export async function upsertRouteCache(
  from: GeoPoint,
  to: GeoPoint,
  metrics: RouteMetrics
): Promise<RouteCacheEntry> {
  const hash = hashRouteKey(from.lat, from.lon, to.lat, to.lon, metrics.provider);
  const now = new Date();
  
  const existing = await getRouteCacheByHash(hash);
  
  if (existing) {
    // Mise à jour
    const updated: RouteCacheEntry = {
      ...existing,
      distanceKm: metrics.distanceKm,
      durationMin: metrics.durationMin,
      provider: metrics.provider,
      updatedAt: now,
    };
    await db.routeCache.put(updated);
    return updated;
  } else {
    // Création
    const entry: RouteCacheEntry = {
      id: generateId(),
      routeKeyHash: hash,
      fromLat: from.lat,
      fromLon: from.lon,
      toLat: to.lat,
      toLon: to.lon,
      distanceKm: metrics.distanceKm,
      durationMin: metrics.durationMin,
      provider: metrics.provider,
      createdAt: now,
      updatedAt: now,
    };
    await db.routeCache.add(entry);
    return entry;
  }
}

/**
 * Supprime une entrée du cache routing
 */
export async function deleteRouteCache(routeKeyHash: string): Promise<void> {
  await db.routeCache.where('routeKeyHash').equals(routeKeyHash).delete();
}

/**
 * Récupère toutes les entrées du cache routing
 */
export async function getAllRouteCache(): Promise<RouteCacheEntry[]> {
  return db.routeCache.toArray();
}

/**
 * Compte les entrées du cache routing
 */
export async function countRouteCache(): Promise<number> {
  return db.routeCache.count();
}

/**
 * Récupère les statistiques du cache routing
 */
export async function getRouteCacheStats(): Promise<{
  count: number;
  providers: Record<string, number>;
  avgDistance: number;
  avgDuration: number;
}> {
  const all = await db.routeCache.toArray();
  const providers: Record<string, number> = {};
  let totalDistance = 0;
  let totalDuration = 0;
  
  for (const entry of all) {
    providers[entry.provider] = (providers[entry.provider] || 0) + 1;
    totalDistance += entry.distanceKm;
    totalDuration += entry.durationMin;
  }
  
  return {
    count: all.length,
    providers,
    avgDistance: all.length > 0 ? totalDistance / all.length : 0,
    avgDuration: all.length > 0 ? totalDuration / all.length : 0,
  };
}

/**
 * Vide le cache routing
 */
export async function clearRouteCache(): Promise<void> {
  await db.routeCache.clear();
}

/**
 * Supprime les entrées de cache plus anciennes que X jours
 */
export async function pruneOldCache(maxAgeDays: number = 30): Promise<{
  geoDeleted: number;
  routeDeleted: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  
  const oldGeo = await db.geoCache.where('updatedAt').below(cutoff).toArray();
  const oldRoutes = await db.routeCache.where('updatedAt').below(cutoff).toArray();
  
  await db.geoCache.bulkDelete(oldGeo.map(e => e.id!));
  await db.routeCache.bulkDelete(oldRoutes.map(e => e.id!));
  
  return {
    geoDeleted: oldGeo.length,
    routeDeleted: oldRoutes.length,
  };
}

// ============================================================
// BULK OPERATIONS
// ============================================================

/**
 * Vérifie quelles adresses sont déjà en cache
 */
export async function checkAddressesInCache(
  addresses: string[]
): Promise<Map<string, GeoCacheEntry | null>> {
  const result = new Map<string, GeoCacheEntry | null>();
  
  for (const address of addresses) {
    const cached = await getGeoCacheByAddress(address);
    result.set(address, cached);
  }
  
  return result;
}

/**
 * Vérifie quels trajets sont déjà en cache
 */
export async function checkRoutesInCache(
  routes: Array<{ from: GeoPoint; to: GeoPoint }>,
  provider: string
): Promise<Map<string, RouteCacheEntry | null>> {
  const result = new Map<string, RouteCacheEntry | null>();
  
  for (const route of routes) {
    const hash = hashRouteKey(route.from.lat, route.from.lon, route.to.lat, route.to.lon, provider);
    const cached = await getRouteCacheByHash(hash);
    result.set(hash, cached);
  }
  
  return result;
}
