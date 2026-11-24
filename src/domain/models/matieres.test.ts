import { describe, it, expect } from 'vitest';
import {
  MATIERES_HEURES_3E,
  cleMatiere,
  getHeuresMatiere,
  getMatiereRef,
  matiereDeReference,
  memeMatiere,
  premiereMatiereCouverte,
} from './matieres';

describe('Référentiel des matières', () => {
  it('reconnaît chaque matière de référence sous son propre nom', () => {
    for (const { matiere } of MATIERES_HEURES_3E) {
      expect(matiereDeReference(matiere)).toBe(matiere);
    }
  });

  it.each([
    ['Maths', 'Mathématiques'],
    ['mathematiques', 'Mathématiques'],
    ['Histoire-Géo', 'Histoire-Géographie'],
    ['HISTOIRE GEOGRAPHIE', 'Histoire-Géographie'],
    ['Arts plastiques', 'Arts Plastiques'],
    ['Musique', 'Éducation Musicale'],
    ['  SVT ', 'SVT'],
    ['Physique Chimie', 'Physique-Chimie'],
    ['Lettres modernes', 'Français'],
    ['anglais', 'Anglais'],
  ])('« %s » → %s', (libelle, attendu) => {
    expect(matiereDeReference(libelle)).toBe(attendu);
  });

  it('compare deux libellés inconnus à la casse et aux accents près', () => {
    expect(memeMatiere('Documentation', 'documentation')).toBe(true);
    expect(memeMatiere('Éco-gestion', 'eco gestion')).toBe(true);
    expect(memeMatiere('Documentation', 'Technologie')).toBe(false);
  });

  it('ne fait jamais correspondre un libellé vide', () => {
    expect(cleMatiere('')).toBe('');
    expect(memeMatiere('', '')).toBe(false);
    expect(memeMatiere(undefined, null)).toBe(false);
  });

  it('trouve la première matière d\'un élève couverte par un jury', () => {
    expect(premiereMatiereCouverte(['Latin', 'SVT'], ['Maths', 'svt'])).toBe('SVT');
    expect(premiereMatiereCouverte(['Latin'], ['Maths'])).toBeNull();
    expect(premiereMatiereCouverte(undefined, ['Maths'])).toBeNull();
  });

  it('donne les heures de la matière quelle que soit son écriture', () => {
    expect(getHeuresMatiere('Maths')).toBe(4);
    expect(getMatiereRef('physique chimie')?.categorie).toBe('scientifique');
    expect(getHeuresMatiere('Documentation')).toBe(1);
  });
});
