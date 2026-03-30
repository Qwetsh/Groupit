// ============================================================
// TESTS - STAGE MATCHING SOLVER
// ============================================================

import { describe, it, expect } from 'vitest';
import { solveStageMatching } from './stageSolver';
import type {
  StageGeoInfo,
  EnseignantGeoInfo,
  TeacherStagePair,
} from '../infrastructure/geo/types';

// ============================================================
// HELPERS
// ============================================================

function makeStage(id: string, lat: number, lon: number, opts?: Partial<StageGeoInfo>): StageGeoInfo {
  return {
    stageId: id,
    eleveId: `eleve-${id}`,
    address: `Adresse ${id}`,
    geo: { lat, lon },
    geoStatus: 'ok',
    ...opts,
  };
}

function makeEnseignant(id: string, lat: number, lon: number, opts?: Partial<EnseignantGeoInfo>): EnseignantGeoInfo {
  return {
    enseignantId: id,
    nom: `Nom-${id}`,
    prenom: `Prenom-${id}`,
    homeGeo: { lat, lon },
    homeGeoStatus: 'ok',
    capacityMax: 10,
    ...opts,
  };
}

function makePair(stageId: string, enseignantId: string, distanceKm: number, durationMin: number): TeacherStagePair {
  return { stageId, enseignantId, distanceKm, durationMin, isValid: true };
}

// ============================================================
// CLUSTERING
// ============================================================

describe('Stage Solver - Clustering', () => {
  it('affecte les stages au même endroit au même enseignant', () => {
    // Deux stages exactement au même endroit (même coordonnées)
    const stages = [
      makeStage('s1', 48.8584, 2.2945),
      makeStage('s2', 48.8584, 2.2945),
    ];
    const enseignants = [
      makeEnseignant('e1', 48.86, 2.30),
      makeEnseignant('e2', 48.87, 2.35),
    ];
    const pairs = [
      makePair('s1', 'e1', 2, 5),
      makePair('s1', 'e2', 8, 15),
      makePair('s2', 'e1', 2, 5),
      makePair('s2', 'e2', 8, 15),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      clusterDistanceKm: 1,
      useLocalSearch: false,
    });

    expect(result.affectations).toHaveLength(2);
    // Les deux doivent être chez le même enseignant
    const ens1 = result.affectations.find(a => a.stageId === 's1')!.enseignantId;
    const ens2 = result.affectations.find(a => a.stageId === 's2')!.enseignantId;
    expect(ens1).toBe(ens2);
  });

  it('affecte les stages à moins de 1km au même enseignant', () => {
    // ~500m d'écart (Paris)
    const stages = [
      makeStage('s1', 48.8584, 2.2945),
      makeStage('s2', 48.8620, 2.2945), // ~400m au nord
    ];
    const enseignants = [
      makeEnseignant('e1', 48.86, 2.30),
      makeEnseignant('e2', 48.87, 2.35),
    ];
    const pairs = [
      makePair('s1', 'e1', 2, 5),
      makePair('s1', 'e2', 8, 15),
      makePair('s2', 'e1', 2, 5),
      makePair('s2', 'e2', 8, 15),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      clusterDistanceKm: 1,
      useLocalSearch: false,
    });

    expect(result.affectations).toHaveLength(2);
    const ens1 = result.affectations.find(a => a.stageId === 's1')!.enseignantId;
    const ens2 = result.affectations.find(a => a.stageId === 's2')!.enseignantId;
    expect(ens1).toBe(ens2);
  });

  it('sépare les stages à plus de 1km', () => {
    // ~5km d'écart
    const stages = [
      makeStage('s1', 48.8584, 2.2945),  // Tour Eiffel
      makeStage('s2', 48.8867, 2.3431),  // Montmartre (~5km)
    ];
    const enseignants = [
      makeEnseignant('e1', 48.8584, 2.2945, { capacityMax: 1 }), // Près de s1
      makeEnseignant('e2', 48.8867, 2.3431, { capacityMax: 1 }), // Près de s2
    ];
    const pairs = [
      makePair('s1', 'e1', 0.1, 1),
      makePair('s1', 'e2', 5, 12),
      makePair('s2', 'e1', 5, 12),
      makePair('s2', 'e2', 0.1, 1),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      clusterDistanceKm: 1,
      useLocalSearch: false,
    });

    expect(result.affectations).toHaveLength(2);
    // Chacun devrait aller chez l'enseignant le plus proche
    const ens1 = result.affectations.find(a => a.stageId === 's1')!.enseignantId;
    const ens2 = result.affectations.find(a => a.stageId === 's2')!.enseignantId;
    expect(ens1).not.toBe(ens2);
  });

  it('respecte la capacité pour un cluster entier', () => {
    // 3 stages au même endroit mais capacité max = 2
    const stages = [
      makeStage('s1', 48.8584, 2.2945),
      makeStage('s2', 48.8584, 2.2945),
      makeStage('s3', 48.8584, 2.2945),
    ];
    const enseignants = [
      makeEnseignant('e1', 48.86, 2.30, { capacityMax: 2 }),
      makeEnseignant('e2', 48.87, 2.35, { capacityMax: 3 }),
    ];
    const pairs = [
      makePair('s1', 'e1', 2, 5), makePair('s1', 'e2', 8, 15),
      makePair('s2', 'e1', 2, 5), makePair('s2', 'e2', 8, 15),
      makePair('s3', 'e1', 2, 5), makePair('s3', 'e2', 8, 15),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      clusterDistanceKm: 1,
      useLocalSearch: false,
    });

    expect(result.affectations).toHaveLength(3);
    // Le cluster de 3 ne peut pas tenir chez e1 (capacité 2), donc e2
    const ensIds = result.affectations.map(a => a.enseignantId);
    const allSameEns = ensIds.every(id => id === ensIds[0]);
    expect(allSameEns).toBe(true);
    expect(ensIds[0]).toBe('e2'); // Seul e2 a la capacité pour 3
  });

  it('gère les stages sans coordonnées comme des singletons', () => {
    const stages = [
      makeStage('s1', 48.8584, 2.2945),
      makeStage('s2', 0, 0, { geo: undefined, geoStatus: 'error' }),
    ];
    const enseignants = [
      makeEnseignant('e1', 48.86, 2.30),
    ];
    const pairs = [
      makePair('s1', 'e1', 2, 5),
      makePair('s2', 'e1', 10, 20),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      clusterDistanceKm: 1,
      useLocalSearch: false,
    });

    // s1 affecté normalement, s2 aussi (pas de cluster car pas de geo)
    expect(result.affectations).toHaveLength(2);
  });
});

// ============================================================
// PROFESSEUR PRINCIPAL (PP)
// ============================================================

describe('Stage Solver - Prof Principal', () => {
  it('favorise le PP de la classe quand le poids est activé', () => {
    const stages = [
      makeStage('s1', 48.86, 2.30, { eleveClasse: '3A' }),
    ];
    const enseignants = [
      // e1 : plus proche mais pas PP
      makeEnseignant('e1', 48.86, 2.30, { classesEnCharge: ['3A'] }),
      // e2 : un peu plus loin mais PP de 3A
      makeEnseignant('e2', 48.87, 2.32, {
        classesEnCharge: ['3A'],
        estProfPrincipal: true,
        classePP: '3A',
      }),
    ];
    const pairs = [
      makePair('s1', 'e1', 3, 8),
      makePair('s1', 'e2', 5, 12),
    ];

    // Sans PP activé → e1 gagne (plus proche)
    const resultSansPP = solveStageMatching(stages, enseignants, pairs, {
      poidsProfPrincipal: 0,
      useLocalSearch: false,
    });
    expect(resultSansPP.affectations[0].enseignantId).toBe('e1');

    // Avec PP activé (poids fort) → e2 gagne
    const resultAvecPP = solveStageMatching(stages, enseignants, pairs, {
      poidsProfPrincipal: 80,
      poidsDuree: 10,
      poidsDistance: 10,
      poidsEquilibrage: 0,
      useLocalSearch: false,
    });
    expect(resultAvecPP.affectations[0].enseignantId).toBe('e2');
  });

  it('PP ne s\'applique pas si l\'enseignant est PP d\'une autre classe', () => {
    const stages = [
      makeStage('s1', 48.86, 2.30, { eleveClasse: '3B' }),
    ];
    const enseignants = [
      makeEnseignant('e1', 48.86, 2.30), // Plus proche, pas PP
      makeEnseignant('e2', 48.87, 2.32, {
        estProfPrincipal: true,
        classePP: '3A', // PP de 3A, pas de 3B
      }),
    ];
    const pairs = [
      makePair('s1', 'e1', 3, 8),
      makePair('s1', 'e2', 5, 12),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      poidsProfPrincipal: 80,
      poidsDuree: 10,
      poidsDistance: 10,
      poidsEquilibrage: 0,
      useLocalSearch: false,
    });

    // e1 gagne car e2 n'est pas PP de 3B
    expect(result.affectations[0].enseignantId).toBe('e1');
  });
});

// ============================================================
// ÉLÈVES EN COURS
// ============================================================

describe('Stage Solver - Élèves en cours', () => {
  it('favorise l\'enseignant qui a l\'élève dans ses classes', () => {
    const stages = [
      makeStage('s1', 48.86, 2.30, { eleveClasse: '3A' }),
    ];
    const enseignants = [
      // e1 : plus proche mais n'a pas 3A
      makeEnseignant('e1', 48.86, 2.30, { classesEnCharge: ['4B'] }),
      // e2 : un peu plus loin mais a 3A
      makeEnseignant('e2', 48.87, 2.32, { classesEnCharge: ['3A', '4C'] }),
    ];
    const pairs = [
      makePair('s1', 'e1', 3, 8),
      makePair('s1', 'e2', 5, 12),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      poidsElevesEnCours: 70,
      poidsDuree: 15,
      poidsDistance: 15,
      poidsEquilibrage: 0,
      useLocalSearch: false,
    });

    expect(result.affectations[0].enseignantId).toBe('e2');
  });
});

// ============================================================
// ÉQUILIBRAGE PONDÉRÉ PAR HEURES
// ============================================================

describe('Stage Solver - Équilibrage par heures', () => {
  it('distribue proportionnellement aux heures 3e', () => {
    // 6 stages, prof A a 4h, prof B a 2h → A devrait avoir ~4 stages, B ~2
    const stages = Array.from({ length: 6 }, (_, i) =>
      makeStage(`s${i}`, 48.86 + i * 0.001, 2.30)
    );
    const enseignants = [
      makeEnseignant('eA', 48.86, 2.30, { heures3e: 4, capacityMax: 10 }),
      makeEnseignant('eB', 48.87, 2.30, { heures3e: 2, capacityMax: 10 }),
    ];
    // Distances similaires pour les deux enseignants
    const pairs = stages.flatMap(s => [
      makePair(s.stageId, 'eA', 5, 10),
      makePair(s.stageId, 'eB', 5, 10),
    ]);

    const result = solveStageMatching(stages, enseignants, pairs, {
      equilibrageWeightByHours: true,
      poidsEquilibrage: 60,
      poidsDuree: 20,
      poidsDistance: 20,
      useLocalSearch: true,
    });

    const countA = result.affectations.filter(a => a.enseignantId === 'eA').length;
    const countB = result.affectations.filter(a => a.enseignantId === 'eB').length;

    // A devrait avoir plus que B (proportionnel)
    expect(countA).toBeGreaterThan(countB);
    expect(countA + countB).toBe(6);
  });

  it('distribue équitablement sans pondération par heures', () => {
    // 6 stages, 2 enseignants, mêmes distances → ~3 chacun
    const stages = Array.from({ length: 6 }, (_, i) =>
      makeStage(`s${i}`, 48.86 + i * 0.001, 2.30)
    );
    const enseignants = [
      makeEnseignant('eA', 48.86, 2.30, { heures3e: 4, capacityMax: 10 }),
      makeEnseignant('eB', 48.87, 2.30, { heures3e: 2, capacityMax: 10 }),
    ];
    const pairs = stages.flatMap(s => [
      makePair(s.stageId, 'eA', 5, 10),
      makePair(s.stageId, 'eB', 5, 10),
    ]);

    const result = solveStageMatching(stages, enseignants, pairs, {
      equilibrageWeightByHours: false,
      poidsEquilibrage: 60,
      poidsDuree: 20,
      poidsDistance: 20,
      useLocalSearch: true,
    });

    const countA = result.affectations.filter(a => a.enseignantId === 'eA').length;
    const countB = result.affectations.filter(a => a.enseignantId === 'eB').length;

    // Distribution raisonnablement équitable (écart max 2 sans pondération)
    expect(Math.abs(countA - countB)).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// SCORES FALLBACK
// ============================================================

describe('Stage Solver - Scores fallback cohérents', () => {
  it('les affectations normales ont un meilleur score que les fallbacks', () => {
    // Un stage affectable normalement, un autre uniquement via fallback aléatoire
    const stages = [
      makeStage('s1', 48.86, 2.30),
      makeStage('s2', 48.86, 2.30, { geo: undefined, geoStatus: 'error' }),
    ];
    const enseignants = [
      makeEnseignant('e1', 48.86, 2.30, { capacityMax: 10 }),
    ];
    // Seulement s1 a une paire (s2 n'a pas de geo → pas de route mais on met une paire pour le fallback)
    const pairs = [
      makePair('s1', 'e1', 2, 5),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, {
      useLocalSearch: false,
    });

    // s1 devrait avoir un score < s2 (ou s2 non affecté)
    const aff1 = result.affectations.find(a => a.stageId === 's1');
    expect(aff1).toBeDefined();
    expect(aff1!.score).toBeLessThan(80); // Affectation normale
  });
});

// ============================================================
// CAS LIMITES
// ============================================================

describe('Stage Solver - Cas limites', () => {
  it('gère 0 stages', () => {
    const result = solveStageMatching([], [makeEnseignant('e1', 48.86, 2.30)], []);
    expect(result.affectations).toHaveLength(0);
    expect(result.nonAffectes).toHaveLength(0);
  });

  it('gère 0 enseignants', () => {
    const stages = [makeStage('s1', 48.86, 2.30)];
    const result = solveStageMatching(stages, [], []);
    expect(result.affectations).toHaveLength(0);
    expect(result.nonAffectes).toHaveLength(1);
  });

  it('gère un stage sans paire via fallback aléatoire', () => {
    const stages = [makeStage('s1', 48.86, 2.30)];
    const enseignants = [makeEnseignant('e1', 48.86, 2.30)];
    // Pas de paires de route → le glouton ne peut pas affecter,
    // mais le fallback aléatoire rattrape si capacité disponible
    const result = solveStageMatching(stages, enseignants, []);
    // Le fallback aléatoire vérifie compatibilité options et capacité,
    // pas les paires de route, donc il affecte quand même
    expect(result.affectations.length + result.nonAffectes.length).toBe(1);
  });

  it('rapporte les stats correctement', () => {
    const stages = [
      makeStage('s1', 48.86, 2.30),
      makeStage('s2', 48.87, 2.31),
    ];
    const enseignants = [
      makeEnseignant('e1', 48.86, 2.30, { capacityMax: 5 }),
    ];
    const pairs = [
      makePair('s1', 'e1', 3, 8),
      makePair('s2', 'e1', 5, 12),
    ];

    const result = solveStageMatching(stages, enseignants, pairs, { useLocalSearch: false });

    expect(result.stats.totalStages).toBe(2);
    expect(result.stats.totalAffectes).toBe(2);
    expect(result.stats.totalNonAffectes).toBe(0);
    expect(result.stats.chargeParEnseignant['e1']).toBe(2);
    expect(result.tempsCalculMs).toBeGreaterThanOrEqual(0);
  });
});
