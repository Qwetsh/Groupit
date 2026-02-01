// ============================================================
// TYPES DE BASE - Groupit Application
// ============================================================

export type Sexe = 'M' | 'F' | 'Autre';

export type Niveau = '6e' | '5e' | '4e' | '3e';

export const NIVEAUX: readonly Niveau[] = ['6e', '5e', '4e', '3e'] as const;

export function isNiveau(value: string): value is Niveau {
  return NIVEAUX.includes(value as Niveau);
}

export function extractNiveau(classe: string): Niveau | null {
  const niveau = classe.replace(/[^0-9]/g, '')[0] + 'e';
  return isNiveau(niveau) ? niveau : null;
}

export type ScenarioMode = 'groupes' | 'matching';

export type ScenarioType = 'oral_dnb' | 'suivi_stage' | 'custom';

export type AffectationType = 'suivi_stage' | 'oral_dnb' | 'autre';

export type ContrainteType = 'doit_etre_avec' | 'ne_doit_pas_etre_avec';
