// ============================================================
// TESTS - CRÉNEAUX HORAIRES (durées groupes + assignation)
// ============================================================

import { describe, it, expect } from 'vitest';
import { getGroupDuration, assignTimeSlots, getTimeSlotsForDemiJournee } from './timeSlots';
import type { Eleve, Jury, Affectation } from '../domain/models';

describe('Time Slots', () => {
  // === TESTS getGroupDuration ===

  describe('getGroupDuration', () => {
    it('solo (size 1) → 20 min', () => {
      expect(getGroupDuration(1)).toBe(20);
    });

    it('binôme (size 2) → 25 min', () => {
      expect(getGroupDuration(2)).toBe(25);
    });

    it('trinôme (size 3) → 35 min', () => {
      expect(getGroupDuration(3)).toBe(35);
    });

    it('size 0 → 20 min (fallback)', () => {
      expect(getGroupDuration(0)).toBe(20);
    });

    it('size 4+ → 20 min (fallback)', () => {
      expect(getGroupDuration(4)).toBe(20);
      expect(getGroupDuration(10)).toBe(20);
    });
  });

  // === TESTS getTimeSlotsForDemiJournee ===

  describe('getTimeSlotsForDemiJournee', () => {
    it('matin génère des créneaux à partir de 08:15', () => {
      const slots = getTimeSlotsForDemiJournee('matin');
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe('08:15');
    });

    it('après-midi génère des créneaux à partir de 13:35', () => {
      const slots = getTimeSlotsForDemiJournee('aprem');
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe('13:35');
    });

    it('matin inclut une pause de 10 min au milieu', () => {
      const slots = getTimeSlotsForDemiJournee('matin');
      // Vérifier qu'il y a un gap de 30min (20 passage + 10 pause) entre 2 créneaux consécutifs au milieu
      let foundBreak = false;
      for (let i = 1; i < slots.length; i++) {
        const [h1, m1] = slots[i - 1].split(':').map(Number);
        const [h2, m2] = slots[i].split(':').map(Number);
        const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff === 30) {
          foundBreak = true;
          break;
        }
      }
      expect(foundBreak).toBe(true);
    });
  });

  // === HELPERS pour assignTimeSlots ===

  const createEleve = (id: string, overrides: Partial<Eleve> = {}): Eleve => ({
    id,
    nom: `Nom${id}`,
    prenom: `Prenom${id}`,
    classe: '3A',
    niveau: '3e',
    customFields: {},
    options: [],
    tags: [],
    contraintes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createJury = (id: string): Jury => ({
    id,
    scenarioId: 's1',
    nom: `Jury ${id}`,
    enseignantIds: [],
    capaciteMax: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createAffectation = (id: string, eleveId: string, juryId: string): Affectation => ({
    id,
    eleveId,
    enseignantId: '',
    juryId,
    scenarioId: 's1',
    type: 'oral_dnb',
    scoreTotal: 80,
    scoreDetail: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // === TESTS assignTimeSlots ===

  describe('assignTimeSlots', () => {
    it('solos → chaque élève occupe 1 créneau', () => {
      const jurys = [createJury('j1')];
      const eleves = [
        createEleve('e1'),
        createEleve('e2'),
        createEleve('e3'),
      ];
      const affectations = [
        createAffectation('a1', 'e1', 'j1'),
        createAffectation('a2', 'e2', 'j1'),
        createAffectation('a3', 'e3', 'j1'),
      ];

      const updates = assignTimeSlots(jurys, affectations, eleves, ['jeudi_matin'], 'fill_first');

      expect(updates.size).toBe(3);

      // Chaque élève a un créneau différent
      const heures = new Set(Array.from(updates.values()).map(u => u.heureCreneau));
      expect(heures.size).toBe(3);
    });

    it('binôme → même créneau + 2 slots consommés', () => {
      const jurys = [createJury('j1')];
      const eleves = [
        createEleve('e1', { groupeOralId: 'g1' }),
        createEleve('e2', { groupeOralId: 'g1' }),
        createEleve('e3'), // solo après le binôme
      ];
      const affectations = [
        createAffectation('a1', 'e1', 'j1'),
        createAffectation('a2', 'e2', 'j1'),
        createAffectation('a3', 'e3', 'j1'),
      ];

      const updates = assignTimeSlots(jurys, affectations, eleves, ['jeudi_matin'], 'fill_first');

      expect(updates.size).toBe(3);

      // Binôme a le même créneau
      const e1Update = updates.get('a1')!;
      const e2Update = updates.get('a2')!;
      expect(e1Update.heureCreneau).toBe(e2Update.heureCreneau);

      // Le solo a un créneau différent, décalé de 2 slots (binôme = 25min → ceil(25/20) = 2 slots)
      const e3Update = updates.get('a3')!;
      expect(e3Update.heureCreneau).not.toBe(e1Update.heureCreneau);
    });

    it('trinôme → même créneau + 2 slots consommés', () => {
      const jurys = [createJury('j1')];
      const eleves = [
        createEleve('e1', { groupeOralId: 'g1' }),
        createEleve('e2', { groupeOralId: 'g1' }),
        createEleve('e3', { groupeOralId: 'g1' }),
        createEleve('e4'), // solo après
      ];
      const affectations = [
        createAffectation('a1', 'e1', 'j1'),
        createAffectation('a2', 'e2', 'j1'),
        createAffectation('a3', 'e3', 'j1'),
        createAffectation('a4', 'e4', 'j1'),
      ];

      const updates = assignTimeSlots(jurys, affectations, eleves, ['jeudi_matin'], 'fill_first');

      expect(updates.size).toBe(4);

      // Trinôme a le même créneau
      const trinomeHeure = updates.get('a1')!.heureCreneau;
      expect(updates.get('a2')!.heureCreneau).toBe(trinomeHeure);
      expect(updates.get('a3')!.heureCreneau).toBe(trinomeHeure);

      // Solo a un créneau différent
      expect(updates.get('a4')!.heureCreneau).not.toBe(trinomeHeure);
    });

    it('distribute_evenly répartit entre demi-journées', () => {
      const jurys = [createJury('j1')];
      const eleves = [
        createEleve('e1'),
        createEleve('e2'),
        createEleve('e3'),
        createEleve('e4'),
      ];
      const affectations = [
        createAffectation('a1', 'e1', 'j1'),
        createAffectation('a2', 'e2', 'j1'),
        createAffectation('a3', 'e3', 'j1'),
        createAffectation('a4', 'e4', 'j1'),
      ];

      const updates = assignTimeSlots(
        jurys, affectations, eleves,
        ['jeudi_matin', 'jeudi_aprem'],
        'distribute_evenly'
      );

      expect(updates.size).toBe(4);

      // Vérifier qu'il y a des élèves dans les deux demi-journées
      const dates = new Set(Array.from(updates.values()).map(u => u.dateCreneau));
      expect(dates.size).toBe(2);
    });

    it('retourne Map vide si pas de demi-journées', () => {
      const jurys = [createJury('j1')];
      const eleves = [createEleve('e1')];
      const affectations = [createAffectation('a1', 'e1', 'j1')];

      const updates = assignTimeSlots(jurys, affectations, eleves, [], 'fill_first');

      expect(updates.size).toBe(0);
    });

    it('retourne Map vide si pas de jurys', () => {
      const eleves = [createEleve('e1')];
      const affectations = [createAffectation('a1', 'e1', 'j1')];

      const updates = assignTimeSlots([], affectations, eleves, ['jeudi_matin'], 'fill_first');

      expect(updates.size).toBe(0);
    });
  });
});
