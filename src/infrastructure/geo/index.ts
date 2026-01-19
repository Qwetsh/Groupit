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
  getBoundingBox,
  isInBoundingBox,
  filterNearbyPoints,
  sortByDistance,
  getNearestPoints,
} from './hash';

// Geocode providers
export {
  getGeoConfig,
  setGeoConfig,
  createGeoProvider,
  getGeoProvider,
  resetGeoProvider,
  NominatimProvider,
  PhotonProvider,
  MockGeoProvider,
  type GeoConfig,
} from './geocode';

// Route providers
export {
  getRouteConfig,
  setRouteConfig,
  createRouteProvider,
  getRouteProvider,
  resetRouteProvider,
  OsrmProvider,
  OpenRouteProvider,
  MockRouteProvider,
  batchGetRoutes,
  type RouteConfig,
  type BatchRouteRequest,
  type BatchRouteResult,
} from './route';

// Cache repository
export {
  getGeoCacheByAddress,
  getGeoCacheByHash,
  upsertGeoCache,
  setGeoCacheError,
  setManualGeoCache,
  deleteGeoCache,
  getAllGeoCache,
  getGeoCacheByStatus,
  countGeoCacheByStatus,
  clearGeoCache,
  getRouteCache,
  getRouteCacheByHash,
  upsertRouteCache,
  deleteRouteCache,
  getAllRouteCache,
  countRouteCache,
  getRouteCacheStats,
  clearRouteCache,
  pruneOldCache,
  checkAddressesInCache,
  checkRoutesInCache,
} from './cacheRepo';

// Workflow
export {
  geocodeAddress,
  geocodeAddressWithFallback,
  geocodeBatch,
  geocodeBatchWithFallback,
  geocodeStagesAndTeachers,
  geocodeStagesAndTeachersWithFallback,
  getRouteMetrics,
  computeRoutePairs,
  checkGeoReadiness,
  buildRoutePairsMap,
  getRoutePair,
  type GeocodeBatchResult,
  type GeocodeBatchResultExtended,
  type RouteBatchResult,
  type StageGeoInfoExtended,
} from './stageGeoWorkflow';

// Geocode with fallback
export {
  geocodeWithFallback,
  geocodeBatchWithFallback as geocodeFallbackBatch,
  toGeoStatus,
  type GeocodeFallbackResult,
  type GeocodeFallbackOptions,
} from './geocodeFallback';

// Address parser
export {
  parseAddress,
  buildCityQuery,
  buildTownhallQuery,
  extractCityInfo,
  normalizeString,
  type ParsedAddress,
} from './addressParser';
