// ============================================================
// ALGORITHME - CALCUL DE CAPACITÉ
// ============================================================

import type { Enseignant, CapaciteConfig } from '../domain/models';

/**
 * Calcule la capacité d'un enseignant basée sur ses heures par niveau
 */
export function calculateEnseignantCapacity(
  enseignant: Enseignant,
  config: CapaciteConfig
): number {
  // Si capacité forcée, l'utiliser
  if (enseignant.capaciteBase !== undefined && enseignant.capaciteBase !== null) {
    return enseignant.capaciteBase;
  }

  const { capaciteBaseDefaut, coefficients } = config;

  // Si pas d'heures définies, retourner la capacité de base
  if (!enseignant.heuresParNiveau) {
    return capaciteBaseDefaut;
  }

  const heures = enseignant.heuresParNiveau;
  let capacite = capaciteBaseDefaut;

  // Appliquer les coefficients par niveau
  capacite += Math.round((heures['6e'] || 0) * coefficients['6e']);
  capacite += Math.round((heures['5e'] || 0) * coefficients['5e']);
  capacite += Math.round((heures['4e'] || 0) * coefficients['4e']);
  capacite += Math.round((heures['3e'] || 0) * coefficients['3e']);

  return Math.max(0, Math.round(capacite));
}

/**
 * Calcule un score de charge (0-100) basé sur la charge actuelle vs capacité
 * Plus l'enseignant est disponible, meilleur est le score
 */
export function calculateChargeScore(
  chargeActuelle: number,
  capacite: number
): number {
  if (capacite <= 0) return 0;
  
  const tauxOccupation = chargeActuelle / capacite;
  
  if (tauxOccupation >= 1) return 0; // Déjà à capacité max
  if (tauxOccupation <= 0) return 100; // Complètement disponible
  
  // Score linéaire inversé
  return Math.round(100 * (1 - tauxOccupation));
}

/**
 * Vérifie si un enseignant peut encore accepter des élèves
 */
export function hasAvailableCapacity(
  chargeActuelle: number,
  capacite: number
): boolean {
  return chargeActuelle < capacite;
}

/**
 * Calcule les statistiques de charge pour un ensemble d'enseignants
 */
export function calculateChargeStats(
  enseignants: Enseignant[],
  charges: Map<string, number>,
  config: CapaciteConfig
): {
  totalCapacite: number;
  totalCharge: number;
  tauxOccupationGlobal: number;
  enseignantsSurcharges: string[];
  enseignantsSousCharges: string[];
} {
  let totalCapacite = 0;
  let totalCharge = 0;
  const enseignantsSurcharges: string[] = [];
  const enseignantsSousCharges: string[] = [];

  enseignants.forEach(e => {
    const capacite = calculateEnseignantCapacity(e, config);
    const charge = charges.get(e.id) || 0;
    
    totalCapacite += capacite;
    totalCharge += charge;
    
    if (charge > capacite) {
      enseignantsSurcharges.push(e.id);
    } else if (capacite > 0 && charge < capacite * 0.5) {
      enseignantsSousCharges.push(e.id);
    }
  });

  return {
    totalCapacite,
    totalCharge,
    tauxOccupationGlobal: totalCapacite > 0 ? totalCharge / totalCapacite : 0,
    enseignantsSurcharges,
    enseignantsSousCharges,
  };
}

/**
 * Score d'équilibrage : pénalise les déséquilibres entre enseignants
 */
export function calculateEquilibrageScore(
  charges: Map<string, number>,
  capacites: Map<string, number>
): number {
  const taux: number[] = [];
  
  capacites.forEach((capacite, enseignantId) => {
    if (capacite > 0) {
      const charge = charges.get(enseignantId) || 0;
      taux.push(charge / capacite);
    }
  });
  
  if (taux.length < 2) return 100;
  
  // Calculer l'écart-type des taux d'occupation
  const moyenne = taux.reduce((a, b) => a + b, 0) / taux.length;
  const variance = taux.reduce((acc, t) => acc + Math.pow(t - moyenne, 2), 0) / taux.length;
  const ecartType = Math.sqrt(variance);
  
  // Convertir en score (moins d'écart = meilleur score)
  // Un écart-type de 0 donne 100, un écart-type de 0.5 donne 0
  return Math.max(0, Math.round(100 * (1 - ecartType * 2)));
}
