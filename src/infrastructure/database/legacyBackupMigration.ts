// ============================================================
// MIGRATION - Ancienne sauvegarde localStorage
// ============================================================
//
// Jusqu'à la version 1.1, les élèves et les enseignants étaient recopiés dans
// localStorage à chaque modification, et relus quand IndexedDB était vide.
// IndexedDB est désormais la seule source de vérité : cette copie n'est plus
// écrite. Au démarrage, on reprend une dernière fois ce qu'elle contient si la
// base est vide, puis on la retire — seulement une fois la reprise vérifiée.
// La reprise conserve les identifiants (les affectations, jurys et stages y
// font référence) et les dates des fiches.
//
// Rien n'est jamais supprimé de la base ici, et la copie n'est retirée que si
// son contenu est en base ou n'a plus lieu d'être (base déjà remplie : c'est
// elle qui fait foi, comme avant).

import { db, preservingTimestamps } from './db';
import { eleveRepository } from '../repositories/eleveRepository';
import { enseignantRepository } from '../repositories/enseignantRepository';
import type { Eleve, Enseignant } from '../../domain/models';

export const LEGACY_BACKUP_KEYS = {
  eleves: 'groupit-backup-eleves',
  enseignants: 'groupit-backup-enseignants',
} as const;

export type LegacyBackupEntity = keyof typeof LEGACY_BACKUP_KEYS;

/**
 * Ce qu'il est advenu d'une ancienne copie :
 * - `absente` : rien à reprendre ;
 * - `vide` / `illisible` : copie sans contenu exploitable, retirée ;
 * - `base-deja-remplie` : la base fait foi, copie retirée ;
 * - `restauree` : base vide, contenu repris en base (identifiants conservés), copie retirée ;
 * - `echec` : la reprise a échoué, copie conservée pour un prochain démarrage.
 */
export type LegacyBackupOutcome =
  | 'absente'
  | 'vide'
  | 'illisible'
  | 'base-deja-remplie'
  | 'restauree'
  | 'echec';

export type LegacyBackupReport = Record<LegacyBackupEntity, LegacyBackupOutcome>;

/** La partie de `Storage` dont la migration a besoin (injectable en test). */
export interface LegacyBackupStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

interface BackedUpRow {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Lit une ancienne copie. `null` si elle est absente, `'illisible'` si elle ne se décode pas. */
function readLegacyBackup<T extends BackedUpRow>(
  storage: LegacyBackupStorage,
  key: string
): T[] | null | 'illisible' {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 'illisible';
    // JSON a transformé les dates en chaînes : les reconvertir.
    return (parsed as T[]).map(item => ({
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    }));
  } catch {
    return 'illisible';
  }
}

async function migrateOne<T extends BackedUpRow>(
  storage: LegacyBackupStorage,
  key: string,
  countInDb: () => Promise<number>,
  restore: (rows: T[]) => Promise<T[]>
): Promise<LegacyBackupOutcome> {
  const backup = readLegacyBackup<T>(storage, key);
  if (backup === null) return 'absente';

  if (backup === 'illisible' || backup.length === 0) {
    storage.removeItem(key);
    return backup === 'illisible' ? 'illisible' : 'vide';
  }

  if ((await countInDb()) > 0) {
    storage.removeItem(key);
    return 'base-deja-remplie';
  }

  try {
    const restored = await restore(backup);
    // Ne retirer la copie qu'une fois son contenu constaté en base.
    if ((await countInDb()) < restored.length) return 'echec';
    storage.removeItem(key);
    return 'restauree';
  } catch (error) {
    console.error(`[Migration] Reprise de l'ancienne sauvegarde « ${key} » impossible :`, error);
    return 'echec';
  }
}

function defaultStorage(): LegacyBackupStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Stockage indisponible (navigation privée stricte) : rien à reprendre.
    return null;
  }
}

/**
 * Reprend en base les anciennes copies localStorage, puis les retire.
 * Sans effet si elles n'existent pas : peut être appelée à chaque démarrage.
 */
export async function migrateLegacyBackups(
  storage: LegacyBackupStorage | null = defaultStorage()
): Promise<LegacyBackupReport> {
  if (!storage) return { eleves: 'absente', enseignants: 'absente' };

  return {
    eleves: await migrateOne<Eleve>(
      storage,
      LEGACY_BACKUP_KEYS.eleves,
      () => db.eleves.count(),
      rows => preservingTimestamps(() => eleveRepository.restoreFromBackup(rows))
    ),
    enseignants: await migrateOne<Enseignant>(
      storage,
      LEGACY_BACKUP_KEYS.enseignants,
      () => db.enseignants.count(),
      rows => preservingTimestamps(() => enseignantRepository.restoreFromBackup(rows))
    ),
  };
}
