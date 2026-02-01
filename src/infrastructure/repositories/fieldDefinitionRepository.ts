// ============================================================
// REPOSITORY - FIELD DEFINITIONS (Colonnes dynamiques)
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { FieldDefinition, EntityType } from '../../domain/models';

// Génère un slug à partir du label
function generateKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
    .replace(/[^a-z0-9]+/g, '_')     // Remplacer espaces/spéciaux par _
    .replace(/^_+|_+$/g, '')         // Trim underscores
    .substring(0, 50);               // Max 50 chars
}

// Note: Les timestamps (createdAt, updatedAt) sont gérés automatiquement
// par les hooks Dexie dans db.ts - ne pas les définir ici.

export class FieldDefinitionRepository {
  async getAll(): Promise<FieldDefinition[]> {
    return db.fieldDefinitions.orderBy('order').toArray();
  }

  async getById(id: string): Promise<FieldDefinition | undefined> {
    return db.fieldDefinitions.get(id);
  }

  async getByKey(key: string): Promise<FieldDefinition | undefined> {
    return db.fieldDefinitions.where('key').equals(key).first();
  }

  async getByEntityType(entityType: EntityType): Promise<FieldDefinition[]> {
    return db.fieldDefinitions
      .where('entityType')
      .anyOf([entityType, 'both'])
      .sortBy('order');
  }

  async create(
    field: Omit<FieldDefinition, 'id' | 'key' | 'createdAt' | 'updatedAt'> & { key?: string }
  ): Promise<FieldDefinition> {
    // Générer une clé unique si non fournie
    let key = field.key || generateKey(field.label);
    
    // Vérifier l'unicité de la clé
    let suffix = 0;
    let originalKey = key;
    while (await this.getByKey(key)) {
      suffix++;
      key = `${originalKey}_${suffix}`;
    }

    // Calculer l'ordre (ajouter à la fin)
    const allFields = await this.getAll();
    const maxOrder = allFields.reduce((max, f) => Math.max(max, f.order || 0), 0);

    const newField = {
      ...field,
      id: uuidv4(),
      key,
      order: field.order ?? maxOrder + 1,
    } as FieldDefinition;

    await db.fieldDefinitions.add(newField);
    return newField;
  }

  async update(
    id: string,
    updates: Partial<Omit<FieldDefinition, 'id' | 'key' | 'createdAt'>>
  ): Promise<void> {
    await db.fieldDefinitions.update(id, updates);
  }

  async delete(id: string): Promise<void> {
    await db.fieldDefinitions.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.fieldDefinitions.clear();
  }

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.fieldDefinitions, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.fieldDefinitions.update(orderedIds[i], { order: i });
      }
    });
  }
}

export const fieldDefinitionRepository = new FieldDefinitionRepository();
