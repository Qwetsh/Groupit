// ============================================================
// ALGORITHME - SOLVEUR GREEDY + AMÉLIORATION LOCALE
// ============================================================

import type {
  Eleve,
  Enseignant,
  Scenario,
  Affectation,
  AffectationMetadata,
  SolverResult,
  MatchingResult,
} from '../domain/models';
import { calculateEnseignantCapacity } from './capacity';
import { validateHardConstraints, scorePair, evaluateAllPairs, type ScoringContext } from './scoring';

// ============ TYPES ============

interface SolverConfig {
  maxIterations: number;
  localSearchIterations: number;
  verbose: boolean;
}

const DEFAULT_CONFIG: SolverConfig = {
  maxIterations: 1000,
  localSearchIterations: 100,
  verbose: false,
};

// ============ INITIALISATION DU CONTEXTE ============

function createScoringContext(
  scenario: Scenario,
  enseignants: Enseignant[],
  existingAffectations: Map<string, string> = new Map() // eleveId -> enseignantId
): ScoringContext {
  const capaciteConfig = scenario.parametres.capaciteConfig;
  
  // Calculer les capacités
  const capacites = new Map<string, number>();
  enseignants.forEach(e => {
    capacites.set(e.id, calculateEnseignantCapacity(e, capaciteConfig));
  });
  
  // Calculer les charges actuelles
  const chargesActuelles = new Map<string, number>();
  enseignants.forEach(e => chargesActuelles.set(e.id, 0));
  
  existingAffectations.forEach((enseignantId) => {
    const current = chargesActuelles.get(enseignantId) || 0;
    chargesActuelles.set(enseignantId, current + 1);
  });
  
  return { scenario, chargesActuelles, capacites };
}

// ============ SOLVEUR GREEDY ============

/**
 * Algorithme greedy : affecte les élèves un par un au meilleur enseignant disponible
 */
export function solveGreedy(
  eleves: Eleve[],
  enseignants: Enseignant[],
  scenario: Scenario,
  metadataMap: Map<string, AffectationMetadata> = new Map(),
  config: Partial<SolverConfig> = {}
): SolverResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Initialiser le contexte
  const context = createScoringContext(scenario, enseignants);
  
  // Résultats
  const affectations: MatchingResult[] = [];
  const nonAffectes: string[] = [];
  let iterations = 0;
  
  // Évaluer toutes les paires une fois
  const allPairs = evaluateAllPairs(eleves, enseignants, context, metadataMap);
  
  // Créer une copie mutable des charges
  const charges = new Map(context.chargesActuelles);
  const capacites = context.capacites;
  
  // Trier les élèves par "difficulté" (moins d'options valides = plus prioritaire)
  const elevesOrdered = [...eleves].sort((a, b) => {
    const validA = allPairs.filter(p => p.eleveId === a.id && p.isValid).length;
    const validB = allPairs.filter(p => p.eleveId === b.id && p.isValid).length;
    return validA - validB; // Les plus contraints d'abord
  });
  
  // Affecter chaque élève
  for (const eleve of elevesOrdered) {
    if (iterations >= cfg.maxIterations) break;
    iterations++;
    
    // Trouver le meilleur enseignant disponible
    const candidates = allPairs
      .filter(p => p.eleveId === eleve.id && p.isValid)
      .filter(p => {
        const charge = charges.get(p.enseignantId) || 0;
        const cap = capacites.get(p.enseignantId) || 0;
        return charge < cap;
      })
      .sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0) {
      const best = candidates[0];
      
      // Affecter
      affectations.push(best);
      
      // Mettre à jour la charge
      const currentCharge = charges.get(best.enseignantId) || 0;
      charges.set(best.enseignantId, currentCharge + 1);
    } else {
      nonAffectes.push(eleve.id);
      
      if (cfg.verbose) {
        console.log(`Aucun enseignant disponible pour ${eleve.prenom} ${eleve.nom}`);
      }
    }
  }
  
  // Calculer le score global
  const scoreGlobal = affectations.length > 0
    ? Math.round(affectations.reduce((sum, a) => sum + a.score, 0) / affectations.length)
    : 0;
  
  const endTime = performance.now();
  
  return {
    affectations,
    nonAffectes,
    conflits: [], // Pas de conflits dans greedy simple
    scoreGlobal,
    tempsCalculMs: Math.round(endTime - startTime),
    iterations,
  };
}

// ============ AMÉLIORATION LOCALE (2-OPT) ============

/**
 * Amélioration par échanges locaux (2-opt)
 * Tente d'échanger des affectations entre élèves pour améliorer le score global
 */
export function improveWithLocalSearch(
  initialResult: SolverResult,
  eleves: Eleve[],
  enseignants: Enseignant[],
  scenario: Scenario,
  metadataMap: Map<string, AffectationMetadata> = new Map(),
  config: Partial<SolverConfig> = {}
): SolverResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Copier les affectations
  let currentAffectations = [...initialResult.affectations];
  let currentScore = initialResult.scoreGlobal;
  let improved = true;
  let iterations = 0;
  
  // Map élève -> enseignant pour accès rapide
  const eleveToEnseignant = new Map<string, string>();
  currentAffectations.forEach(a => eleveToEnseignant.set(a.eleveId, a.enseignantId));
  
  // Map enseignant -> élèves
  const enseignantToEleves = new Map<string, string[]>();
  enseignants.forEach(e => enseignantToEleves.set(e.id, []));
  currentAffectations.forEach(a => {
    const list = enseignantToEleves.get(a.enseignantId) || [];
    list.push(a.eleveId);
    enseignantToEleves.set(a.enseignantId, list);
  });
  
  // Créer le contexte de scoring
  const context = createScoringContext(scenario, enseignants, eleveToEnseignant);
  
  while (improved && iterations < cfg.localSearchIterations) {
    improved = false;
    iterations++;
    
    // Essayer tous les échanges possibles
    for (let i = 0; i < currentAffectations.length && !improved; i++) {
      for (let j = i + 1; j < currentAffectations.length && !improved; j++) {
        const aff1 = currentAffectations[i];
        const aff2 = currentAffectations[j];
        
        // Vérifier si l'échange est valide et améliore le score
        const eleve1 = eleves.find(e => e.id === aff1.eleveId)!;
        const eleve2 = eleves.find(e => e.id === aff2.eleveId)!;
        const ens1 = enseignants.find(e => e.id === aff1.enseignantId)!;
        const ens2 = enseignants.find(e => e.id === aff2.enseignantId)!;
        
        // Simuler l'échange
        const meta1 = metadataMap.get(eleve1.id);
        const meta2 = metadataMap.get(eleve2.id);
        
        // Valider les nouvelles paires
        const valid1 = validateHardConstraints(eleve1, ens2, context, meta1);
        const valid2 = validateHardConstraints(eleve2, ens1, context, meta2);
        
        if (valid1.isValid && valid2.isValid) {
          // Calculer les nouveaux scores
          const newScore1 = scorePair(eleve1, ens2, context, meta1);
          const newScore2 = scorePair(eleve2, ens1, context, meta2);
          
          const oldScoreSum = aff1.score + aff2.score;
          const newScoreSum = newScore1.score + newScore2.score;
          
          if (newScoreSum > oldScoreSum) {
            // Appliquer l'échange
            currentAffectations[i] = {
              ...aff1,
              enseignantId: ens2.id,
              score: newScore1.score,
              scoreDetail: newScore1.breakdown,
              violations: [],
              isValid: true,
            };
            
            currentAffectations[j] = {
              ...aff2,
              enseignantId: ens1.id,
              score: newScore2.score,
              scoreDetail: newScore2.breakdown,
              violations: [],
              isValid: true,
            };
            
            // Mettre à jour le score global
            currentScore = Math.round(
              currentAffectations.reduce((sum, a) => sum + a.score, 0) / currentAffectations.length
            );
            
            improved = true;
            
            if (cfg.verbose) {
              console.log(`Swap améliorant: score ${oldScoreSum} -> ${newScoreSum}`);
            }
          }
        }
      }
    }
  }
  
  const endTime = performance.now();
  
  return {
    ...initialResult,
    affectations: currentAffectations,
    scoreGlobal: currentScore,
    tempsCalculMs: initialResult.tempsCalculMs + Math.round(endTime - startTime),
    iterations: initialResult.iterations + iterations,
  };
}

// ============ SOLVEUR PRINCIPAL ============

/**
 * Résout le matching complet avec greedy + amélioration locale
 */
export function solveMatching(
  eleves: Eleve[],
  enseignants: Enseignant[],
  scenario: Scenario,
  metadataMap: Map<string, AffectationMetadata> = new Map(),
  config: Partial<SolverConfig> = {}
): SolverResult {
  // Phase 1: Greedy
  const greedyResult = solveGreedy(eleves, enseignants, scenario, metadataMap, config);
  
  // Phase 2: Amélioration locale
  const improvedResult = improveWithLocalSearch(
    greedyResult,
    eleves,
    enseignants,
    scenario,
    metadataMap,
    config
  );
  
  return improvedResult;
}

// ============ UTILITAIRES ============

/**
 * Convertit les résultats du solveur en affectations prêtes pour la DB
 */
export function convertToAffectations(
  results: MatchingResult[],
  scenario: Scenario,
  metadataMap: Map<string, AffectationMetadata> = new Map()
): Omit<Affectation, 'id' | 'createdAt' | 'updatedAt'>[] {
  return results
    .filter(r => r.isValid)
    .map(r => ({
      eleveId: r.eleveId,
      enseignantId: r.enseignantId,
      scenarioId: scenario.id,
      type: scenario.type === 'suivi_stage' ? 'suivi_stage' as const :
            scenario.type === 'oral_dnb' ? 'oral_dnb' as const : 'autre' as const,
      metadata: metadataMap.get(r.eleveId) || {},
      scoreDetail: r.scoreDetail,
      scoreTotal: r.score,
    }));
}
