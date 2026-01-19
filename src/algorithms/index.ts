// ============================================================
// ALGORITHMS INDEX - Export centralisé
// ============================================================

export { calculateDistance, distanceToScore, communeProximityScore } from './distance';
export {
  calculateEnseignantCapacity,
  calculateChargeScore,
  hasAvailableCapacity,
  calculateChargeStats,
  calculateEquilibrageScore,
} from './capacity';
export {
  validateHardConstraints,
  scorePair,
  evaluateAllPairs,
  findBestMatchesForEleve,
  type ScoringContext,
  type ValidationResult,
  type ScoreResult,
} from './scoring';
export {
  solveGreedy,
  improveWithLocalSearch,
  solveMatching,
  convertToAffectations,
} from './solver';
export {
  solveOralDnb,
  solveOralDnbComplete,
  improveOralDnbWithSwaps,
} from './solverDnb';
export {
  solveStageMatching,
  toStageGeoInfo,
  toEnseignantGeoInfo,
} from './stageSolver';
