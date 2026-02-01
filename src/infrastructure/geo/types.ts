// ============================================================
// TYPES POUR LA GÉOLOCALISATION ET LE ROUTING
// ============================================================

/**
 * Point géographique (coordonnées)
 */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Statut de géocodage
 */
export type GeoStatus =
  | 'pending'      // En attente de géocodage
  | 'ok'           // Géocodé avec succès
  | 'error'        // Erreur de géocodage (adresse invalide, etc.)
  | 'manual'       // Coordonnées saisies manuellement
  | 'not_found';   // Adresse non trouvée

const GEO_STATUSES: readonly GeoStatus[] = ['pending', 'ok', 'error', 'manual', 'not_found'] as const;

export function isGeoStatus(value: string): value is GeoStatus {
  return GEO_STATUSES.includes(value as GeoStatus);
}

export function toGeoStatus(value: string | undefined): GeoStatus {
  return isGeoStatus(value ?? '') ? value as GeoStatus : 'pending';
}

/**
 * Niveau de confiance du géocodage
 */
export type GeoConfidence = 'high' | 'medium' | 'low' | 'unknown';

/**
 * Niveau de précision du géocodage (fallback)
 */
export type GeoPrecision = 'FULL' | 'CITY' | 'TOWNHALL' | 'NONE';

/**
 * Statut de géocodage étendu avec fallback
 */
export type GeoStatusExtended = 
  | 'PENDING'
  | 'OK_FULL'
  | 'OK_CITY_FALLBACK'
  | 'OK_TOWNHALL_FALLBACK'
  | 'ERROR';

/**
 * Entrée du cache de géocodage
 */
export interface GeoCacheEntry {
  id?: string;                    // ID auto-généré
  addressHash: string;            // Hash stable de l'adresse normalisée
  originalAddress: string;        // Adresse originale
  normalizedAddress: string;      // Adresse normalisée pour le hash
  lat: number;
  lon: number;
  provider: string;               // ex: 'nominatim', 'google', 'manual'
  confidence: GeoConfidence;
  status: GeoStatus;
  precision?: GeoPrecision;       // Niveau de précision (fallback)
  queryUsed?: string;             // Requête qui a abouti
  errorMessage?: string;          // Message d'erreur si status === 'error'
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Métriques d'un trajet routier
 */
export interface RouteMetrics {
  distanceKm: number;             // Distance en kilomètres
  durationMin: number;            // Durée en minutes
  provider: string;               // ex: 'osrm', 'google', 'openroute'
}

/**
 * Entrée du cache de routing
 */
export interface RouteCacheEntry {
  id?: string;                    // ID auto-généré
  routeKeyHash: string;           // Hash de (fromLat, fromLon, toLat, toLon, provider)
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  distanceKm: number;
  durationMin: number;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Résultat d'un géocodage
 */
export interface GeocodeResult {
  success: boolean;
  point?: GeoPoint;
  normalizedAddress?: string;
  confidence: GeoConfidence;
  errorMessage?: string;
  provider: string;
}

/**
 * Résultat d'un calcul de route
 */
export interface RouteResult {
  success: boolean;
  metrics?: RouteMetrics;
  errorMessage?: string;
}

/**
 * Configuration d'un provider de géocodage
 */
export interface GeoProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  rateLimit?: number;             // Requêtes par seconde
  timeout?: number;               // Timeout en ms
}

/**
 * Configuration d'un provider de routing
 */
export interface RouteProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  rateLimit?: number;
  timeout?: number;
  profile?: 'car' | 'bike' | 'foot';
}

/**
 * Interface abstraite pour un provider de géocodage
 */
export interface IGeoProvider {
  readonly name: string;
  geocode(address: string): Promise<GeocodeResult>;
}

/**
 * Interface abstraite pour un provider de routing
 */
export interface IRouteProvider {
  readonly name: string;
  getRoute(from: GeoPoint, to: GeoPoint): Promise<RouteResult>;
}

// ============================================================
// TYPES SPÉCIFIQUES AU SUIVI DE STAGE
// ============================================================

/**
 * Informations géographiques d'un stage
 */
export interface StageGeoInfo {
  stageId: string;
  eleveId: string;                // Référence locale uniquement
  eleveClasse?: string;           // Classe de l'élève (pour critère "élèves en cours")
  eleveOptions?: string[];        // Options de l'élève (langues, etc.) pour matching avec matière enseignant
  address: string;
  geo?: GeoPoint;
  geoStatus: GeoStatus;
  geoErrorMessage?: string;
  nomEntreprise?: string;
  tuteur?: string;
  dateDebut?: string;
  dateFin?: string;
}

/**
 * Informations géographiques d'un enseignant (domicile)
 */
export interface EnseignantGeoInfo {
  enseignantId: string;
  nom: string;
  prenom: string;
  matierePrincipale?: string;     // Matière principale (pour vérifier compatibilité options élève)
  homeAddress?: string;
  homeGeo?: GeoPoint;
  homeGeoStatus: GeoStatus;
  homeGeoErrorMessage?: string;
  capacityMax: number;
  classesEnCharge?: string[];     // Classes de l'enseignant (pour critère "élèves en cours")
  exclusions?: StageExclusion[];
}

/**
 * Exclusion d'un enseignant (classes, zones, élèves)
 */
export type StageExclusionType = 'classe' | 'zone' | 'eleve' | 'secteur';

const EXCLUSION_TYPES: readonly StageExclusionType[] = ['classe', 'zone', 'eleve', 'secteur'] as const;

export function isExclusionType(value: string): value is StageExclusionType {
  return EXCLUSION_TYPES.includes(value as StageExclusionType);
}

export function toExclusionType(value: string): StageExclusionType {
  return isExclusionType(value) ? value : 'classe';
}

export interface StageExclusion {
  type: StageExclusionType;
  value: string;                  // ex: "3A", "eleveId123", "Paris 15e"
  reason?: string;
}

/**
 * Paire enseignant-stage avec métriques de trajet
 */
export interface TeacherStagePair {
  enseignantId: string;
  stageId: string;
  distanceKm: number;
  durationMin: number;
  isValid: boolean;               // Respecte les contraintes dures
  invalidReason?: string;
}

/**
 * Résultat d'affectation pour un stage
 */
export interface StageAffectationResult {
  stageId: string;
  eleveId: string;
  enseignantId: string;
  distanceKm: number;
  durationMin: number;
  score: number;
  explication: string;
}

/**
 * Statistiques globales d'affectation de stages
 */
export interface StageAffectationStats {
  totalStages: number;
  totalAffectes: number;
  totalNonAffectes: number;
  dureeTotaleMin: number;
  dureeMoyenneMin: number;
  distanceTotaleKm: number;
  distanceMoyenneKm: number;
  chargeParEnseignant: Record<string, number>;
  ecartTypeCharge: number;
}

/**
 * Résultat complet de l'algorithme d'affectation de stages
 */
export interface StageMatchingResult {
  affectations: StageAffectationResult[];
  nonAffectes: Array<{
    stageId: string;
    eleveId: string;
    raisons: string[];
  }>;
  stats: StageAffectationStats;
  tempsCalculMs: number;
}

/**
 * Options pour l'algorithme d'affectation de stages
 */
export interface StageMatchingOptions {
  // Poids des critères (0-100)
  poidsDuree: number;             // Poids de la durée du trajet
  poidsDistance: number;          // Poids de la distance
  poidsEquilibrage: number;       // Poids de l'équilibrage de charge
  poidsElevesEnCours?: number;    // Poids du critère "élèves en cours"

  // Contraintes
  dureeMaxMin?: number;           // Durée max acceptée (minutes)
  distanceMaxKm?: number;         // Distance max acceptée (km)

  // Optimisation
  maxCandidatsParStage?: number;  // Limiter les candidats par stage (perf)
  useLocalSearch?: boolean;       // Amélioration par recherche locale
  maxIterations?: number;         // Itérations max pour local search
  localSearchTimeoutMs?: number;  // Timeout pour éviter freeze UI

  // Fallback pour enseignants éloignés des stages
  collegeGeo?: GeoPoint;          // Position du collège
  fallbackCollegeActif?: boolean; // Activer le fallback collège (défaut: true si collegeGeo fourni)
  fallbackAngleMaxDeg?: number;   // Demi-angle du cône directionnel (défaut: 45° = cône de 90°)

  verbose?: boolean;
}

export const DEFAULT_STAGE_MATCHING_OPTIONS: StageMatchingOptions = {
  poidsDuree: 60,
  poidsDistance: 20,
  poidsEquilibrage: 20,
  poidsElevesEnCours: 0,          // Désactivé par défaut
  dureeMaxMin: 60,
  distanceMaxKm: 50,
  maxCandidatsParStage: 10,
  useLocalSearch: true,
  maxIterations: 50, // Réduit de 100 à 50 pour meilleures performances
  localSearchTimeoutMs: 3000, // 3 secondes max
  // Fallback pour enseignants éloignés
  fallbackCollegeActif: true,     // Actif par défaut si collegeGeo fourni
  fallbackAngleMaxDeg: 45,        // Cône de 90° (±45°)
  verbose: false,
};

/**
 * État de progression pour les opérations longues
 */
export interface GeoProgressState {
  phase: 'idle' | 'geocoding' | 'routing' | 'matching' | 'done' | 'error';
  current: number;
  total: number;
  currentItem?: string;
  errors: Array<{ item: string; message: string }>;
  startedAt?: Date;
  completedAt?: Date;
}
