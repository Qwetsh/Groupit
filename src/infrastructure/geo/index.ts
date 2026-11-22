// ============================================================
// GEO MODULE - Index
// ============================================================

// Types
export * from './types';

// Hash utilities
export {
  normalizeAddress,
  hashAddress,
  hashRouteKey,
  roundCoord,
  haversineDistance,
  sortByDistance,
  getNearestPoints,
} from './hash';

// Geocode providers
export {
  getGeoConfig,
  createGeoProvider,
  getGeoProvider,
  NominatimProvider,
  PhotonProvider,
  MockGeoProvider,
  type GeoConfig,
} from './geocode';

// Route providers
export {
  getRouteConfig,
  createRouteProvider,
  getRouteProvider,
  OsrmProvider,
  OpenRouteProvider,
  MockRouteProvider,
  type RouteConfig,
} from './route';

// Cache repository
export {
  getGeoCacheByAddress,
  getGeoCacheByHash,
  upsertGeoCache,
  getRouteCache,
  getRouteCacheByHash,
  upsertRouteCache,
} from './cacheRepo';

// Workflow
export {
  geocodeAddressWithFallback,
  getRouteMetrics,
  computeRoutePairs,
  buildRoutePairsMap,
  getRoutePair,
  type RouteBatchResult,
} from './stageGeoWorkflow';

// Geocode with fallback (version unifiée)
export {
  geocodeWithFallback,
  toGeoStatus,
  type GeocodeFallbackResult,
  type GeocodeFallbackOptions,
} from './geocodeFallback';

// Address parser
export {
  parseAddress,
  buildCityQuery,
  buildTownhallQuery,
  type ParsedAddress,
} from './addressParser';
