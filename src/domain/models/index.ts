// ============================================================
// DOMAIN MODELS - Groupit Application
// ============================================================

// Importer les types de critères pour usage interne
import type { CritereInstance as CritereInstanceType } from '../criteriaConfig';

// Réexporter les types de critères
export type { 
  PriorityLevel, 
  CritereDefinition, 
  CritereInstance 
} from '../criteriaConfig';

export { 
  CRITERE_DEFINITIONS,
  getCriteresForScenarioType,
  getForcedCriteresForScenarioType,
  getOptionalCriteresForScenarioType,
  createCritereInstance,
  createDefaultCriteres,
  getEffectiveCriteres,
  priorityToWeight,
  weightToPriority,
  getCritereDefinition,
  isCritereActive,
  getActiveCriteres,
} from '../criteriaConfig';

// ============ TYPES DE BASE ============

export type Sexe = 'M' | 'F' | 'Autre';

export type Niveau = '6e' | '5e' | '4e' | '3e';

export const NIVEAUX: readonly Niveau[] = ['6e', '5e', '4e', '3e'] as const;

export function isNiveau(value: string): value is Niveau {
  return NIVEAUX.includes(value as Niveau);
}

export function extractNiveau(classe: string): Niveau | null {
  const niveau = classe.replace(/[^0-9]/g, '')[0] + 'e';
  return isNiveau(niveau) ? niveau : null;
}

export type ScenarioMode = 'groupes' | 'matching';

// Types de scénarios supportés
export type ScenarioType = 'oral_dnb' | 'suivi_stage' | 'custom';

export type AffectationType = 'suivi_stage' | 'oral_dnb' | 'autre';

export type ContrainteType = 'doit_etre_avec' | 'ne_doit_pas_etre_avec';

// ============ TABLE DE RÉFÉRENCE HEURES HEBDOMADAIRES 3e ============
// Utilisé pour pondérer l'importance pédagogique des matières

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

// Helper pour obtenir les heures d'une matière
export function getHeuresMatiere(matiere: string): number {
  const ref = MATIERES_HEURES_3E.find(m => 
    m.matiere.toLowerCase() === matiere.toLowerCase() ||
    matiere.toLowerCase().includes(m.matiere.toLowerCase())
  );
  return ref?.heuresMoyenne ?? 1; // Défaut: 1h si matière inconnue
}

// Calcul du poids pédagogique normalisé (0-1)
export function getPoidsPedagogiqueNormalise(matiere: string): number {
  const heures = getHeuresMatiere(matiere);
  const maxHeures = Math.max(...MATIERES_HEURES_3E.map(m => m.heuresMoyenne));
  return heures / maxHeures;
}

// ============ CALCUL CAPACITÉ STAGE ============

/** Capacité maximale souhaitée par enseignant (6 élèves max si possible) */
const CAPACITE_MAX_SOUHAITEE = 6;

/** Capacité minimale pour un enseignant ayant des 3èmes */
const CAPACITE_MIN = 1;

/**
 * Calcule la capacité de stage pour chaque enseignant basée sur:
 * - Le nombre de classes de 3ème qu'il enseigne
 * - Les heures hebdomadaires de sa matière en 3ème
 * - Un plafond de 6 élèves max par enseignant (si possible)
 *
 * Formule:
 * 1. poids_prof = heures_matière × nb_classes_3e
 * 2. capacité_brute = round((poids_prof / poids_total) × nb_élèves_3e)
 * 3. plafond = max(6, ceil(nb_élèves / nb_profs_3e)) pour couvrir tous les élèves
 * 4. capacité_finale = min(capacité_brute, plafond), minimum 1
 *
 * @param enseignants Liste des enseignants
 * @param eleves Liste des élèves (pour compter les 3èmes)
 * @returns Map<enseignantId, capaciteCalculee>
 */
export function calculateCapacitesStage(
  enseignants: { id?: string; matierePrincipale: string; classesEnCharge?: string[] }[],
  eleves: { classe: string }[]
): Map<string, number> {
  const result = new Map<string, number>();

  // Compter les élèves de 3ème
  const nb3e = eleves.filter(e => e.classe.startsWith('3')).length;

  if (nb3e === 0) {
    // Pas d'élèves de 3ème, capacité 0 pour tous
    enseignants.forEach(e => {
      if (e.id) result.set(e.id, 0);
    });
    return result;
  }

  // Calculer le poids de chaque enseignant
  const poidsParEnseignant = new Map<string, number>();
  let poidsTotalGlobal = 0;

  for (const ens of enseignants) {
    if (!ens.id) continue;

    // Compter les classes de 3ème de cet enseignant
    const nbClasses3e = (ens.classesEnCharge || []).filter(c => c.startsWith('3')).length;

    if (nbClasses3e === 0) {
      // Pas de 3ème => capacité 0
      result.set(ens.id, 0);
      continue;
    }

    // Récupérer les heures de la matière
    const heures = getHeuresMatiere(ens.matierePrincipale);

    // Poids = heures × nombre de classes de 3e
    const poids = heures * nbClasses3e;
    poidsParEnseignant.set(ens.id, poids);
    poidsTotalGlobal += poids;
  }

  // Nombre d'enseignants ayant des 3èmes
  const nbProfs3e = poidsParEnseignant.size;

  if (nbProfs3e === 0 || poidsTotalGlobal === 0) {
    return result;
  }

  // Calculer le plafond: 6 si possible, sinon le minimum nécessaire pour couvrir tous les élèves
  const capaciteMoyenneRequise = Math.ceil(nb3e / nbProfs3e);
  const plafond = Math.max(CAPACITE_MAX_SOUHAITEE, capaciteMoyenneRequise);

  // Phase 1: Calculer les capacités brutes selon les poids
  const capacitesBrutes = new Map<string, number>();
  for (const [ensId, poids] of poidsParEnseignant) {
    // Utiliser round au lieu de ceil pour une répartition plus équilibrée
    const capaciteBrute = Math.round((poids / poidsTotalGlobal) * nb3e);
    capacitesBrutes.set(ensId, capaciteBrute);
  }

  // Phase 2: Plafonner et s'assurer d'un minimum de 1
  let totalCapacite = 0;
  for (const [ensId, capaciteBrute] of capacitesBrutes) {
    const capacite = Math.max(CAPACITE_MIN, Math.min(capaciteBrute, plafond));
    result.set(ensId, capacite);
    totalCapacite += capacite;
  }

  // Phase 3: Ajuster si le total ne couvre pas tous les élèves
  // (peut arriver à cause des arrondis)
  let deficit = nb3e - totalCapacite;

  if (deficit > 0) {
    // Trier par poids décroissant pour donner la priorité aux profs avec plus de charge
    const enseignantsTriesParPoids = Array.from(poidsParEnseignant.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [ensId] of enseignantsTriesParPoids) {
      if (deficit <= 0) break;
      const capaciteActuelle = result.get(ensId)!;
      if (capaciteActuelle < plafond) {
        const ajout = Math.min(deficit, plafond - capaciteActuelle);
        result.set(ensId, capaciteActuelle + ajout);
        deficit -= ajout;
      }
    }

    // Si toujours en déficit (tous au plafond), augmenter le plafond pour les plus chargés
    if (deficit > 0) {
      for (const [ensId] of enseignantsTriesParPoids) {
        if (deficit <= 0) break;
        const capaciteActuelle = result.get(ensId)!;
        result.set(ensId, capaciteActuelle + 1);
        deficit -= 1;
      }
    }
  }

  return result;
}

/**
 * Retourne la capacité de stage d'un enseignant individuel
 */
export function getCapaciteStageCalculee(
  enseignant: { id?: string; matierePrincipale: string; classesEnCharge?: string[] },
  enseignants: { id?: string; matierePrincipale: string; classesEnCharge?: string[] }[],
  eleves: { classe: string }[]
): number {
  if (!enseignant.id) return 0;
  const capacites = calculateCapacitesStage(enseignants, eleves);
  return capacites.get(enseignant.id) ?? 0;
}

// ============ CONTRAINTE RELATIONNELLE ============

export interface Contrainte {
  type: ContrainteType;
  cibleType: 'eleve' | 'enseignant';
  cibleId: string;
  raison?: string;
}

// ============ FIELD DEFINITION (Colonnes dynamiques) ============

export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date';
export type EntityType = 'eleve' | 'enseignant' | 'both';

export interface FieldDefinition {
  id: string;
  entityType: EntityType;
  key: string;           // Slug stable ex: "cantine"
  label: string;         // ex: "Mange à la cantine"
  type: FieldType;
  options?: string[];    // Pour select/multiselect
  defaultValue?: unknown;
  required?: boolean;
  order?: number;        // Ordre d'affichage
  createdAt: Date;
  updatedAt: Date;
}

// ============ ÉLÈVE ============

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  classe: string; // OBLIGATOIRE
  dateNaissance?: string; // format ISO ou jj/mm/aaaa
  sexe?: Sexe;
  email?: string;
  options: string[]; // ex: ["Latin", "Allemand"]
  regime?: string; // ex: "Demi-pensionnaire", "Externe"
  tags: string[];
  contraintes: Contrainte[];
  
  // Champs personnalisés (colonnes dynamiques)
  customFields?: Record<string, unknown>;
  
  // V2 - Emploi du temps
  emploiDuTemps?: EmploiDuTemps;
  
  // Métadonnées import
  encouragementValorisation?: string;
  autresChamps?: Record<string, string>;
  
  // === ORAL DNB SPECIFIQUE ===
  // Matière(s) choisie(s) par l'élève pour son oral
  matieresOral?: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============ ENSEIGNANT ============

export interface HeuresParNiveau {
  '6e': number;
  '5e': number;
  '4e': number;
  '3e': number;
}

export interface Enseignant {
  id: string;
  nom: string;
  prenom: string;
  matierePrincipale: string; // ex: "SVT", "Histoire-Géo"
  matiereSecondaire?: string[]; // matières secondaires enseignées
  classesEnCharge: string[]; // ex: ["3A", "3D", "4B"]
  estProfPrincipal: boolean;
  classePP?: string; // si PP, sa classe principale
  
  // Localisation (domicile pour suivi de stage)
  adresse?: string;
  commune?: string;
  lat?: number;
  lon?: number;
  geoStatus?: 'pending' | 'ok' | 'error' | 'manual' | 'not_found';
  geoErrorMessage?: string;
  
  // Capacité selon le type de scénario
  heuresParNiveau?: HeuresParNiveau;
  capaciteBase?: number;  // Oral DNB: nb max d'élèves par enseignant/jury
  capaciteStage?: number; // Suivi Stage: nb max de stages à encadrer
  
  // Exclusions pour suivi de stage
  stageExclusions?: Array<{
    type: 'classe' | 'zone' | 'eleve' | 'secteur';
    value: string;
    reason?: string;
  }>;
  
  tags: string[];
  
  // Champs personnalisés (colonnes dynamiques)
  customFields?: Record<string, unknown>;
  
  // V2 - Emploi du temps
  emploiDuTemps?: EmploiDuTemps;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============ METADATA AFFECTATION ============

export interface MetadataSuiviStage {
  lieuStageNom?: string;
  adresseStage?: string;
  latStage?: number;
  lonStage?: number;
  entreprise?: string;
  tuteur?: string;
  dateDebut?: string;
  dateFin?: string;
}

export interface MetadataOralDNB {
  theme?: string;
  matiereOralChoisieParEleve?: string;
  dateCreneau?: string;
  heureCreneau?: string;
  salle?: string;
}

export type AffectationMetadata = MetadataSuiviStage | MetadataOralDNB | Record<string, unknown>;

// ============ AFFECTATION ============

export interface AffectationExplication {
  raisonPrincipale: string; // ex: "Matière correspondante (SVT)"
  criteresUtilises: string[]; // ex: ["matiere_match", "equilibrage"]
  matiereRespectee: boolean; // true si la matière de l'élève correspond à un enseignant du jury
  score: number;
  detailScores?: Record<string, number>; // ex: { matiere: 100, equilibrage: 75 }
}

export interface Affectation {
  id: string;
  eleveId: string;
  enseignantId: string; // Pour compatibilité - peut être vide si juryId utilisé
  juryId?: string; // ID du jury (pour oral_dnb)
  scenarioId: string;
  type: AffectationType;
  metadata: AffectationMetadata;
  scoreDetail?: Record<string, number>; // ex: { distance: 8, capacite: 7, matiere: 10 }
  scoreTotal?: number;
  
  // Explication de l'affectation (pourquoi cet élève dans ce jury)
  explication?: AffectationExplication;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============ STAGE (Suivi de stage) ============
// Représente un stage d'un élève (lieu, dates, infos entreprise)

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
  nomEntreprise?: string;     // Nom de l'entreprise
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

// ============ GROUPE ============

export interface Groupe {
  id: string;
  scenarioId: string;
  nom: string;
  tailleCible?: number;
  tailleMin?: number;
  tailleMax?: number;
  type?: string; // ex: "projet", "atelier"
  
  eleveIds: string[];
  enseignantIds: string[];
  
  contraintes?: GroupeContrainte[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupeContrainte {
  type: string;
  description: string;
  valeur: unknown;
}

// ============ JURY (Oral DNB) ============
// Un jury est un groupe d'enseignants qui évalue ensemble les élèves

export interface Jury {
  id: string;
  scenarioId: string;
  nom: string; // ex: "Jury 1", "Jury Sciences"
  
  // Enseignants du jury
  enseignantIds: string[];
  
  // Capacité
  capaciteMax: number; // Nombre max d'élèves que ce jury peut évaluer
  
  // Statistiques calculées (mise à jour après affectation)
  stats?: JuryStats;
  
  // Métadonnées optionnelles
  salle?: string;
  horaire?: string;
  notes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface JuryStats {
  nbElevesAffectes: number;
  repartitionMatieres: Record<string, number>; // { "SVT": 3, "Français": 5 }
  tauxRemplissage: number; // 0-100%
  matieresEnseignants: string[]; // Matières couvertes par les enseignants du jury
}

// ============ SCÉNARIO ============

export interface CapaciteConfig {
  capaciteBaseDefaut: number;
  coefficients: {
    '6e': number;
    '5e': number;
    '4e': number;
    '3e': number;
  };
}

/**
 * Retourne la capacité effective d'un enseignant selon le type de scénario
 * @param enseignant L'enseignant
 * @param scenarioType Le type de scénario ('oral_dnb' ou 'suivi_stage')
 * @param defaultValue Valeur par défaut si non définie
 */
export function getEnseignantCapacite(
  enseignant: { capaciteBase?: number; capaciteStage?: number },
  scenarioType: ScenarioType,
  defaultValue = 5
): number {
  if (scenarioType === 'suivi_stage') {
    return enseignant.capaciteStage ?? defaultValue;
  }
  // oral_dnb et autres
  return enseignant.capaciteBase ?? defaultValue;
}

// @deprecated - Utiliser CritereInstance à la place
export interface CritereConfig {
  id: string;
  nom: string;
  actif: boolean;
  poids: number; // 0-100
  estContrainteDure: boolean;
}

export interface ScenarioParametres {
  // Nouveau système de critères (priorité)
  criteresV2?: CritereInstanceType[];
  
  // @deprecated - Ancien système de critères (garde pour migration)
  criteres: CritereConfig[];
  
  capaciteConfig: CapaciteConfig;
  
  // Filtres élèves - qui inclure dans le matching
  filtresEleves?: {
    classes?: string[];         // ex: ["3A", "3B", "3C"]
    niveaux?: Niveau[];         // ex: ["3e"]
    options?: string[];         // ex: ["Latin"]
    tags?: string[];            // ex: ["prioritaire"]
  };
  
  // Filtres enseignants - qui peut recevoir des élèves
  filtresEnseignants?: {
    matieres?: string[];        // ex: ["SVT", "Physique-Chimie"]
    classesEnCharge?: string[]; // ex: ["3A", "3B"]
    niveauxEnCharge?: Niveau[]; // ex: ["3e", "4e"] - enseigne à ce niveau
    ppOnly?: boolean;           // seulement les profs principaux
    tags?: string[];            // ex: ["disponible"]
    enseignantIds?: string[];   // sélection individuelle d'enseignants
  };
  
  // Paramètres legacy pour compatibilité
  matieresOralPossibles?: string[]; // @deprecated - utiliser oralDnb.matieresAutorisees
  distanceMaxKm?: number;           // @deprecated - utiliser suiviStage.distanceMaxKm
  
  // === SPÉCIFIQUE ORAL DNB ===
  oralDnb?: {
    // Liste des matières possibles pour l'oral
    matieresAutorisees: string[];
    // Utiliser les jurys au lieu d'enseignants individuels
    utiliserJurys: boolean;
    // Poids du critère "matière correspondante" (0-100)
    poidsMatiere: number;
    // Critères de fallback quand matière ne match pas
    criteresSecondaires: ('equilibrage' | 'parite' | 'capacite')[];
    // Capacité par défaut d'un jury
    capaciteJuryDefaut: number;
  };
  
  // Spécifique suivi_stage
  suiviStage?: {
    distanceMaxKm: number;
    dureeMaxMin: number;
    prioriserPP: boolean;
    capaciteTuteurDefaut: number;
    /** Si true, utilise la capacité calculée pour chaque enseignant (basée sur heures × classes 3e) */
    utiliserCapaciteCalculee?: boolean;
  };
  
  // Contraintes globales
  equilibrageActif: boolean;
  
  // Custom
  autresParametres?: Record<string, unknown>;
}

export interface Scenario {
  id: string;
  nom: string;
  mode: ScenarioMode;
  type: ScenarioType;
  parametres: ScenarioParametres;
  description?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============ HISTORIQUE RUN ============

export interface HistoriqueRun {
  id: string;
  scenarioId: string;
  dateRun: Date;
  affectationsSnapshot: Affectation[];
  groupesSnapshot?: Groupe[];
  scoreGlobal: number;
  statistiques: {
    nbEleves: number;
    nbEnseignants: number;
    nbAffectations: number;
    nbConflits: number;
    tempsCalculMs: number;
  };
  notes?: string;
}

// ============ SCENARIO ARCHIVE (Historique Enseignants) ============
// Structure persistante pour reconstruire l'historique d'un enseignant

export interface ArchiveParticipant {
  enseignantId: string;
  enseignantNom: string;
  enseignantPrenom: string;
  role: 'membre_jury' | 'referent_stage' | 'tuteur' | 'examinateur' | 'autre';
  roleLabel?: string; // ex: "Jury 3", "Référent stage"
}

export interface ArchiveEleve {
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  eleveClasse: string;
  // Métadonnées contextuelles selon le type de scénario
  matiereOral?: string;        // Pour oral_dnb
  adresseStage?: string;       // Pour suivi_stage
  entreprise?: string;         // Pour suivi_stage
  distanceKm?: number;         // Pour suivi_stage
  dureeMin?: number;           // Pour suivi_stage
}

export interface ArchiveAffectation {
  enseignantId: string;
  eleves: ArchiveEleve[];
  juryId?: string;
  juryNom?: string;
  scoreTotal?: number;
}

export interface ScenarioArchive {
  id: string;
  scenarioId: string;
  scenarioNom: string;
  scenarioType: ScenarioType;
  
  // Date de l'archivage (validation/enregistrement)
  archivedAt: Date;
  
  // Snapshot des participants (enseignants)
  participants: ArchiveParticipant[];
  
  // Snapshot des affectations (pour requêtes par enseignantId)
  affectations: ArchiveAffectation[];
  
  // Statistiques globales
  stats: {
    nbEnseignants: number;
    nbEleves: number;
    nbAffectations: number;
    scoreGlobal?: number;
    tauxAffectation?: number;
  };
  
  // Métadonnées spécifiques au type
  metadata?: {
    // Oral DNB
    jurys?: Array<{ id: string; nom: string; enseignantIds: string[] }>;
    // Suivi Stage
    distanceMoyenneKm?: number;
    dureeMoyenneMin?: number;
  };
  
  // Timestamps
  createdAt: Date;
}

// ============ EMPLOI DU TEMPS (V2 PREPARATION) ============

export interface CreneauHoraire {
  jour: 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi';
  heureDebut: string; // "08:00"
  heureFin: string; // "09:00"
  matiere?: string;
  salle?: string;
}

export interface EmploiDuTemps {
  creneaux: CreneauHoraire[];
}

// ============ RÉSULTATS MATCHING ============

export interface ConstraintViolation {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface MatchingResult {
  eleveId: string;
  enseignantId: string;
  score: number;
  scoreDetail: Record<string, number>;
  violations: ConstraintViolation[];
  isValid: boolean;
}

export interface SolverResult {
  affectations: MatchingResult[];
  nonAffectes: string[]; // eleveIds sans affectation
  conflits: ConstraintViolation[];
  scoreGlobal: number;
  tempsCalculMs: number;
  iterations: number;
}

// ============ IMPORT CSV ============

export interface ColumnMapping {
  csvHeader: string;
  targetField: keyof Eleve | null;
  isIgnored: boolean;
}

export interface ImportResult {
  success: boolean;
  eleves: Partial<Eleve>[];
  errors: string[];
  warnings: string[];
  mappings: ColumnMapping[];
}

// === Import matières oral pour élèves ===
export interface ImportMatiereOralResult {
  success: boolean;
  nbMisesAJour: number;
  elevesNonTrouves: { nom: string; prenom: string; ligne: number }[];
  matieresInconnues: { matiere: string; ligne: number }[];
  doublons: { nom: string; prenom: string; ligne: number }[];
  errors: string[];
}

// ============ RÉSULTATS MATCHING AMÉLIORÉS ============

export interface MatchingResultDNB {
  eleveId: string;
  juryId: string;
  matiereEleve: string | null;
  matieresJury: string[];
  matiereMatch: boolean; // true si une matière de l'élève correspond au jury
  score: number;
  scoreDetail: Record<string, number>;
  explication: AffectationExplication;
}

export interface SolverResultDNB {
  affectations: MatchingResultDNB[];
  nonAffectes: string[]; // eleveIds sans affectation
  sansMatchMatiere: string[]; // eleveIds affectés mais sans correspondance matière
  statsParJury: Record<string, JuryStats>;
  scoreGlobal: number;
  tauxMatchMatiere: number; // % d'élèves avec matière respectée
  tempsCalculMs: number;
}

// ============ UI STATE ============

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
