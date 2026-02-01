// ============================================================
// FILTRES UI - États des filtres pour l'interface
// ============================================================

export interface FilterEleves {
  classe?: string;
  option?: string;
  nonAffectesOnly: boolean;
  recherche: string;
}

export interface FilterEnseignants {
  matiere?: string;
  ppOnly: boolean;
  classePP?: string;
  classeEnCharge?: string;
  recherche: string;
}
