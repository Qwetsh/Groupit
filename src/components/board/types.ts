// ============================================================
// BOARD - Types partagés entre sous-composants
// ============================================================

import type { Eleve, Enseignant, Affectation, Jury, Scenario, Stage } from '../../domain/models';

// ============================================================
// DRAG & DROP DATA TYPES
// ============================================================

export interface DragDataEleve {
  type: 'eleve';
  eleveId: string;
  eleve: Eleve;
}

export interface DragDataAffectation {
  type: 'affectation';
  affectationId: string;
  eleveId: string;
  eleve: Eleve;
}

export interface DragDataJuryAffectation {
  type: 'jury-affectation';
  affectationId: string;
  eleveId: string;
  eleve: Eleve;
}

export interface DropDataUnassigned {
  type: 'unassigned';
}

export interface DropDataEnseignant {
  type: 'enseignant';
  enseignantId: string;
}

export interface DropDataJury {
  type: 'jury';
  juryId: string;
}

export type DragData = DragDataEleve | DragDataAffectation | DragDataJuryAffectation;
export type DropData = DropDataUnassigned | DropDataEnseignant | DropDataJury;

// ============================================================
// CONTEXT MENU STATE TYPE
// ============================================================

export interface ContextMenuState {
  x: number;
  y: number;
  eleve: Eleve;
  affectation?: Affectation;
  enseignant?: Enseignant;
}

// ============================================================
// JURY AFFECTATION DISPLAY
// ============================================================

export interface JuryAffectationDisplay {
  eleveId: string;
  eleve: Eleve;
  matiereMatch: boolean;
  matiereEleve: string | null;
  explicationRaison?: string;
}

// ============================================================
// MATCHING STATS
// ============================================================

export interface MatchingStats {
  total: number;
  affected: number;
  score: number;
  tauxMatiere?: number;
}

// ============================================================
// VALIDATION SUCCESS
// ============================================================

export interface ValidationSuccess {
  date: Date;
  archiveId: string;
}

// ============================================================
// TOOLBAR PROPS
// ============================================================

export interface BoardToolbarProps {
  activeScenario: Scenario | undefined;
  isJuryMode: boolean;
  isStageScenario: boolean;
  isRunning: boolean;
  isValidating: boolean;
  scenarioInfo: string;
  affectationsCount: number;
  runButtonDisabled: boolean;
  runButtonTitle: string;
  onRunMatching: () => void;
  onResetAffectations: () => void;
  onValidateClick: () => void;
}

// ============================================================
// MESSAGES PROPS
// ============================================================

export interface BoardMessagesProps {
  // Warning conditions
  isJuryMode: boolean;
  isStageScenario: boolean;
  scenarioJurysCount: number;
  stageReadyForMatching: boolean;
  geocodedStagesCount: number;
  geocodedEnseignantsCount: number;
  activeScenarioNom?: string;
  // Error/Success states
  matchingError: string | null;
  matchingStats: MatchingStats | null;
  validationSuccess: ValidationSuccess | null;
  // Callbacks
  onClearError: () => void;
  onClearStats: () => void;
  onClearValidation: () => void;
}

// ============================================================
// VALIDATION MODAL PROPS
// ============================================================

export interface ValidationModalProps {
  isOpen: boolean;
  isValidating: boolean;
  scenario: Scenario;
  affectations: Affectation[];
  eleves: Eleve[];
  enseignants: Enseignant[];
  jurys: Jury[];
  stages: Stage[];
  onClose: () => void;
  onConfirm: () => void;
}

// ============================================================
// NON-AFFECTATION INFO (raisons de non-affectation après matching)
// ============================================================

export interface NonAffectationInfo {
  eleveId: string;
  raisons: string[];
  /** Type de problème principal pour affichage visuel */
  problemType: 'no-stage' | 'no-geo' | 'too-far' | 'capacity' | 'unknown';
}

// ============================================================
// TILE PROPS
// ============================================================

export interface DraggableEleveProps {
  eleve: Eleve;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve) => void;
  /** Infos de non-affectation (si élève non placé après matching) */
  nonAffectationInfo?: NonAffectationInfo;
}

export interface DraggableAffectationChipProps {
  affectation: Affectation;
  eleve: Eleve;
  enseignant: Enseignant;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, enseignant: Enseignant) => void;
}

export interface DroppableEnseignantTileProps {
  enseignant: Enseignant;
  affectations: Affectation[];
  eleves: Eleve[];
  capacity: number;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, enseignant: Enseignant) => void;
  onClick?: (enseignant: Enseignant) => void;
  isStageScenario?: boolean;
}

export interface DroppableJuryTileProps {
  jury: Jury;
  enseignants: Enseignant[];
  affectationsDisplay: JuryAffectationDisplay[];
  scenarioAffectations: Affectation[];
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, jury: Jury) => void;
}
