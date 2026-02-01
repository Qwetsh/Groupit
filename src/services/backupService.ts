// ============================================================
// BACKUP SERVICE - Sauvegarde localStorage de secours
// ============================================================
// Protège contre la perte de données en cas de:
// - Changement d'origine (port dev différent)
// - Reset accidentel d'IndexedDB
// - Corruption de la base
// ============================================================

const STORAGE_PREFIX = 'groupit-backup-';

export interface BackupService<T extends { id: string; createdAt: Date; updatedAt: Date }> {
  persist(data: T[]): void;
  restore(): T[] | null;
  clear(): void;
}

/**
 * Crée un service de backup localStorage pour une entité donnée
 * @param entityName Nom de l'entité (ex: 'eleves', 'enseignants')
 */
export function createBackupService<T extends { id: string; createdAt: Date; updatedAt: Date }>(
  entityName: string
): BackupService<T> {
  const storageKey = `${STORAGE_PREFIX}${entityName}`;

  return {
    /**
     * Sauvegarde les données dans localStorage
     */
    persist(data: T[]): void {
      try {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (error) {
        console.warn(`[BackupService] Impossible de sauvegarder ${entityName}:`, error);
      }
    },

    /**
     * Restaure les données depuis localStorage
     * Reconvertit les dates string en objets Date
     */
    restore(): T[] | null {
      try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as T[];

        // Reconvertir les dates (JSON.parse les transforme en string)
        return parsed.map(item => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }));
      } catch (error) {
        console.warn(`[BackupService] Impossible de restaurer ${entityName}:`, error);
        return null;
      }
    },

    /**
     * Efface le backup
     */
    clear(): void {
      try {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn(`[BackupService] Impossible d'effacer le backup ${entityName}:`, error);
      }
    },
  };
}

// ============================================================
// Instances pré-configurées pour les entités principales
// ============================================================

import type { Eleve, Enseignant } from '../domain/models';

export const eleveBackupService = createBackupService<Eleve>('eleves');
export const enseignantBackupService = createBackupService<Enseignant>('enseignants');
