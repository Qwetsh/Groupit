// ============================================================
// DONNÉES DE RÉFÉRENCE - Matières et heures hebdomadaires
// ============================================================

export interface MatiereHeuresRef {
  matiere: string;
  heuresMin: number;
  heuresMax: number;
  heuresMoyenne: number;
  categorie: 'fondamentale' | 'scientifique' | 'linguistique' | 'artistique' | 'sportive' | 'technologique';
}

export const MATIERES_HEURES_3E: MatiereHeuresRef[] = [
  { matiere: 'Français', heuresMin: 4, heuresMax: 4.5, heuresMoyenne: 4.25, categorie: 'fondamentale' },
  { matiere: 'Mathématiques', heuresMin: 3.5, heuresMax: 4.5, heuresMoyenne: 4, categorie: 'fondamentale' },
  { matiere: 'Histoire-Géographie', heuresMin: 3, heuresMax: 3.5, heuresMoyenne: 3.25, categorie: 'fondamentale' },
  { matiere: 'EMC', heuresMin: 0.5, heuresMax: 0.5, heuresMoyenne: 0.5, categorie: 'fondamentale' },
  { matiere: 'Anglais', heuresMin: 3, heuresMax: 3, heuresMoyenne: 3, categorie: 'linguistique' },
  { matiere: 'LV2', heuresMin: 2.5, heuresMax: 2.5, heuresMoyenne: 2.5, categorie: 'linguistique' },
  { matiere: 'Espagnol', heuresMin: 2.5, heuresMax: 2.5, heuresMoyenne: 2.5, categorie: 'linguistique' },
  { matiere: 'Allemand', heuresMin: 2.5, heuresMax: 2.5, heuresMoyenne: 2.5, categorie: 'linguistique' },
  { matiere: 'Italien', heuresMin: 2.5, heuresMax: 2.5, heuresMoyenne: 2.5, categorie: 'linguistique' },
  { matiere: 'EPS', heuresMin: 3, heuresMax: 3, heuresMoyenne: 3, categorie: 'sportive' },
  { matiere: 'SVT', heuresMin: 1.5, heuresMax: 1.5, heuresMoyenne: 1.5, categorie: 'scientifique' },
  { matiere: 'Physique-Chimie', heuresMin: 1.5, heuresMax: 1.5, heuresMoyenne: 1.5, categorie: 'scientifique' },
  { matiere: 'Technologie', heuresMin: 1.5, heuresMax: 1.5, heuresMoyenne: 1.5, categorie: 'technologique' },
  { matiere: 'Arts Plastiques', heuresMin: 1, heuresMax: 1, heuresMoyenne: 1, categorie: 'artistique' },
  { matiere: 'Éducation Musicale', heuresMin: 1, heuresMax: 1, heuresMoyenne: 1, categorie: 'artistique' },
  { matiere: 'Latin', heuresMin: 2, heuresMax: 3, heuresMoyenne: 2.5, categorie: 'linguistique' },
  { matiere: 'Grec', heuresMin: 2, heuresMax: 3, heuresMoyenne: 2.5, categorie: 'linguistique' },
];

// ============ PARCOURS ORAL DNB ============

export const PARCOURS_ORAL_DNB = [
  'EPI',
  'Histoire des Sciences',
  'Parcours Avenir',
  'Parcours Citoyen',
  'Parcours Santé',
  'Parcours Artistique',
] as const;

/** Retourne les heures hebdomadaires moyennes d'une matière */
export function getHeuresMatiere(matiere: string): number {
  return getMatiereRef(matiere)?.heuresMoyenne ?? 1; // Défaut: 1h si matière inconnue
}

/** Fiche de référence d'une matière (heures, catégorie), quelle que soit son écriture. */
export function getMatiereRef(matiere: string | null | undefined): MatiereHeuresRef | undefined {
  const cle = cleMatiere(matiere);
  if (!cle) return undefined;
  return MATIERES_HEURES_3E.find(m => cleMatiere(m.matiere) === cle);
}

/** Calcule le poids pédagogique normalisé (0-1) d'une matière */
export function getPoidsPedagogiqueNormalise(matiere: string): number {
  const heures = getHeuresMatiere(matiere);
  const maxHeures = Math.max(...MATIERES_HEURES_3E.map(m => m.heuresMoyenne));
  return heures / maxHeures;
}

// Langues étrangères disponibles pour l'oral DNB
export const LANGUES_ETRANGERES = ['Anglais', 'Espagnol', 'Allemand', 'Chinois'] as const;

// ============ RÉFÉRENTIEL : une matière, plusieurs écritures ============
//
// Les matières des élèves viennent d'une liste fermée, celles des enseignants
// d'une saisie libre ou d'un import (« Maths », « Histoire-Géo », « SVT  »).
// Les comparer à la lettre près fait rater des correspondances. On ramène donc
// chaque libellé à une clé : celle de la matière de référence quand on la
// reconnaît, sinon le libellé simplifié (deux écritures identiques à la casse
// et aux accents près restent ainsi reconnues entre elles).

/** Retire accents, casse, ponctuation et espaces superflus. */
export function simplifierLibelle(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Écritures courantes → matière de référence (libellés déjà simplifiés). */
const ALIAS_MATIERES: Record<string, string> = {
  'francais': 'Français',
  'lettres': 'Français',
  'lettres modernes': 'Français',
  'lettres classiques': 'Français',
  'mathematiques': 'Mathématiques',
  'mathematique': 'Mathématiques',
  'maths': 'Mathématiques',
  'math': 'Mathématiques',
  'histoire geographie': 'Histoire-Géographie',
  'histoire geo': 'Histoire-Géographie',
  'histoire et geographie': 'Histoire-Géographie',
  'histoire geographie emc': 'Histoire-Géographie',
  'hg': 'Histoire-Géographie',
  'hgemc': 'Histoire-Géographie',
  'emc': 'EMC',
  'education morale et civique': 'EMC',
  'anglais': 'Anglais',
  'lv1 anglais': 'Anglais',
  'espagnol': 'Espagnol',
  'lv2 espagnol': 'Espagnol',
  'allemand': 'Allemand',
  'lv2 allemand': 'Allemand',
  'italien': 'Italien',
  'lv2 italien': 'Italien',
  'chinois': 'Chinois',
  'lv2': 'LV2',
  'eps': 'EPS',
  'education physique et sportive': 'EPS',
  'education physique': 'EPS',
  'sport': 'EPS',
  'svt': 'SVT',
  'sciences de la vie et de la terre': 'SVT',
  'physique chimie': 'Physique-Chimie',
  'physique': 'Physique-Chimie',
  'sciences physiques': 'Physique-Chimie',
  'pc': 'Physique-Chimie',
  'technologie': 'Technologie',
  'techno': 'Technologie',
  'arts plastiques': 'Arts Plastiques',
  'arts plastique': 'Arts Plastiques',
  'art plastique': 'Arts Plastiques',
  'education musicale': 'Éducation Musicale',
  'musique': 'Éducation Musicale',
  'latin': 'Latin',
  'lca latin': 'Latin',
  'grec': 'Grec',
  'lca grec': 'Grec',
};

/**
 * Matière de référence correspondant à un libellé (« Maths » → « Mathématiques »),
 * ou `null` si le libellé n'est pas reconnu.
 */
export function matiereDeReference(libelle: string | null | undefined): string | null {
  if (!libelle) return null;
  return ALIAS_MATIERES[simplifierLibelle(libelle)] ?? null;
}

/**
 * Clé de comparaison d'une matière : deux libellés désignent la même matière
 * si et seulement s'ils ont la même clé. Chaîne vide pour un libellé vide.
 */
export function cleMatiere(libelle: string | null | undefined): string {
  if (!libelle) return '';
  const reference = matiereDeReference(libelle);
  return simplifierLibelle(reference ?? libelle);
}

/** Vrai si les deux libellés désignent la même matière. */
export function memeMatiere(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = cleMatiere(a);
  return ka !== '' && ka === cleMatiere(b);
}

/**
 * Première matière de `matieres` couverte par `matieresJury`, ou `null`.
 * Les deux listes peuvent être écrites différemment.
 */
export function premiereMatiereCouverte(
  matieres: readonly string[] | undefined,
  matieresJury: readonly string[]
): string | null {
  if (!matieres?.length) return null;
  const cles = new Set(matieresJury.map(cleMatiere).filter(Boolean));
  return matieres.find(m => cles.has(cleMatiere(m))) ?? null;
}
