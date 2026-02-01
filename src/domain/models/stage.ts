// ============================================================
// STAGE - Modèle et types associés (Suivi de stage)
// ============================================================

/** Niveau de précision du géocodage */
export type GeoPrecision = 'FULL' | 'CITY' | 'TOWNHALL' | 'NONE';

/** Statut détaillé du géocodage avec fallback */
export type GeoStatusExtended =
  | 'PENDING'
  | 'OK_FULL'
  | 'OK_CITY_FALLBACK'
  | 'OK_TOWNHALL_FALLBACK'
  | 'ERROR';

export interface Stage {
  id: string;
  eleveId?: string; // Référence vers l'élève (optionnel si élève non trouvé)
  scenarioId?: string; // Optionnel - permet les stages globaux non liés à un scénario

  // Informations de l'élève (pour import sans correspondance)
  eleveNom?: string;
  elevePrenom?: string;
  eleveClasse?: string;

  // Informations du stage
  nomEntreprise?: string; // Nom de l'entreprise
  tuteur?: string;
  tuteurEmail?: string;
  tuteurTel?: string;
  secteurActivite?: string;

  // Adresse du stage
  adresse?: string; // Rendu optionnel pour permettre la création progressive
  codePostal?: string;
  ville?: string;

  // Géocodage (coordonnées)
  lat?: number;
  lon?: number;

  // Ancien statut (rétrocompatibilité)
  geoStatus?: 'pending' | 'ok' | 'error' | 'manual' | 'not_found';
  geoErrorMessage?: string;

  // Nouveaux champs géocodage avec fallback
  geoStatusExtended?: GeoStatusExtended;
  geoPrecision?: GeoPrecision;
  geoQueryUsed?: string; // La requête qui a abouti

  // Dates
  dateDebut?: string;
  dateFin?: string;

  // Notes / commentaires
  notes?: string;

  // Marqueur de données de test
  isTest?: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
