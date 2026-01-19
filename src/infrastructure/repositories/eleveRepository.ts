// ============================================================
// REPOSITORY - ÉLÈVES
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { Eleve, Contrainte } from '../../domain/models';

export class EleveRepository {
  async getAll(): Promise<Eleve[]> {
    return db.eleves.toArray();
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

  async create(eleve: Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>): Promise<Eleve> {
    const newEleve: Eleve = {
      ...eleve,
      id: uuidv4(),
      options: eleve.options || [],
      tags: eleve.tags || [],
      contraintes: eleve.contraintes || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.eleves.add(newEleve);
    return newEleve;
  }

  async createMany(eleves: Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Eleve[]> {
    const newEleves: Eleve[] = eleves.map(e => ({
      ...e,
      id: uuidv4(),
      options: e.options || [],
      tags: e.tags || [],
      contraintes: e.contraintes || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.eleves.bulkAdd(newEleves);
    return newEleves;
  }

  async update(id: string, updates: Partial<Omit<Eleve, 'id' | 'createdAt'>>): Promise<void> {
    await db.eleves.update(id, { ...updates, updatedAt: new Date() });
  }

  async updateClasse(id: string, classe: string): Promise<void> {
    await db.eleves.update(id, { classe, updatedAt: new Date() });
  }

  async updateClasseForMany(ids: string[], classe: string): Promise<void> {
    await db.transaction('rw', db.eleves, async () => {
      for (const id of ids) {
        await db.eleves.update(id, { classe, updatedAt: new Date() });
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
