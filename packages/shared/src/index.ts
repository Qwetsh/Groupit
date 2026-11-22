// ============================================================
// SHARED PACKAGE — Export centralisé
// ============================================================

export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
export {
  ensureSignedIn, joinJury, openDashboard, isWriteRefused, SignInError,
  ACCESS_DENIED_MESSAGES, WRITE_REFUSED_MESSAGE,
} from './access';
export { sanitizeSessionCode, SESSION_CODE_MAX_LENGTH } from './sessionCode';
export type { AccessDeniedReason, JoinJuryResult, OpenDashboardResult } from './access';
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
