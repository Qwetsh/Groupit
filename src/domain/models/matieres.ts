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

/** Retourne les heures hebdomadaires moyennes d'une matière */
export function getHeuresMatiere(matiere: string): number {
  const ref = MATIERES_HEURES_3E.find(m =>
    m.matiere.toLowerCase() === matiere.toLowerCase() ||
    matiere.toLowerCase().includes(m.matiere.toLowerCase())
  );
  return ref?.heuresMoyenne ?? 1; // Défaut: 1h si matière inconnue
}

/** Calcule le poids pédagogique normalisé (0-1) d'une matière */
export function getPoidsPedagogiqueNormalise(matiere: string): number {
  const heures = getHeuresMatiere(matiere);
  const maxHeures = Math.max(...MATIERES_HEURES_3E.map(m => m.heuresMoyenne));
  return heures / maxHeures;
}
