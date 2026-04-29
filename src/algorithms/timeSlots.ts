// ============================================================
// TIME SLOTS - Calcul des créneaux horaires pour l'oral DNB
// ============================================================

import type { Affectation, Eleve, Jury } from '../domain/models';

// ============ DURÉE PAR TAILLE DE GROUPE ============

/**
 * Retourne la durée de passage en minutes selon la taille du groupe.
 * Solo = 20min, Binôme = 25min, Trinôme = 35min, autre = 20min (fallback).
 */
export function getGroupDuration(size: number): number {
  if (size === 2) return 25;
  if (size === 3) return 35;
  return 20;
}

// ============ TYPES ============

export type DistributionMode = 'fill_first' | 'distribute_evenly';

interface TimeSlot {
  heure: string; // "08:15"
  demiJournee: string; // "jeudi_matin"
}

// ============ CONSTANTES HORAIRES (défauts) ============

const DUREE_PASSAGE_MIN = 20;

/** Créneaux matin par défaut : 08:15 → 12:10 avec pause 10 min au milieu */
const DEFAULT_MATIN_START = { h: 8, m: 15 };
const MATIN_END = { h: 12, m: 10 };

/** Créneaux après-midi par défaut : 13:35 → 16:35 avec pause ~15:30 */
const DEFAULT_APREM_START = { h: 13, m: 35 };
const APREM_END = { h: 16, m: 35 };

/** Parse une heure "HH:MM" en { h, m }. Retourne le défaut si invalide. */
function parseHeure(heure: string | undefined, fallback: { h: number; m: number }): { h: number; m: number } {
  if (!heure) return fallback;
  const [hStr, mStr] = heure.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return fallback;
  return { h, m };
}

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
function generateSlotsForPeriod(type: 'matin' | 'aprem', minSlots?: number, customStart?: { h: number; m: number }): string[] {
  const defaultStart = type === 'matin' ? DEFAULT_MATIN_START : DEFAULT_APREM_START;
  const start = customStart || defaultStart;
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
export function getTimeSlotsForDemiJournee(type: 'matin' | 'aprem', customStart?: string): string[] {
  const start = customStart ? parseHeure(customStart, type === 'matin' ? DEFAULT_MATIN_START : DEFAULT_APREM_START) : undefined;
  return generateSlotsForPeriod(type, undefined, start);
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
  mode: DistributionMode,
  heureDebutMatin?: string,
  heureDebutAprem?: string,
  dureeSupplementaireTiersTemps?: number
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
  const matinStart = parseHeure(heureDebutMatin, DEFAULT_MATIN_START);
  const apremStart = parseHeure(heureDebutAprem, DEFAULT_APREM_START);
  const slotsByDemiJournee = new Map<string, TimeSlot[]>();
  for (const dj of demiJournees) {
    const periodType = getPeriodType(dj);
    const customStart = periodType === 'matin' ? matinStart : apremStart;
    const heures = generateSlotsForPeriod(periodType, slotsNeededPerDj, customStart);
    slotsByDemiJournee.set(dj, heures.map(h => ({ heure: h, demiJournee: dj })));
  }

  const extraTT = dureeSupplementaireTiersTemps || 0;

  // Pour chaque jury, assigner les créneaux avec temps cumulatif réel
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

    // Build ordered passages (group oral members on same slot)
    const assignedIds = new Set<string>();
    interface Passage { affs: Affectation[]; groupSize: number; hasTiersTemps: boolean }
    const passages: Passage[] = [];

    for (const aff of juryAffectations) {
      if (assignedIds.has(aff.eleveId)) continue;
      const eleve = elevesById.get(aff.eleveId);
      const groupAffs: Affectation[] = [aff];
      assignedIds.add(aff.eleveId);

      if (eleve?.groupeOralId) {
        for (const other of juryAffectations) {
          if (!assignedIds.has(other.eleveId)) {
            const otherEleve = elevesById.get(other.eleveId);
            if (otherEleve?.groupeOralId === eleve.groupeOralId) {
              groupAffs.push(other);
              assignedIds.add(other.eleveId);
            }
          }
        }
      }

      const hasTT = groupAffs.some(a => elevesById.get(a.eleveId)?.tiersTemps);
      passages.push({ affs: groupAffs, groupSize: groupAffs.length, hasTiersTemps: hasTT });
    }

    // Distribute passages across demi-journées
    const passagesPerDj: { dj: string; passages: Passage[] }[] = [];
    if (mode === 'fill_first') {
      // Fill each DJ before moving to the next
      let djIdx = 0;
      let remaining = [...passages];
      while (remaining.length > 0 && djIdx < demiJournees.length) {
        const dj = demiJournees[djIdx];
        const periodType = getPeriodType(dj);
        const start = periodType === 'matin' ? matinStart : apremStart;
        const end = periodType === 'matin' ? MATIN_END : APREM_END;
        const availableMin = timeToMinutes(end.h, end.m) - timeToMinutes(start.h, start.m);

        const djPassages: Passage[] = [];
        let usedMin = 0;
        while (remaining.length > 0) {
          const p = remaining[0];
          const dur = getGroupDuration(p.groupSize) + (p.hasTiersTemps ? extraTT : 0);
          if (usedMin + dur > availableMin + 10 && djPassages.length > 0) break; // 10min tolerance
          djPassages.push(remaining.shift()!);
          usedMin += dur;
        }
        if (djPassages.length > 0) passagesPerDj.push({ dj, passages: djPassages });
        djIdx++;
      }
      // Overflow: put remaining in last DJ
      if (remaining.length > 0 && passagesPerDj.length > 0) {
        passagesPerDj[passagesPerDj.length - 1].passages.push(...remaining);
      }
    } else {
      // Distribute evenly
      const perDj = Math.ceil(passages.length / demiJournees.length);
      let idx = 0;
      for (const dj of demiJournees) {
        const djPassages = passages.slice(idx, idx + perDj);
        if (djPassages.length > 0) passagesPerDj.push({ dj, passages: djPassages });
        idx += perDj;
      }
    }

    // Assign actual times with cumulative duration + break
    for (const { dj, passages: djPassages } of passagesPerDj) {
      const periodType = getPeriodType(dj);
      const start = periodType === 'matin' ? matinStart : apremStart;
      let curMin = timeToMinutes(start.h, start.m);
      const halfIdx = Math.floor(djPassages.length / 2);

      for (let pi = 0; pi < djPassages.length; pi++) {
        const passage = djPassages[pi];
        const heure = minutesToTimeStr(curMin);

        for (const aff of passage.affs) {
          updates.set(aff.id, {
            dateCreneau: getDemiJourneeLabel(dj),
            heureCreneau: heure,
          });
        }

        const dur = getGroupDuration(passage.groupSize) + (passage.hasTiersTemps ? extraTT : 0);
        curMin += dur;

        // 10min break after halfway
        if (pi === halfIdx - 1 && djPassages.length >= 4) {
          curMin += 10;
        }
      }
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
  mode: DistributionMode,
  heureDebutMatin?: string,
  heureDebutAprem?: string,
  dureeSupplementaireTiersTemps?: number
): Map<string, { dateCreneau: string; heureCreneau: string }> {
  const targetJurys = allJurys.filter(j => juryIds.includes(j.id!));
  return assignTimeSlots(targetJurys, affectations, eleves, demiJournees, mode, heureDebutMatin, heureDebutAprem, dureeSupplementaireTiersTemps);
}
