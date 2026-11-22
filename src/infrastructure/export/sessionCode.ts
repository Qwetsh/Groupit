// ============================================================
// CODE DE SESSION — génération
// ============================================================
//
// Le code de session ouvre la notation en ligne aux jurys. Choisi à la main
// (« ORAL2026 »), il se devine en quelques essais ; tiré au hasard, non.
// Les jurys ne le saisissent pas : il est dans le QR code de leur convocation.

import { sanitizeSessionCode, SESSION_CODE_MAX_LENGTH } from '@groupit/shared/sessionCode';

/** Lettres et chiffres sans ambiguïté à la lecture : ni 0/O, ni 1/I/L. */
export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const SESSION_CODE_MIN_LENGTH = 4;

// Le nettoyage d'un code est commun aux trois applications (packages/shared).
export { sanitizeSessionCode };

/** Tire un code de session au hasard (générateur cryptographique du navigateur). */
export function generateSessionCode(length: number = SESSION_CODE_MAX_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => SESSION_CODE_ALPHABET[b % SESSION_CODE_ALPHABET.length]).join('');
}

/** Affiche un code en deux groupes de quatre, plus facile à recopier. */
export function formatCodeForDisplay(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
