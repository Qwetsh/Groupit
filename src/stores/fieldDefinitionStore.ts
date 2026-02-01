// ============================================================
// ZUSTAND STORE - FIELD DEFINITIONS (Colonnes dynamiques)
// ============================================================

import { create } from 'zustand';
import type { FieldDefinition, EntityType, FieldType } from '../domain/models';
import { fieldDefinitionRepository } from '../infrastructure/repositories';
import { extractErrorMessage } from '../utils/errorUtils';

interface FieldDefinitionState {
  fieldDefinitions: FieldDefinition[];
  loading: boolean;
  error: string | null;

  // Actions
  loadFieldDefinitions: () => Promise<void>;
  addFieldDefinition: (field: {
    entityType: EntityType;
    label: string;
    type: FieldType;
    options?: string[];
    defaultValue?: unknown;
    required?: boolean;
  }) => Promise<FieldDefinition>;
  updateFieldDefinition: (id: string, updates: Partial<FieldDefinition>) => Promise<void>;
  deleteFieldDefinition: (id: string) => Promise<void>;
  reorderFieldDefinitions: (orderedIds: string[]) => Promise<void>;

  // Getters
  getFieldDefinitionById: (id: string) => FieldDefinition | undefined;
  getFieldDefinitionByKey: (key: string) => FieldDefinition | undefined;
  getFieldDefinitionsForEntity: (entityType: 'eleve' | 'enseignant') => FieldDefinition[];
}

export const useFieldDefinitionStore = create<FieldDefinitionState>((set, get) => ({
  fieldDefinitions: [],
  loading: false,
  error: null,

  loadFieldDefinitions: async () => {
    set({ loading: true, error: null });
    try {
      const fieldDefinitions = await fieldDefinitionRepository.getAll();
      set({ fieldDefinitions, loading: false });
    } catch (error) {
      set({ error: extractErrorMessage(error), loading: false });
    }
  },

  addFieldDefinition: async (field) => {
    try {
      const newField = await fieldDefinitionRepository.create(field);
      set((state) => ({
        fieldDefinitions: [...state.fieldDefinitions, newField].sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        ),
      }));
      return newField;
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  updateFieldDefinition: async (id, updates) => {
    try {
      await fieldDefinitionRepository.update(id, updates);
      set((state) => ({
        fieldDefinitions: state.fieldDefinitions.map((f) =>
          f.id === id ? { ...f, ...updates, updatedAt: new Date() } : f
        ),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  deleteFieldDefinition: async (id) => {
    try {
      await fieldDefinitionRepository.delete(id);
      set((state) => ({
        fieldDefinitions: state.fieldDefinitions.filter((f) => f.id !== id),
      }));
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  reorderFieldDefinitions: async (orderedIds) => {
    try {
      await fieldDefinitionRepository.reorder(orderedIds);
      set((state) => {
        const reordered = orderedIds
          .map((id, index) => {
            const field = state.fieldDefinitions.find((f) => f.id === id);
            return field ? { ...field, order: index } : null;
          })
          .filter(Boolean) as FieldDefinition[];
        return { fieldDefinitions: reordered };
      });
    } catch (error) {
      set({ error: extractErrorMessage(error) });
      throw error;
    }
  },

  getFieldDefinitionById: (id) => {
    return get().fieldDefinitions.find((f) => f.id === id);
  },

  getFieldDefinitionByKey: (key) => {
    return get().fieldDefinitions.find((f) => f.key === key);
  },

  getFieldDefinitionsForEntity: (entityType) => {
    return get().fieldDefinitions.filter(
      (f) => f.entityType === entityType || f.entityType === 'both'
    );
  },
}));
