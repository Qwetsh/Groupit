// ============================================================
// CRITÈRES DE NOTATION — Grille Oral DNB
// ============================================================

export interface CriterionLevel {
  label: string;
  value: number;
}

export interface Criterion {
  id: string;
  label: string;
  desc: string;
  category: 'oral' | 'sujet';
  levels: CriterionLevel[];
  max: number;
}

export const CRITERIA: Criterion[] = [
  {
    id: 'expression',
    label: 'Expression et présentation',
    desc: 'Vocabulaire précis, syntaxe correcte, débit adapté',
    category: 'oral',
    levels: [
      { label: 'Très insuffisant', value: 0.5 },
      { label: 'Insuffisant', value: 1 },
      { label: 'Satisfaisant', value: 1.5 },
      { label: 'Très satisfaisant', value: 2 },
    ],
    max: 2,
  },
  {
    id: 'diaporama',
    label: 'Qualité du diaporama',
    desc: 'Soin, lisibilité, structure, présentation visuelle',
    category: 'oral',
    levels: [
      { label: 'Très insuffisant', value: 1 },
      { label: 'Insuffisant', value: 2 },
      { label: 'Satisfaisant', value: 3 },
      { label: 'Très satisfaisant', value: 4 },
    ],
    max: 4,
  },
  {
    id: 'reactivite',
    label: 'Réactivité lors de l\'entretien',
    desc: 'Capacité à écouter et répondre avec pertinence',
    category: 'oral',
    levels: [
      { label: 'Très insuffisant', value: 0.5 },
      { label: 'Insuffisant', value: 1 },
      { label: 'Satisfaisant', value: 1.5 },
      { label: 'Très satisfaisant', value: 2 },
    ],
    max: 2,
  },
  {
    id: 'contenu',
    label: 'Contenu et connaissances',
    desc: 'Maîtrise des notions liées au sujet',
    category: 'sujet',
    levels: [
      { label: 'Très insuffisant', value: 2 },
      { label: 'Insuffisant', value: 3 },
      { label: 'Satisfaisant', value: 4 },
      { label: 'Très satisfaisant', value: 5 },
    ],
    max: 5,
  },
  {
    id: 'structure',
    label: 'Structure de l\'exposé',
    desc: 'Plan logique, intro, conclusion, respect du temps',
    category: 'sujet',
    levels: [
      { label: 'Très insuffisant', value: 0.5 },
      { label: 'Insuffisant', value: 1 },
      { label: 'Satisfaisant', value: 1.5 },
      { label: 'Très satisfaisant', value: 2 },
    ],
    max: 2,
  },
  {
    id: 'engagement',
    label: 'Engagement personnel',
    desc: 'Expérience, rencontres, ressenti',
    category: 'sujet',
    levels: [
      { label: 'Très insuffisant', value: 2 },
      { label: 'Insuffisant', value: 3 },
      { label: 'Satisfaisant', value: 4 },
      { label: 'Très satisfaisant', value: 5 },
    ],
    max: 5,
  },
];

export const LEVEL_SHORT = ['TI', 'I', 'S', 'TS'] as const;

export const MAX_TOTAL = 20;
export const MAX_ORAL = 8;
export const MAX_SUJET = 12;

export const TIMER_INDIVIDUEL = 15 * 60; // 15 minutes en secondes
export const TIMER_COLLECTIF = 25 * 60;  // 25 minutes en secondes

/** Calcule les totaux à partir des scores */
export function computeTotals(scores: Record<string, number | undefined>) {
  const oralCriteria = CRITERIA.filter(c => c.category === 'oral');
  const sujetCriteria = CRITERIA.filter(c => c.category === 'sujet');

  const totalOral = oralCriteria.reduce((sum, c) => sum + (scores[c.id] ?? 0), 0);
  const totalSujet = sujetCriteria.reduce((sum, c) => sum + (scores[c.id] ?? 0), 0);

  return {
    totalOral,
    totalSujet,
    total: totalOral + totalSujet,
  };
}

/** Vérifie si tous les critères sont notés */
export function allCriteriaScored(scores: Record<string, number | undefined>): boolean {
  return CRITERIA.every(c => scores[c.id] !== undefined);
}

/** Retourne les critères en désaccord entre 2 évaluations */
export function getDisagreements(
  scoresA: Record<string, number | undefined>,
  scoresB: Record<string, number | undefined>
): Criterion[] {
  return CRITERIA.filter(c =>
    scoresA[c.id] !== undefined &&
    scoresB[c.id] !== undefined &&
    scoresA[c.id] !== scoresB[c.id]
  );
}
