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
import { useScenarioArchiveStore } from '../../stores/scenarioArchiveStore';
import { buildArchiveFromCurrentState } from '../../services';
import { solveMatching, convertToAffectations, solveOralDnbComplete, solveStageMatching, toStageGeoInfo, toEnseignantGeoInfo, calculateDistance } from '../../algorithms';
import { getEffectiveCriteres, criteresToStageOptions } from '../../domain/criteriaConfig';
import type { Eleve, Enseignant, Affectation, Jury, MatchingResultDNB } from '../../domain/models';
import { filterEleves, filterEnseignants } from '../../utils/filteringUtils';
import { Info, UserX, Users } from 'lucide-react';
import { OverlayProgress } from '../ui/ProgressIndicator';
import { HelpTooltip, HELP_TEXTS } from '../ui/Tooltip';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ContextMenu, type ContextMenuItem } from '../context-menu';
import { useConfirmReset } from '../../hooks/useConfirm';
import { EleveInfoModal } from '../modals/EleveInfoModal';
import { ExportButtons } from '../export';
import { StageAssignmentMapDrawer, COLLEGE_GEO } from './StageAssignmentMapDrawer';

// Sous-composants
import { BoardToolbar } from './BoardToolbar';
import { BoardMessages } from './BoardMessages';
import { ValidationModal } from './ValidationModal';
import { DraggableEleve, DroppableEnseignantTile, DroppableJuryTile } from './tiles';
import type { DragData, DropData, ContextMenuState, JuryAffectationDisplay, MatchingStats, ValidationSuccess } from './types';

import './Board.css';

// ============================================================
// CONSTANTS
// ============================================================

/** Durée d'affichage du message de succès de validation (en ms) */
const VALIDATION_SUCCESS_DISPLAY_MS = 5000;

/** Vitesse moyenne pour estimation durée trajet (km/h) */
const AVERAGE_SPEED_KMH = 40;

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
  const createArchive = useScenarioArchiveStore(state => state.createArchive);

  // Active scenario
  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
  }, [scenarios, currentScenarioId]);

  // Scenario type flags
  const isStageScenario = activeScenario?.type === 'suivi_stage';
  const isJuryMode = activeScenario?.type === 'oral_dnb' && activeScenario?.parametres?.oralDnb?.utiliserJurys;

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
  const [isRunning, setIsRunning] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingStats, setMatchingStats] = useState<MatchingStats | null>(null);
  const [dnbResults, setDnbResults] = useState<Map<string, MatchingResultDNB>>(new Map());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [infoModalEleve, setInfoModalEleve] = useState<{ eleve: Eleve; affectation?: Affectation; enseignant?: Enseignant; jury?: Jury } | null>(null);
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const [selectedTeacherForMap, setSelectedTeacherForMap] = useState<Enseignant | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState<ValidationSuccess | null>(null);

  // Confirm modal hook
  const { confirmState, confirmReset, handleConfirm: handleConfirmReset, handleCancel: handleCancelReset } = useConfirmReset();

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
    const filters = activeScenario?.parametres?.filtresEleves;
    const defaultNiveaux = isStageScenario ? ['3e'] as const : [];
    return filterEleves(eleves, filters, [...defaultNiveaux]);
  }, [eleves, activeScenario, isStageScenario]);

  const scenarioEnseignants = useMemo(() => {
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

  // Capacity
  const capacity = useMemo(() => {
    if (!activeScenario) return 5;
    if (isStageScenario) return activeScenario.parametres?.suiviStage?.capaciteTuteurDefaut || 5;
    return activeScenario.parametres?.capaciteConfig?.capaciteBaseDefaut || 5;
  }, [activeScenario, isStageScenario]);

  // Toolbar props
  const scenarioInfo = isStageScenario
    ? `${geocodedStagesCount}/${scenarioStages.length} stages • ${geocodedEnseignantsCount} enseignants`
    : `${scenarioEleves.length} élèves • ${isJuryMode ? `${scenarioJurys.length} jurys` : `${scenarioEnseignants.length} enseignants`}`;

  const jurysWithoutEnseignants = isJuryMode ? scenarioJurys.filter(j => !j.enseignantIds || j.enseignantIds.length === 0) : [];
  const hasJurysWithoutEnseignants = jurysWithoutEnseignants.length > 0;

  const runButtonDisabled = isRunning || !activeScenario
    || (isJuryMode && (scenarioJurys.length === 0 || hasJurysWithoutEnseignants))
    || (isStageScenario && !stageReadyForMatching);

  const runButtonTitle = !activeScenario
    ? 'Sélectionnez un scénario pour lancer le matching'
    : isJuryMode && scenarioJurys.length === 0
      ? 'Créez d\'abord des jurys dans la page Scénarios'
      : isJuryMode && hasJurysWithoutEnseignants
        ? `Associez au moins un enseignant à chaque jury`
        : isStageScenario && geocodedStagesCount === 0
          ? 'Géocodez d\'abord les stages dans la page Scénarios'
          : isStageScenario && geocodedEnseignantsCount === 0
            ? 'Les enseignants doivent avoir une adresse géocodée'
            : '';

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
    });
  }, [enseignants]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Context menu items
  const contextMenuItems: ContextMenuItem[] = useMemo(() => {
    if (!contextMenu) return [];
    const items: ContextMenuItem[] = [
      {
        id: 'info',
        label: 'Voir les infos',
        icon: <Info size={16} />,
        onClick: () => setInfoModalEleve({ eleve: contextMenu.eleve, affectation: contextMenu.affectation, enseignant: contextMenu.enseignant }),
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
  }, [contextMenu, deleteAffectation]);

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
    if (activeDataCurrent?.type === 'eleve' && targetEnseignantId) {
      try {
        await addAffectation({
          eleveId: activeDataCurrent.eleveId,
          enseignantId: targetEnseignantId,
          scenarioId: activeScenario?.id!,
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
    if (activeDataCurrent?.type === 'eleve' && targetJuryId) {
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
            scenarioId: activeScenario?.id!,
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
        } catch (err) {
          setMatchingError(`Erreur lors du déplacement jury : ${String(err)}`);
        }
      }
    }

    // Case 3: Remove affectation (drop on unassigned zone)
    if ((activeDataCurrent?.type === 'affectation' || activeDataCurrent?.type === 'jury-affectation') && isDropOnUnassigned) {
      try {
        await deleteAffectation(activeDataCurrent.affectationId);
      } catch (err) {
        setMatchingError(`Erreur lors de la suppression : ${String(err)}`);
      }
    }
  }, [activeScenario, jurysById, enseignantsById, addAffectation, updateAffectation, deleteAffectation]);

  // Run matching algorithm
  const runMatching = useCallback(async () => {
    if (!activeScenario) {
      setMatchingError('Aucun scénario actif.');
      return;
    }

    // Validation for Oral DNB
    if (activeScenario.type === 'oral_dnb') {
      const elevesWithoutMatiere = scenarioEleves.filter(e => !e.matieresOral || e.matieresOral.length === 0);
      if (elevesWithoutMatiere.length > 0) {
        const names = elevesWithoutMatiere.slice(0, 3).map(e => `${e.prenom} ${e.nom}`);
        const more = elevesWithoutMatiere.length > 3 ? ` et ${elevesWithoutMatiere.length - 3} autres` : '';
        setMatchingError(`⚠️ ${elevesWithoutMatiere.length} élève(s) n'ont pas de matière d'oral assignée : ${names.join(', ')}${more}. Allez dans la page "Élèves" > "Matières Oral DNB" pour attribuer les matières.`);
        return;
      }
    }

    if (isJuryMode) {
      if (scenarioJurys.length === 0) {
        setMatchingError('⚠️ Aucun jury configuré. Rendez-vous dans "Scénarios" > "Jurys" pour en créer.');
        return;
      }
      const jurysSansEnseignant = scenarioJurys.filter(j => !j.enseignantIds || j.enseignantIds.length === 0);
      if (jurysSansEnseignant.length > 0) {
        setMatchingError(`⚠️ ${jurysSansEnseignant.length} jury(s) n'ont aucun enseignant assigné.`);
        return;
      }
    }

    setIsRunning(true);
    setMatchingError(null);
    setMatchingStats(null);
    setDnbResults(new Map());

    try {
      if (isStageScenario) {
        // Stage matching
        const eleveIds = new Set(scenarioEleves.map(e => e.id!));
        const scenarioStagesForMatching = stages.filter(s => s.eleveId && eleveIds.has(s.eleveId));
        const geocodedStages = scenarioStagesForMatching.filter(s => (s.geoStatus === 'ok' || s.geoStatus === 'manual') && s.lat && s.lon);
        const geocodedEnseignants = scenarioEnseignants.filter(e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon);

        if (geocodedStages.length === 0) {
          setMatchingError('⚠️ Aucun stage géocodé.');
          return;
        }
        if (geocodedEnseignants.length === 0) {
          setMatchingError('⚠️ Aucun enseignant géocodé.');
          return;
        }

        const stagesGeoInfo = geocodedStages.map(s => toStageGeoInfo({ id: s.id, eleveId: s.eleveId, adresse: s.adresse || '', lat: s.lat, lon: s.lon, geoStatus: s.geoStatus || 'pending', nomEntreprise: s.nomEntreprise }));
        const enseignantsGeoInfo = geocodedEnseignants.map(e => toEnseignantGeoInfo({ id: e.id!, nom: e.nom, prenom: e.prenom, adresse: e.adresse, lat: e.lat, lon: e.lon, geoStatus: e.geoStatus, capaciteStage: activeScenario.parametres.suiviStage?.capaciteTuteurDefaut ?? 5 }));

        const effectiveCriteres = getEffectiveCriteres(activeScenario.type, activeScenario.parametres.criteresV2 || []);
        const stageOptions = criteresToStageOptions(effectiveCriteres, { distanceMaxKm: activeScenario.parametres.suiviStage?.distanceMaxKm, dureeMaxMin: activeScenario.parametres.suiviStage?.dureeMaxMin });

        const distanceMaxKm = activeScenario.parametres.suiviStage?.distanceMaxKm ?? 25;
        const pairs: Array<{ enseignantId: string; stageId: string; distanceKm: number; durationMin: number; isValid: boolean }> = [];

        for (const stage of stagesGeoInfo) {
          if (!stage.geo) continue;
          for (const ens of enseignantsGeoInfo) {
            if (!ens.homeGeo) continue;
            const distanceKm = calculateDistance(ens.homeGeo.lat, ens.homeGeo.lon, stage.geo.lat, stage.geo.lon);
            if (distanceKm <= distanceMaxKm) {
              pairs.push({ enseignantId: ens.enseignantId, stageId: stage.stageId, distanceKm: Math.round(distanceKm * 10) / 10, durationMin: Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60), isValid: true });
            }
          }
        }

        const result = solveStageMatching(stagesGeoInfo, enseignantsGeoInfo, pairs, { ...stageOptions, useLocalSearch: true, verbose: false });

        // Clear and create affectations
        const existingForScenario = affectations.filter(a => a.scenarioId === activeScenario.id);
        for (const aff of existingForScenario) await deleteAffectation(aff.id!);

        for (const aff of result.affectations) {
          const stage = geocodedStages.find(s => s.id === aff.stageId);
          try {
            await addAffectation({ eleveId: aff.eleveId, enseignantId: aff.enseignantId, scenarioId: activeScenario.id!, type: 'suivi_stage', metadata: { stageId: aff.stageId, distanceKm: aff.distanceKm, durationMin: aff.durationMin, entreprise: stage?.nomEntreprise }, scoreDetail: { trajet: Math.round(100 - aff.score) }, scoreTotal: Math.round(100 - aff.score) });
          } catch (err) {
            setMatchingError(`Erreur lors de la création d'une affectation : ${String(err)}`);
          }
        }

        setMatchingStats({ total: geocodedStages.length, affected: result.affectations.length, score: result.stats.totalAffectes > 0 ? Math.round(100 - (result.stats.dureeMoyenneMin / 60) * 100) : 0 });
        if (result.nonAffectes.length > 0) {
          const reasons = result.nonAffectes.slice(0, 3).map(n => n.raisons[0]).join('; ');
          setMatchingError(`${result.nonAffectes.length} stage(s) non affecté(s): ${reasons}`);
        }
      } else if (isJuryMode && scenarioJurys.length > 0) {
        // DNB jury matching
        const result = solveOralDnbComplete(scenarioEleves, enseignants, scenarioJurys, activeScenario, { verbose: false });

        const resultsMap = new Map<string, MatchingResultDNB>();
        result.affectations.forEach(a => resultsMap.set(a.eleveId, a));
        setDnbResults(resultsMap);

        const existingForScenario = affectations.filter(a => a.scenarioId === activeScenario.id);
        for (const aff of existingForScenario) await deleteAffectation(aff.id!);

        for (const aff of result.affectations) {
          await addAffectation({ eleveId: aff.eleveId, enseignantId: '', juryId: aff.juryId, scenarioId: activeScenario.id!, type: 'oral_dnb', metadata: { source: 'algorithm' }, explication: aff.explication, scoreDetail: aff.scoreDetail, scoreTotal: aff.score });
        }

        setMatchingStats({ total: scenarioEleves.length, affected: result.affectations.length, score: result.scoreGlobal, tauxMatiere: result.tauxMatchMatiere });
        if (result.nonAffectes.length > 0) setMatchingError(`${result.nonAffectes.length} élève(s) non affectés`);
      } else {
        // Standard matching
        const result = solveMatching(scenarioEleves, scenarioEnseignants, activeScenario, new Map(), { verbose: false });
        const newAffectations = convertToAffectations(result.affectations, activeScenario);

        const existingForScenario = affectations.filter(a => a.scenarioId === activeScenario.id);
        for (const aff of existingForScenario) await deleteAffectation(aff.id!);

        for (const aff of newAffectations) await addAffectation(aff);

        setMatchingStats({ total: scenarioEleves.length, affected: result.affectations.length, score: result.scoreGlobal });
        if (result.nonAffectes.length > 0) setMatchingError(`${result.nonAffectes.length} élève(s) non affectés`);
      }
    } catch (err) {
      setMatchingError(`Erreur: ${String(err)}`);
    } finally {
      setIsRunning(false);
    }
  }, [activeScenario, isJuryMode, isStageScenario, scenarioEleves, scenarioEnseignants, scenarioJurys, stages, enseignants, affectations, addAffectation, deleteAffectation]);

  const handleResetAffectations = useCallback(async () => {
    if (!activeScenario) return;

    const confirmed = await confirmReset('Êtes-vous sûr de vouloir réinitialiser toutes les affectations ?');
    if (!confirmed) return;

    try {
      await deleteAffectationsByScenario(activeScenario.id!);
      setMatchingStats(null);
      setMatchingError(null);
      setDnbResults(new Map());
    } catch (err) {
      setMatchingError(`Erreur lors de la réinitialisation : ${String(err)}`);
    }
  }, [activeScenario, deleteAffectationsByScenario, confirmReset]);

  const handleValidateClick = useCallback(() => {
    if (scenarioAffectations.length === 0) {
      setMatchingError('Aucune affectation à valider. Lancez d\'abord le matching.');
      return;
    }
    setShowValidationModal(true);
  }, [scenarioAffectations]);

  const handleValidateAffectations = useCallback(async () => {
    if (!activeScenario) return;

    setIsValidating(true);
    setMatchingError(null);

    try {
      const result = buildArchiveFromCurrentState({
        scenario: activeScenario,
        affectations,
        eleves,
        enseignants,
        jurys: isJuryMode ? scenarioJurys : undefined,
        stages: isStageScenario ? stages : undefined,
      });

      const archiveId = await createArchive(result.archive);
      setValidationSuccess({ date: new Date(), archiveId });
      setShowValidationModal(false);
      setTimeout(() => setValidationSuccess(null), VALIDATION_SUCCESS_DISPLAY_MS);
    } catch (err) {
      setMatchingError(`Erreur lors de la validation : ${String(err)}`);
    } finally {
      setIsValidating(false);
    }
  }, [activeScenario, affectations, eleves, enseignants, isJuryMode, isStageScenario, scenarioJurys, stages, createArchive]);

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
        isValidating={isValidating}
        scenarioInfo={scenarioInfo}
        affectationsCount={scenarioAffectations.length}
        runButtonDisabled={runButtonDisabled}
        runButtonTitle={runButtonTitle}
        onRunMatching={runMatching}
        onResetAffectations={handleResetAffectations}
        onValidateClick={handleValidateClick}
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

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="board-columns">
          {/* Unassigned column */}
          <div className="board-column eleves-column">
            <div className="column-header">
              <h2>Élèves à affecter</h2>
              <HelpTooltip content={HELP_TEXTS.board.dragDrop} />
              <span className="count-badge">{unassignedEleves.length}</span>
            </div>
            <UnassignedDropZone>
              {unassignedEleves.map(eleve => (
                <DraggableEleve key={eleve.id} eleve={eleve} onContextMenu={handleContextMenuUnassigned} />
              ))}
              {unassignedEleves.length === 0 && (
                <div className="empty-state"><p>Tous les élèves sont affectés</p></div>
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
                    />
                  ))
                ) : (
                  <div className="empty-state jury-setup-required">
                    <Users size={48} />
                    <h3>Configuration des jurys requise</h3>
                    <p>Aucun jury n'a été créé pour ce scénario.</p>
                  </div>
                )
              ) : (
                displayedEnseignants.map(enseignant => (
                  <DroppableEnseignantTile
                    key={enseignant.id}
                    enseignant={enseignant}
                    affectations={affectationsByEnseignant.get(enseignant.id!) || []}
                    eleves={eleves}
                    capacity={capacity}
                    onContextMenu={handleContextMenuAffected}
                    onClick={handleTeacherCardClick}
                    isStageScenario={isStageScenario}
                  />
                ))
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

      {infoModalEleve && (
        <EleveInfoModal
          eleve={infoModalEleve.eleve}
          affectation={infoModalEleve.affectation}
          enseignant={infoModalEleve.enseignant}
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

      <ValidationModal
        isOpen={showValidationModal}
        isValidating={isValidating}
        scenario={activeScenario!}
        affectations={scenarioAffectations}
        eleves={scenarioEleves}
        enseignants={displayedEnseignants}
        jurys={scenarioJurys}
        stages={stages}
        onClose={() => setShowValidationModal(false)}
        onConfirm={handleValidateAffectations}
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
