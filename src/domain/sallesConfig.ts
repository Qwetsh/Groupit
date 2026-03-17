// ============================================================
// CONFIGURATION DES SALLES DISPONIBLES POUR L'ORAL DNB
// ============================================================

export interface SalleInfo {
  numero: string;
  categorie: string;
}

export const SALLES_DISPONIBLES: SalleInfo[] = [
  // Réunion
  { numero: '105', categorie: 'Réunion' },

  // Salle info
  { numero: '210', categorie: 'Salle info' },

  // Enseignement général
  { numero: '113', categorie: 'Enseignement général' },
  { numero: '117', categorie: 'Enseignement général' },
  { numero: '116', categorie: 'Enseignement général' },
  { numero: '205', categorie: 'Enseignement général' },
  { numero: '215', categorie: 'Enseignement général' },
  { numero: '209', categorie: 'Enseignement général' },
  { numero: '211', categorie: 'Enseignement général' },
  { numero: '302', categorie: 'Enseignement général' },
  { numero: '304', categorie: 'Enseignement général' },
  { numero: '306', categorie: 'Enseignement général' },
  { numero: '401', categorie: 'Enseignement général' },
  { numero: '402', categorie: 'Enseignement général' },
  { numero: '403', categorie: 'Enseignement général' },
  { numero: '404', categorie: 'Enseignement général' },
  { numero: '405', categorie: 'Enseignement général' },
  { numero: '406', categorie: 'Enseignement général' },
  { numero: '407', categorie: 'Enseignement général' },
  { numero: '408', categorie: 'Enseignement général' },
  { numero: '409', categorie: 'Enseignement général' },
  { numero: '411', categorie: 'Enseignement général' },
  { numero: '412', categorie: 'Enseignement général' },

  // Sciences
  { numero: '307', categorie: 'Sciences' },
  { numero: '310', categorie: 'Sciences' },
  { numero: '311', categorie: 'Sciences' },

  // Techno
  { numero: '301', categorie: 'Techno' },
  { numero: '305', categorie: 'Techno' },
];

/** Catégories dans l'ordre d'affichage */
export const CATEGORIES_SALLES = [
  'Réunion',
  'Salle info',
  'Enseignement général',
  'Sciences',
  'Techno',
] as const;
