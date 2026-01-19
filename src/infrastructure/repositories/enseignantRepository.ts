// ============================================================
// REPOSITORY - ENSEIGNANTS
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { Enseignant, CapaciteConfig } from '../../domain/models';

export class EnseignantRepository {
  async getAll(): Promise<Enseignant[]> {
    return db.enseignants.toArray();
  }

  async getById(id: string): Promise<Enseignant | undefined> {
    return db.enseignants.get(id);
  }

  async getByMatiere(matiere: string): Promise<Enseignant[]> {
    return db.enseignants.where('matierePrincipale').equals(matiere).toArray();
  }

  async getByMatieres(matieres: string[]): Promise<Enseignant[]> {
    return db.enseignants.where('matierePrincipale').anyOf(matieres).toArray();
  }

  async getProfsPrincipaux(): Promise<Enseignant[]> {
    return db.enseignants.where('estProfPrincipal').equals(1).toArray();
  }

  async getByClasseEnCharge(classe: string): Promise<Enseignant[]> {
    return db.enseignants
      .filter(e => e.classesEnCharge.includes(classe))
      .toArray();
  }

  async search(query: string): Promise<Enseignant[]> {
    const lowerQuery = query.toLowerCase();
    return db.enseignants
      .filter(e => 
        e.nom.toLowerCase().includes(lowerQuery) ||
        e.prenom.toLowerCase().includes(lowerQuery) ||
        e.matierePrincipale.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }

  async create(enseignant: Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Enseignant> {
    const newEnseignant: Enseignant = {
      ...enseignant,
      id: uuidv4(),
      classesEnCharge: enseignant.classesEnCharge || [],
      tags: enseignant.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.enseignants.add(newEnseignant);
    return newEnseignant;
  }

  async createMany(enseignants: Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Enseignant[]> {
    const newEnseignants: Enseignant[] = enseignants.map(e => ({
      ...e,
      id: uuidv4(),
      classesEnCharge: e.classesEnCharge || [],
      tags: e.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.enseignants.bulkAdd(newEnseignants);
    return newEnseignants;
  }

  async update(id: string, updates: Partial<Omit<Enseignant, 'id' | 'createdAt'>>): Promise<void> {
    await db.enseignants.update(id, { ...updates, updatedAt: new Date() });
  }

  async delete(id: string): Promise<void> {
    await db.enseignants.delete(id);
  }

  async deleteMany(ids: string[]): Promise<void> {
    await db.enseignants.bulkDelete(ids);
  }

  async deleteAll(): Promise<void> {
    await db.enseignants.clear();
  }

  async count(): Promise<number> {
    return db.enseignants.count();
  }

  async getDistinctMatieres(): Promise<string[]> {
    const enseignants = await db.enseignants.toArray();
    const matieres = new Set(enseignants.map(e => e.matierePrincipale));
    return Array.from(matieres).sort();
  }

  // Calcul de capacité basé sur les heures par niveau
  calculateCapacity(enseignant: Enseignant, config: CapaciteConfig): number {
    const { capaciteBaseDefaut, coefficients } = config;
    
    // Si capacité forcée, l'utiliser
    if (enseignant.capaciteBase !== undefined) {
      return enseignant.capaciteBase;
    }

    // Sinon calculer à partir des heures
    if (!enseignant.heuresParNiveau) {
      return capaciteBaseDefaut;
    }

    const heures = enseignant.heuresParNiveau;
    let capacite = capaciteBaseDefaut;

    capacite += Math.round((heures['6e'] || 0) * coefficients['6e']);
    capacite += Math.round((heures['5e'] || 0) * coefficients['5e']);
    capacite += Math.round((heures['4e'] || 0) * coefficients['4e']);
    capacite += Math.round((heures['3e'] || 0) * coefficients['3e']);

    return Math.max(0, capacite);
  }

  // Obtenir les capacités pour tous les enseignants
  async getAllWithCapacity(config: CapaciteConfig): Promise<(Enseignant & { capaciteCalculee: number })[]> {
    const enseignants = await this.getAll();
    return enseignants.map(e => ({
      ...e,
      capaciteCalculee: this.calculateCapacity(e, config),
    }));
  }
}

export const enseignantRepository = new EnseignantRepository();
