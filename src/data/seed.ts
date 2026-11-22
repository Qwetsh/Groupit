// ============================================================
// SEED - Données locales de l'établissement
// ============================================================
//
// Aucune donnée personnelle ne doit figurer dans le code source : le dépôt
// est public et tout ce qui est importé ici finit dans le bundle déployé.
//
// Les données réelles de l'établissement vivent dans `src/data/local/`,
// dossier ignoré par git. Elles ne sont chargées qu'en développement, et
// seulement si la base est vide. En production, les enseignants s'importent
// depuis l'interface.

import type { Enseignant } from '../domain/models';
import { enseignantRepository } from '../infrastructure/repositories';

type EnseignantSeed = Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Charge le fichier local d'enseignants s'il existe.
 * `import.meta.glob` tolère l'absence du fichier (cas de la CI et d'un clone neuf).
 */
async function loadLocalEnseignants(): Promise<EnseignantSeed[]> {
  const modules = import.meta.glob<{ default: EnseignantSeed[] }>('./local/enseignants.local.json');
  const loader = modules['./local/enseignants.local.json'];
  if (!loader) return [];
  const mod = await loader();
  return Array.isArray(mod.default) ? mod.default : [];
}

/**
 * En développement uniquement : remplit la table des enseignants depuis le
 * fichier local si la base est vide. À appeler après la reprise de l'ancienne
 * sauvegarde (`migrateLegacyBackups`), qui prime sur le fichier.
 *
 * Ne supprime jamais rien : les données existantes priment toujours.
 */
export async function seedLocalDataIfEmpty(): Promise<number> {
  if (!import.meta.env.DEV) return 0;

  if ((await enseignantRepository.count()) > 0) return 0;

  const enseignants = await loadLocalEnseignants();
  if (enseignants.length === 0) return 0;

  const created = await enseignantRepository.createMany(enseignants);
  return created.length;
}
