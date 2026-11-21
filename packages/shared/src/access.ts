// ============================================================
// ACCÈS AUX SESSIONS — connexion et points d'entrée
// ============================================================
//
// Aucune table n'est lisible sans avoir d'abord présenté le code d'une
// session à l'une des fonctions ci-dessous. Voir
// `supabase/migrations/20261121230000_groupit_access_model.sql`.

import { supabase } from './supabase';
import type { CriteriaConfig } from './criteria';

/** Raisons de refus renvoyées par les fonctions d'accès. */
export type AccessDeniedReason =
  | 'invalid_code'
  | 'jury_not_found'
  | 'locked'
  | 'direction_code_required'
  | 'too_many_attempts';

export const ACCESS_DENIED_MESSAGES: Record<AccessDeniedReason, string> = {
  invalid_code: 'Code de session invalide',
  jury_not_found: 'Numéro de jury introuvable',
  locked: 'Cette session est verrouillée par la direction. La notation n\'est plus possible.',
  direction_code_required: 'Le code direction est nécessaire pour ouvrir cette session depuis ce poste.',
  too_many_attempts: 'Trop d\'essais. Patientez une dizaine de minutes avant de réessayer.',
};

/**
 * Garantit une connexion anonyme, en réutilisant celle du navigateur si elle
 * existe. Ne jamais se reconnecter d'office : l'identité anonyme porte les
 * droits (emplacement de juré, propriété d'une session), une nouvelle
 * connexion les ferait perdre.
 */
export async function ensureSignedIn(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error('Erreur de connexion');
}

export type JoinJuryResult =
  | { ok: true; sessionId: string; juryId: string; slot: 'A' | 'B'; criteriaConfig: CriteriaConfig | null }
  | { ok: false; reason: AccessDeniedReason };

/** Rejoint un jury avec le code de session et le numéro de jury. */
export async function joinJury(code: string, juryNumber: number): Promise<JoinJuryResult> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('join_jury', {
    p_code: code,
    p_jury_number: juryNumber,
  });
  if (error || !data) throw new Error('Impossible de rejoindre le jury');
  if (!data.ok) return { ok: false, reason: data.reason as AccessDeniedReason };
  return {
    ok: true,
    sessionId: data.session_id,
    juryId: data.jury_id,
    slot: data.slot,
    criteriaConfig: (data.criteria_config as CriteriaConfig | null) ?? null,
  };
}

export type OpenDashboardResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: AccessDeniedReason };

/**
 * Ouvre le tableau de bord d'une session.
 * Le code direction est inutile sur le poste qui a créé la session, et sur
 * un poste où il a déjà été saisi.
 */
export async function openDashboard(code: string, directionCode?: string): Promise<OpenDashboardResult> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('open_dashboard', {
    p_code: code,
    p_direction_code: directionCode?.trim() || null,
  });
  if (error || !data) throw new Error('Impossible d\'ouvrir la session');
  if (!data.ok) return { ok: false, reason: data.reason as AccessDeniedReason };
  return { ok: true, sessionId: data.session_id };
}

/** Message affiché quand le serveur refuse d'enregistrer une note. */
export const WRITE_REFUSED_MESSAGE =
  'Note non enregistrée : la session est verrouillée, ou ce jury a été repris sur un autre appareil.';

/**
 * Vrai si le serveur a refusé l'écriture (session verrouillée, jury quitté).
 * Ce n'est pas une panne de réseau : inutile de réessayer.
 */
export function isWriteRefused(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '42501';
}

/**
 * Nettoie un code de session saisi ou collé : majuscules, sans espace ni
 * tiret, 8 caractères au plus.
 */
export function sanitizeSessionCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
