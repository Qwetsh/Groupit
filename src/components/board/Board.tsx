import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  pointerWithin,
} from '@dnd-kit/core';
import { useEleveStore } from '../../stores/eleveStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useAffectationStore } from '../../stores/affectationStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useJuryStore } from '../../stores/juryStore';
import { useStageStore } from '../../stores/stageStore';
import { calculateDistance, recalcTimeSlotsForJurys } from '../../algorithms';
import type { Eleve, Enseignant, Affectation, Jury, MatchingResultDNB, Stage } from '../../domain/models';
import { calculateCapacitesStage, getHeuresMatiere } from '../../domain/models';
import { filterEleves, filterEnseignants } from '../../utils/filteringUtils';
import { Info, UserX, Users, MapPin, MapPinOff, Palette, Eye } from 'lucide-react';
import { OverlayProgress } from '../ui/ProgressIndicator';
import { HelpTooltip, HELP_TEXTS } from '../ui/Tooltip';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ContextMenu, type ContextMenuItem } from '../context-menu';
import { useConfirmReset } from '../../hooks/useConfirm';
import { EleveInfoModal } from '../modals/EleveInfoModal';
import { ExportButtons } from '../export';
import { StageAssignmentMapDrawer, COLLEGE_GEO } from './StageAssignmentMapDrawer';
import { ImportSessionModal } from './ImportSessionModal';
import { exportAffectationSession, downloadSessionAsJson, importAffectationSession, type SessionExportData, type ImportReport } from '../../services/affectationSessionService';

// Sous-composants
import { BoardToolbar } from './BoardToolbar';
import { BoardMessages } from './BoardMessages';
import { DraggableEleve, DroppableEnseignantTile, DroppableJuryTile } from './tiles';
import type { DragData, DropData, ContextMenuState, EnseignantContextMenuState, JuryAffectationDisplay, MatchingStats, ValidationSuccess, NonAffectationInfo } from './types';

import './Board.css';

// ============================================================
// CONSTANTS
// ============================================================

/** Durée d'affichage du message de succès de validation (en ms) */


/** Vitesse moyenne pour estimation durée trajet (km/h) */


// ============================================================
// UNASSIGNED DROP ZONE
// ============================================================

const UnassignedDropZone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned-zone',
    data: { type: 'unassigned' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`column-content ${isOver ? 'drop-highlight' : ''}`}
    >
      {children}
    </div>
  );
};

// ============================================================
// MAIN BOARD COMPONENT
// ============================================================

export const Board: React.FC = () => {
  // Stores
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const affectations = useAffectationStore(state => state.affectations);
  const addAffectation = useAffectationStore(state => state.addAffectation);
  const updateAffectation = useAffectationStore(state => state.updateAffectation);
  const deleteAffectation = useAffectationStore(state => state.deleteAffectation);
  const deleteAffectationsByScenario = useAffectationStore(state => state.deleteAffectationsByScenario);
  const scenarios = useScenarioStore(state => state.scenarios);
  const currentScenarioId = useScenarioStore(state => state.currentScenarioId);
  const jurys = useJuryStore(state => state.jurys);
  const stages = useStageStore(state => state.stages);
  const loadGlobalStages = useStageStore(state => state.loadGlobalStages);

  // Active scenario
  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
  }, [scenarios, currentScenarioId]);

  // Scenario type flags
  const isStageScenario = activeScenario?.type === 'suivi_stage';
  const isCustomScenario = activeScenario?.type === 'custom';
  // Pour oral_dnb, utiliser le mode jury par défaut (true si non défini)
  // Pour custom, toujours utiliser le mode jury (groupes)
  const isJuryMode = (activeScenario?.type === 'oral_dnb' && (activeScenario?.parametres?.oralDnb?.utiliserJurys ?? true))
    || isCustomScenario;

  // Scenario jurys
  const scenarioJurys = useMemo(() => {
    if (!isJuryMode || !activeScenario) return [];
    return jurys.filter(j => j.scenarioId === activeScenario.id);
  }, [jurys, activeScenario, isJuryMode]);

  // Index maps for O(1) lookups
  const elevesById = useMemo(() => new Map(eleves.map(e => [e.id, e])), [eleves]);
  const enseignantsById = useMemo(() => new Map(enseignants.map(e => [e.id, e])), [enseignants]);
  const jurysById = useMemo(() => new Map(scenarioJurys.map(j => [j.id, j])), [scenarioJurys]);

  // State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<DragData | null>(null);
  const [isRunning] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [dnbResults] = useState<Map<string, MatchingResultDNB>>(new Map());
  const [nonAffectesInfo] = useState<Map<string, NonAffectationInfo>>(new Map());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [enseignantContextMenu, setEnseignantContextMenu] = useState<EnseignantContextMenuState | null>(null);
  const [distanceEnseignantId, setDistanceEnseignantId] = useState<string | null>(null);
  const [infoModalEleve, setInfoModalEleve] = useState<{ eleve: Eleve; affectation?: Affectation; enseignant?: Enseignant; jury?: Jury; stage?: Stage } | null>(null);
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const [selectedTeacherForMap, setSelectedTeacherForMap] = useState<Enseignant | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<ValidationSuccess | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGenderColor, setShowGenderColor] = useState(false);
  const [showClassHighlight, setShowClassHighlight] = useState(false);

  // Confirm modal hook
  const { confirmState, handleConfirm: handleConfirmReset, handleCancel: handleCancelReset } = useConfirmReset();

  // Load global stages when entering a stage scenario
  useEffect(() => {
    if (isStageScenario) {
      loadGlobalStages();
    }
  }, [isStageScenario, loadGlobalStages]);

  // Sensors for drag & drop
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Filter eleves/enseignants based on scenario
  const scenarioEleves = useMemo(() => {
    // Custom scenario with selected students: show only those
    const customSelectedIds = activeScenario?.parametres?.custom?.selectedEleveIds;
    if (customSelectedIds && customSelectedIds.length > 0) {
      const idSet = new Set(customSelectedIds);
      return eleves.filter(e => idSet.has(e.id!));
    }
    const filters = activeScenario?.parametres?.filtresEleves;
    const defaultNiveaux = isStageScenario ? ['3e'] as const : [];
    return filterEleves(eleves, filters, [...defaultNiveaux]);
  }, [eleves, activeScenario, isStageScenario]);

  const scenarioEnseignants = useMemo(() => {
    if (activeScenario?.parametres?.custom?.sansAdultes) return [];
    return filterEnseignants(enseignants, activeScenario?.parametres?.filtresEnseignants);
  }, [enseignants, activeScenario]);

  // Displayed enseignants (includes those with existing affectations)
  const displayedEnseignants = useMemo(() => {
    if (!isStageScenario) return scenarioEnseignants;

    const enseignantIdsWithAffectations = new Set(
      affectations
        .filter(a => a.scenarioId === activeScenario?.id && !a.juryId)
        .map(a => a.enseignantId)
    );

    const combined = new Map<string, Enseignant>();
    scenarioEnseignants.forEach(e => combined.set(e.id!, e));
    enseignants.forEach(e => {
      if (enseignantIdsWithAffectations.has(e.id!)) {
        combined.set(e.id!, e);
      }
    });

    return Array.from(combined.values());
  }, [isStageScenario, scenarioEnseignants, enseignants, affectations, activeScenario]);

  // Affectations by enseignant
  const affectationsByEnseignant = useMemo(() => {
    const map = new Map<string, Affectation[]>();
    displayedEnseignants.forEach(e => map.set(e.id!, []));

    const scenarioAffs = affectations.filter(a => a.scenarioId === activeScenario?.id && !a.juryId);
    scenarioAffs.forEach(a => {
      if (!map.has(a.enseignantId)) map.set(a.enseignantId, []);
      map.get(a.enseignantId)!.push(a);
    });

    return map;
  }, [displayedEnseignants, affectations, activeScenario]);

  // Affectations by jury
  const affectationsByJury = useMemo(() => {
    const map = new Map<string, JuryAffectationDisplay[]>();
    scenarioJurys.forEach(j => map.set(j.id!, []));

    affectations
      .filter(a => a.scenarioId === activeScenario?.id && a.juryId)
      .forEach(a => {
        const list = map.get(a.juryId!);
        const eleve = elevesById.get(a.eleveId);
        if (list && eleve) {
          const dnbResult = dnbResults.get(a.eleveId);
          list.push({
            eleveId: a.eleveId,
            eleve,
            matiereMatch: dnbResult?.matiereMatch ?? a.explication?.matiereRespectee ?? false,
            matiereEleve: dnbResult?.matiereEleve ?? eleve.matieresOral?.[0] ?? null,
            explicationRaison: dnbResult?.explication?.raisonPrincipale ?? a.explication?.raisonPrincipale,
          });
        }
      });

    return map;
  }, [scenarioJurys, affectations, activeScenario, elevesById, dnbResults]);

  // Unassigned eleves
  const assignedEleveIds = useMemo(() => {
    return new Set(affectations.filter(a => a.scenarioId === activeScenario?.id).map(a => a.eleveId));
  }, [affectations, activeScenario]);

  const unassignedEleves = useMemo(() => {
    return scenarioEleves.filter(e => !assignedEleveIds.has(e.id!));
  }, [scenarioEleves, assignedEleveIds]);

  const scenarioAffectations = useMemo(() => {
    return affectations.filter(a => a.scenarioId === activeScenario?.id);
  }, [affectations, activeScenario]);

  // Stage stats
  const scenarioEleveIds = useMemo(() => new Set(scenarioEleves.map(e => e.id!)), [scenarioEleves]);
  const scenarioStages = useMemo(() => stages.filter(s => s.eleveId && scenarioEleveIds.has(s.eleveId)), [stages, scenarioEleveIds]);
  const geocodedStagesCount = useMemo(() => scenarioStages.filter(s => (s.geoStatus === 'ok' || s.geoStatus === 'manual') && s.lat && s.lon).length, [scenarioStages]);
  const geocodedEnseignantsCount = useMemo(() => scenarioEnseignants.filter(e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon).length, [scenarioEnseignants]);
  const stageReadyForMatching = geocodedStagesCount > 0 && geocodedEnseignantsCount > 0;

  // Capacity (default fixed value)
  const capacity = useMemo(() => {
    if (!activeScenario) return 5;
    if (isStageScenario) return activeScenario.parametres?.suiviStage?.capaciteTuteurDefaut || 5;
    return activeScenario.parametres?.capaciteConfig?.capaciteBaseDefaut || 5;
  }, [activeScenario, isStageScenario]);

  // Capacités calculées pour suivi stage (heures × nb classes 3e)
  const capacitesStageCalculees = useMemo(() => {
    if (!isStageScenario) return new Map<string, number>();
    return calculateCapacitesStage(enseignants, eleves);
  }, [isStageScenario, enseignants, eleves]);

  // Déterminer si on utilise les capacités calculées
  const utiliserCapaciteCalculee = activeScenario?.parametres?.suiviStage?.utiliserCapaciteCalculee ?? true;

  // Heures de 3e par enseignant (pour indicateur de charge)
  // Utilise heures3eReelles si renseigné, sinon calcul automatique
  const heures3eParEnseignant = useMemo(() => {
    const map = new Map<string, number>();
    if (!isStageScenario) return map;

    for (const ens of enseignants) {
      if (!ens.id) continue;
      const nbClasses3e = (ens.classesEnCharge || []).filter(c => c.startsWith('3')).length;
      if (nbClasses3e === 0) continue;

      // Utiliser heures3eReelles si renseigné (pour groupes multi-classes)
      if (ens.heures3eReelles !== undefined && ens.heures3eReelles > 0) {
        map.set(ens.id, ens.heures3eReelles);
      } else {
        const heuresMatiere = getHeuresMatiere(ens.matierePrincipale);
        map.set(ens.id, heuresMatiere * nbClasses3e);
      }
    }
    return map;
  }, [isStageScenario, enseignants]);

  // Toolbar props
  const scenarioInfo = isStageScenario
    ? `${geocodedStagesCount}/${scenarioStages.length} stages • ${geocodedEnseignantsCount} enseignants`
    : `${scenarioEleves.length} élèves • ${isJuryMode ? `${scenarioJurys.length} jurys` : `${scenarioEnseignants.length} enseignants`}`;

  // Stages for selected teacher map
  const selectedTeacherStages = useMemo(() => {
    if (!selectedTeacherForMap || !isStageScenario) return [];
    const teacherAffectations = affectations.filter(a => a.enseignantId === selectedTeacherForMap.id && a.scenarioId === activeScenario?.id);
    const assignedEleveIds = new Set(teacherAffectations.map(a => a.eleveId));
    return stages.filter(s => s.eleveId && assignedEleveIds.has(s.eleveId)).map(stage => ({ ...stage, eleve: elevesById.get(stage.eleveId!) }));
  }, [selectedTeacherForMap, isStageScenario, affectations, stages, activeScenario?.id, elevesById]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleTeacherCardClick = useCallback((enseignant: Enseignant) => {
    if (!isStageScenario) return;
    setSelectedTeacherForMap(enseignant);
    setMapDrawerOpen(true);
  }, [isStageScenario]);

  const handleCloseMapDrawer = useCallback(() => {
    setMapDrawerOpen(false);
    setSelectedTeacherForMap(null);
  }, []);

  const handleContextMenuUnassigned = useCallback((e: React.MouseEvent, eleve: Eleve) => {
    setContextMenu({ x: e.clientX, y: e.clientY, eleve });
  }, []);

  const handleContextMenuAffected = useCallback((e: React.MouseEvent, eleve: Eleve, affectation: Affectation, enseignant: Enseignant) => {
    setContextMenu({ x: e.clientX, y: e.clientY, eleve, affectation, enseignant });
  }, []);

  const handleContextMenuJury = useCallback((e: React.MouseEvent, eleve: Eleve, affectation: Affectation, jury: Jury) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      eleve,
      affectation,
      enseignant: enseignants.find(ens => jury.enseignantIds.includes(ens.id!)),
      jury,
    });
  }, [enseignants]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Handlers pour menu contextuel enseignant (clic droit sur tuile enseignant)
  const handleEnseignantContextMenu = useCallback((e: React.MouseEvent, enseignant: Enseignant) => {
    e.preventDefault();
    e.stopPropagation();
    setEnseignantContextMenu({ x: e.clientX, y: e.clientY, enseignant });
  }, []);

  const closeEnseignantContextMenu = useCallback(() => setEnseignantContextMenu(null), []);

  // Stage lookup by eleveId (pour mode stage)
  const stageByEleveId = useMemo(() => {
    const map = new Map<string, Stage>();
    for (const stage of stages) {
      if (stage.eleveId) {
        map.set(stage.eleveId, stage);
      }
    }
    return map;
  }, [stages]);

  // Distances enseignant -> stage de l'élève dragué (pour feedback visuel)
  const dragDistancesByEnseignant = useMemo(() => {
    const distances = new Map<string, number>();

    // Seulement en mode stage et si un élève est dragué
    if (!isStageScenario || !activeData) return distances;

    // Récupérer l'eleveId depuis activeData
    const eleveId = 'eleveId' in activeData ? activeData.eleveId : undefined;
    if (!eleveId) return distances;

    // Récupérer le stage de l'élève dragué
    const stage = stageByEleveId.get(eleveId);
    if (!stage || !stage.lat || !stage.lon) return distances;

    // Calculer la distance pour chaque enseignant géocodé
    for (const ens of enseignants) {
      if (ens.lat && ens.lon) {
        const dist = calculateDistance(ens.lat, ens.lon, stage.lat, stage.lon);
        distances.set(ens.id!, dist);
      }
    }

    return distances;
  }, [isStageScenario, activeData, stageByEleveId, enseignants]);

  // Calcul des enseignants qui ont l'élève dragué dans leur classe
  const enseignantsWithDraggedEleveClass = useMemo(() => {
    const enseignantIds = new Set<string>();

    // Seulement si un élève est dragué
    if (!activeData) return enseignantIds;

    // Récupérer l'élève depuis activeData
    const eleve = 'eleve' in activeData ? activeData.eleve : undefined;
    if (!eleve || !eleve.classe) return enseignantIds;

    // Trouver tous les enseignants qui ont cette classe
    for (const ens of enseignants) {
      if (ens.classesEnCharge?.includes(eleve.classe)) {
        enseignantIds.add(ens.id!);
      }
    }

    return enseignantIds;
  }, [activeData, enseignants]);

  // Classe de l'élève dragué (pour highlighting même classe)
  const draggedEleveClasse = useMemo(() => {
    if (!showClassHighlight || !activeData) return null;
    const eleve = 'eleve' in activeData ? activeData.eleve : undefined;
    return eleve?.classe || null;
  }, [activeData, showClassHighlight]);

  // Calcul des distances depuis l'enseignant sélectionné vers TOUS les élèves (mode distance enseignant)
  const distancesByEleveFromEnseignant = useMemo(() => {
    const distances = new Map<string, number>();

    // Seulement en mode stage et si un enseignant est sélectionné pour le mode distance
    if (!isStageScenario || !distanceEnseignantId) return distances;

    // Récupérer l'enseignant sélectionné
    const enseignant = enseignantsById.get(distanceEnseignantId);
    if (!enseignant || !enseignant.lat || !enseignant.lon) return distances;

    // Calculer la distance pour TOUS les élèves du scénario avec un stage géocodé
    for (const eleve of scenarioEleves) {
      const stage = stageByEleveId.get(eleve.id!);
      if (stage && stage.lat && stage.lon) {
        const dist = calculateDistance(enseignant.lat, enseignant.lon, stage.lat, stage.lon);
        distances.set(eleve.id!, dist);
      }
    }

    return distances;
  }, [isStageScenario, distanceEnseignantId, enseignantsById, scenarioEleves, stageByEleveId]);

  // Computed non-affectation info (persiste entre les changements d'onglet)
  // Fusionne l'info calculée (basée sur les données actuelles) avec l'info détaillée du matching
  const computedNonAffectesInfo = useMemo(() => {
    if (!isStageScenario || !activeScenario) return nonAffectesInfo;

    const result = new Map<string, NonAffectationInfo>();
    const affectedEleveIds = new Set(scenarioAffectations.map(a => a.eleveId));

    for (const eleve of scenarioEleves) {
      if (affectedEleveIds.has(eleve.id!)) continue; // Skip affected students

      // Si on a déjà une info détaillée du matching, l'utiliser
      const existingInfo = nonAffectesInfo.get(eleve.id!);
      if (existingInfo) {
        result.set(eleve.id!, existingInfo);
        continue;
      }

      // Sinon, calculer l'info de base
      const stage = stageByEleveId.get(eleve.id!);
      const raisons: string[] = [];
      let problemType: NonAffectationInfo['problemType'] = 'unknown';

      // Vérifier si le stage existe ET a des données significatives
      const hasStage = stage && (stage.nomEntreprise || stage.adresse);
      const hasAddress = stage && stage.adresse && stage.adresse.trim().length > 0;
      const isGeocoded = stage && stage.lat && stage.lon && (stage.geoStatus === 'ok' || stage.geoStatus === 'manual');

      if (!hasStage) {
        // Pas de stage OU stage vide (juste créé sans données)
        raisons.push('📭 Pas de stage renseigné');
        problemType = 'no-stage';
      } else if (!hasAddress) {
        // Stage avec entreprise mais sans adresse
        raisons.push('🏢 Stage sans adresse');
        if (stage.nomEntreprise) raisons.push(`Entreprise: ${stage.nomEntreprise}`);
        problemType = 'no-address';
      } else if (!isGeocoded) {
        // Stage avec adresse mais pas géocodé
        raisons.push('📍 Adresse non géolocalisée');
        raisons.push(`Adresse: ${stage.adresse}`);
        if (stage.geoStatus === 'error' || stage.geoStatus === 'not_found') {
          raisons.push('⚠️ Échec du géocodage');
        }
        problemType = 'no-geo';
      } else {
        // Stage géocodé mais non affecté - probablement trop loin ou capacité
        raisons.push('🚗 Non affecté (distance ou capacité)');
        problemType = 'too-far';
      }

      result.set(eleve.id!, { eleveId: eleve.id!, raisons, problemType });
    }

    return result;
  }, [isStageScenario, activeScenario, scenarioEleves, scenarioAffectations, stageByEleveId, nonAffectesInfo]);

  // Context menu items
  const contextMenuItems: ContextMenuItem[] = useMemo(() => {
    if (!contextMenu) return [];

    // Récupérer le stage de l'élève si en mode stage
    const eleveStage = isStageScenario ? stageByEleveId.get(contextMenu.eleve.id!) : undefined;

    const items: ContextMenuItem[] = [
      {
        id: 'info',
        label: 'Voir les infos',
        icon: <Info size={16} />,
        onClick: () => setInfoModalEleve({
          eleve: contextMenu.eleve,
          affectation: contextMenu.affectation,
          enseignant: contextMenu.enseignant,
          jury: contextMenu.jury,
          stage: eleveStage,
        }),
      },
    ];
    if (contextMenu.affectation) {
      items.push({
        id: 'unassign',
        label: 'Désaffecter',
        icon: <UserX size={16} />,
        onClick: async () => { await deleteAffectation(contextMenu.affectation!.id!); },
        dividerAfter: true,
      });
    }
    return items;
  }, [contextMenu, deleteAffectation, isStageScenario, stageByEleveId]);

  // Context menu items pour enseignant (mode distance)
  const enseignantContextMenuItems: ContextMenuItem[] = useMemo(() => {
    if (!enseignantContextMenu || !isStageScenario) return [];

    const enseignant = enseignantContextMenu.enseignant;
    const isActive = distanceEnseignantId === enseignant.id;

    return [
      {
        id: 'distance-toggle',
        label: isActive ? 'Masquer distances' : 'Voir distances stages',
        icon: isActive ? <MapPinOff size={16} /> : <MapPin size={16} />,
        onClick: () => {
          if (isActive) {
            setDistanceEnseignantId(null);
          } else {
            setDistanceEnseignantId(enseignant.id!);
          }
        },
      },
    ];
  }, [enseignantContextMenu, isStageScenario, distanceEnseignantId]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setActiveData(event.active.data.current as DragData);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveData(null);

    if (!over) return;

    const activeDataCurrent = active.data.current as DragData | undefined;
    const overDataCurrent = over.data.current as DropData | DragData | undefined;

    const targetEnseignantId = (overDataCurrent && 'enseignantId' in overDataCurrent ? overDataCurrent.enseignantId : null)
      || (String(over.id).startsWith('enseignant:') ? String(over.id).split(':')[1] : null);

    const targetJuryId = (overDataCurrent && 'juryId' in overDataCurrent ? overDataCurrent.juryId : null)
      || (String(over.id).startsWith('jury:') ? String(over.id).split(':')[1] : null);

    const isDropOnUnassigned = overDataCurrent?.type === 'unassigned' || over.id === 'unassigned-zone';

    // Case 1a: Dropping unassigned élève on enseignant
    if (activeDataCurrent?.type === 'eleve' && targetEnseignantId && activeScenario?.id) {
      try {
        await addAffectation({
          eleveId: activeDataCurrent.eleveId,
          enseignantId: targetEnseignantId,
          scenarioId: activeScenario.id,
          type: 'autre',
          metadata: { source: 'drag-drop' },
          scoreDetail: {},
          scoreTotal: 0,
        });
      } catch (err) {
        setMatchingError(`Erreur lors de l'affectation : ${String(err)}`);
      }
    }

    // Case 1b: Dropping unassigned élève on jury
    if (activeDataCurrent?.type === 'eleve' && targetJuryId && activeScenario?.id) {
      const eleve = activeDataCurrent.eleve;
      const jury = jurysById.get(targetJuryId);
      if (jury) {
        const juryMatieres = [...new Set(jury.enseignantIds.map(id => enseignantsById.get(id)?.matierePrincipale).filter(Boolean))] as string[];
        const matiereMatch = eleve.matieresOral?.some(m => juryMatieres.includes(m)) ?? false;
        try {
          await addAffectation({
            eleveId: activeDataCurrent.eleveId,
            enseignantId: '',
            juryId: targetJuryId,
            scenarioId: activeScenario.id,
            type: 'oral_dnb',
            metadata: { source: 'drag-drop' },
            explication: {
              raisonPrincipale: matiereMatch ? 'Correspondance matière manuelle' : 'Affectation manuelle (pas de correspondance matière)',
              criteresUtilises: ['manuel'],
              matiereRespectee: matiereMatch,
              score: matiereMatch ? 100 : 50,
            },
            scoreDetail: { manuel: 100 },
            scoreTotal: matiereMatch ? 100 : 50,
          });

          // Recalculate time slots for the target jury
          if (activeScenario.type === 'oral_dnb') {
            const demiJournees = activeScenario.parametres.oralDnb?.demiJourneesOral || [];
            const distMode = activeScenario.parametres.oralDnb?.distributionCreneaux || 'fill_first';
            if (demiJournees.length > 0) {
              const freshAffectations = useAffectationStore.getState().affectations.filter(a => a.scenarioId === activeScenario.id);
              const updates = recalcTimeSlotsForJurys(
                [targetJuryId],
                scenarioJurys,
                freshAffectations,
                eleves,
                demiJournees,
                distMode,
                activeScenario.parametres.oralDnb?.heureDebutMatin,
                activeScenario.parametres.oralDnb?.heureDebutAprem,
                activeScenario.parametres.oralDnb?.dureeSupplementaireTiersTemps
              );
              for (const [affId, meta] of updates) {
                await updateAffectation(affId, {
                  metadata: { dateCreneau: meta.dateCreneau, heureCreneau: meta.heureCreneau },
                });
              }
            }
          }
        } catch (err) {
          setMatchingError(`Erreur lors de l'affectation jury : ${String(err)}`);
        }
      }
    }

    // Case 2a: Reassign affectation to different enseignant
    if (activeDataCurrent?.type === 'affectation' && targetEnseignantId) {
      try {
        await updateAffectation(activeDataCurrent.affectationId, { enseignantId: targetEnseignantId, juryId: undefined });
      } catch (err) {
        setMatchingError(`Erreur lors du déplacement : ${String(err)}`);
      }
    }

    // Case 2b: Reassign jury affectation to different jury
    if (activeDataCurrent?.type === 'jury-affectation' && targetJuryId) {
      const eleve = activeDataCurrent.eleve as Eleve;
      const jury = jurysById.get(targetJuryId);
      if (jury) {
        const juryMatieres = [...new Set(jury.enseignantIds.map(id => enseignantsById.get(id)?.matierePrincipale).filter(Boolean))] as string[];
        const matiereMatch = eleve.matieresOral?.some(m => juryMatieres.includes(m)) ?? false;
        try {
          await updateAffectation(activeDataCurrent.affectationId, {
            juryId: targetJuryId,
            explication: {
              raisonPrincipale: matiereMatch ? 'Correspondance matière (déplacement manuel)' : 'Déplacement manuel (pas de correspondance matière)',
              criteresUtilises: ['manuel'],
              matiereRespectee: matiereMatch,
              score: matiereMatch ? 100 : 50,
            },
          });

          // Recalculate time slots for affected jurys
          if (activeScenario?.type === 'oral_dnb') {
            const demiJournees = activeScenario.parametres.oralDnb?.demiJourneesOral || [];
            const distMode = activeScenario.parametres.oralDnb?.distributionCreneaux || 'fill_first';
            if (demiJournees.length > 0) {
              // Find source jury from the original affectation
              const sourceAff = affectations.find(a => a.id === activeDataCurrent.affectationId);
              const sourceJuryId = sourceAff?.juryId;
              const juryIdsToRecalc = [targetJuryId, ...(sourceJuryId ? [sourceJuryId] : [])];

              // Use fresh affectations (after the update above)
              const freshAffectations = affectations.map(a =>
                a.id === activeDataCurrent.affectationId ? { ...a, juryId: targetJuryId } : a
              );
              const updates = recalcTimeSlotsForJurys(
                juryIdsToRecalc,
                scenarioJurys,
                freshAffectations,
                eleves,
                demiJournees,
                distMode,
                activeScenario.parametres.oralDnb?.heureDebutMatin,
                activeScenario.parametres.oralDnb?.heureDebutAprem,
                activeScenario.parametres.oralDnb?.dureeSupplementaireTiersTemps
              );
              for (const [affId, meta] of updates) {
                await updateAffectation(affId, {
                  metadata: { dateCreneau: meta.dateCreneau, heureCreneau: meta.heureCreneau },
                });
              }
            }
          }
        } catch (err) {
          setMatchingError(`Erreur lors du déplacement jury : ${String(err)}`);
        }
      }
    }

    // Case 3: Remove affectation (drop on unassigned zone)
    if ((activeDataCurrent?.type === 'affectation' || activeDataCurrent?.type === 'jury-affectation') && isDropOnUnassigned) {
      try {
        const sourceAff = affectations.find(a => a.id === activeDataCurrent.affectationId);
        const sourceJuryId = sourceAff?.juryId;

        await deleteAffectation(activeDataCurrent.affectationId);

        // Recalculate time slots for the source jury after removal
        if (sourceJuryId && activeScenario?.type === 'oral_dnb') {
          const demiJournees = activeScenario.parametres.oralDnb?.demiJourneesOral || [];
          const distMode = activeScenario.parametres.oralDnb?.distributionCreneaux || 'fill_first';
          if (demiJournees.length > 0) {
            const freshAffectations = affectations.filter(a => a.id !== activeDataCurrent.affectationId);
            const updates = recalcTimeSlotsForJurys(
              [sourceJuryId],
              scenarioJurys,
              freshAffectations,
              eleves,
              demiJournees,
              distMode,
              activeScenario.parametres.oralDnb?.heureDebutMatin,
              activeScenario.parametres.oralDnb?.heureDebutAprem,
              activeScenario.parametres.oralDnb?.dureeSupplementaireTiersTemps
            );
            for (const [affId, meta] of updates) {
              await updateAffectation(affId, {
                metadata: { dateCreneau: meta.dateCreneau, heureCreneau: meta.heureCreneau },
              });
            }
          }
        }
      } catch (err) {
        setMatchingError(`Erreur lors de la suppression : ${String(err)}`);
      }
    }
  }, [activeScenario, jurysById, enseignantsById, addAffectation, updateAffectation, deleteAffectation, affectations, scenarioJurys, eleves]);



  // ============================================================
  // EXPORT/IMPORT SESSION HANDLERS
  // ============================================================

  const handleExportSession = useCallback(() => {
    if (!activeScenario) return;

    const exportData = exportAffectationSession(
      activeScenario,
      affectations,
      eleves,
      enseignants,
      stages
    );

    downloadSessionAsJson(exportData);
  }, [activeScenario, affectations, eleves, enseignants, stages]);

  const handleImportSession = useCallback(async (data: SessionExportData): Promise<ImportReport> => {
    const scenarios = useScenarioStore.getState().scenarios;
    const upsertStage = useStageStore.getState().upsertStageForEleve;
    const updateScenarioParametres = useScenarioStore.getState().updateParametres;
    const setActiveScenarioId = useScenarioStore.getState().setCurrentScenario;
    const updateEnseignant = useEnseignantStore.getState().updateEnseignant;

    return await importAffectationSession(data, {
      eleves,
      enseignants,
      stages,
      scenarios,
      upsertStage,
      addAffectation,
      deleteAffectationsByScenario,
      updateScenarioParametres,
      setActiveScenarioId,
      updateEnseignantGeo: (id, geo) => updateEnseignant(id, geo),
    });
  }, [eleves, enseignants, stages, addAffectation, deleteAffectationsByScenario]);

  const activeEleve = activeData?.eleve;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="board-container">
      <BoardToolbar
        activeScenario={activeScenario}
        isJuryMode={isJuryMode ?? false}
        isStageScenario={isStageScenario}
        isRunning={isRunning}
        scenarioInfo={scenarioInfo}
        onExportSession={handleExportSession}
        onImportSession={() => setShowImportModal(true)}
      />

      <BoardMessages
        isJuryMode={isJuryMode ?? false}
        isStageScenario={isStageScenario}
        scenarioJurysCount={scenarioJurys.length}
        stageReadyForMatching={stageReadyForMatching}
        geocodedStagesCount={geocodedStagesCount}
        geocodedEnseignantsCount={geocodedEnseignantsCount}
        activeScenarioNom={activeScenario?.nom}
        matchingError={matchingError}
        matchingStats={matchingStats}
        validationSuccess={validationSuccess}
        onClearError={() => setMatchingError(null)}
        onClearStats={() => setMatchingStats(null)}
        onClearValidation={() => setValidationSuccess(null)}
      />

      {(isJuryMode || isStageScenario) && activeScenario && (
        <ExportButtons scenario={activeScenario} filteredEleveIds={scenarioEleves.map(e => e.id!)} />
      )}

      <div className="board-visual-toggles">
        <button
          className={`btn-toggle ${showGenderColor ? 'active' : ''}`}
          onClick={() => setShowGenderColor(v => !v)}
          title="Colorer par sexe (F / M)"
        >
          <Palette size={16} />
          Sexe
        </button>
        <button
          className={`btn-toggle ${showClassHighlight ? 'active' : ''}`}
          onClick={() => setShowClassHighlight(v => !v)}
          title="Surligner les élèves de la même classe lors du drag"
        >
          <Eye size={16} />
          Même classe
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} autoScroll={false}>
        <div className="board-columns">
          {/* Unassigned column */}
          <div className="board-column eleves-column">
            <div className="column-header">
              <h2>Élèves à affecter</h2>
              <HelpTooltip content={HELP_TEXTS.board.dragDrop} />
              <span className="count-badge">{unassignedEleves.length}</span>
            </div>
            {unassignedEleves.length > 0 && (
              <div className="drag-hint">
                <span className="drag-hint-icon">👆</span>
                <span>Glissez les élèves vers un enseignant →</span>
              </div>
            )}
            <UnassignedDropZone>
              {unassignedEleves.map(eleve => (
                <DraggableEleve key={eleve.id} eleve={eleve} onContextMenu={handleContextMenuUnassigned} nonAffectationInfo={computedNonAffectesInfo.get(eleve.id!)} distanceFromEnseignantKm={distancesByEleveFromEnseignant.get(eleve.id!)} showGenderColor={showGenderColor} sameClassAsDragged={!!draggedEleveClasse && eleve.classe === draggedEleveClasse} />
              ))}
              {unassignedEleves.length === 0 && (
                <div className="empty-state success"><p>✓ Tous les élèves sont affectés</p></div>
              )}
            </UnassignedDropZone>
          </div>

          {/* Results column */}
          <div className="board-column results-column">
            <div className="column-header">
              <h2>Résultats</h2>
              <span className="count-badge">{scenarioAffectations.length} affectations</span>
              {isJuryMode && matchingStats?.tauxMatiere !== undefined && (
                <span className="matiere-badge">{Math.round(matchingStats.tauxMatiere)}% matières correspondantes</span>
              )}
            </div>
            {isStageScenario && (
              <div className="drag-legend">
                <span className="legend-title">Légende drag & drop :</span>
                <span className="legend-item"><span className="legend-color distance-close"></span> ≤5km</span>
                <span className="legend-item"><span className="legend-color distance-medium"></span> ≤15km</span>
                <span className="legend-item"><span className="legend-color distance-far"></span> ≤30km</span>
                <span className="legend-item"><span className="legend-color distance-very-far"></span> &gt;30km</span>
                <span className="legend-item"><span className="legend-border has-class"></span> Prof de l'élève</span>
              </div>
            )}
            <div className="results-grid">
              {isJuryMode ? (
                scenarioJurys.length > 0 ? (
                  scenarioJurys.map(jury => (
                    <DroppableJuryTile
                      key={jury.id}
                      jury={jury}
                      affectationsDisplay={affectationsByJury.get(jury.id!) || []}
                      scenarioAffectations={scenarioAffectations}
                      enseignants={enseignants}
                      onContextMenu={handleContextMenuJury}
                      showGenderColor={showGenderColor}
                      draggedEleveClasse={draggedEleveClasse}
                    />
                  ))
                ) : (
                  <div className="empty-state jury-setup-required">
                    <Users size={48} />
                    <h3>Configuration des jurys requise</h3>
                    <p>Aucun jury n'a été créé pour cette configuration.</p>
                  </div>
                )
              ) : (
                displayedEnseignants.map(enseignant => {
                  // Capacité par enseignant: calculée ou fixe selon l'option du scénario (suivi stage)
                  const enseignantCapacity = isStageScenario && utiliserCapaciteCalculee
                    ? (capacitesStageCalculees.get(enseignant.id!) ?? capacity)
                    : capacity;
                  return (
                    <DroppableEnseignantTile
                      key={enseignant.id}
                      enseignant={enseignant}
                      affectations={affectationsByEnseignant.get(enseignant.id!) || []}
                      elevesById={elevesById}
                      capacity={enseignantCapacity}
                      onContextMenu={handleContextMenuAffected}
                      onTileContextMenu={handleEnseignantContextMenu}
                      onClick={handleTeacherCardClick}
                      isStageScenario={isStageScenario}
                      dragDistanceKm={dragDistancesByEnseignant.get(enseignant.id!)}
                      isDistanceActive={distanceEnseignantId === enseignant.id}
                      distancesByEleve={distancesByEleveFromEnseignant}
                      hasEleveInClass={enseignantsWithDraggedEleveClass.has(enseignant.id!)}
                      heures3e={heures3eParEnseignant.get(enseignant.id!)}
                      showGenderColor={showGenderColor}
                      draggedEleveClasse={draggedEleveClasse}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeId && activeEleve && (
            <div className="drag-overlay-item">
              {activeEleve.prenom} {activeEleve.nom} ({activeEleve.classe})
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={closeContextMenu} />}
      {enseignantContextMenu && <ContextMenu x={enseignantContextMenu.x} y={enseignantContextMenu.y} items={enseignantContextMenuItems} onClose={closeEnseignantContextMenu} />}

      {infoModalEleve && (
        <EleveInfoModal
          eleve={infoModalEleve.eleve}
          affectation={infoModalEleve.affectation}
          enseignant={infoModalEleve.enseignant}
          jury={infoModalEleve.jury}
          stage={infoModalEleve.stage}
          onClose={() => setInfoModalEleve(null)}
        />
      )}

      {isStageScenario && selectedTeacherForMap && (
        <StageAssignmentMapDrawer
          isOpen={mapDrawerOpen}
          onClose={handleCloseMapDrawer}
          teacher={selectedTeacherForMap}
          assignedStages={selectedTeacherStages}
          collegeGeo={COLLEGE_GEO}
        />
      )}

      <OverlayProgress
        visible={isRunning}
        label="Algorithme en cours..."
        subtitle={isJuryMode ? `Matching ${scenarioEleves.length} élèves vers ${scenarioJurys.length} jurys` : isStageScenario ? `Matching ${geocodedStagesCount} stages vers ${geocodedEnseignantsCount} enseignants` : `Matching ${scenarioEleves.length} élèves vers ${scenarioEnseignants.length} enseignants`}
        indeterminate
        showElapsedTime
      />

      {/* Import Session Modal */}
      <ImportSessionModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportSession}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
      />
    </div>
  );
};
