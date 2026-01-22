// ============================================================
// TESTS - UTILITAIRES D'ÉQUILIBRAGE
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  calculateTargetLoad,
  calculateRelativeLoad,
  calculateBalancingPenalty,
  calculateBalancingScore,
  calculateGlobalImbalance,
  type BalancingEntity,
  type BalancingOptions,
} from './balancing';

describe('Balancing Utilities', () => {
  // === DONNÉES DE TEST ===
  
  // Enseignant A: 1h/semaine avec les 3e
  const enseignantA: BalancingEntity = { id: 'A', currentLoad: 0, heuresParSemaine: 1 };
  
  // Enseignant B: 4h/semaine avec les 3e (4x plus)
  const enseignantB: BalancingEntity = { id: 'B', currentLoad: 0, heuresParSemaine: 4 };
  
  // Enseignant C: heures non renseignées (utilise fallback)
  const enseignantC: BalancingEntity = { id: 'C', currentLoad: 0, heuresParSemaine: 0 };
  
  const allEntities = [enseignantA, enseignantB, enseignantC];
  
  const defaultOptions: BalancingOptions = {
    weightByHours: false,
    totalToAssign: 10,
    defaultHours: 1,
  };
  
  const weightedOptions: BalancingOptions = {
    weightByHours: true,
    totalToAssign: 12, // 12 élèves pour avoir des nombres ronds
    defaultHours: 1,
  };
  
  // === TESTS calculateTargetLoad ===
  
  describe('calculateTargetLoad', () => {
    it('répartit également sans pondération', () => {
      // 10 élèves / 3 enseignants = 3.33 chacun
      const targetA = calculateTargetLoad(enseignantA, allEntities, defaultOptions);
      const targetB = calculateTargetLoad(enseignantB, allEntities, defaultOptions);
      
      expect(targetA).toBeCloseTo(10 / 3);
      expect(targetB).toBeCloseTo(10 / 3);
      expect(targetA).toBe(targetB); // Égalité stricte
    });
    
    it('pondère par heures avec weightByHours=true', () => {
      // Heures: A=1, B=4, C=1 (fallback) → total = 6
      // 12 élèves à répartir
      // A: 1/6 * 12 = 2
      // B: 4/6 * 12 = 8
      // C: 1/6 * 12 = 2
      const targetA = calculateTargetLoad(enseignantA, allEntities, weightedOptions);
      const targetB = calculateTargetLoad(enseignantB, allEntities, weightedOptions);
      const targetC = calculateTargetLoad(enseignantC, allEntities, weightedOptions);
      
      expect(targetA).toBeCloseTo(2);
      expect(targetB).toBeCloseTo(8);
      expect(targetC).toBeCloseTo(2); // Fallback à 1h
    });
    
    it('B reçoit 4x plus que A avec pondération', () => {
      const targetA = calculateTargetLoad(enseignantA, allEntities, weightedOptions);
      const targetB = calculateTargetLoad(enseignantB, allEntities, weightedOptions);
      
      // B a 4x les heures de A → devrait recevoir 4x plus
      expect(targetB / targetA).toBeCloseTo(4);
    });
    
    it('utilise le fallback pour heures=0', () => {
      const targetC = calculateTargetLoad(enseignantC, allEntities, weightedOptions);
      
      // C utilise fallback=1h, comme A
      expect(targetC).toBeCloseTo(2);
    });
  });
  
  // === TESTS calculateRelativeLoad ===
  
  describe('calculateRelativeLoad', () => {
    it('retourne 1.0 quand charge = cible', () => {
      // Avec pondération, cible A = 2
      const entityA = { ...enseignantA, currentLoad: 2 };
      const relLoad = calculateRelativeLoad(entityA, allEntities, weightedOptions);
      
      expect(relLoad).toBeCloseTo(1.0);
    });
    
    it('retourne 2.0 quand charge = 2x cible', () => {
      // Cible A = 2, charge = 4
      const entityA = { ...enseignantA, currentLoad: 4 };
      const relLoad = calculateRelativeLoad(entityA, allEntities, weightedOptions);
      
      expect(relLoad).toBeCloseTo(2.0);
    });
    
    it('traite équitablement A et B avec pondération', () => {
      // A avec 2 élèves et B avec 8 élèves → même charge relative (1.0)
      const entityA = { ...enseignantA, currentLoad: 2 };
      const entityB = { ...enseignantB, currentLoad: 8 };
      const entities = [entityA, entityB, enseignantC];
      
      const relLoadA = calculateRelativeLoad(entityA, entities, weightedOptions);
      const relLoadB = calculateRelativeLoad(entityB, entities, weightedOptions);
      
      // Les deux sont à leur cible respective
      expect(relLoadA).toBeCloseTo(1.0);
      expect(relLoadB).toBeCloseTo(1.0);
    });
  });
  
  // === TESTS calculateBalancingPenalty ===
  
  describe('calculateBalancingPenalty', () => {
    it('pénalité 0 si à la cible', () => {
      const entityA = { ...enseignantA, currentLoad: 2 };
      const result = calculateBalancingPenalty(entityA, allEntities, weightedOptions);
      
      expect(result.penalty).toBe(0);
      expect(result.isOverloaded).toBe(false);
    });
    
    it('pénalité croissante si au-dessus de la cible', () => {
      // Cible A = 2
      const at50Over = { ...enseignantA, currentLoad: 3 }; // 1.5x cible
      const at100Over = { ...enseignantA, currentLoad: 4 }; // 2x cible
      
      const result50 = calculateBalancingPenalty(at50Over, allEntities, weightedOptions);
      const result100 = calculateBalancingPenalty(at100Over, allEntities, weightedOptions);
      
      expect(result50.penalty).toBeCloseTo(50);
      expect(result100.penalty).toBeCloseTo(100);
      expect(result50.isOverloaded).toBe(true);
    });
    
    it('pas de pénalité si en dessous de la cible', () => {
      const entityA = { ...enseignantA, currentLoad: 1 }; // sous la cible de 2
      const result = calculateBalancingPenalty(entityA, allEntities, weightedOptions);
      
      expect(result.penalty).toBe(0);
      expect(result.isOverloaded).toB
      e(false);
    });
  });
  
  // === TESTS calculateBalancingScore ===
  
  describe('calculateBalancingScore', () => {
    it('score 100 si peu chargé', () => {
      const score = calculateBalancingScore('A', 0, 1, allEntities, weightedOptions);
      
      expect(score).toBe(100);
    });
    
    it('score 0 si très surchargé', () => {
      // Cible A = 2, charge = 4 (2x) → pénalité 100 → score 0
      const score = calculateBalancingScore('A', 4, 1, allEntities, weightedOptions);
      
      expect(score).toBe(0);
    });
    
    it('B accepte plus d\'élèves que A avant pénalité avec pondération', () => {
      // A avec 1h → cible ≈ 2, pénalité à partir de 2
      // B avec 4h → cible ≈ 8, pénalité à partir de 8
      
      // À 4 élèves:
      const scoreA_at4 = calculateBalancingScore('A', 4, 1, allEntities, weightedOptions);
      const scoreB_at4 = calculateBalancingScore('B', 4, 4, allEntities, weightedOptions);
      
      // A est surchargé (4 > 2), B est sous-chargé (4 < 8)
      expect(scoreB_at4).toBeGreaterThan(scoreA_at4);
      expect(scoreB_at4).toBe(100); // B pas encore pénalisé
      expect(scoreA_at4).toBeLessThan(100); // A déjà pénalisé
    });
  });
  
  // === TESTS sans vs avec pondération ===
  
  describe('Comparaison sans/avec pondération', () => {
    it('sans pondération, A et B ont mêmes cibles', () => {
      const targetA = calculateTargetLoad(enseignantA, allEntities, defaultOptions);
      const targetB = calculateTargetLoad(enseignantB, allEntities, defaultOptions);
      
      expect(targetA).toBe(targetB);
    });
    
    it('avec pondération, B a cible 4x supérieure', () => {
      const targetA = calculateTargetLoad(enseignantA, allEntities, weightedOptions);
      const targetB = calculateTargetLoad(enseignantB, allEntities, weightedOptions);
      
      expect(targetB).toBeGreaterThan(targetA);
      expect(targetB / targetA).toBeCloseTo(4);
    });
    
    it('pondération change le résultat de pénalité', () => {
      // Même charge pour A et B
      const entityA = { ...enseignantA, currentLoad: 3 };
      const entityB = { ...enseignantB, currentLoad: 3 };
      const entities = [entityA, entityB];
      
      // Sans pondération: même pénalité (même charge, même cible)
      const penaltyA_off = calculateBalancingPenalty(entityA, entities, { ...defaultOptions, totalToAssign: 6 });
      const penaltyB_off = calculateBalancingPenalty(entityB, entities, { ...defaultOptions, totalToAssign: 6 });
      
      // Avec pondération: A surchargé (cible=1.2), B sous-chargé (cible=4.8)
      const penaltyA_on = calculateBalancingPenalty(entityA, entities, { ...weightedOptions, totalToAssign: 6 });
      const penaltyB_on = calculateBalancingPenalty(entityB, entities, { ...weightedOptions, totalToAssign: 6 });
      
      // Sans pondération: pénalités égales
      expect(penaltyA_off.penalty).toBe(penaltyB_off.penalty);
      
      // Avec pondération: A très pénalisé, B pas du tout
      expect(penaltyA_on.penalty).toBeGreaterThan(0);
      expect(penaltyB_on.penalty).toBe(0);
      expect(penaltyA_on.isOverloaded).toBe(true);
      expect(penaltyB_on.isOverloaded).toBe(false);
    });
  });
  
  // === TEST calculateGlobalImbalance ===
  
  describe('calculateGlobalImbalance', () => {
    it('retourne 0 si parfait équilibre', () => {
      // A: 2 élèves (cible 2), B: 8 élèves (cible 8)
      const entities = [
        { ...enseignantA, currentLoad: 2 },
        { ...enseignantB, currentLoad: 8 },
      ];
      
      const imbalance = calculateGlobalImbalance(entities, weightedOptions);
      
      expect(imbalance).toBeCloseTo(0);
    });
    
    it('retourne > 0 si déséquilibre', () => {
      // A: 5 élèves (cible 2), B: 5 élèves (cible 8)
      const entities = [
        { ...enseignantA, currentLoad: 5 },
        { ...enseignantB, currentLoad: 5 },
      ];
      
      const imbalance = calculateGlobalImbalance(entities, weightedOptions);
      
      expect(imbalance).toBeGreaterThan(0);
    });
  });
});
