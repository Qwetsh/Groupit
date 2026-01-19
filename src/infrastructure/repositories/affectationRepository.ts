// ============================================================
// REPOSITORY - AFFECTATIONS
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { Affectation, AffectationMetadata } from '../../domain/models';

export class AffectationRepository {
  async getAll(): Promise<Affectation[]> {
    return db.affectations.toArray();
  }

  async getById(id: string): Promise<Affectation | undefined> {
    return db.affectations.get(id);
  }

  async getByScenario(scenarioId: string): Promise<Affectation[]> {
    return db.affectations.where('scenarioId').equals(scenarioId).toArray();
  }

  async getByEleve(eleveId: string): Promise<Affectation[]> {
    return db.affectations.where('eleveId').equals(eleveId).toArray();
  }

  async getByEnseignant(enseignantId: string): Promise<Affectation[]> {
    return db.affectations.where('enseignantId').equals(enseignantId).toArray();
  }

  async getByEnseignantAndScenario(enseignantId: string, scenarioId: string): Promise<Affectation[]> {
    return db.affectations
      .where('scenarioId').equals(scenarioId)
      .and(a => a.enseignantId === enseignantId)
      .toArray();
  }

  async getByEleveAndScenario(eleveId: string, scenarioId: string): Promise<Affectation | undefined> {
    const results = await db.affectations
      .where('[scenarioId+eleveId]')
      .equals([scenarioId, eleveId])
      .toArray();
    return results[0];
  }

  async countByEnseignantAndScenario(enseignantId: string, scenarioId: string): Promise<number> {
    return db.affectations
      .where('scenarioId').equals(scenarioId)
      .and(a => a.enseignantId === enseignantId)
      .count();
  }

  async create(affectation: Omit<Affectation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Affectation> {
    const newAffectation: Affectation = {
      ...affectation,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.affectations.add(newAffectation);
    return newAffectation;
  }

  async createMany(affectations: Omit<Affectation, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Affectation[]> {
    const newAffectations: Affectation[] = affectations.map(a => ({
      ...a,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.affectations.bulkAdd(newAffectations);
    return newAffectations;
  }

  async update(id: string, updates: Partial<Omit<Affectation, 'id' | 'createdAt'>>): Promise<void> {
    await db.affectations.update(id, { ...updates, updatedAt: new Date() });
  }

  async updateMetadata(id: string, metadata: AffectationMetadata): Promise<void> {
    await db.affectations.update(id, { metadata, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await db.affectations.delete(id);
  }

  async deleteByScenario(scenarioId: string): Promise<void> {
    await db.affectations.where('scenarioId').equals(scenarioId).delete();
  }

  async deleteByEleve(eleveId: string): Promise<void> {
    await db.affectations.where('eleveId').equals(eleveId).delete();
  }

  async deleteByEnseignant(enseignantId: string): Promise<void> {
    await db.affectations.where('enseignantId').equals(enseignantId).delete();
  }

  async deleteAll(): Promise<void> {
    await db.affectations.clear();
  }

  async count(): Promise<number> {
    return db.affectations.count();
  }

  async countByScenario(scenarioId: string): Promise<number> {
    return db.affectations.where('scenarioId').equals(scenarioId).count();
  }

  // Obtenir les élèves non affectés pour un scénario
  async getUnassignedEleveIds(scenarioId: string, allEleveIds: string[]): Promise<string[]> {
    const affectations = await this.getByScenario(scenarioId);
    const assignedIds = new Set(affectations.map(a => a.eleveId));
    return allEleveIds.filter(id => !assignedIds.has(id));
  }

  // Statistiques par enseignant
  async getChargeByEnseignant(scenarioId: string): Promise<Map<string, number>> {
    const affectations = await this.getByScenario(scenarioId);
    const charge = new Map<string, number>();
    
    affectations.forEach(a => {
      const current = charge.get(a.enseignantId) || 0;
      charge.set(a.enseignantId, current + 1);
    });
    
    return charge;
  }
}

export const affectationRepository = new AffectationRepository();
