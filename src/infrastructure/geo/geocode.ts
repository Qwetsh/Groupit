// ============================================================
// GEO PROVIDERS - Interface et implémentations de géocodage
// ============================================================

import type { IGeoProvider, GeocodeResult, GeoConfidence } from './types';
import { parseAddress } from './addressParser';

// ============================================================
// CONFIGURATION DES PROVIDERS
// ============================================================

/**
 * Configuration globale des providers
 * Peut être surchargée via localStorage ou variables d'environnement
 */
export interface GeoConfig {
  geocodeProvider: 'nominatim' | 'photon' | 'ban' | 'hybrid' | 'mock';
  nominatim?: {
    baseUrl: string;
    userAgent: string;
    rateLimit: number; // ms entre requêtes
  };
  photon?: {
    baseUrl: string;
    rateLimit: number;
  };
  ban?: {
    baseUrl: string;
    rateLimit: number; // ms entre requêtes (peut être très bas)
  };
}

const DEFAULT_GEO_CONFIG: GeoConfig = {
  geocodeProvider: 'hybrid', // Utilise BAN pour France, Nominatim pour Luxembourg
  nominatim: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    userAgent: 'Groupit/1.0 (educational-app)',
    rateLimit: 1000, // 1 requête par seconde (respect des CGU Nominatim)
  },
  photon: {
    baseUrl: 'https://photon.komoot.io',
    rateLimit: 200,
  },
  ban: {
    baseUrl: 'https://api-adresse.data.gouv.fr',
    rateLimit: 50, // ~20 req/s, on reste conservateur
  },
};

/**
 * Récupère la configuration (avec possibilité de surcharge localStorage)
 */
export function getGeoConfig(): GeoConfig {
  try {
    const stored = localStorage.getItem('groupit_geo_config');
    if (stored) {
      return { ...DEFAULT_GEO_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_GEO_CONFIG;
}

/**
 * Sauvegarde la configuration et reset le provider actif
 * pour forcer la recréation avec la nouvelle config
 */
export function setGeoConfig(config: Partial<GeoConfig>): void {
  const current = getGeoConfig();
  const merged = { ...current, ...config };
  localStorage.setItem('groupit_geo_config', JSON.stringify(merged));
  // Reset le provider actif pour qu'il soit recréé avec la nouvelle config
  resetGeoProvider();
}

// ============================================================
// UTILITAIRES
// ============================================================

/**
 * Délai avec promesse
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch avec timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// PROVIDER: NOMINATIM (OpenStreetMap)
// ============================================================

/**
 * Provider Nominatim (gratuit, mais rate-limited)
 * https://nominatim.org/release-docs/develop/api/Search/
 */
export class NominatimProvider implements IGeoProvider {
  readonly name = 'nominatim';
  private lastRequestTime = 0;
  private config: NonNullable<GeoConfig['nominatim']>;
  private countryCodes: string;

  constructor(config?: Partial<GeoConfig['nominatim']>, countryCodes: string = 'fr,lu') {
    this.config = { ...DEFAULT_GEO_CONFIG.nominatim!, ...config };
    this.countryCodes = countryCodes;
  }

  async geocode(address: string): Promise<GeocodeResult> {
    // Rate limiting
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.config.rateLimit) {
      await delay(this.config.rateLimit - elapsed);
    }
    this.lastRequestTime = Date.now();

    try {
      const params = new URLSearchParams({
        q: address,
        format: 'json',
        addressdetails: '1',
        limit: '1',
        countrycodes: this.countryCodes,
      });
      
      const url = `${this.config.baseUrl}/search?${params}`;
      
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'application/json',
        },
        timeout: 10000,
      });
      
      if (!response.ok) {
        return {
          success: false,
          confidence: 'unknown',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
          provider: this.name,
        };
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          confidence: 'unknown',
          errorMessage: 'Adresse non trouvée',
          provider: this.name,
        };
      }
      
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      
      // Déterminer la confiance basée sur le type de résultat
      const confidence = this.determineConfidence(result);
      
      return {
        success: true,
        point: { lat, lon },
        normalizedAddress: result.display_name,
        confidence,
        provider: this.name,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        confidence: 'unknown',
        errorMessage: message.includes('abort') ? 'Timeout' : message,
        provider: this.name,
      };
    }
  }
  
  private determineConfidence(result: Record<string, unknown>): GeoConfidence {
    const type = result.type as string;
    const classType = result.class as string;
    
    // Haute confiance: adresses précises
    if (classType === 'building' || type === 'house' || type === 'residential') {
      return 'high';
    }
    
    // Confiance moyenne: rues, places
    if (classType === 'highway' || type === 'street' || type === 'road') {
      return 'medium';
    }
    
    // Faible confiance: villes, régions
    if (classType === 'place' || classType === 'boundary') {
      return 'low';
    }
    
    return 'medium';
  }
}

// ============================================================
// PROVIDER: PHOTON (Komoot, basé sur OSM)
// ============================================================

/**
 * Provider Photon (gratuit, rapide, pas de rate limit strict)
 * https://photon.komoot.io/
 */
export class PhotonProvider implements IGeoProvider {
  readonly name = 'photon';
  private lastRequestTime = 0;
  private config: NonNullable<GeoConfig['photon']>;
  
  constructor(config?: Partial<GeoConfig['photon']>) {
    this.config = { ...DEFAULT_GEO_CONFIG.photon!, ...config };
  }
  
  async geocode(address: string): Promise<GeocodeResult> {
    // Rate limiting (même si moins strict)
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.config.rateLimit) {
      await delay(this.config.rateLimit - elapsed);
    }
    this.lastRequestTime = Date.now();
    
    try {
      const params = new URLSearchParams({
        q: address,
        limit: '1',
        lang: 'fr',
      });
      
      // Biais géographique vers la France
      params.append('lat', '46.603354');
      params.append('lon', '1.888334');
      
      const url = `${this.config.baseUrl}/api?${params}`;
      
      const response = await fetchWithTimeout(url, {
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000,
      });
      
      if (!response.ok) {
        return {
          success: false,
          confidence: 'unknown',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
          provider: this.name,
        };
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return {
          success: false,
          confidence: 'unknown',
          errorMessage: 'Adresse non trouvée',
          provider: this.name,
        };
      }
      
      const feature = data.features[0];
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties;
      
      // Construire l'adresse normalisée
      const parts = [
        props.housenumber,
        props.street,
        props.postcode,
        props.city,
        props.country,
      ].filter(Boolean);
      const normalizedAddress = parts.join(', ');
      
      const confidence = this.determineConfidence(props);
      
      return {
        success: true,
        point: { lat, lon },
        normalizedAddress: normalizedAddress || props.name,
        confidence,
        provider: this.name,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        confidence: 'unknown',
        errorMessage: message.includes('abort') ? 'Timeout' : message,
        provider: this.name,
      };
    }
  }
  
  private determineConfidence(props: Record<string, unknown>): GeoConfidence {
    const type = props.type as string;
    const osmKey = props.osm_key as string;
    
    if (osmKey === 'building' || type === 'house') {
      return 'high';
    }
    
    if (osmKey === 'highway' || type === 'street') {
      return 'medium';
    }
    
    if (osmKey === 'place' || type === 'city' || type === 'town') {
      return 'low';
    }
    
    return 'medium';
  }
}

// ============================================================
// PROVIDER: MOCK (pour les tests)
// ============================================================

/**
 * Provider de test qui retourne des coordonnées fictives
 */
export class MockGeoProvider implements IGeoProvider {
  readonly name = 'mock';
  private mockData: Map<string, { lat: number; lon: number }>;
  
  constructor() {
    // Données de test pour quelques adresses françaises
    this.mockData = new Map([
      ['1 rue de la paix paris', { lat: 48.8698, lon: 2.3309 }],
      ['10 place bellecour lyon', { lat: 45.7578, lon: 4.8320 }],
      ['5 quai des chartrons bordeaux', { lat: 44.8515, lon: -0.5694 }],
      ['20 rue du vieux port marseille', { lat: 43.2965, lon: 5.3698 }],
      ['college jean moulin toulouse', { lat: 43.6047, lon: 1.4442 }],
    ]);
  }
  
  async geocode(address: string): Promise<GeocodeResult> {
    // Simuler un délai réseau
    await delay(100);
    
    const normalized = address.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
    
    // Chercher une correspondance partielle
    for (const [key, coords] of this.mockData) {
      if (normalized.includes(key) || key.includes(normalized.split(' ').slice(0, 3).join(' '))) {
        return {
          success: true,
          point: coords,
          normalizedAddress: address,
          confidence: 'high',
          provider: this.name,
        };
      }
    }
    
    // Générer des coordonnées aléatoires en France si pas de match
    const lat = 43 + Math.random() * 7; // 43-50° N
    const lon = -1 + Math.random() * 9; // -1 à 8° E
    
    return {
      success: true,
      point: { lat, lon },
      normalizedAddress: address,
      confidence: 'low',
      provider: this.name,
    };
  }
  
  /**
   * Ajouter des données de test
   */
  addMockAddress(address: string, lat: number, lon: number): void {
    const normalized = address.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
    this.mockData.set(normalized, { lat, lon });
  }
}

// ============================================================
// PROVIDER: BAN (Base Adresse Nationale - api-adresse.data.gouv.fr)
// ============================================================

/**
 * Provider BAN - API du gouvernement français
 * GRATUIT et RAPIDE (~50 req/s autorisé)
 * https://adresse.data.gouv.fr/api-doc/adresse
 *
 * LIMITATION: France uniquement
 */
export class BanProvider implements IGeoProvider {
  readonly name = 'ban';
  private lastRequestTime = 0;
  private config: NonNullable<GeoConfig['ban']>;

  constructor(config?: Partial<GeoConfig['ban']>) {
    this.config = { ...DEFAULT_GEO_CONFIG.ban!, ...config };
  }

  async geocode(address: string): Promise<GeocodeResult> {
    // Rate limiting (très permissif)
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.config.rateLimit) {
      await delay(this.config.rateLimit - elapsed);
    }
    this.lastRequestTime = Date.now();

    try {
      const params = new URLSearchParams({
        q: address,
        limit: '1',
      });

      const url = `${this.config.baseUrl}/search/?${params}`;

      const response = await fetchWithTimeout(url, {
        headers: {
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        return {
          success: false,
          confidence: 'unknown',
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
          provider: this.name,
        };
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return {
          success: false,
          confidence: 'unknown',
          errorMessage: 'Adresse non trouvée',
          provider: this.name,
        };
      }

      const feature = data.features[0];
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties;

      // Score de confiance basé sur le score BAN (0-1)
      const confidence = this.determineConfidence(props);

      return {
        success: true,
        point: { lat, lon },
        normalizedAddress: props.label || address,
        confidence,
        provider: this.name,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        confidence: 'unknown',
        errorMessage: message.includes('abort') ? 'Timeout' : message,
        provider: this.name,
      };
    }
  }

  private determineConfidence(props: Record<string, unknown>): GeoConfidence {
    const score = props.score as number;
    const type = props.type as string;

    // Score BAN: 0-1, plus c'est haut, meilleur c'est
    if (score >= 0.8 && (type === 'housenumber' || type === 'street')) {
      return 'high';
    }

    if (score >= 0.6) {
      return 'medium';
    }

    // Résultat au niveau ville/localité
    if (type === 'municipality' || type === 'locality') {
      return 'low';
    }

    return score >= 0.4 ? 'medium' : 'low';
  }
}

// ============================================================
// PROVIDER: HYBRID (BAN pour France, Nominatim pour Luxembourg)
// ============================================================

/**
 * Provider Hybride intelligent
 * - Détecte automatiquement le pays (France vs Luxembourg)
 * - Utilise BAN (rapide) pour la France
 * - Utilise Nominatim (lent) pour le Luxembourg et autres pays
 *
 * Résultat: ~50 req/s pour France, 1 req/s pour Luxembourg
 */
export class HybridGeoProvider implements IGeoProvider {
  readonly name = 'hybrid';
  private banProvider: BanProvider;
  private nominatimProvider: NominatimProvider;

  constructor() {
    this.banProvider = new BanProvider();
    // Nominatim pour Luxembourg uniquement
    this.nominatimProvider = new NominatimProvider(undefined, 'lu,be,de');
  }

  async geocode(address: string): Promise<GeocodeResult> {
    // Analyser l'adresse pour détecter le pays
    const parsed = parseAddress(address);

    // Si Luxembourg détecté, utiliser Nominatim
    if (parsed.pays === 'LU') {
      const result = await this.nominatimProvider.geocode(address);
      return {
        ...result,
        provider: `${this.name}:nominatim`,
      };
    }

    // France ou inconnu: essayer BAN d'abord
    const banResult = await this.banProvider.geocode(address);

    if (banResult.success) {
      return {
        ...banResult,
        provider: `${this.name}:ban`,
      };
    }

    // Si BAN échoue et que le pays est inconnu, essayer Nominatim en fallback
    if (parsed.pays === 'unknown') {
      const nominatimResult = await this.nominatimProvider.geocode(address);
      if (nominatimResult.success) {
        return {
          ...nominatimResult,
          provider: `${this.name}:nominatim-fallback`,
        };
      }
    }

    // Retourner l'erreur BAN
    return {
      ...banResult,
      provider: `${this.name}:ban`,
    };
  }
}

// ============================================================
// FACTORY
// ============================================================

/**
 * Crée le provider de géocodage configuré
 */
export function createGeoProvider(providerName?: string): IGeoProvider {
  const config = getGeoConfig();
  const name = providerName || config.geocodeProvider;

  switch (name) {
    case 'hybrid':
      return new HybridGeoProvider();
    case 'ban':
      return new BanProvider(config.ban);
    case 'nominatim':
      return new NominatimProvider(config.nominatim);
    case 'photon':
      return new PhotonProvider(config.photon);
    case 'mock':
      return new MockGeoProvider();
    default:
      console.warn(`[Geo] Provider inconnu: ${name}, utilisation de Hybrid`);
      return new HybridGeoProvider();
  }
}

/**
 * Instance singleton du provider actif
 */
let activeProvider: IGeoProvider | null = null;

export function getGeoProvider(): IGeoProvider {
  if (!activeProvider) {
    activeProvider = createGeoProvider();
  }
  return activeProvider;
}

export function resetGeoProvider(): void {
  activeProvider = null;
}
