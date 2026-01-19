// ============================================================
// ALGORITHME - CALCUL DE DISTANCE
// ============================================================

/**
 * Calcule la distance en km entre deux points GPS (formule de Haversine)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Convertit une distance en score (0-100)
 * Plus la distance est courte, meilleur est le score
 */
export function distanceToScore(distance: number, maxDistance: number = 50): number {
  if (distance <= 0) return 100;
  if (distance >= maxDistance) return 0;
  
  // Score linéaire inversé
  return Math.round(100 * (1 - distance / maxDistance));
}

/**
 * Calcule un score de proximité basé sur la commune/ville
 * Retourne un score approximatif si pas de coordonnées GPS
 */
export function communeProximityScore(commune1?: string, commune2?: string): number {
  if (!commune1 || !commune2) return 50; // Score neutre si pas d'info
  
  const normalized1 = normalizeCommune(commune1);
  const normalized2 = normalizeCommune(commune2);
  
  if (normalized1 === normalized2) return 100; // Même commune
  
  // Vérifier si même département (2 premiers chiffres du code postal)
  const dept1 = extractDepartement(commune1);
  const dept2 = extractDepartement(commune2);
  
  if (dept1 && dept2 && dept1 === dept2) return 70; // Même département
  
  return 30; // Différent
}

function normalizeCommune(commune: string): string {
  return commune
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(le|la|les|l)\s*/i, '');
}

function extractDepartement(commune: string): string | null {
  const match = commune.match(/\b(\d{2})\d{3}\b/);
  return match ? match[1] : null;
}
