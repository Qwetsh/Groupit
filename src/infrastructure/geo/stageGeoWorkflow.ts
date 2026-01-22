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
import { getGeoProvider } from './geocode';
import { getRouteProvider } from './route';
import { 
  getGeoCacheByAddress, 
  upsertGeoCache, 
  setGeoCacheError,
  getRouteCache,
  upsertRouteCache,
} from './cacheRepo';
import { getNearestPoints, haversineDistance } from './hash';
import { geocodeWithFallback, toGeoStatus } from './geocodeFallback';

// ============================================================
// TYPES INTERNES
// ============================================================

export interface GeocodeBatchResult {
  total: number;
  success: number;
  errors: number;
  cached: number;
  details: Array<{
    address: string;
    status: GeoStatus;
    point?: GeoPoint;
    errorMessage?: string;
  }>;
}

export interface GeocodeBatchResultExtended {
  total: number;
  success: number;
  successFull: number;      // OK avec adresse exacte
  successFallback: number;  // OK avec fallback (ville/mairie)
  errors: number;
  cached: number;
  details: Array<{
    address: string;
    status: GeoStatus;
    statusExtended: GeoStatusExtended;
    precision: GeoPrecision;
    queryUsed?: string;
    point?: GeoPoint;
    errorMessage?: string;
  }>;
}

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
 * Géocode une seule adresse (avec cache)
 */
export async function geocodeAddress(
  address: string
): Promise<{ point: GeoPoint | null; status: GeoStatus; errorMessage?: string }> {
  if (!address || address.trim() === '') {
    return { point: null, status: 'error', errorMessage: 'Adresse vide' };
  }
  
  // Vérifier le cache
  const cached = await getGeoCacheByAddress(address);
  if (cached && cached.status === 'ok') {
    return { 
      point: { lat: cached.lat, lon: cached.lon }, 
      status: 'ok' 
    };
  }
  if (cached && cached.status === 'manual') {
    return { 
      point: { lat: cached.lat, lon: cached.lon }, 
      status: 'manual' 
    };
  }
  
  // Appel API
  const provider = getGeoProvider();
  const result = await provider.geocode(address);
  
  if (result.success && result.point) {
    // Sauvegarder en cache
    await upsertGeoCache(address, {
      lat: result.point.lat,
      lon: result.point.lon,
      provider: result.provider,
      confidence: result.confidence,
      status: 'ok',
      normalizedAddress: result.normalizedAddress,
    });
    
    return { point: result.point, status: 'ok' };
  } else {
    // Sauvegarder l'erreur
    await setGeoCacheError(address, result.provider, result.errorMessage || 'Erreur inconnue');
    
    const status: GeoStatus = result.errorMessage?.includes('non trouvée') ? 'not_found' : 'error';
    return { point: null, status, errorMessage: result.errorMessage };
  }
}

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

/**
 * Géocode un lot d'adresses avec progression
 */
export async function geocodeBatch(
  addresses: string[],
  options?: {
    onProgress?: (state: GeoProgressState) => void;
    abortSignal?: AbortSignal;
    delayMs?: number;
  }
): Promise<GeocodeBatchResult> {
  const delayMs = options?.delayMs ?? 200;
  const result: GeocodeBatchResult = {
    total: addresses.length,
    success: 0,
    errors: 0,
    cached: 0,
    details: [],
  };
  
  const state: GeoProgressState = {
    phase: 'geocoding',
    current: 0,
    total: addresses.length,
    errors: [],
    startedAt: new Date(),
  };
  
  options?.onProgress?.(state);
  
  for (let i = 0; i < addresses.length; i++) {
    if (options?.abortSignal?.aborted) {
      state.phase = 'idle';
      break;
    }
    
    const address = addresses[i];
    state.current = i + 1;
    state.currentItem = address;
    options?.onProgress?.(state);
    
    // Vérifier le cache d'abord
    const cached = await getGeoCacheByAddress(address);
    if (cached && (cached.status === 'ok' || cached.status === 'manual')) {
      result.cached++;
      result.success++;
      result.details.push({
        address,
        status: cached.status,
        point: { lat: cached.lat, lon: cached.lon },
      });
      continue;
    }
    
    // Géocoder
    const geo = await geocodeAddress(address);
    
    if (geo.status === 'ok' || geo.status === 'manual') {
      result.success++;
    } else {
      result.errors++;
      state.errors.push({ item: address, message: geo.errorMessage || 'Erreur' });
    }
    
    result.details.push({
      address,
      status: geo.status,
      point: geo.point || undefined,
      errorMessage: geo.errorMessage,
    });
    
    // Délai entre requêtes API (pas pour le cache)
    if (!cached && i < addresses.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  
  state.phase = 'done';
  state.completedAt = new Date();
  options?.onProgress?.(state);
  
  return result;
}

/**
 * Géocode un lot d'adresses avec stratégie de fallback et progression
 * Tente: adresse complète → ville+CP → "Mairie de Ville" → erreur
 *
 * @deprecated Utiliser geocodeBatchWithFallback de './geocodeFallback' à la place.
 * Cette fonction n'est plus exportée depuis l'index et sera supprimée dans une version future.
 */
async function _geocodeBatchWithFallbackLegacy(
  addresses: string[],
  options?: {
    onProgress?: (state: GeoProgressState) => void;
    abortSignal?: AbortSignal;
    delayMs?: number;
  }
): Promise<GeocodeBatchResultExtended> {
  const delayMs = options?.delayMs ?? 200;
  const result: GeocodeBatchResultExtended = {
    total: addresses.length,
    success: 0,
    successFull: 0,
    successFallback: 0,
    errors: 0,
    cached: 0,
    details: [],
  };
  
  const state: GeoProgressState = {
    phase: 'geocoding',
    current: 0,
    total: addresses.length,
    errors: [],
    startedAt: new Date(),
  };
  
  options?.onProgress?.(state);
  
  for (let i = 0; i < addresses.length; i++) {
    if (options?.abortSignal?.aborted) {
      state.phase = 'idle';
      break;
    }
    
    const address = addresses[i];
    state.current = i + 1;
    state.currentItem = address;
    options?.onProgress?.(state);
    
    // Vérifier le cache d'abord (uniquement si résultat complet)
    const cached = await getGeoCacheByAddress(address);
    if (cached && (cached.status === 'ok' || cached.status === 'manual')) {
      result.cached++;
      result.success++;
      
      // Déterminer la précision depuis le cache
      const precision = cached.precision || 'FULL';
      if (precision === 'FULL') {
        result.successFull++;
      } else {
        result.successFallback++;
      }
      
      result.details.push({
        address,
        status: cached.status,
        statusExtended: precision === 'FULL' ? 'OK_FULL' 
          : precision === 'CITY' ? 'OK_CITY_FALLBACK'
          : precision === 'TOWNHALL' ? 'OK_TOWNHALL_FALLBACK'
          : 'OK_FULL',
        precision,
        queryUsed: cached.queryUsed || address,
        point: { lat: cached.lat, lon: cached.lon },
      });
      continue;
    }
    
    // Géocoder avec fallback
    const geo = await geocodeAddressWithFallback(address);
    
    if (geo.status === 'ok' || geo.status === 'manual') {
      result.success++;
      if (geo.precision === 'FULL') {
        result.successFull++;
      } else {
        result.successFallback++;
      }
    } else {
      result.errors++;
      state.errors.push({ item: address, message: geo.errorMessage || 'Erreur' });
    }
    
    result.details.push({
      address,
      status: geo.status,
      statusExtended: geo.statusExtended,
      precision: geo.precision,
      queryUsed: geo.queryUsed,
      point: geo.point || undefined,
      errorMessage: geo.errorMessage,
    });
    
    // Délai entre requêtes API (pas pour le cache)
    if (!cached && i < addresses.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  
  state.phase = 'done';
  state.completedAt = new Date();
  options?.onProgress?.(state);
  
  return result;
}

/**
 * Géocode les stages et enseignants
 */
export async function geocodeStagesAndTeachers(
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[],
  options?: {
    onProgress?: (state: GeoProgressState) => void;
    abortSignal?: AbortSignal;
  }
): Promise<{
  stages: StageGeoInfo[];
  enseignants: EnseignantGeoInfo[];
  stats: { stagesOk: number; stagesError: number; enseignantsOk: number; enseignantsError: number };
}> {
  const stats = { stagesOk: 0, stagesError: 0, enseignantsOk: 0, enseignantsError: 0 };
  
  // Collecter toutes les adresses uniques
  const stageAddresses = stages.filter(s => s.address && s.geoStatus !== 'ok' && s.geoStatus !== 'manual');
  const enseignantAddresses = enseignants.filter(e => e.homeAddress && e.homeGeoStatus !== 'ok' && e.homeGeoStatus !== 'manual');
  
  const allAddresses = [
    ...stageAddresses.map(s => s.address),
    ...enseignantAddresses.map(e => e.homeAddress!),
  ];
  
  // Géocoder en batch
  await geocodeBatch(allAddresses, options);
  
  // Mettre à jour les stages
  for (const stage of stages) {
    if (!stage.address) {
      stage.geoStatus = 'error';
      stage.geoErrorMessage = 'Adresse manquante';
      stats.stagesError++;
      continue;
    }
    
    const cached = await getGeoCacheByAddress(stage.address);
    if (cached && (cached.status === 'ok' || cached.status === 'manual')) {
      stage.geo = { lat: cached.lat, lon: cached.lon };
      stage.geoStatus = cached.status;
      stats.stagesOk++;
    } else if (cached) {
      stage.geoStatus = cached.status;
      stage.geoErrorMessage = cached.errorMessage;
      stats.stagesError++;
    } else {
      stage.geoStatus = 'pending';
      stats.stagesError++;
    }
  }
  
  // Mettre à jour les enseignants
  for (const ens of enseignants) {
    if (!ens.homeAddress) {
      ens.homeGeoStatus = 'error';
      ens.homeGeoErrorMessage = 'Adresse manquante';
      stats.enseignantsError++;
      continue;
    }
    
    const cached = await getGeoCacheByAddress(ens.homeAddress);
    if (cached && (cached.status === 'ok' || cached.status === 'manual')) {
      ens.homeGeo = { lat: cached.lat, lon: cached.lon };
      ens.homeGeoStatus = cached.status;
      stats.enseignantsOk++;
    } else if (cached) {
      ens.homeGeoStatus = cached.status;
      ens.homeGeoErrorMessage = cached.errorMessage;
      stats.enseignantsError++;
    } else {
      ens.homeGeoStatus = 'pending';
      stats.enseignantsError++;
    }
  }
  
  return { stages, enseignants, stats };
}

/**
 * Interface étendue pour StageGeoInfo avec précision
 */
export interface StageGeoInfoExtended extends StageGeoInfo {
  geoStatusExtended?: GeoStatusExtended;
  geoPrecision?: GeoPrecision;
  geoQueryUsed?: string;
}

/**
 * Géocode les stages et enseignants AVEC stratégie de fallback
 * Pour les stages qui ne sont pas trouvés exactement, tente:
 * 1. Adresse complète
 * 2. Ville + Code Postal
 * 3. "Mairie de {Ville}"
 */
export async function geocodeStagesAndTeachersWithFallback(
  stages: StageGeoInfoExtended[],
  enseignants: EnseignantGeoInfo[],
  options?: {
    onProgress?: (state: GeoProgressState) => void;
    abortSignal?: AbortSignal;
  }
): Promise<{
  stages: StageGeoInfoExtended[];
  enseignants: EnseignantGeoInfo[];
  stats: { 
    stagesOk: number; 
    stagesOkFull: number;
    stagesOkFallback: number;
    stagesError: number; 
    enseignantsOk: number; 
    enseignantsError: number;
  };
}> {
  const stats = { 
    stagesOk: 0, 
    stagesOkFull: 0,
    stagesOkFallback: 0,
    stagesError: 0, 
    enseignantsOk: 0, 
    enseignantsError: 0 
  };
  
  // Collecter les adresses de stages à géocoder (ceux qui ne sont pas déjà OK)
  const stageAddresses = stages.filter(
    s => s.address && s.geoStatus !== 'ok' && s.geoStatus !== 'manual'
  );
  
  // Collecter les adresses d'enseignants
  const enseignantAddresses = enseignants.filter(
    e => e.homeAddress && e.homeGeoStatus !== 'ok' && e.homeGeoStatus !== 'manual'
  );
  
  // Calculer le total pour la progression
  const totalItems = stageAddresses.length + enseignantAddresses.length;
  let processedItems = 0;
  
  const state: GeoProgressState = {
    phase: 'geocoding',
    current: 0,
    total: totalItems,
    errors: [],
    startedAt: new Date(),
  };
  
  options?.onProgress?.(state);
  
  // Géocoder les stages avec fallback
  for (const stage of stageAddresses) {
    if (options?.abortSignal?.aborted) break;
    
    processedItems++;
    state.current = processedItems;
    state.currentItem = stage.address;
    options?.onProgress?.(state);
    
    const result = await geocodeAddressWithFallback(stage.address);
    
    if (result.point) {
      stage.geo = result.point;
      stage.geoStatus = result.status;
      stage.geoStatusExtended = result.statusExtended;
      stage.geoPrecision = result.precision;
      stage.geoQueryUsed = result.queryUsed;
      stage.geoErrorMessage = undefined;
      
      stats.stagesOk++;
      if (result.precision === 'FULL') {
        stats.stagesOkFull++;
      } else {
        stats.stagesOkFallback++;
      }
    } else {
      stage.geoStatus = result.status;
      stage.geoStatusExtended = result.statusExtended;
      stage.geoPrecision = result.precision;
      stage.geoErrorMessage = result.errorMessage;
      stats.stagesError++;
      state.errors.push({ item: stage.address, message: result.errorMessage || 'Erreur' });
    }
    
    // Délai entre requêtes API
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Géocoder les enseignants (sans fallback pour l'instant, adresse domicile exacte attendue)
  for (const ens of enseignantAddresses) {
    if (options?.abortSignal?.aborted) break;
    
    processedItems++;
    state.current = processedItems;
    state.currentItem = ens.homeAddress;
    options?.onProgress?.(state);
    
    const result = await geocodeAddress(ens.homeAddress!);
    
    if (result.point) {
      ens.homeGeo = result.point;
      ens.homeGeoStatus = result.status;
    } else {
      ens.homeGeoStatus = result.status;
      ens.homeGeoErrorMessage = result.errorMessage;
      stats.enseignantsError++;
      state.errors.push({ item: ens.homeAddress!, message: result.errorMessage || 'Erreur' });
    }
    
    if (ens.homeGeoStatus === 'ok' || ens.homeGeoStatus === 'manual') {
      stats.enseignantsOk++;
    }
    
    // Délai entre requêtes API
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Mettre à jour les stages qui étaient déjà OK (ne pas les modifier)
  for (const stage of stages) {
    if (!stage.address) {
      stage.geoStatus = 'error';
      stage.geoStatusExtended = 'ERROR';
      stage.geoPrecision = 'NONE';
      stage.geoErrorMessage = 'Adresse manquante';
      stats.stagesError++;
      continue;
    }
    
    // Si déjà OK, compter dans les stats
    if (stage.geoStatus === 'ok' || stage.geoStatus === 'manual') {
      if (!stageAddresses.includes(stage)) {
        stats.stagesOk++;
        stats.stagesOkFull++;
      }
    }
  }
  
  // Idem pour enseignants déjà OK
  for (const ens of enseignants) {
    if ((ens.homeGeoStatus === 'ok' || ens.homeGeoStatus === 'manual') && !enseignantAddresses.includes(ens)) {
      stats.enseignantsOk++;
    }
  }
  
  state.phase = 'done';
  state.completedAt = new Date();
  options?.onProgress?.(state);
  
  return { stages, enseignants, stats };
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
  const delayMs = options?.delayMs ?? 100;
  
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
  
  for (let i = 0; i < pairsToCompute.length; i++) {
    if (options?.abortSignal?.aborted) {
      state.phase = 'idle';
      break;
    }
    
    const pair = pairsToCompute[i];
    state.current = i + 1;
    state.currentItem = `${pair.enseignantId} -> ${pair.stageId}`;
    options?.onProgress?.(state);
    
    // Vérifier le cache
    const cached = await getRouteCache(pair.from, pair.to, provider.name);
    if (cached) {
      result.cached++;
      result.success++;
      result.pairs.push({
        enseignantId: pair.enseignantId,
        stageId: pair.stageId,
        distanceKm: cached.distanceKm,
        durationMin: cached.durationMin,
        isValid: true,
      });
      continue;
    }
    
    // Calculer le trajet
    const metrics = await getRouteMetrics(pair.from, pair.to);
    
    if (metrics) {
      result.success++;
      result.pairs.push({
        enseignantId: pair.enseignantId,
        stageId: pair.stageId,
        distanceKm: metrics.distanceKm,
        durationMin: metrics.durationMin,
        isValid: true,
      });
    } else {
      result.errors++;
      state.errors.push({ 
        item: `${pair.enseignantId} -> ${pair.stageId}`, 
        message: 'Échec calcul trajet' 
      });
      // On ajoute quand même la paire avec des valeurs par défaut (Haversine)
      const directDist = haversineDistance(pair.from.lat, pair.from.lon, pair.to.lat, pair.to.lon);
      result.pairs.push({
        enseignantId: pair.enseignantId,
        stageId: pair.stageId,
        distanceKm: directDist * 1.3, // Estimation
        durationMin: (directDist * 1.3 / 50) * 60, // ~50 km/h
        isValid: true,
      });
    }
    
    // Délai entre requêtes
    if (i < pairsToCompute.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
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
 * Vérifie si tous les stages et enseignants sont géocodés
 */
export function checkGeoReadiness(
  stages: StageGeoInfo[],
  enseignants: EnseignantGeoInfo[]
): {
  ready: boolean;
  stagesReady: number;
  stagesTotal: number;
  enseignantsReady: number;
  enseignantsTotal: number;
  missingStages: StageGeoInfo[];
  missingEnseignants: EnseignantGeoInfo[];
} {
  const stagesReady = stages.filter(s => s.geoStatus === 'ok' || s.geoStatus === 'manual');
  const enseignantsReady = enseignants.filter(e => e.homeGeoStatus === 'ok' || e.homeGeoStatus === 'manual');
  
  return {
    ready: stagesReady.length === stages.length && enseignantsReady.length === enseignants.length,
    stagesReady: stagesReady.length,
    stagesTotal: stages.length,
    enseignantsReady: enseignantsReady.length,
    enseignantsTotal: enseignants.length,
    missingStages: stages.filter(s => s.geoStatus !== 'ok' && s.geoStatus !== 'manual'),
    missingEnseignants: enseignants.filter(e => e.homeGeoStatus !== 'ok' && e.homeGeoStatus !== 'manual'),
  };
}

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
