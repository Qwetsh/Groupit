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
