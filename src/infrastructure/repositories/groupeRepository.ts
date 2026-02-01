// ============================================================
// REPOSITORY - GROUPES
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { Groupe } from '../../domain/models';

// Note: Les timestamps (createdAt, updatedAt) sont gérés automatiquement
// par les hooks Dexie dans db.ts - ne pas les définir ici.

export class GroupeRepository {
  async getAll(): Promise<Groupe[]> {
    return db.groupes.toArray();
  }

  async getById(id: string): Promise<Groupe | undefined> {
    return db.groupes.get(id);
  }

  async getByScenario(scenarioId: string): Promise<Groupe[]> {
    return db.groupes.where('scenarioId').equals(scenarioId).toArray();
  }

  async create(groupe: Omit<Groupe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Groupe> {
    const newGroupe = {
      ...groupe,
      id: uuidv4(),
      eleveIds: groupe.eleveIds || [],
      enseignantIds: groupe.enseignantIds || [],
      contraintes: groupe.contraintes || [],
    } as Groupe;
    await db.groupes.add(newGroupe);
    return newGroupe;
  }

  async createMany(groupes: Omit<Groupe, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Groupe[]> {
    const newGroupes = groupes.map(g => ({
      ...g,
      id: uuidv4(),
      eleveIds: g.eleveIds || [],
      enseignantIds: g.enseignantIds || [],
      contraintes: g.contraintes || [],
    } as Groupe));
    await db.groupes.bulkAdd(newGroupes);
    return newGroupes;
  }

  async update(id: string, updates: Partial<Omit<Groupe, 'id' | 'createdAt'>>): Promise<void> {
    await db.groupes.update(id, updates);
  }

  async addEleve(groupeId: string, eleveId: string): Promise<void> {
    const groupe = await this.getById(groupeId);
    if (groupe && !groupe.eleveIds.includes(eleveId)) {
      const eleveIds = [...groupe.eleveIds, eleveId];
      await this.update(groupeId, { eleveIds });
    }
  }

  async removeEleve(groupeId: string, eleveId: string): Promise<void> {
    const groupe = await this.getById(groupeId);
    if (groupe) {
      const eleveIds = groupe.eleveIds.filter(id => id !== eleveId);
      await this.update(groupeId, { eleveIds });
    }
  }

  async addEnseignant(groupeId: string, enseignantId: string): Promise<void> {
    const groupe = await this.getById(groupeId);
    if (groupe && !groupe.enseignantIds.includes(enseignantId)) {
      const enseignantIds = [...groupe.enseignantIds, enseignantId];
      await this.update(groupeId, { enseignantIds });
    }
  }

  async removeEnseignant(groupeId: string, enseignantId: string): Promise<void> {
    const groupe = await this.getById(groupeId);
    if (groupe) {
      const enseignantIds = groupe.enseignantIds.filter(id => id !== enseignantId);
      await this.update(groupeId, { enseignantIds });
    }
  }

  async moveEleveBetweenGroupes(eleveId: string, fromGroupeId: string, toGroupeId: string): Promise<void> {
    await db.transaction('rw', db.groupes, async () => {
      await this.removeEleve(fromGroupeId, eleveId);
      await this.addEleve(toGroupeId, eleveId);
    });
  }

  async delete(id: string): Promise<void> {
    await db.groupes.delete(id);
  }

  async deleteByScenario(scenarioId: string): Promise<void> {
    await db.groupes.where('scenarioId').equals(scenarioId).delete();
  }

  async deleteAll(): Promise<void> {
    await db.groupes.clear();
  }

  async count(): Promise<number> {
    return db.groupes.count();
  }

  async countByScenario(scenarioId: string): Promise<number> {
    return db.groupes.where('scenarioId').equals(scenarioId).count();
  }
}

export const groupeRepository = new GroupeRepository();
