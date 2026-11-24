// ============================================================
// PARCOURS DE L’ASSISTANT : étapes et point de départ
// ============================================================

import type { GuidedStep, GuidedScenarioType } from "../../stores/uiStore";

// Étapes visibles de chaque parcours ('recap' lance le calcul, 'results' ouvre le tableau)
export const STEPS_BASE: GuidedStep[] = ['eleves', 'enseignants', 'configuration'];
const STEPS_ORAL_DNB: GuidedStep[] = ['eleves', 'themes', 'groupes', 'enseignants', 'configuration', 'salles'];
const STEPS_STAGE: GuidedStep[] = ['eleves', 'stages', 'enseignants', 'configuration'];
const STEPS_CUSTOM: GuidedStep[] = ['eleves', 'selection', 'adultes', 'parametres'];
export const ETAPES_DE_CALCUL: GuidedStep[] = ['recap', 'results'];

export const STEP_LABELS: Record<GuidedStep, string> = {
  welcome: 'Bienvenue',
  scenario: 'Type',
  eleves: 'Élèves',
  stages: 'Stages',
  themes: 'Sujets',
  groupes: 'Groupes',
  enseignants: 'Enseignants',
  configuration: 'Réglages',
  salles: 'Salles',
  selection: 'Sélection',
  adultes: 'Adultes',
  parametres: 'Paramètres',
  recap: 'Calcul',
  results: 'Résultats',
};

export function etapesDuParcours(type: GuidedScenarioType): GuidedStep[] {
  if (type === 'oral_dnb') return STEPS_ORAL_DNB;
  if (type === 'suivi_stage') return STEPS_STAGE;
  if (type === 'personnalise') return STEPS_CUSTOM;
  return STEPS_BASE;
}

/** Première étape utile : on saute l'import des élèves s'ils sont déjà là. */
export function etapeDeDepart(type: GuidedScenarioType, nbEleves: number): GuidedStep {
  const etapes = etapesDuParcours(type);
  return nbEleves > 0 && etapes[0] === 'eleves' ? etapes[1] : etapes[0];
}
