import { describe, it, expect } from 'vitest';
import { etapeDeDepart, etapesDuParcours, ETAPES_DE_CALCUL } from './guidedFlow';

describe('Parcours de l’assistant', () => {
  it('saute l’import des élèves quand ils sont déjà là', () => {
    expect(etapeDeDepart('oral_dnb', 60)).toBe('themes');
    expect(etapeDeDepart('suivi_stage', 117)).toBe('stages');
    expect(etapeDeDepart('personnalise', 30)).toBe('selection');
  });

  it('commence par l’import quand la base est vide', () => {
    expect(etapeDeDepart('oral_dnb', 0)).toBe('eleves');
    expect(etapeDeDepart('suivi_stage', 0)).toBe('eleves');
  });

  it('ne compte plus le récapitulatif ni les résultats comme des étapes', () => {
    for (const type of ['oral_dnb', 'suivi_stage', 'personnalise', null] as const) {
      const etapes = etapesDuParcours(type);
      for (const calcul of ETAPES_DE_CALCUL) expect(etapes).not.toContain(calcul);
    }
    expect(etapesDuParcours('oral_dnb')).toEqual(['eleves', 'themes', 'groupes', 'enseignants', 'configuration', 'salles']);
    expect(etapesDuParcours('suivi_stage')).toEqual(['eleves', 'stages', 'enseignants', 'configuration']);
  });
});
