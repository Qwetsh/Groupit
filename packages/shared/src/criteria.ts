// ============================================================
// CRITÈRES DE NOTATION — Grille Oral DNB (configurable)
// ============================================================

export interface CriterionLevel {
  label: string;
  shortLabel: string;
  value: number;
}

export interface Criterion {
  id: string;
  label: string;
  desc: string;
  category: string;
  levels: CriterionLevel[];
  max: number;
}

// --- Types pour la configuration dynamique ---

export interface CriteriaCategory {
  id: string;
  label: string;
  emoji?: string;
}

export interface CriterionConfig {
  id: string;
  label: string;
  desc: string;
  categoryId: string;
  levels: { label: string; shortLabel: string; value: number }[];
  max: number;
}

export interface CriteriaConfig {
  categories: CriteriaCategory[];
  criteria: CriterionConfig[];
}

// --- Configuration par défaut (6 critères DNB 2025) ---

export const DEFAULT_CRITERIA_CONFIG: CriteriaConfig = {
  categories: [
    { id: 'oral', label: 'Maîtrise de la présentation orale', emoji: '\u{1F5E3}\u{FE0F}' },
    { id: 'sujet', label: 'Maîtrise du sujet présenté', emoji: '\u{1F9E0}' },
  ],
  criteria: [
    {
      id: 'expression',
      label: 'Expression et présentation',
      desc: 'Vocabulaire précis, syntaxe correcte, débit adapté, posture',
      categoryId: 'oral',
      levels: [
        { label: 'Très insuffisant', shortLabel: 'TI', value: 1 },
        { label: 'Insuffisant', shortLabel: 'I', value: 2 },
        { label: 'Satisfaisant', shortLabel: 'S', value: 3 },
        { label: 'Très satisfaisant', shortLabel: 'TS', value: 4 },
      ],
      max: 4,
    },
    {
      id: 'diaporama',
      label: 'Qualité du support',
      desc: 'Soin, lisibilité, structure des diapositives, présentation visuelle',
      categoryId: 'oral',
      levels: [
        { label: 'Très insuffisant', shortLabel: 'TI', value: 0.5 },
        { label: 'Insuffisant', shortLabel: 'I', value: 1 },
        { label: 'Satisfaisant', shortLabel: 'S', value: 1.5 },
        { label: 'Très satisfaisant', shortLabel: 'TS', value: 2 },
      ],
      max: 2,
    },
    {
      id: 'reactivite',
      label: 'Réactivité lors de l\'entretien',
      desc: 'Capacité à écouter les questions et à y répondre avec pertinence',
      categoryId: 'oral',
      levels: [
        { label: 'Très insuffisant', shortLabel: 'TI', value: 0.5 },
        { label: 'Insuffisant', shortLabel: 'I', value: 1 },
        { label: 'Satisfaisant', shortLabel: 'S', value: 1.5 },
        { label: 'Très satisfaisant', shortLabel: 'TS', value: 2 },
      ],
      max: 2,
    },
    {
      id: 'contenu',
      label: 'Contenu et connaissances',
      desc: 'Maîtrise des notions liées au sujet (Histoire des arts, EPI, etc.)',
      categoryId: 'sujet',
      levels: [
        { label: 'Très insuffisant', shortLabel: 'TI', value: 2 },
        { label: 'Insuffisant', shortLabel: 'I', value: 3 },
        { label: 'Satisfaisant', shortLabel: 'S', value: 4 },
        { label: 'Très satisfaisant', shortLabel: 'TS', value: 5 },
      ],
      max: 5,
    },
    {
      id: 'structure',
      label: 'Structure de l\'exposé',
      desc: 'Plan logique, introduction claire, conclusion et respect du temps de parole',
      categoryId: 'sujet',
      levels: [
        { label: 'Très insuffisant', shortLabel: 'TI', value: 0.5 },
        { label: 'Insuffisant', shortLabel: 'I', value: 1 },
        { label: 'Satisfaisant', shortLabel: 'S', value: 1.5 },
        { label: 'Très satisfaisant', shortLabel: 'TS', value: 2 },
      ],
      max: 2,
    },
    {
      id: 'engagement',
      label: 'Engagement personnel',
      desc: 'Capacité à rendre compte de son expérience, de ses rencontres et de son ressenti',
      categoryId: 'sujet',
      levels: [
        { label: 'Très insuffisant', shortLabel: 'TI', value: 2 },
        { label: 'Insuffisant', shortLabel: 'I', value: 3 },
        { label: 'Satisfaisant', shortLabel: 'S', value: 4 },
        { label: 'Très satisfaisant', shortLabel: 'TS', value: 5 },
      ],
      max: 5,
    },
  ],
};

/** Alias backward-compat : liste de Criterion avec category string */
export const CRITERIA: Criterion[] = DEFAULT_CRITERIA_CONFIG.criteria.map(c => ({
  ...c,
  category: c.categoryId,
}));

export const LEVEL_SHORT = ['TI', 'I', 'S', 'TS'] as const;

export const TIMER_INDIVIDUEL = 15 * 60; // 15 minutes en secondes
export const TIMER_COLLECTIF = 25 * 60;  // 25 minutes en secondes

// --- Fonctions utilitaires dynamiques ---

/** Convertit un CriterionConfig en Criterion (pour CriterionRow) */
export function toCriterion(c: CriterionConfig): Criterion {
  return { ...c, category: c.categoryId };
}

/** Calcule le total max d'une config */
export function computeMaxTotal(config: CriteriaConfig): number {
  return config.criteria.reduce((sum, c) => sum + c.max, 0);
}

/** Calcule le total max par catégorie */
export function computeMaxByCategory(config: CriteriaConfig): Record<string, number> {
  const result: Record<string, number> = {};
  for (const cat of config.categories) {
    result[cat.id] = config.criteria
      .filter(c => c.categoryId === cat.id)
      .reduce((sum, c) => sum + c.max, 0);
  }
  return result;
}

/** Calcule les totaux par catégorie à partir des scores */
export function computeCategoryTotals(
  scores: Record<string, number | undefined>,
  config: CriteriaConfig
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const cat of config.categories) {
    result[cat.id] = config.criteria
      .filter(c => c.categoryId === cat.id)
      .reduce((sum, c) => sum + (scores[c.id] ?? 0), 0);
  }
  return result;
}

/** Calcule les totaux à partir des scores (compatible config dynamique) */
export function computeTotals(
  scores: Record<string, number | undefined>,
  config: CriteriaConfig = DEFAULT_CRITERIA_CONFIG
) {
  const categoryTotals = computeCategoryTotals(scores, config);
  const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // Backward compat : totalOral / totalSujet
  return {
    categoryTotals,
    totalOral: categoryTotals['oral'] ?? 0,
    totalSujet: categoryTotals['sujet'] ?? 0,
    total,
  };
}

/** Vérifie si tous les critères sont notés */
export function allCriteriaScored(
  scores: Record<string, number | undefined>,
  config: CriteriaConfig = DEFAULT_CRITERIA_CONFIG
): boolean {
  return config.criteria.every(c => scores[c.id] !== undefined);
}

/** Retourne les critères en désaccord entre 2 évaluations */
export function getDisagreements(
  scoresA: Record<string, number | undefined>,
  scoresB: Record<string, number | undefined>,
  config: CriteriaConfig = DEFAULT_CRITERIA_CONFIG
): CriterionConfig[] {
  return config.criteria.filter(c =>
    scoresA[c.id] !== undefined &&
    scoresB[c.id] !== undefined &&
    scoresA[c.id] !== scoresB[c.id]
  );
}

/** Valide une CriteriaConfig (3-8 critères, niveaux non vides, max cohérent) */
export function validateCriteriaConfig(config: CriteriaConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.categories.length === 0) {
    errors.push('Au moins une catégorie est requise.');
  }

  if (config.criteria.length < 3 || config.criteria.length > 8) {
    errors.push(`Le nombre de critères doit être entre 3 et 8 (actuel : ${config.criteria.length}).`);
  }

  for (const c of config.criteria) {
    if (!c.id || !c.label) {
      errors.push(`Chaque critère doit avoir un id et un label.`);
    }
    if (c.levels.length === 0) {
      errors.push(`Le critère "${c.label}" doit avoir au moins un niveau.`);
    }
    const maxLevel = Math.max(...c.levels.map(l => l.value));
    if (c.max !== maxLevel) {
      errors.push(`Le critère "${c.label}" : max (${c.max}) ne correspond pas au niveau le plus élevé (${maxLevel}).`);
    }
    const catExists = config.categories.some(cat => cat.id === c.categoryId);
    if (!catExists) {
      errors.push(`Le critère "${c.label}" référence la catégorie "${c.categoryId}" qui n'existe pas.`);
    }
  }

  // Vérifier que chaque catégorie a au moins un critère
  for (const cat of config.categories) {
    if (!config.criteria.some(c => c.categoryId === cat.id)) {
      errors.push(`La catégorie "${cat.label}" n'a aucun critère.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// --- Constantes calculées (backward compat) ---

export const MAX_TOTAL = computeMaxTotal(DEFAULT_CRITERIA_CONFIG);
export const MAX_ORAL = computeMaxByCategory(DEFAULT_CRITERIA_CONFIG)['oral'] ?? 0;
export const MAX_SUJET = computeMaxByCategory(DEFAULT_CRITERIA_CONFIG)['sujet'] ?? 0;
