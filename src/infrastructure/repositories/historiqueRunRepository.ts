// ============================================================
// REPOSITORY - HISTORIQUE RUNS
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { HistoriqueRun, Affectation, Groupe } from '../../domain/models';

export class HistoriqueRunRepository {
  async getAll(): Promise<HistoriqueRun[]> {
    return db.historiqueRuns.orderBy('dateRun').reverse().toArray();
  }

  async getById(id: string): Promise<HistoriqueRun | undefined> {
    return db.historiqueRuns.get(id);
  }

  async getByScenario(scenarioId: string): Promise<HistoriqueRun[]> {
    return db.historiqueRuns
      .where('scenarioId')
      .equals(scenarioId)
      .reverse()
      .sortBy('dateRun');
  }

  async getLatestByScenario(scenarioId: string): Promise<HistoriqueRun | undefined> {
    const runs = await this.getByScenario(scenarioId);
    return runs[0];
  }

  async create(run: Omit<HistoriqueRun, 'id'>): Promise<HistoriqueRun> {
    const newRun: HistoriqueRun = {
      ...run,
      id: uuidv4(),
    };
    await db.historiqueRuns.add(newRun);
    return newRun;
  }

  async saveRun(
    scenarioId: string,
    affectations: Affectation[],
    groupes: Groupe[] | undefined,
    scoreGlobal: number,
    tempsCalculMs: number,
    notes?: string
  ): Promise<HistoriqueRun> {
    const nbConflits = affectations.filter(a => 
      a.scoreDetail && Object.values(a.scoreDetail).some(s => s < 0)
    ).length;

    return this.create({
      scenarioId,
      dateRun: new Date(),
      affectationsSnapshot: JSON.parse(JSON.stringify(affectations)),
      groupesSnapshot: groupes ? JSON.parse(JSON.stringify(groupes)) : undefined,
      scoreGlobal,
      statistiques: {
        nbEleves: new Set(affectations.map(a => a.eleveId)).size,
        nbEnseignants: new Set(affectations.map(a => a.enseignantId)).size,
        nbAffectations: affectations.length,
        nbConflits,
        tempsCalculMs,
      },
      notes,
    });
  }

  async update(id: string, updates: Partial<HistoriqueRun>): Promise<void> {
    await db.historiqueRuns.update(id, updates);
  }

  async delete(id: string): Promise<void> {
    await db.historiqueRuns.delete(id);
  }

  async deleteByScenario(scenarioId: string): Promise<void> {
    await db.historiqueRuns.where('scenarioId').equals(scenarioId).delete();
  }

  async deleteOlderThan(date: Date): Promise<void> {
    await db.historiqueRuns.where('dateRun').below(date).delete();
  }

  async deleteAll(): Promise<void> {
    await db.historiqueRuns.clear();
  }

  async count(): Promise<number> {
    return db.historiqueRuns.count();
  }
}

export const historiqueRunRepository = new HistoriqueRunRepository();
