// ============================================================
// REPOSITORY - ÉLÈVES
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { Eleve, Contrainte } from '../../domain/models';

// ============================================================
// Utilitaire de déduplication
// ============================================================

interface DedupeResult {
  unique: Eleve[];
  duplicateIds: string[];
}

/**
 * Génère une clé unique pour identifier un élève (hors id)
 */
function getEleveKey(eleve: Eleve): string {
  return `${eleve.nom?.toLowerCase() || ''}|${eleve.prenom?.toLowerCase() || ''}|${eleve.classe || ''}|${eleve.dateNaissance || ''}`;
}

/**
 * Supprime les doublons d'une liste d'élèves
 * Garde le premier élève rencontré pour chaque clé unique
 */
function dedupeEleves(eleves: Eleve[]): DedupeResult {
  const seen = new Set<string>();
  const unique: Eleve[] = [];
  const duplicateIds: string[] = [];

  for (const eleve of eleves) {
    const key = getEleveKey(eleve);
    if (seen.has(key)) {
      if (eleve.id) duplicateIds.push(eleve.id);
    } else {
      seen.add(key);
      unique.push(eleve);
    }
  }

  return { unique, duplicateIds };
}

// ============================================================
// Repository
// ============================================================

export class EleveRepository {
  /**
   * Récupère tous les élèves
   */
  async getAll(): Promise<Eleve[]> {
    return db.eleves.toArray();
  }

  /**
   * Récupère tous les élèves en supprimant les doublons de la base
   * Utiliser cette méthode au chargement initial pour nettoyer automatiquement
   */
  async getAllAndDedupe(): Promise<Eleve[]> {
    const eleves = await db.eleves.toArray();
    const { unique, duplicateIds } = dedupeEleves(eleves);

    // Supprimer les doublons de la base
    if (duplicateIds.length > 0) {
      await this.deleteMany(duplicateIds);
      console.info(`[EleveRepository] ${duplicateIds.length} doublon(s) supprimé(s)`);
    }

    return unique;
  }

  async getById(id: string): Promise<Eleve | undefined> {
    return db.eleves.get(id);
  }

  async getByClasse(classe: string): Promise<Eleve[]> {
    return db.eleves.where('classe').equals(classe).toArray();
  }

  async getByClasses(classes: string[]): Promise<Eleve[]> {
    return db.eleves.where('classe').anyOf(classes).toArray();
  }

  async search(query: string): Promise<Eleve[]> {
    const lowerQuery = query.toLowerCase();
    return db.eleves
      .filter(e => 
        e.nom.toLowerCase().includes(lowerQuery) ||
        e.prenom.toLowerCase().includes(lowerQuery) ||
        e.classe.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }

  // Note: Les timestamps (createdAt, updatedAt) sont gérés automatiquement
  // par les hooks Dexie dans db.ts - ne pas les définir ici.

  async create(eleve: Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>): Promise<Eleve> {
    const newEleve = {
      ...eleve,
      id: uuidv4(),
      options: eleve.options || [],
      tags: eleve.tags || [],
      contraintes: eleve.contraintes || [],
    } as Eleve;
    await db.eleves.add(newEleve);
    return newEleve;
  }

  async createMany(eleves: Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Eleve[]> {
    const newEleves = eleves.map(e => ({
      ...e,
      id: uuidv4(),
      options: e.options || [],
      tags: e.tags || [],
      contraintes: e.contraintes || [],
    } as Eleve));
    await db.eleves.bulkAdd(newEleves);
    return newEleves;
  }

  /**
   * Restaure des élèves depuis un backup
   * Déduplique avant insertion
   */
  async restoreFromBackup(eleves: Eleve[]): Promise<Eleve[]> {
    const { unique } = dedupeEleves(eleves);

    const restored = unique.map(e => ({
      ...e,
      id: uuidv4(),
      options: e.options || [],
      tags: e.tags || [],
      contraintes: e.contraintes || [],
    } as Eleve));

    await db.eleves.bulkAdd(restored);
    return restored;
  }

  async update(id: string, updates: Partial<Omit<Eleve, 'id' | 'createdAt'>>): Promise<void> {
    await db.eleves.update(id, updates);
  }

  async updateClasse(id: string, classe: string): Promise<void> {
    await db.eleves.update(id, { classe });
  }

  async updateClasseForMany(ids: string[], classe: string): Promise<void> {
    await db.transaction('rw', db.eleves, async () => {
      for (const id of ids) {
        await db.eleves.update(id, { classe });
      }
    });
  }

  async addContrainte(eleveId: string, contrainte: Contrainte): Promise<void> {
    const eleve = await this.getById(eleveId);
    if (eleve) {
      const contraintes = [...eleve.contraintes, contrainte];
      await this.update(eleveId, { contraintes });
    }
  }

  async removeContrainte(eleveId: string, cibleId: string): Promise<void> {
    const eleve = await this.getById(eleveId);
    if (eleve) {
      const contraintes = eleve.contraintes.filter(c => c.cibleId !== cibleId);
      await this.update(eleveId, { contraintes });
    }
  }

  async delete(id: string): Promise<void> {
    await db.eleves.delete(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    await db.eleves.bulkDelete(ids);
  }

  async deleteAll(): Promise<void> {
    await db.eleves.clear();
  }

  async count(): Promise<number> {
    return db.eleves.count();
  }

  async getDistinctClasses(): Promise<string[]> {
    const eleves = await db.eleves.toArray();
    const classes = new Set(eleves.map(e => e.classe));
    return Array.from(classes).sort();
  }

  async getDistinctOptions(): Promise<string[]> {
    const eleves = await db.eleves.toArray();
    const options = new Set<string>();
    eleves.forEach(e => e.options.forEach(o => options.add(o)));
    return Array.from(options).sort();
  }
}

export const eleveRepository = new EleveRepository();
