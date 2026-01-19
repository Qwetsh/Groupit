// ============================================================
// REPOSITORY - JURYS (Oral DNB)
// ============================================================

import { db } from '../database/db';
import type { Jury } from '../../domain/models';
import { v4 as uuidv4 } from 'uuid';

export const juryRepository = {
  /**
   * Récupère tous les jurys
   */
  async getAll(): Promise<Jury[]> {
    return db.jurys.toArray();
  },

  /**
   * Récupère un jury par son ID
   */
  async getById(id: string): Promise<Jury | undefined> {
    return db.jurys.get(id);
  },

  /**
   * Récupère tous les jurys d'un scénario
   */
  async getByScenarioId(scenarioId: string): Promise<Jury[]> {
    return db.jurys.where('scenarioId').equals(scenarioId).toArray();
  },

  /**
   * Crée un nouveau jury
   */
  async create(data: Omit<Jury, 'id' | 'createdAt' | 'updatedAt'>): Promise<Jury> {
    const id = uuidv4();
    const now = new Date();
    
    const jury: Jury = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    await db.jurys.add(jury);
    return jury;
  },

  /**
   * Met à jour un jury existant
   */
  async update(id: string, updates: Partial<Omit<Jury, 'id' | 'createdAt'>>): Promise<void> {
    await db.jurys.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  },

  /**
   * Supprime un jury
   */
  async delete(id: string): Promise<void> {
    await db.jurys.delete(id);
  },

  /**
   * Supprime tous les jurys d'un scénario
   */
  async deleteByScenarioId(scenarioId: string): Promise<void> {
    await db.jurys.where('scenarioId').equals(scenarioId).delete();
  },

  /**
   * Ajoute un enseignant à un jury
   */
  async addEnseignant(juryId: string, enseignantId: string): Promise<void> {
    const jury = await db.jurys.get(juryId);
    if (jury && !jury.enseignantIds.includes(enseignantId)) {
      await db.jurys.update(juryId, {
        enseignantIds: [...jury.enseignantIds, enseignantId],
        updatedAt: new Date(),
      });
    }
  },

  /**
   * Retire un enseignant d'un jury
   */
  async removeEnseignant(juryId: string, enseignantId: string): Promise<void> {
    const jury = await db.jurys.get(juryId);
    if (jury) {
      await db.jurys.update(juryId, {
        enseignantIds: jury.enseignantIds.filter(id => id !== enseignantId),
        updatedAt: new Date(),
      });
    }
  },

  /**
   * Import en masse (pour restauration)
   */
  async bulkPut(jurys: Jury[]): Promise<void> {
    await db.jurys.bulkPut(jurys);
  },

  /**
   * Compte le nombre de jurys pour un scénario
   */
  async countByScenario(scenarioId: string): Promise<number> {
    return db.jurys.where('scenarioId').equals(scenarioId).count();
  },
};
