import { isWriteRefused } from '@groupit/shared';

/**
 * Relance une écriture Supabase qui échoue (réseau instable en salle
 * d'examen) : jusqu'à `maxRetries` nouvelles tentatives, espacées de 1 s,
 * 2 s puis 4 s. Renvoie le dernier résultat, erreur comprise.
 */
export async function withRetry(
  fn: () => PromiseLike<{ error: unknown }>,
  maxRetries = 3
): Promise<{ error: unknown }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fn();
    if (!result.error) return result;
    // Refus du serveur (session verrouillée) : réessayer ne changera rien.
    if (isWriteRefused(result.error)) return result;
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    } else {
      return result;
    }
  }
  return fn();
}
