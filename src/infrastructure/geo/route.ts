// ============================================================
// ROUTE PROVIDERS - Interface et implémentations de routing
// ============================================================

import type { IRouteProvider, RouteResult, GeoPoint, RouteMetrics } from './types';
import { haversineDistance } from './hash';

// ============================================================
// CONFIGURATION DES PROVIDERS DE ROUTING
// ============================================================

export interface RouteConfig {
  routeProvider: 'osrm' | 'openroute' | 'mock';
  osrm?: {
    baseUrl: string;
    profile: 'car' | 'bike' | 'foot';
    rateLimit: number;
  };
  openroute?: {
    baseUrl: string;
    apiKey: string;
    profile: string;
    rateLimit: number;
  };
}

const DEFAULT_ROUTE_CONFIG: RouteConfig = {
  routeProvider: 'osrm',
  osrm: {
    baseUrl: 'https://router.project-osrm.org',
    profile: 'car',
    rateLimit: 100, // OSRM public est assez permissif
  },
  openroute: {
    baseUrl: 'https://api.openrouteservice.org',
    apiKey: '', // Nécessite une clé API
    profile: 'driving-car',
    rateLimit: 200,
  },
};

/**
 * Récupère la configuration routing
 */
export function getRouteConfig(): RouteConfig {
  try {
    const stored = localStorage.getItem('groupit_route_config');
    if (stored) {
      return { ...DEFAULT_ROUTE_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_ROUTE_CONFIG;
}

/**
 * Sauvegarde la configuration routing
 */
export function setRouteConfig(config: Partial<RouteConfig>): void {
  const current = getRouteConfig();
  const merged = { ...current, ...config };
  localStorage.setItem('groupit_route_config', JSON.stringify(merged));
}

// ============================================================
// UTILITAIRES
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 15000, ...fetchOptions } = options;
  
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
// PROVIDER: OSRM (Open Source Routing Machine)
// ============================================================

/**
 * Provider OSRM - Serveur public gratuit
 * http://project-osrm.org/docs/v5.24.0/api/
 * 
 * IMPORTANT: Le serveur public est pour démo/test uniquement.
 * Pour la production, utiliser une instance auto-hébergée.
 */
export class OsrmProvider implements IRouteProvider {
  readonly name = 'osrm';
  private lastRequestTime = 0;
  private config: NonNullable<RouteConfig['osrm']>;
  
  constructor(config?: Partial<RouteConfig['osrm']>) {
    this.config = { ...DEFAULT_ROUTE_CONFIG.osrm!, ...config };
  }
  
  async getRoute(from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
    // Rate limiting
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.config.rateLimit) {
      await delay(this.config.rateLimit - elapsed);
    }
    this.lastRequestTime = Date.now();
    
    try {
      // Format OSRM: lon,lat (attention à l'ordre!)
      const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
      const url = `${this.config.baseUrl}/route/v1/${this.config.profile}/${coordinates}?overview=false`;
      
      const response = await fetchWithTimeout(url, {
        headers: {
          'Accept': 'application/json',
        },
        timeout: 15000,
      });
      
      if (!response.ok) {
        return {
          success: false,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        return {
          success: false,
          errorMessage: data.message || 'Aucun itinéraire trouvé',
        };
      }
      
      const route = data.routes[0];
      
      return {
        success: true,
        metrics: {
          distanceKm: route.distance / 1000, // OSRM retourne en mètres
          durationMin: route.duration / 60,  // OSRM retourne en secondes
          provider: this.name,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        errorMessage: message.includes('abort') ? 'Timeout' : message,
      };
    }
  }
}

// ============================================================
// PROVIDER: OpenRouteService
// ============================================================

/**
 * Provider OpenRouteService - Nécessite une clé API gratuite
 * https://openrouteservice.org/dev/#/api-docs
 * 
 * Quota gratuit: 2000 req/jour
 */
export class OpenRouteProvider implements IRouteProvider {
  readonly name = 'openroute';
  private lastRequestTime = 0;
  private config: NonNullable<RouteConfig['openroute']>;
  
  constructor(config?: Partial<RouteConfig['openroute']>) {
    this.config = { ...DEFAULT_ROUTE_CONFIG.openroute!, ...config };
  }
  
  async getRoute(from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
    if (!this.config.apiKey) {
      return {
        success: false,
        errorMessage: 'Clé API OpenRouteService non configurée',
      };
    }
    
    // Rate limiting
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.config.rateLimit) {
      await delay(this.config.rateLimit - elapsed);
    }
    this.lastRequestTime = Date.now();
    
    try {
      const url = `${this.config.baseUrl}/v2/directions/${this.config.profile}`;
      
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.config.apiKey,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
        }),
        timeout: 15000,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          errorMessage: errorData.error?.message || `HTTP ${response.status}`,
        };
      }
      
      const data = await response.json();
      
      if (!data.routes || data.routes.length === 0) {
        return {
          success: false,
          errorMessage: 'Aucun itinéraire trouvé',
        };
      }
      
      const route = data.routes[0].summary;
      
      return {
        success: true,
        metrics: {
          distanceKm: route.distance / 1000,
          durationMin: route.duration / 60,
          provider: this.name,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        errorMessage: message.includes('abort') ? 'Timeout' : message,
      };
    }
  }
}

// ============================================================
// PROVIDER: MOCK (pour les tests)
// ============================================================

/**
 * Provider de test qui estime les trajets
 * Utilise Haversine * facteur pour simuler un trajet routier
 */
export class MockRouteProvider implements IRouteProvider {
  readonly name = 'mock';
  private roadFactor: number;
  private speedKmh: number;
  
  constructor(options?: { roadFactor?: number; speedKmh?: number }) {
    // Facteur multiplicateur pour simuler les détours routiers
    this.roadFactor = options?.roadFactor ?? 1.3;
    // Vitesse moyenne en km/h
    this.speedKmh = options?.speedKmh ?? 50;
  }
  
  async getRoute(from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
    // Simuler un délai réseau
    await delay(50);
    
    // Calculer distance à vol d'oiseau
    const directDistance = haversineDistance(from.lat, from.lon, to.lat, to.lon);
    
    // Appliquer facteur routier
    const roadDistance = directDistance * this.roadFactor;
    
    // Calculer durée
    const durationMin = (roadDistance / this.speedKmh) * 60;
    
    return {
      success: true,
      metrics: {
        distanceKm: Math.round(roadDistance * 100) / 100,
        durationMin: Math.round(durationMin * 10) / 10,
        provider: this.name,
      },
    };
  }
}

// ============================================================
// FACTORY
// ============================================================

/**
 * Crée le provider de routing configuré
 */
export function createRouteProvider(providerName?: string): IRouteProvider {
  const config = getRouteConfig();
  const name = providerName || config.routeProvider;
  
  switch (name) {
    case 'osrm':
      return new OsrmProvider(config.osrm);
    case 'openroute':
      return new OpenRouteProvider(config.openroute);
    case 'mock':
      return new MockRouteProvider();
    default:
      console.warn(`[Route] Provider inconnu: ${name}, utilisation de OSRM`);
      return new OsrmProvider(config.osrm);
  }
}

/**
 * Instance singleton du provider actif
 */
let activeRouteProvider: IRouteProvider | null = null;

export function getRouteProvider(): IRouteProvider {
  if (!activeRouteProvider) {
    activeRouteProvider = createRouteProvider();
  }
  return activeRouteProvider;
}

export function resetRouteProvider(): void {
  activeRouteProvider = null;
}

// ============================================================
// BATCH ROUTING
// ============================================================

export interface BatchRouteRequest {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
}

export interface BatchRouteResult {
  id: string;
  success: boolean;
  metrics?: RouteMetrics;
  errorMessage?: string;
}

/**
 * Calcule plusieurs routes en batch avec throttling
 */
export async function batchGetRoutes(
  requests: BatchRouteRequest[],
  provider: IRouteProvider,
  options?: {
    delayMs?: number;
    onProgress?: (current: number, total: number) => void;
    abortSignal?: AbortSignal;
  }
): Promise<BatchRouteResult[]> {
  const results: BatchRouteResult[] = [];
  const delayMs = options?.delayMs ?? 100;
  
  for (let i = 0; i < requests.length; i++) {
    // Vérifier l'annulation
    if (options?.abortSignal?.aborted) {
      break;
    }
    
    const req = requests[i];
    
    try {
      const result = await provider.getRoute(req.from, req.to);
      results.push({
        id: req.id,
        success: result.success,
        metrics: result.metrics,
        errorMessage: result.errorMessage,
      });
    } catch (error) {
      results.push({
        id: req.id,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erreur',
      });
    }
    
    // Callback de progression
    options?.onProgress?.(i + 1, requests.length);
    
    // Délai entre requêtes (sauf la dernière)
    if (i < requests.length - 1) {
      await delay(delayMs);
    }
  }
  
  return results;
}
