// ============================================================
// SHARED PACKAGE — Export centralisé
// ============================================================

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
export type { Database } from './database.types';
export type {
  ExamSessionRow, SessionJuryRow, JuryMemberRow,
  SessionEleveRow, EvaluationRow, FinalScoreRow,
} from './database.types';
export {
  CRITERIA,
  LEVEL_SHORT,
  MAX_TOTAL,
  MAX_ORAL,
  MAX_SUJET,
  TIMER_INDIVIDUEL,
  TIMER_COLLECTIF,
  computeTotals,
  allCriteriaScored,
  getDisagreements,
} from './criteria';
export type { Criterion, CriterionLevel } from './criteria';
