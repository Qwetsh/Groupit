// ============================================================
// REPOSITORY - ENSEIGNANTS
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { Enseignant, CapaciteConfig } from '../../domain/models';
import { geocodeWithFallback, toGeoStatus } from '../geo/geocodeFallback';

// ============================================================
// Utilitaire de déduplication
// ============================================================

interface DedupeResult {
  unique: Enseignant[];
  duplicateIds: string[];
}

/**
 * Génère une clé unique pour identifier un enseignant (hors id)
 */
function getEnseignantKey(enseignant: Enseignant): string {
  return `${enseignant.nom?.toLowerCase() || ''}|${enseignant.prenom?.toLowerCase() || ''}|${enseignant.matierePrincipale?.toLowerCase() || ''}`;
}

/**
 * Supprime les doublons d'une liste d'enseignants
 */
function dedupeEnseignants(enseignants: Enseignant[]): DedupeResult {
  const seen = new Set<string>();
  const unique: Enseignant[] = [];
  const duplicateIds: string[] = [];

  for (const enseignant of enseignants) {
    const key = getEnseignantKey(enseignant);
    if (seen.has(key)) {
      if (enseignant.id) duplicateIds.push(enseignant.id);
    } else {
      seen.add(key);
      unique.push(enseignant);
    }
  }

  return { unique, duplicateIds };
}

// ============================================================
// Repository
// ============================================================

export class EnseignantRepository {
  /**
   * Récupère tous les enseignants
   */
  async getAll(): Promise<Enseignant[]> {
    return db.enseignants.toArray();
  }

  /**
   * Récupère tous les enseignants en supprimant les doublons de la base
   */
  async getAllAndDedupe(): Promise<Enseignant[]> {
    const enseignants = await db.enseignants.toArray();
    const { unique, duplicateIds } = dedupeEnseignants(enseignants);

    if (duplicateIds.length > 0) {
      await this.deleteMany(duplicateIds);
      console.info(`[EnseignantRepository] ${duplicateIds.length} doublon(s) supprimé(s)`);
    }

    return unique;
  }

  // Note: Les timestamps (createdAt, updatedAt) sont gérés automatiquement
  // par les hooks Dexie dans db.ts - ne pas les définir ici.

  /**
   * Restaure des enseignants depuis un backup
   * Note: Ne fait PAS de géocodage automatique pour éviter les appels API
   */
  async restoreFromBackup(enseignants: Enseignant[]): Promise<Enseignant[]> {
    const { unique } = dedupeEnseignants(enseignants);

    const restored = unique.map(e => ({
      ...e,
      id: uuidv4(),
      classesEnCharge: e.classesEnCharge || [],
      tags: e.tags || [],
    } as Enseignant));

    await db.enseignants.bulkAdd(restored);
    return restored;
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
    const newEnseignant = {
      ...enseignant,
      id: uuidv4(),
      classesEnCharge: enseignant.classesEnCharge || [],
      tags: enseignant.tags || [],
    } as Enseignant;

    // Géocodage automatique si adresse fournie mais pas de coordonnées
    if (newEnseignant.adresse && !newEnseignant.lat && !newEnseignant.lon) {
      const fullAddress = newEnseignant.commune
        ? `${newEnseignant.adresse}, ${newEnseignant.commune}`
        : newEnseignant.adresse;

      try {
        const geoResult = await geocodeWithFallback(fullAddress);
        if (geoResult.success && geoResult.point) {
          newEnseignant.lat = geoResult.point.lat;
          newEnseignant.lon = geoResult.point.lon;
          newEnseignant.geoStatus = toGeoStatus(geoResult.status);
        } else {
          newEnseignant.geoStatus = 'error';
          newEnseignant.geoErrorMessage = geoResult.errorMessage;
        }
      } catch (error) {
        console.error('Erreur géocodage enseignant:', error);
        newEnseignant.geoStatus = 'error';
        newEnseignant.geoErrorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      }
    }

    await db.enseignants.add(newEnseignant);
    return newEnseignant;
  }

  async createMany(enseignants: Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Enseignant[]> {
    const newEnseignants = enseignants.map(e => ({
      ...e,
      id: uuidv4(),
      classesEnCharge: e.classesEnCharge || [],
      tags: e.tags || [],
    } as Enseignant));

    // Géocodage automatique pour ceux qui ont une adresse mais pas de coordonnées
    const toGeocode = newEnseignants.filter(e => e.adresse && !e.lat && !e.lon);

    if (toGeocode.length > 0) {
      // Géocodage séquentiel avec délai pour respecter les rate limits
      for (const ens of toGeocode) {
        const fullAddress = ens.commune
          ? `${ens.adresse}, ${ens.commune}`
          : ens.adresse!;

        try {
          const geoResult = await geocodeWithFallback(fullAddress);
          if (geoResult.success && geoResult.point) {
            ens.lat = geoResult.point.lat;
            ens.lon = geoResult.point.lon;
            ens.geoStatus = toGeoStatus(geoResult.status);
          } else {
            ens.geoStatus = 'error';
            ens.geoErrorMessage = geoResult.errorMessage;
          }
        } catch (error) {
          console.error('Erreur géocodage enseignant:', error);
          ens.geoStatus = 'error';
          ens.geoErrorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        }

        // Petit délai entre chaque géocodage pour respecter les rate limits
        if (toGeocode.indexOf(ens) < toGeocode.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    await db.enseignants.bulkAdd(newEnseignants);
    return newEnseignants;
  }

  async update(id: string, updates: Partial<Omit<Enseignant, 'id' | 'createdAt'>>): Promise<void> {
    // Si l'adresse change et qu'on ne fournit pas de nouvelles coordonnées, géocoder
    if (updates.adresse && updates.lat === undefined && updates.lon === undefined) {
      const existing = await this.getById(id);
      // Géocoder seulement si l'adresse a vraiment changé
      if (existing && updates.adresse !== existing.adresse) {
        const commune = updates.commune ?? existing.commune;
        const fullAddress = commune
          ? `${updates.adresse}, ${commune}`
          : updates.adresse;

        try {
          const geoResult = await geocodeWithFallback(fullAddress);
          if (geoResult.success && geoResult.point) {
            updates.lat = geoResult.point.lat;
            updates.lon = geoResult.point.lon;
            updates.geoStatus = toGeoStatus(geoResult.status);
            updates.geoErrorMessage = undefined;
          } else {
            updates.geoStatus = 'error';
            updates.geoErrorMessage = geoResult.errorMessage;
          }
        } catch (error) {
          console.error('Erreur géocodage enseignant:', error);
          updates.geoStatus = 'error';
          updates.geoErrorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        }
      }
    }

    await db.enseignants.update(id, updates);
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
