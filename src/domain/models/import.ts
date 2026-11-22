// ============================================================
// IMPORT CSV - Types pour l'import de données
// ============================================================

import type { Eleve } from './eleve';
import type { Enseignant } from './enseignant';

export interface ColumnMapping {
  csvHeader: string;
  targetField: keyof Eleve | null;
  isIgnored: boolean;
}

export interface EnseignantColumnMapping {
  csvHeader: string;
  targetField: keyof Enseignant | null;
  isIgnored: boolean;
}

export interface ImportResult {
  success: boolean;
  eleves: Partial<Eleve>[];
  errors: string[];
  warnings: string[];
  mappings: ColumnMapping[];
}

// === Import matières oral pour élèves ===
