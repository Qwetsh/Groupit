// ============================================================
// FIELD DEFINITION - Colonnes dynamiques personnalisées
// ============================================================

export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date';

export type EntityType = 'eleve' | 'enseignant' | 'both';

export interface FieldDefinition {
  id: string;
  entityType: EntityType;
  key: string; // Slug stable ex: "cantine"
  label: string; // ex: "Mange à la cantine"
  type: FieldType;
  options?: string[]; // Pour select/multiselect
  defaultValue?: unknown;
  required?: boolean;
  order?: number; // Ordre d'affichage
  createdAt: Date;
  updatedAt: Date;
}
