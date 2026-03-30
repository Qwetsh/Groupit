// ============================================================
// TIME SLOTS - Calcul des créneaux horaires pour l'oral DNB
// ============================================================

import type { Affectation, Eleve, Jury } from '../domain/models';

// ============ TYPES ============

export type DistributionMode = 'fill_first' | 'distribute_evenly';

interface TimeSlot {
  heure: string; // "08:15"
  demiJournee: string; // "jeudi_matin"
}

// ============ CONSTANTES HORAIRES ============

const DUREE_PASSAGE_MIN = 20;

/** Créneaux matin : 08:15 → 12:10 avec pause 10 min au milieu */
const MATIN_START = { h: 8, m: 15 };
const MATIN_END = { h: 12, m: 10 };

/** Créneaux après-midi : 13:35 → 16:35 avec pause ~15:30 */
const APREM_START = { h: 13, m: 35 };
const APREM_END = { h: 16, m: 35 };

// ============ HELPERS ============

function timeToMinutes(h: number, m: number): number {
  return h * 60 + m;
}

function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Génère les créneaux horaires pour une demi-journée (matin ou après-midi).
 * Insère une pause de 10 min au milieu de la plage.
 * Si minSlots est fourni et dépasse la capacité de la plage, génère des
 * créneaux supplémentaires au-delà de l'heure de fin prévue.
 */
function generateSlotsForPeriod(type: 'matin' | 'aprem', minSlots?: number): string[] {
  const start = type === 'matin' ? MATIN_START : APREM_START;
  const end = type === 'matin' ? MATIN_END : APREM_END;

  const startMin = timeToMinutes(start.h, start.m);
  const endMin = timeToMinutes(end.h, end.m);
  const totalAvailable = endMin - startMin;

  // Nombre de créneaux sans pause (dans la plage nominale)
  const slotsWithoutBreak = Math.floor(totalAvailable / DUREE_PASSAGE_MIN);

  // Si on demande plus de créneaux que la plage ne le permet, on dépasse
  const targetSlots = minSlots ? Math.max(slotsWithoutBreak, minSlots) : slotsWithoutBreak;

  // Point milieu pour la pause (après la moitié des créneaux nominaux)
  const halfSlots = Math.floor(slotsWithoutBreak / 2);

  const slots: string[] = [];
  let currentMin = startMin;

  for (let i = 0; i < targetSlots; i++) {
    slots.push(minutesToTimeStr(currentMin));
    currentMin += DUREE_PASSAGE_MIN;

    // Insérer la pause après la moitié des créneaux nominaux
    if (i === halfSlots - 1) {
      currentMin += 10; // 10 min de pause
    }
  }

  return slots;
}

/**
 * Retourne les créneaux horaires pour un type de demi-journée.
 */
export function getTimeSlotsForDemiJournee(type: 'matin' | 'aprem'): string[] {
  return generateSlotsForPeriod(type);
}

/**
 * Extrait le type de période ('matin' ou 'aprem') depuis un ID de demi-journée.
 */
function getPeriodType(demiJourneeId: string): 'matin' | 'aprem' {
  return demiJourneeId.endsWith('_matin') ? 'matin' : 'aprem';
}

/**
 * Label lisible pour une demi-journée (ex: "jeudi_matin" → "Jeudi matin").
 */
export function getDemiJourneeLabel(id: string): string {
  const parts = id.split('_');
  const jour = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const periode = parts[1] === 'matin' ? 'matin' : 'après-midi';
  return `${jour} ${periode}`;
}

// ============ ASSIGNATION PRINCIPALE ============

/**
 * Assigne des créneaux horaires aux affectations d'oral DNB.
 *
 * @param jurys - Les jurys du scénario
 * @param affectations - Les affectations existantes
 * @param eleves - Tous les élèves
 * @param demiJournees - Les demi-journées configurées (ex: ['jeudi_matin', 'jeudi_aprem'])
 * @param mode - Mode de distribution ('fill_first' ou 'distribute_evenly')
 * @returns Map<affectationId, { dateCreneau, heureCreneau }> — les métadonnées à mettre à jour
 */
export function assignTimeSlots(
  jurys: Jury[],
  affectations: Affectation[],
  eleves: Eleve[],
  demiJournees: string[],
  mode: DistributionMode
): Map<string, { dateCreneau: string; heureCreneau: string }> {
  const updates = new Map<string, { dateCreneau: string; heureCreneau: string }>();

  if (demiJournees.length === 0 || jurys.length === 0) return updates;

  // Estimer le nombre max d'élèves par jury pour dimensionner les créneaux
  const elevesById = new Map(eleves.map(e => [e.id, e]));
  let maxElevesPerJury = 0;
  for (const jury of jurys) {
    const count = affectations.filter(a => a.juryId === jury.id).length;
    if (count > maxElevesPerJury) maxElevesPerJury = count;
  }
  // En fill_first, tous les élèves pourraient finir dans la 1ère demi-journée
  const slotsNeededPerDj = mode === 'fill_first' ? maxElevesPerJury : Math.ceil(maxElevesPerJury / Math.max(demiJournees.length, 1));

  // Pré-calculer les créneaux pour chaque demi-journée (avec overflow si nécessaire)
  const slotsByDemiJournee = new Map<string, TimeSlot[]>();
  for (const dj of demiJournees) {
    const periodType = getPeriodType(dj);
    const heures = generateSlotsForPeriod(periodType, slotsNeededPerDj);
    slotsByDemiJournee.set(dj, heures.map(h => ({ heure: h, demiJournee: dj })));
  }

  // Pour chaque jury, assigner les créneaux
  for (const jury of jurys) {
    // Récupérer les affectations de ce jury, triées par nom d'élève (alphabétique)
    const juryAffectations = affectations
      .filter(a => a.juryId === jury.id)
      .sort((a, b) => {
        const eleveA = elevesById.get(a.eleveId);
        const eleveB = elevesById.get(b.eleveId);
        if (!eleveA || !eleveB) return 0;
        const cmp = eleveA.nom.localeCompare(eleveB.nom, 'fr');
        return cmp !== 0 ? cmp : eleveA.prenom.localeCompare(eleveB.prenom, 'fr');
      });

    if (juryAffectations.length === 0) continue;

    // Distribuer les élèves dans les demi-journées selon le mode
    const distribution = distributeStudents(juryAffectations.length, demiJournees, slotsByDemiJournee, mode);

    // Assigner les créneaux (binômes = même créneau, durée doublée → saute un slot)
    let slotIdx = 0;
    const assignedIds = new Set<string>();

    for (let i = 0; i < juryAffectations.length; i++) {
      const aff = juryAffectations[i];
      if (assignedIds.has(aff.eleveId)) continue;

      const slot = distribution[slotIdx];
      if (!slot) break;

      const eleve = elevesById.get(aff.eleveId);
      const isBinome = eleve?.binomeId != null;

      updates.set(aff.id, {
        dateCreneau: getDemiJourneeLabel(slot.demiJournee),
        heureCreneau: slot.heure,
      });
      assignedIds.add(aff.eleveId);

      // Si binôme, assigner le partenaire au même créneau
      if (isBinome) {
        const partnerAff = juryAffectations.find(a => a.eleveId === eleve!.binomeId);
        if (partnerAff && !assignedIds.has(partnerAff.eleveId)) {
          updates.set(partnerAff.id, {
            dateCreneau: getDemiJourneeLabel(slot.demiJournee),
            heureCreneau: slot.heure,
          });
          assignedIds.add(partnerAff.eleveId);
          // Sauter un créneau supplémentaire (durée doublée)
          slotIdx++;
        }
      }

      slotIdx++;
    }
  }

  return updates;
}

/**
 * Distribue N élèves dans les demi-journées disponibles.
 */
function distributeStudents(
  count: number,
  demiJournees: string[],
  slotsByDemiJournee: Map<string, TimeSlot[]>,
  mode: DistributionMode
): TimeSlot[] {
  const allSlots: TimeSlot[] = [];

  if (mode === 'fill_first') {
    // Remplir chaque demi-journée avant de passer à la suivante
    for (const dj of demiJournees) {
      const slots = slotsByDemiJournee.get(dj) || [];
      allSlots.push(...slots);
      if (allSlots.length >= count) break;
    }
  } else {
    // Répartir équitablement entre les demi-journées
    const perDj = Math.ceil(count / demiJournees.length);

    for (let djIdx = 0; djIdx < demiJournees.length; djIdx++) {
      const slots = slotsByDemiJournee.get(demiJournees[djIdx]) || [];
      const take = Math.min(perDj, slots.length, count - allSlots.length);
      allSlots.push(...slots.slice(0, take));
      if (allSlots.length >= count) break;
    }
  }

  return allSlots.slice(0, count);
}

/**
 * Recalcule les créneaux pour un ou plusieurs jurys spécifiques.
 * Utilisé après un swap d'élève entre jurys.
 */
export function recalcTimeSlotsForJurys(
  juryIds: string[],
  allJurys: Jury[],
  affectations: Affectation[],
  eleves: Eleve[],
  demiJournees: string[],
  mode: DistributionMode
): Map<string, { dateCreneau: string; heureCreneau: string }> {
  const targetJurys = allJurys.filter(j => juryIds.includes(j.id!));
  return assignTimeSlots(targetJurys, affectations, eleves, demiJournees, mode);
}
