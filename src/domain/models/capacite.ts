// ============================================================
// CALCUL DES CAPACITÉS ENSEIGNANTS
// ============================================================

import { getHeuresMatiere } from './matieres';
import type { ScenarioType } from './types';

/** Capacité maximale souhaitée par enseignant (6 élèves max si possible) */
const CAPACITE_MAX_SOUHAITEE = 6;

/** Capacité minimale pour un enseignant ayant des 3èmes */
const CAPACITE_MIN = 1;

/**
 * Calcule la capacité de stage pour chaque enseignant basée sur:
 * - Le nombre de classes de 3ème qu'il enseigne
 * - Les heures hebdomadaires de sa matière en 3ème
 * - Un plafond de 6 élèves max par enseignant (si possible)
 *
 * Formule:
 * 1. poids_prof = heures_matière × nb_classes_3e
 * 2. capacité_brute = round((poids_prof / poids_total) × nb_élèves_3e)
 * 3. plafond = max(6, ceil(nb_élèves / nb_profs_3e)) pour couvrir tous les élèves
 * 4. capacité_finale = min(capacité_brute, plafond), minimum 1
 *
 * @param enseignants Liste des enseignants
 * @param eleves Liste des élèves (pour compter les 3èmes)
 * @returns Map<enseignantId, capaciteCalculee>
 */
export function calculateCapacitesStage(
  enseignants: { id?: string; matierePrincipale: string; classesEnCharge?: string[]; heures3eReelles?: number }[],
  eleves: { classe: string }[]
): Map<string, number> {
  const result = new Map<string, number>();

  // Compter les élèves de 3ème
  const nb3e = eleves.filter(e => e.classe.startsWith('3')).length;

  if (nb3e === 0) {
    // Pas d'élèves de 3ème, capacité 0 pour tous
    enseignants.forEach(e => {
      if (e.id) result.set(e.id, 0);
    });
    return result;
  }

  // Calculer le poids de chaque enseignant
  const poidsParEnseignant = new Map<string, number>();
  let poidsTotalGlobal = 0;

  for (const ens of enseignants) {
    if (!ens.id) continue;

    // Compter les classes de 3ème de cet enseignant
    const nbClasses3e = (ens.classesEnCharge || []).filter(c => c.startsWith('3')).length;

    if (nbClasses3e === 0) {
      // Pas de 3ème => capacité 0
      result.set(ens.id, 0);
      continue;
    }

    // Utiliser heures3eReelles si renseigné, sinon calcul automatique
    let poids: number;
    if (ens.heures3eReelles !== undefined && ens.heures3eReelles > 0) {
      // Heures réelles saisies manuellement (pour groupes multi-classes)
      poids = ens.heures3eReelles;
    } else {
      // Calcul automatique: heures de la matière × nombre de classes de 3e
      const heures = getHeuresMatiere(ens.matierePrincipale);
      poids = heures * nbClasses3e;
    }

    poidsParEnseignant.set(ens.id, poids);
    poidsTotalGlobal += poids;
  }

  // Nombre d'enseignants ayant des 3èmes
  const nbProfs3e = poidsParEnseignant.size;

  if (nbProfs3e === 0 || poidsTotalGlobal === 0) {
    return result;
  }

  // Calculer le plafond: 6 si possible, sinon le minimum nécessaire pour couvrir tous les élèves
  const capaciteMoyenneRequise = Math.ceil(nb3e / nbProfs3e);
  const plafond = Math.max(CAPACITE_MAX_SOUHAITEE, capaciteMoyenneRequise);

  // Phase 1: Calculer les capacités brutes selon les poids
  const capacitesBrutes = new Map<string, number>();
  for (const [ensId, poids] of poidsParEnseignant) {
    // Utiliser round au lieu de ceil pour une répartition plus équilibrée
    const capaciteBrute = Math.round((poids / poidsTotalGlobal) * nb3e);
    capacitesBrutes.set(ensId, capaciteBrute);
  }

  // Phase 2: Plafonner et s'assurer d'un minimum de 1
  let totalCapacite = 0;
  for (const [ensId, capaciteBrute] of capacitesBrutes) {
    const capacite = Math.max(CAPACITE_MIN, Math.min(capaciteBrute, plafond));
    result.set(ensId, capacite);
    totalCapacite += capacite;
  }

  // Phase 3: Ajuster si le total ne couvre pas tous les élèves
  // (peut arriver à cause des arrondis)
  let deficit = nb3e - totalCapacite;

  if (deficit > 0) {
    // Trier par poids décroissant pour donner la priorité aux profs avec plus de charge
    const enseignantsTriesParPoids = Array.from(poidsParEnseignant.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [ensId] of enseignantsTriesParPoids) {
      if (deficit <= 0) break;
      const capaciteActuelle = result.get(ensId)!;
      if (capaciteActuelle < plafond) {
        const ajout = Math.min(deficit, plafond - capaciteActuelle);
        result.set(ensId, capaciteActuelle + ajout);
        deficit -= ajout;
      }
    }

    // Si toujours en déficit (tous au plafond), augmenter le plafond pour les plus chargés
    if (deficit > 0) {
      for (const [ensId] of enseignantsTriesParPoids) {
        if (deficit <= 0) break;
        const capaciteActuelle = result.get(ensId)!;
        result.set(ensId, capaciteActuelle + 1);
        deficit -= 1;
      }
    }
  }

  return result;
}

/**
 * Retourne la capacité de stage d'un enseignant individuel
 */
export function getCapaciteStageCalculee(
  enseignant: { id?: string; matierePrincipale: string; classesEnCharge?: string[] },
  enseignants: { id?: string; matierePrincipale: string; classesEnCharge?: string[] }[],
  eleves: { classe: string }[]
): number {
  if (!enseignant.id) return 0;
  const capacites = calculateCapacitesStage(enseignants, eleves);
  return capacites.get(enseignant.id) ?? 0;
}

/**
 * Retourne la capacité effective d'un enseignant selon le type de scénario
 * @param enseignant L'enseignant
 * @param scenarioType Le type de scénario ('oral_dnb' ou 'suivi_stage')
 * @param defaultValue Valeur par défaut si non définie
 */
export function getEnseignantCapacite(
  enseignant: { capaciteBase?: number; capaciteStage?: number },
  scenarioType: ScenarioType,
  defaultValue = 5
): number {
  if (scenarioType === 'suivi_stage') {
    return enseignant.capaciteStage ?? defaultValue;
  }
  // oral_dnb et autres
  return enseignant.capaciteBase ?? defaultValue;
}
