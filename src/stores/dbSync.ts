// ============================================================
// SYNCHRONISATION STORE ← BASE
// ============================================================
//
// IndexedDB est la seule source de vérité. Un store Zustand n'est qu'une vue
// en mémoire d'une table : après chaque écriture, il relit en base les lignes
// concernées au lieu de reconstruire leur état à la main. Ainsi la vue ne peut
// pas diverger de ce qui sera rechargé au prochain démarrage.

interface Row {
  id: string;
}

/**
 * Aligne une vue en mémoire sur l'état relu en base.
 *
 * - `fresh` : les lignes relues en base pour le périmètre concerné ;
 * - `inScope` : dit si une ligne de la vue appartient à ce périmètre
 *   (par défaut, toute la vue).
 *
 * Les lignes du périmètre sont remplacées par leur version en base, ou
 * retirées si elles n'y sont plus ; les lignes nouvelles sont ajoutées à la
 * fin. L'ordre existant est conservé, et les lignes hors périmètre gardent
 * leur identité (pas de rendu inutile).
 */
export function reconcileRows<T extends Row>(
  current: readonly T[],
  fresh: readonly T[],
  inScope: (row: T) => boolean = () => true
): T[] {
  const freshById = new Map(fresh.map(row => [row.id, row]));
  const kept = new Set<string>();
  const next: T[] = [];

  for (const row of current) {
    const updated = freshById.get(row.id);
    if (updated) {
      next.push(updated);
      kept.add(row.id);
    } else if (!inScope(row)) {
      next.push(row);
    }
    // Dans le périmètre mais absente de la base : supprimée.
  }

  for (const row of fresh) {
    if (!kept.has(row.id)) {
      next.push(row);
      kept.add(row.id);
    }
  }

  return next;
}

/** Périmètre « ces identifiants-là », pour `reconcileRows`. */
export function byIds(ids: Iterable<string>): (row: Row) => boolean {
  const set = new Set(ids);
  return row => set.has(row.id);
}
