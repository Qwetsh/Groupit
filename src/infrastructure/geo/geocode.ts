// ============================================================
// GEO PROVIDERS - Interface et implémentations de géocodage
// ============================================================

import type { IGeoProvider, GeocodeResult, GeoConfidence } from './types';

// ============================================================
// CONFIGURATION DES PROVIDERS
// ============================================================

/**
 * Configuration globale des providers
 * Peut être surchargée via localStorage ou variables d'environnement
 */
export interface GeoConfig {
  geocodeProvider: 'nominatim' | 'photon' | 'mock';
  nominatim?: {
    baseUrl: string;
    userAgent: string;
    rateLimit: number; // ms entre requêtes
  };
  photon?: {
    baseUrl: string;
    rateLimit: number;
  };
}

const DEFAULT_GEO_CONFIG: GeoConfig = {
  geocodeProvider: 'nominatim',
  nominatim: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    userAgent: 'Groupit/1.0 (educational-app)',
    rateLimit: 1000, // 1 requête par seconde (respect des CGU Nominatim)
  },
  photon: {
    baseUrl: 'https://photon.komoot.io',
    rateLimit: 200,
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
 * Sauvegarde la configuration
 */
export function setGeoConfig(config: Partial<GeoConfig>): void {
  const current = getGeoConfig();
  const merged = { ...current, ...config };
  localStorage.setItem('groupit_geo_config', JSON.stringify(merged));
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
  
  constructor(config?: Partial<GeoConfig['nominatim']>) {
    this.config = { ...DEFAULT_GEO_CONFIG.nominatim!, ...config };
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
        countrycodes: 'fr', // Limiter à la France
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
// FACTORY
// ============================================================

/**
 * Crée le provider de géocodage configuré
 */
export function createGeoProvider(providerName?: string): IGeoProvider {
  const config = getGeoConfig();
  const name = providerName || config.geocodeProvider;
  
  switch (name) {
    case 'nominatim':
      return new NominatimProvider(config.nominatim);
    case 'photon':
      return new PhotonProvider(config.photon);
    case 'mock':
      return new MockGeoProvider();
    default:
      console.warn(`[Geo] Provider inconnu: ${name}, utilisation de Nominatim`);
      return new NominatimProvider(config.nominatim);
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
