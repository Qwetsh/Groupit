// ============================================================
// STAGE GEO WORKFLOW - Orchestration géocodage & routing
// ============================================================

import type { 
  GeoPoint, 
  GeoProgressState, 
  StageGeoInfo, 
  EnseignantGeoInfo,
  TeacherStagePair,
  GeoStatus,
  GeoPrecision,
  GeoStatusExtended,
} from './types';
import { getRouteProvider } from './route';
import {
  getRouteCache,
  upsertRouteCache,
} from './cacheRepo';
import { getNearestPoints, haversineDistance } from './hash';
import { geocodeWithFallback, toGeoStatus } from './geocodeFallback';

// ============================================================
// TYPES INTERNES
// ============================================================

export interface RouteBatchResult {
  total: number;
  success: number;
  errors: number;
  cached: number;
  pairs: TeacherStagePair[];
}

// ============================================================
// GÉOCODAGE
// ============================================================

/**
 * Géocode une adresse avec stratégie de fallback (adresse complète → ville → mairie)
 * Retourne des informations étendues sur la précision du résultat
 */
export async function geocodeAddressWithFallback(
  address: string
): Promise<{ 
  point: GeoPoint | null; 
  status: GeoStatus; 
  statusExtended: GeoStatusExtended;
  precision: GeoPrecision;
  queryUsed?: string;
  errorMessage?: string;
}> {
  if (!address || address.trim() === '') {
    return { 
      point: null, 
      status: 'error', 
      statusExtended: 'ERROR',
      precision: 'NONE',
      errorMessage: 'Adresse vide' 
    };
  }
  
  // Utiliser la stratégie de fallback
  const result = await geocodeWithFallback(address);
  
  return {
    point: result.point || null,
    status: toGeoStatus(result.status),
    statusExtended: result.status,
    precision: result.precision,
    queryUsed: result.queryUsed,
    errorMessage: result.errorMessage,
  };
}

// ============================================================
// ROUTING
// ============================================================

/**
 * Calcule le trajet entre deux points (avec cache)
 */
export async function getRouteMetrics(
  from: GeoPoint,
  to: GeoPoint
): Promise<{ distanceKm: number; durationMin: number } | null> {
  const provider = getRouteProvider();
  
  // Vérifier le cache
  const cached = await getRouteCache(from, to, provider.name);
  if (cached) {
    return { distanceKm: cached.distanceKm, durationMin: cached.durationMin };
  }
  
  // Appel API
  const result = await provider.getRoute(from, to);
  
  if (result.success && result.metrics) {
    // Sauvegarder en cache
    await upsertRouteCache(from, to, result.metrics);
    return { distanceKm: result.metrics.distanceKm, durationMin: result.metrics.durationMin };
  }
  
  return null;
}

/**
 * Calcule les trajets pour toutes les paires enseignant-stage nécessaires
 * Optimisation: limite aux N enseignants les plus proches de chaque stage
 */
export async function computeRoutePairs(
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[],
  options?: {
    maxCandidatsParStage?: number;
    maxDistanceKm?: number;
    onProgress?: (state: GeoProgressState) => void;
    abortSignal?: AbortSignal;
    delayMs?: number;
  }
): Promise<RouteBatchResult> {
  const maxCandidats = options?.maxCandidatsParStage ?? 10;
  const maxDistanceKm = options?.maxDistanceKm ?? 100;
  const concurrency = 5; // Requêtes parallèles simultanées
  
  // Filtrer les entités avec coordonnées valides
  const validStages = stages.filter(s => s.geo && (s.geoStatus === 'ok' || s.geoStatus === 'manual'));
  const validEnseignants = enseignants.filter(e => e.homeGeo && (e.homeGeoStatus === 'ok' || e.homeGeoStatus === 'manual'));
  
  // Préparer la liste des paires à calculer
  const pairsToCompute: Array<{
    stageId: string;
    enseignantId: string;
    from: GeoPoint;
    to: GeoPoint;
  }> = [];
  
  for (const stage of validStages) {
    // Trouver les N enseignants les plus proches (distance à vol d'oiseau)
    const enseignantsWithGeo = validEnseignants.map(e => ({
      ...e,
      lat: e.homeGeo!.lat,
      lon: e.homeGeo!.lon,
    }));
    
    const nearest = getNearestPoints(
      stage.geo!.lat,
      stage.geo!.lon,
      enseignantsWithGeo,
      maxCandidats
    ).filter(e => haversineDistance(stage.geo!.lat, stage.geo!.lon, e.lat, e.lon) <= maxDistanceKm);
    
    for (const ens of nearest) {
      pairsToCompute.push({
        stageId: stage.stageId,
        enseignantId: ens.enseignantId,
        from: ens.homeGeo!,
        to: stage.geo!,
      });
    }
  }
  
  // Résultat
  const result: RouteBatchResult = {
    total: pairsToCompute.length,
    success: 0,
    errors: 0,
    cached: 0,
    pairs: [],
  };
  
  const state: GeoProgressState = {
    phase: 'routing',
    current: 0,
    total: pairsToCompute.length,
    errors: [],
    startedAt: new Date(),
  };
  
  options?.onProgress?.(state);
  
  const provider = getRouteProvider();
  
  // Traiter par batches parallèles pour accélérer le calcul
  let completed = 0;

  for (let i = 0; i < pairsToCompute.length; i += concurrency) {
    if (options?.abortSignal?.aborted) {
      state.phase = 'idle';
      break;
    }

    const batch = pairsToCompute.slice(i, i + concurrency);

    const batchResults = await Promise.all(batch.map(async (pair) => {
      // Vérifier le cache
      const cached = await getRouteCache(pair.from, pair.to, provider.name);
      if (cached) {
        return { pair, cached: true as const, metrics: cached };
      }

      // Calculer le trajet (le provider gère son propre rate limit)
      const metrics = await getRouteMetrics(pair.from, pair.to);
      return { pair, cached: false as const, metrics };
    }));

    for (const br of batchResults) {
      completed++;

      if (br.cached) {
        result.cached++;
        result.success++;
        result.pairs.push({
          enseignantId: br.pair.enseignantId,
          stageId: br.pair.stageId,
          distanceKm: br.metrics!.distanceKm,
          durationMin: br.metrics!.durationMin,
          isValid: true,
        });
      } else if (br.metrics) {
        result.success++;
        result.pairs.push({
          enseignantId: br.pair.enseignantId,
          stageId: br.pair.stageId,
          distanceKm: br.metrics.distanceKm,
          durationMin: br.metrics.durationMin,
          isValid: true,
        });
      } else {
        result.errors++;
        state.errors.push({
          item: `${br.pair.enseignantId} -> ${br.pair.stageId}`,
          message: 'Échec calcul trajet'
        });
        const directDist = haversineDistance(br.pair.from.lat, br.pair.from.lon, br.pair.to.lat, br.pair.to.lon);
        result.pairs.push({
          enseignantId: br.pair.enseignantId,
          stageId: br.pair.stageId,
          distanceKm: directDist * 1.3,
          durationMin: (directDist * 1.3 / 50) * 60,
          isValid: true,
        });
      }
    }

    state.current = completed;
    state.currentItem = `batch ${Math.floor(i / concurrency) + 1}`;
    options?.onProgress?.(state);
  }
  
  state.phase = 'done';
  state.completedAt = new Date();
  options?.onProgress?.(state);
  
  return result;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Construit une map des trajets par paire (stageId, enseignantId)
 */
export function buildRoutePairsMap(
  pairs: TeacherStagePair[]
): Map<string, TeacherStagePair> {
  const map = new Map<string, TeacherStagePair>();
  for (const pair of pairs) {
    const key = `${pair.stageId}:${pair.enseignantId}`;
    map.set(key, pair);
  }
  return map;
}

/**
 * Récupère les métriques de trajet pour une paire donnée
 */
export function getRoutePair(
  pairsMap: Map<string, TeacherStagePair>,
  stageId: string,
  enseignantId: string
): TeacherStagePair | null {
  return pairsMap.get(`${stageId}:${enseignantId}`) || null;
}
