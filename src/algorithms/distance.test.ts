// ============================================================
// TESTS - CALCUL DE DISTANCE (Haversine)
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateDistance, distanceToScore, communeProximityScore } from './distance';

describe('Distance Utilities', () => {
  // === DONNÉES DE TEST ===

  // Paris (Tour Eiffel)
  const paris = { lat: 48.8584, lon: 2.2945 };

  // Lyon (Place Bellecour)
  const lyon = { lat: 45.7578, lon: 4.8320 };

  // Marseille (Vieux Port)
  const marseille = { lat: 43.2965, lon: 5.3698 };

  // Versailles (proche de Paris)
  const versailles = { lat: 48.8048, lon: 2.1203 };

  // === TESTS calculateDistance ===

  describe('calculateDistance (Haversine)', () => {
    it('distance Paris-Lyon ≈ 390-400 km', () => {
      const distance = calculateDistance(paris.lat, paris.lon, lyon.lat, lyon.lon);

      // Distance réelle Paris-Lyon ≈ 393 km à vol d'oiseau
      expect(distance).toBeGreaterThan(380);
      expect(distance).toBeLessThan(410);
    });

    it('distance Paris-Marseille ≈ 660-680 km', () => {
      const distance = calculateDistance(paris.lat, paris.lon, marseille.lat, marseille.lon);

      // Distance réelle Paris-Marseille ≈ 661 km à vol d'oiseau
      expect(distance).toBeGreaterThan(650);
      expect(distance).toBeLessThan(690);
    });

    it('distance Lyon-Marseille ≈ 275-290 km', () => {
      const distance = calculateDistance(lyon.lat, lyon.lon, marseille.lat, marseille.lon);

      // Distance réelle Lyon-Marseille ≈ 278 km
      expect(distance).toBeGreaterThan(270);
      expect(distance).toBeLessThan(300);
    });

    it('distance Paris-Versailles ≈ 15-20 km', () => {
      const distance = calculateDistance(paris.lat, paris.lon, versailles.lat, versailles.lon);

      // Distance réelle ≈ 17 km
      expect(distance).toBeGreaterThan(14);
      expect(distance).toBeLessThan(22);
    });

    it('distance 0 pour même point', () => {
      const distance = calculateDistance(paris.lat, paris.lon, paris.lat, paris.lon);

      expect(distance).toBe(0);
    });

    it('symétrique: A→B = B→A', () => {
      const parisLyon = calculateDistance(paris.lat, paris.lon, lyon.lat, lyon.lon);
      const lyonParis = calculateDistance(lyon.lat, lyon.lon, paris.lat, paris.lon);

      expect(parisLyon).toBe(lyonParis);
    });

    it('respecte inégalité triangulaire', () => {
      const parisLyon = calculateDistance(paris.lat, paris.lon, lyon.lat, lyon.lon);
      const lyonMarseille = calculateDistance(lyon.lat, lyon.lon, marseille.lat, marseille.lon);
      const parisMarseille = calculateDistance(paris.lat, paris.lon, marseille.lat, marseille.lon);

      // Paris-Marseille direct ≤ Paris-Lyon + Lyon-Marseille
      expect(parisMarseille).toBeLessThanOrEqual(parisLyon + lyonMarseille + 0.1); // +0.1 pour erreurs d'arrondi
    });
  });

  // === TESTS distanceToScore ===

  describe('distanceToScore', () => {
    it('distance 0 → score 100', () => {
      const score = distanceToScore(0);
      expect(score).toBe(100);
    });

    it('distance = maxDistance → score 0', () => {
      const score = distanceToScore(50, 50);
      expect(score).toBe(0);
    });

    it('distance > maxDistance → score 0', () => {
      const score = distanceToScore(100, 50);
      expect(score).toBe(0);
    });

    it('distance négative → score 100', () => {
      const score = distanceToScore(-5);
      expect(score).toBe(100);
    });

    it('score linéaire: 25km sur max 50km → score 50', () => {
      const score = distanceToScore(25, 50);
      expect(score).toBe(50);
    });

    it('score linéaire: 10km sur max 50km → score 80', () => {
      const score = distanceToScore(10, 50);
      expect(score).toBe(80);
    });

    it('utilise maxDistance par défaut de 50', () => {
      const score1 = distanceToScore(25);
      const score2 = distanceToScore(25, 50);
      expect(score1).toBe(score2);
    });
  });

  // === TESTS communeProximityScore ===

  describe('communeProximityScore', () => {
    it('même commune → score 100', () => {
      const score = communeProximityScore('Paris', 'Paris');
      expect(score).toBe(100);
    });

    it('même commune avec casse différente → score 100', () => {
      const score = communeProximityScore('PARIS', 'paris');
      expect(score).toBe(100);
    });

    it('même commune avec accents → score 100', () => {
      const score = communeProximityScore('Évry', 'Evry');
      expect(score).toBe(100);
    });

    it('commune différente → score 30', () => {
      const score = communeProximityScore('Paris', 'Lyon');
      expect(score).toBe(30);
    });

    it('commune vide → score 50 (neutre)', () => {
      const score1 = communeProximityScore('', 'Paris');
      const score2 = communeProximityScore('Paris', '');

      expect(score1).toBe(50);
      expect(score2).toBe(50);
    });

    it('commune undefined → score 50 (neutre)', () => {
      const score = communeProximityScore(undefined, 'Paris');
      expect(score).toBe(50);
    });

    it('même département (code postal) → score 70', () => {
      // 75001 et 75020 → même département 75
      const score = communeProximityScore('Paris 75001', 'Paris 75020');
      expect(score).toBeGreaterThanOrEqual(70);
    });
  });

  // === TESTS de cohérence globale ===

  describe('Cohérence distance → score', () => {
    it('plus proche = meilleur score', () => {
      const distPV = calculateDistance(paris.lat, paris.lon, versailles.lat, versailles.lon);
      const distPL = calculateDistance(paris.lat, paris.lon, lyon.lat, lyon.lon);

      const scorePV = distanceToScore(distPV, 500);
      const scorePL = distanceToScore(distPL, 500);

      // Versailles plus proche → meilleur score
      expect(scorePV).toBeGreaterThan(scorePL);
    });
  });
});
