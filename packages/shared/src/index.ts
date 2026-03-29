// ============================================================
// SHARED PACKAGE — Export centralisé
// ============================================================

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
export type { Database } from './database.types';
export type {
  ExamSessionRow, SessionJuryRow, JuryMemberRow,
  SessionEleveRow, EvaluationRow, FinalScoreRow,
  EvaluationInsert, FinalScoreInsert,
} from './database.types';
export {
  CRITERIA,
  DEFAULT_CRITERIA_CONFIG,
  LEVEL_SHORT,
  MAX_TOTAL,
  MAX_ORAL,
  MAX_SUJET,
  TIMER_INDIVIDUEL,
  TIMER_COLLECTIF,
  computeTotals,
  computeCategoryTotals,
  computeMaxTotal,
  computeMaxByCategory,
  allCriteriaScored,
  getDisagreements,
  validateCriteriaConfig,
  toCriterion,
} from './criteria';
export type {
  Criterion,
  CriterionLevel,
  CriteriaConfig,
  CriteriaCategory,
  CriterionConfig,
} from './criteria';
