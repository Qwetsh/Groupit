// ============================================================
// TESTS - CALCUL DE DISTANCE (Haversine)
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateDistance } from './distance';

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
});
