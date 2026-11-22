// ============================================================
// CODE DE SESSION — nettoyage
// ============================================================
//
// Module sans dépendance (ni client Supabase, ni variables d'environnement) :
// il peut être importé seul, y compris depuis des tests.

/** Longueur maximale d'un code de session (VARCHAR(8) en base). */
export const SESSION_CODE_MAX_LENGTH = 8;

/**
 * Nettoie un code de session saisi ou collé : majuscules, sans espace ni
 * tiret, 8 caractères au plus. C'est ce que le serveur accepte.
 */
export function sanitizeSessionCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, SESSION_CODE_MAX_LENGTH);
}
