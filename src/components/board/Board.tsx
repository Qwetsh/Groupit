import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  pointerWithin,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useEleveStore } from '../../stores/eleveStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useAffectationStore } from '../../stores/affectationStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useJuryStore } from '../../stores/juryStore';
import { useStageStore } from '../../stores/stageStore';
import { solveMatching, convertToAffectations, solveOralDnbComplete, solveStageMatching, toStageGeoInfo, toEnseignantGeoInfo } from '../../algorithms';
import { getEffectiveCriteres, criteresToStageOptions } from '../../domain/criteriaConfig';
import type { Eleve, Enseignant, Affectation, Jury, MatchingResultDNB } from '../../domain/models';
import { Wand2, RefreshCw, AlertCircle, GripVertical, Info, UserX, Users, CheckCircle, RotateCcw, MapPin } from 'lucide-react';
import { ContextMenu, type ContextMenuItem } from '../context-menu';
import { EleveInfoModal } from '../modals/EleveInfoModal';
import { ExportButtons } from '../export';
import { StageAssignmentMapDrawer, COLLEGE_GEO } from './StageAssignmentMapDrawer';
import './Board.css';

// ============================================================
// CONTEXT MENU STATE TYPE
// ============================================================
interface ContextMenuState {
  x: number;
  y: number;
  eleve: Eleve;
  affectation?: Affectation;
  enseignant?: Enseignant;
}

// ============================================================
// DRAGGABLE COMPONENTS
// ============================================================

// Draggable élève from the unassigned column
const DraggableEleve: React.FC<{ 
  eleve: Eleve;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve) => void;
}> = ({ eleve, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `eleve:${eleve.id}`,
    data: { type: 'eleve', eleveId: eleve.id, eleve },
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, eleve);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-eleve ${isDragging ? 'dragging' : ''}`}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={14} className="drag-handle" />
      <span className="eleve-nom">{eleve.nom}</span>
      <span className="eleve-prenom">{eleve.prenom}</span>
      <span className="eleve-classe">{eleve.classe}</span>
    </div>
  );
};

// Draggable affectation chip (élève already assigned)
const DraggableAffectationChip: React.FC<{ 
  affectation: Affectation; 
  eleve: Eleve;
  enseignant: Enseignant;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, enseignant: Enseignant) => void;
}> = ({ affectation, eleve, enseignant, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `affectation:${affectation.id}`,
    data: { type: 'affectation', affectationId: affectation.id, eleveId: eleve.id, eleve },
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, eleve, affectation, enseignant);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mini-eleve ${isDragging ? 'dragging' : ''}`}
      title={`${eleve.prenom} ${eleve.nom} (${eleve.classe}) - Clic droit pour le menu`}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <span className="mini-name">{eleve.prenom} {eleve.nom.charAt(0)}.</span>
      <span className="mini-classe">{eleve.classe}</span>
    </div>
  );
};

// ============================================================
// DROPPABLE COMPONENTS
// ============================================================

// Droppable zone for unassigned élèves
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

// Droppable enseignant tile
const DroppableEnseignantTile: React.FC<{
  enseignant: Enseignant;
  affectations: Affectation[];
  eleves: Eleve[];
  capacity: number;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, enseignant: Enseignant) => void;
  onClick?: (enseignant: Enseignant) => void;
  isStageScenario?: boolean;
}> = ({ enseignant, affectations, eleves, capacity, onContextMenu, onClick, isStageScenario }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `enseignant:${enseignant.id}`,
    data: { type: 'enseignant', enseignantId: enseignant.id },
  });

  const handleTileClick = (e: React.MouseEvent) => {
    // Ne pas déclencher si on clique sur un élève ou si c'est un drag
    if ((e.target as HTMLElement).closest('.mini-eleve')) return;
    if (onClick && isStageScenario) {
      onClick(enseignant);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`enseignant-tile ${affectations.length > 0 ? 'has-eleves' : ''} ${isOver ? 'drop-highlight' : ''} ${isStageScenario && onClick ? 'clickable' : ''}`}
      onClick={handleTileClick}
      style={isStageScenario && onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="tile-header">
        <div className="tile-info">
          <span className="tile-name">{enseignant.prenom} {enseignant.nom}</span>
          <span className="tile-matiere">{enseignant.matierePrincipale}</span>
          {enseignant.estProfPrincipal && enseignant.classePP && (
            <span className="tile-pp">PP {enseignant.classePP}</span>
          )}
        </div>
        <div className="tile-count">
          <span className={affectations.length >= capacity ? 'full' : ''}>
            {affectations.length}/{capacity}
          </span>
          {isStageScenario && affectations.length > 0 && (
            <span title="Cliquez pour voir la carte des trajets">
              <MapPin size={14} className="stage-map-icon" />
            </span>
          )}
        </div>
      </div>
      <div className="tile-eleves">
        {affectations.map(aff => {
          const eleve = eleves.find(e => e.id === aff.eleveId);
          if (!eleve) return null;
          return (
            <DraggableAffectationChip 
              key={aff.id} 
              affectation={aff} 
              eleve={eleve}
              enseignant={enseignant}
              onContextMenu={onContextMenu}
            />
          );
        })}
        {affectations.length === 0 && (
          <div className="tile-empty">Déposez des élèves ici</div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// JURY TILE COMPONENT (for Oral DNB)
// ============================================================

interface JuryAffectationDisplay {
  eleveId: string;
  eleve: Eleve;
  matiereMatch: boolean;
  matiereEleve: string | null;
  explicationRaison?: string;
}

// Draggable élève chip for jury (with matière info)
const DraggableJuryAffectationChip: React.FC<{
  display: JuryAffectationDisplay;
  jury: Jury;
  affectation: Affectation;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, jury: Jury) => void;
}> = ({ display, jury, affectation, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `jury-aff:${affectation.id}`,
    data: { type: 'jury-affectation', affectationId: affectation.id, eleveId: display.eleveId, eleve: display.eleve },
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, display.eleve, affectation, jury);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mini-eleve jury-eleve ${display.matiereMatch ? 'matiere-match' : 'no-matiere-match'} ${isDragging ? 'dragging' : ''}`}
      title={`${display.eleve.prenom} ${display.eleve.nom} - ${display.matiereEleve || 'Matière non renseignée'}${display.matiereMatch ? ' ✓' : ''}`}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <span className="mini-name">{display.eleve.prenom} {display.eleve.nom.charAt(0)}.</span>
      {display.matiereEleve && (
        <span className={`mini-matiere ${display.matiereMatch ? 'match' : ''}`}>
          {display.matiereEleve.substring(0, 3)}
          {display.matiereMatch && <CheckCircle size={10} />}
        </span>
      )}
    </div>
  );
};

// Droppable jury tile
const DroppableJuryTile: React.FC<{
  jury: Jury;
  enseignants: Enseignant[];
  affectationsDisplay: JuryAffectationDisplay[];
  scenarioAffectations: Affectation[];
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, jury: Jury) => void;
}> = ({ jury, enseignants, affectationsDisplay, scenarioAffectations, onContextMenu }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `jury:${jury.id}`,
    data: { type: 'jury', juryId: jury.id },
  });

  // Get jury enseignants
  const juryEnseignants = enseignants.filter(e => jury.enseignantIds.includes(e.id!));
  const juryMatieres = [...new Set(juryEnseignants.map(e => e.matierePrincipale))];
  
  // Stats
  const nbMatchMatiere = affectationsDisplay.filter(a => a.matiereMatch).length;
  const tauxRemplissage = Math.round((affectationsDisplay.length / jury.capaciteMax) * 100);

  return (
    <div
      ref={setNodeRef}
      className={`jury-tile ${affectationsDisplay.length > 0 ? 'has-eleves' : ''} ${isOver ? 'drop-highlight' : ''}`}
    >
      <div className="tile-header jury-header">
        <div className="tile-info">
          <span className="tile-name jury-name">
            <Users size={14} />
            {jury.nom}
          </span>
          <div className="jury-enseignants-list">
            {juryEnseignants.length > 0 ? (
              juryEnseignants.map((e) => (
                <span key={e.id} className="ens-full-name" title={e.matierePrincipale}>
                  {e.prenom} {e.nom}
                </span>
              ))
            ) : (
              <span className="no-enseignants">Aucun enseignant</span>
            )}
          </div>
          <div className="jury-matieres">
            {juryMatieres.map((m, idx) => (
              <span key={idx} className="jury-matiere-tag">{m}</span>
            ))}
          </div>
        </div>
        <div className="tile-count jury-count">
          <span className={affectationsDisplay.length >= jury.capaciteMax ? 'full' : ''}>
            {affectationsDisplay.length}/{jury.capaciteMax}
          </span>
          {affectationsDisplay.length > 0 && (
            <span className="matiere-match-count" title="Correspondances matière">
              <CheckCircle size={12} />
              {nbMatchMatiere}
            </span>
          )}
        </div>
      </div>
      <div className="tile-eleves jury-eleves">
        {affectationsDisplay.map((display) => {
          const aff = scenarioAffectations.find(a => a.eleveId === display.eleveId);
          if (!aff) return null;
          return (
            <DraggableJuryAffectationChip
              key={display.eleveId}
              display={display}
              jury={jury}
              affectation={aff}
              onContextMenu={onContextMenu}
            />
          );
        })}
        {affectationsDisplay.length === 0 && (
          <div className="tile-empty">Déposez des élèves ici</div>
        )}
      </div>
      {tauxRemplissage > 0 && (
        <div className="jury-progress">
          <div 
            className={`progress-fill ${tauxRemplissage >= 100 ? 'full' : tauxRemplissage >= 80 ? 'warning' : ''}`}
            style={{ width: `${Math.min(tauxRemplissage, 100)}%` }}
          />
        </div>
      )}
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
  const { stages, loadStagesByScenario } = useStageStore();

  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === currentScenarioId) || scenarios[0];
  }, [scenarios, currentScenarioId]);

  // Determine if it's a stage scenario
  const isStageScenario = useMemo(() => {
    return activeScenario?.type === 'suivi_stage';
  }, [activeScenario]);

  // Determine if we're in jury mode (Oral DNB)
  const isJuryMode = useMemo(() => {
    return activeScenario?.type === 'oral_dnb' && activeScenario?.parametres?.oralDnb?.utiliserJurys;
  }, [activeScenario]);

  // Get jurys for this scenario
  const scenarioJurys = useMemo(() => {
    if (!isJuryMode || !activeScenario) return [];
    return jurys.filter(j => j.scenarioId === activeScenario.id);
  }, [jurys, activeScenario, isJuryMode]);

  // State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);
  const [matchingStats, setMatchingStats] = useState<{ total: number; affected: number; score: number; tauxMatiere?: number } | null>(null);
  
  // DNB specific results storage
  const [dnbResults, setDnbResults] = useState<Map<string, MatchingResultDNB>>(new Map());
  
  // Context menu and modal state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [infoModalEleve, setInfoModalEleve] = useState<{ eleve: Eleve; affectation?: Affectation; enseignant?: Enseignant; jury?: Jury } | null>(null);

  // Stage map drawer state
  const [mapDrawerOpen, setMapDrawerOpen] = useState(false);
  const [selectedTeacherForMap, setSelectedTeacherForMap] = useState<Enseignant | null>(null);

  // Load stages when scenario changes (for stage scenarios)
  useEffect(() => {
    if (isStageScenario && activeScenario?.id) {
      loadStagesByScenario(activeScenario.id);
    }
  }, [isStageScenario, activeScenario?.id, loadStagesByScenario]);

  // Get stages for the selected teacher
  const selectedTeacherStages = useMemo(() => {
    if (!selectedTeacherForMap || !isStageScenario) return [];
    
    // Get affectations for this teacher
    const teacherAffectations = affectations.filter(
      a => a.enseignantId === selectedTeacherForMap.id && a.scenarioId === activeScenario?.id
    );
    
    // Get stages for the assigned students
    const assignedEleveIds = new Set(teacherAffectations.map(a => a.eleveId));
    
    return stages
      .filter(s => s.scenarioId === activeScenario?.id && s.eleveId && assignedEleveIds.has(s.eleveId))
      .map(stage => {
        const eleve = eleves.find(e => e.id === stage.eleveId);
        return { ...stage, eleve };
      });
  }, [selectedTeacherForMap, isStageScenario, affectations, stages, activeScenario?.id, eleves]);

  // Handle teacher card click (for stage scenarios)
  const handleTeacherCardClick = useCallback((enseignant: Enseignant) => {
    if (!isStageScenario) return;
    setSelectedTeacherForMap(enseignant);
    setMapDrawerOpen(true);
  }, [isStageScenario]);

  // Close map drawer
  const handleCloseMapDrawer = useCallback(() => {
    setMapDrawerOpen(false);
    setSelectedTeacherForMap(null);
  }, []);

  // Sensors - use Mouse and Touch for better compatibility
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // Filter eleves/enseignants based on scenario
  const scenarioEleves = useMemo(() => {
    if (!activeScenario?.parametres?.filtresEleves) return eleves;
    const filters = activeScenario.parametres.filtresEleves;
    return eleves.filter(e => {
      if (filters.classes && filters.classes.length > 0 && !filters.classes.includes(e.classe)) return false;
      if (filters.niveaux && filters.niveaux.length > 0) {
        const niveau = e.classe.replace(/[^0-9]/g, '')[0] + 'e';
        if (!filters.niveaux.includes(niveau as any)) return false;
      }
      return true;
    });
  }, [eleves, activeScenario]);

  const scenarioEnseignants = useMemo(() => {
    if (!activeScenario?.parametres?.filtresEnseignants) return enseignants;
    const filters = activeScenario.parametres.filtresEnseignants;
    return enseignants.filter(e => {
      if (filters.ppOnly && !e.estProfPrincipal) return false;
      if (filters.matieres && filters.matieres.length > 0 && !filters.matieres.includes(e.matierePrincipale)) return false;
      return true;
    });
  }, [enseignants, activeScenario]);

  // Liste d'enseignants à afficher dans le Board
  // Pour suivi_stage, on affiche tous les enseignants qui ont des affectations
  const displayedEnseignants = useMemo(() => {
    if (!isStageScenario) return scenarioEnseignants;
    
    // Récupérer les IDs des enseignants qui ont des affectations dans ce scénario
    const enseignantIdsWithAffectations = new Set(
      affectations
        .filter(a => a.scenarioId === activeScenario?.id && !a.juryId)
        .map(a => a.enseignantId)
    );
    
    // Combiner: enseignants du filtre + ceux avec des affectations
    const combined = new Map<string, typeof enseignants[0]>();
    scenarioEnseignants.forEach(e => combined.set(e.id!, e));
    enseignants.forEach(e => {
      if (enseignantIdsWithAffectations.has(e.id!)) {
        combined.set(e.id!, e);
      }
    });
    
    return Array.from(combined.values());
  }, [isStageScenario, scenarioEnseignants, enseignants, affectations, activeScenario]);

  // Compute affectations by enseignant (standard mode)
  // Pour suivi_stage, on doit inclure TOUS les enseignants qui ont des affectations
  const affectationsByEnseignant = useMemo(() => {
    const map = new Map<string, Affectation[]>();
    
    // Initialiser avec tous les enseignants à afficher
    displayedEnseignants.forEach(e => map.set(e.id!, []));
    
    // Ajouter les affectations
    const scenarioAffs = affectations.filter(a => a.scenarioId === activeScenario?.id && !a.juryId);
    
    scenarioAffs.forEach(a => {
      if (!map.has(a.enseignantId)) {
        map.set(a.enseignantId, []);
      }
      const list = map.get(a.enseignantId);
      if (list) list.push(a);
    });
    
    return map;
  }, [displayedEnseignants, affectations, activeScenario]);

  // Compute affectations by jury (jury mode)
  const affectationsByJury = useMemo(() => {
    const map = new Map<string, JuryAffectationDisplay[]>();
    scenarioJurys.forEach(j => map.set(j.id!, []));
    
    affectations
      .filter(a => a.scenarioId === activeScenario?.id && a.juryId)
      .forEach(a => {
        const list = map.get(a.juryId!);
        const eleve = eleves.find(e => e.id === a.eleveId);
        if (list && eleve) {
          // Get DNB result info if available
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
  }, [scenarioJurys, affectations, activeScenario, eleves, dnbResults]);

  // Unassigned élèves
  const assignedEleveIds = useMemo(() => {
    return new Set(
      affectations
        .filter(a => a.scenarioId === activeScenario?.id)
        .map(a => a.eleveId)
    );
  }, [affectations, activeScenario]);

  const unassignedEleves = useMemo(() => {
    return scenarioEleves.filter(e => !assignedEleveIds.has(e.id!));
  }, [scenarioEleves, assignedEleveIds]);

  // Context menu handlers
  const handleContextMenuUnassigned = useCallback((e: React.MouseEvent, eleve: Eleve) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      eleve,
    });
  }, []);

  const handleContextMenuAffected = useCallback((e: React.MouseEvent, eleve: Eleve, affectation: Affectation, enseignant: Enseignant) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      eleve,
      affectation,
      enseignant,
    });
  }, []);

  // Handler for jury context menu
  const handleContextMenuJury = useCallback((e: React.MouseEvent, eleve: Eleve, affectation: Affectation, jury: Jury) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      eleve,
      affectation,
      // Find first enseignant of jury for compatibility
      enseignant: enseignants.find(ens => jury.enseignantIds.includes(ens.id!)),
    });
  }, [enseignants]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Build context menu items
  const contextMenuItems: ContextMenuItem[] = useMemo(() => {
    if (!contextMenu) return [];
    const { affectation } = contextMenu;
    
    const items: ContextMenuItem[] = [
      {
        id: 'info',
        label: 'Voir les infos',
        icon: <Info size={16} />,
        onClick: () => {
          setInfoModalEleve({
            eleve: contextMenu.eleve,
            affectation: contextMenu.affectation,
            enseignant: contextMenu.enseignant,
          });
        },
      },
    ];

    if (affectation) {
      // Élève is assigned - show option to unassign
      items.push({
        id: 'unassign',
        label: 'Désaffecter',
        icon: <UserX size={16} />,
        onClick: async () => {
          await deleteAffectation(affectation.id!);
        },
        dividerAfter: true,
      });
    }

    // Future options can be added here
    // items.push({
    //   id: 'edit',
    //   label: 'Modifier l\'élève',
    //   icon: <Edit size={16} />,
    //   onClick: () => { /* open edit modal */ },
    // });

    return items;
  }, [contextMenu, deleteAffectation]);

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(String(active.id));
    setActiveData(active.data.current);
    console.log('DragStart:', active.id, active.data.current);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('DragEnd:', { activeId: active.id, overId: over?.id, overData: over?.data?.current });
    
    setActiveId(null);
    setActiveData(null);

    if (!over) {
      console.log('No drop target');
      return;
    }

    const activeDataCurrent = active.data.current as any;
    const overDataCurrent = over.data.current as any;

    // Get target enseignant ID
    const targetEnseignantId = overDataCurrent?.enseignantId || 
      (String(over.id).startsWith('enseignant:') ? String(over.id).split(':')[1] : null);

    // Get target jury ID (for Oral DNB mode)
    const targetJuryId = overDataCurrent?.juryId || 
      (String(over.id).startsWith('jury:') ? String(over.id).split(':')[1] : null);

    const isDropOnUnassigned = overDataCurrent?.type === 'unassigned' || over.id === 'unassigned-zone';

    // Case 1a: Dropping an unassigned élève on an enseignant (standard mode)
    if (activeDataCurrent?.type === 'eleve' && targetEnseignantId) {
      const eleveId = activeDataCurrent.eleveId;
      console.log('Creating affectation:', { eleveId, enseignantId: targetEnseignantId });
      
      try {
        await addAffectation({
          eleveId,
          enseignantId: targetEnseignantId,
          scenarioId: activeScenario?.id!,
          type: 'autre', // Manual assignment
          metadata: { source: 'drag-drop' },
          scoreDetail: {},
          scoreTotal: 0,
        });
        console.log('Affectation created successfully');
      } catch (err) {
        console.error('Failed to create affectation:', err);
      }
    }

    // Case 1b: Dropping an unassigned élève on a jury (DNB mode)
    if (activeDataCurrent?.type === 'eleve' && targetJuryId) {
      const eleveId = activeDataCurrent.eleveId;
      const eleve = activeDataCurrent.eleve as Eleve;
      const jury = scenarioJurys.find(j => j.id === targetJuryId);
      
      if (jury) {
        console.log('Creating jury affectation:', { eleveId, juryId: targetJuryId });
        
        // Check matière match
        const juryMatieres = [...new Set(
          jury.enseignantIds
            .map(id => enseignants.find(e => e.id === id)?.matierePrincipale)
            .filter(Boolean)
        )] as string[];
        const matiereMatch = eleve.matieresOral?.some(m => juryMatieres.includes(m)) ?? false;
        
        try {
          await addAffectation({
            eleveId,
            enseignantId: '', // No individual enseignant
            juryId: targetJuryId,
            scenarioId: activeScenario?.id!,
            type: 'oral_dnb',
            metadata: { source: 'drag-drop' },
            explication: {
              raisonPrincipale: matiereMatch 
                ? `Correspondance matière manuelle`
                : 'Affectation manuelle (pas de correspondance matière)',
              criteresUtilises: ['manuel'],
              matiereRespectee: matiereMatch,
              score: matiereMatch ? 100 : 50,
            },
            scoreDetail: { manuel: 100 },
            scoreTotal: matiereMatch ? 100 : 50,
          });
          console.log('Jury affectation created successfully');
        } catch (err) {
          console.error('Failed to create jury affectation:', err);
        }
      }
    }

    // Case 2a: Dropping an affectation on a different enseignant (reassign - standard mode)
    if (activeDataCurrent?.type === 'affectation' && targetEnseignantId) {
      const affectationId = activeDataCurrent.affectationId;
      console.log('Reassigning affectation:', { affectationId, newEnseignantId: targetEnseignantId });
      
      try {
        await updateAffectation(affectationId, { enseignantId: targetEnseignantId, juryId: undefined });
        console.log('Affectation reassigned successfully');
      } catch (err) {
        console.error('Failed to reassign affectation:', err);
      }
    }

    // Case 2b: Dropping a jury affectation on a different jury (reassign - DNB mode)
    if (activeDataCurrent?.type === 'jury-affectation' && targetJuryId) {
      const affectationId = activeDataCurrent.affectationId;
      const eleve = activeDataCurrent.eleve as Eleve;
      const jury = scenarioJurys.find(j => j.id === targetJuryId);
      
      if (jury) {
        console.log('Reassigning jury affectation:', { affectationId, newJuryId: targetJuryId });
        
        const juryMatieres = [...new Set(
          jury.enseignantIds
            .map(id => enseignants.find(e => e.id === id)?.matierePrincipale)
            .filter(Boolean)
        )] as string[];
        const matiereMatch = eleve.matieresOral?.some(m => juryMatieres.includes(m)) ?? false;
        
        try {
          await updateAffectation(affectationId, { 
            juryId: targetJuryId,
            explication: {
              raisonPrincipale: matiereMatch 
                ? `Correspondance matière (déplacement manuel)`
                : 'Déplacement manuel (pas de correspondance matière)',
              criteresUtilises: ['manuel'],
              matiereRespectee: matiereMatch,
              score: matiereMatch ? 100 : 50,
            },
          });
          console.log('Jury affectation reassigned successfully');
        } catch (err) {
          console.error('Failed to reassign jury affectation:', err);
        }
      }
    }

    // Case 3a: Dropping an affectation back to unassigned zone (remove - standard)
    if (activeDataCurrent?.type === 'affectation' && isDropOnUnassigned) {
      const affectationId = activeDataCurrent.affectationId;
      console.log('Deleting affectation:', affectationId);
      
      try {
        await deleteAffectation(affectationId);
        console.log('Affectation deleted successfully');
      } catch (err) {
        console.error('Failed to delete affectation:', err);
      }
    }

    // Case 3b: Dropping a jury affectation back to unassigned zone (remove - DNB)
    if (activeDataCurrent?.type === 'jury-affectation' && isDropOnUnassigned) {
      const affectationId = activeDataCurrent.affectationId;
      console.log('Deleting jury affectation:', affectationId);
      
      try {
        await deleteAffectation(affectationId);
        console.log('Jury affectation deleted successfully');
      } catch (err) {
        console.error('Failed to delete jury affectation:', err);
      }
    }
  }, [activeScenario, scenarioJurys, enseignants, addAffectation, updateAffectation, deleteAffectation]);

  // Run matching algorithm
  const runMatching = async () => {
    if (!activeScenario) {
      setMatchingError('Aucun scénario actif.');
      return;
    }

    // Validation pour Oral DNB : vérifier que tous les élèves ont une matière
    if (activeScenario.type === 'oral_dnb') {
      const elevesWithoutMatiere = scenarioEleves.filter(
        e => !e.matieresOral || e.matieresOral.length === 0
      );
      
      if (elevesWithoutMatiere.length > 0) {
        const names = elevesWithoutMatiere.slice(0, 3).map(e => `${e.prenom} ${e.nom}`);
        const more = elevesWithoutMatiere.length > 3 ? ` et ${elevesWithoutMatiere.length - 3} autres` : '';
        setMatchingError(
          `⚠️ ${elevesWithoutMatiere.length} élève(s) n'ont pas de matière d'oral assignée : ${names.join(', ')}${more}. ` +
          `Allez dans la page "Élèves" > "Matières Oral DNB" pour attribuer les matières.`
        );
        return;
      }
    }

    if (isJuryMode) {
      if (scenarioJurys.length === 0) {
        setMatchingError('⚠️ Aucun jury configuré. Rendez-vous dans "Scénarios" > "Jurys" pour en créer avant de lancer le matching.');
        return;
      }

      const jurysSansEnseignant = scenarioJurys.filter(j => !j.enseignantIds || j.enseignantIds.length === 0);
      if (jurysSansEnseignant.length > 0) {
        const names = jurysSansEnseignant.slice(0, 3).map(j => j.nom).join(', ');
        const more = jurysSansEnseignant.length > 3 ? ` et ${jurysSansEnseignant.length - 3} autre(s)` : '';
        setMatchingError(
          `⚠️ ${jurysSansEnseignant.length} jury(s) n'ont aucun enseignant assigné : ${names}${more}. ` +
          `Ajoutez au moins un enseignant par jury avant de lancer l'algorithme.`
        );
        return;
      }
    }

    setIsRunning(true);
    setMatchingError(null);
    setMatchingStats(null);
    setDnbResults(new Map());

    try {
      // ============================================================
      // SUIVI DE STAGE - Algorithme géographique
      // ============================================================
      if (isStageScenario) {
        console.log('🎯 [MATCHING STAGE] Début du matching Suivi de Stage');
        console.log('  - Scenario ID:', activeScenario.id);
        console.log('  - Stages dans le store:', stages.length);
        console.log('  - Enseignants filtrés:', scenarioEnseignants.length);
        
        // Filtrer les stages géocodés
        const geocodedStages = stages.filter(
          s => s.scenarioId === activeScenario.id && 
               (s.geoStatus === 'ok' || s.geoStatus === 'manual') && 
               s.lat && s.lon
        );
        
        console.log('  - Stages géocodés pour ce scénario:', geocodedStages.length);
        
        // Filtrer les enseignants géocodés
        const geocodedEnseignants = scenarioEnseignants.filter(
          e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon
        );
        
        console.log('  - Enseignants géocodés:', geocodedEnseignants.length);

        if (geocodedStages.length === 0) {
          setMatchingError('⚠️ Aucun stage géocodé. Allez dans Scénarios > Suivi de Stage > Géocodage pour localiser les stages.');
          return;
        }
        
        if (geocodedEnseignants.length === 0) {
          setMatchingError('⚠️ Aucun enseignant géocodé. Les enseignants doivent avoir une adresse localisée.');
          return;
        }

        // Convertir en format attendu par le solver
        const stagesGeoInfo = geocodedStages.map(s => toStageGeoInfo({
          id: s.id,
          eleveId: s.eleveId,
          adresse: s.adresse || '',
          lat: s.lat,
          lon: s.lon,
          geoStatus: s.geoStatus || 'pending',
          nomEntreprise: s.nomEntreprise,
        }));

        const enseignantsGeoInfo = geocodedEnseignants.map(e => toEnseignantGeoInfo({
          id: e.id!,
          nom: e.nom,
          prenom: e.prenom,
          adresse: e.adresse,
          lat: e.lat,
          lon: e.lon,
          geoStatus: e.geoStatus,
          capaciteStage: activeScenario.parametres.suiviStage?.capaciteTuteurDefaut ?? 5,
        }));

        // Récupérer les options depuis les critères du scénario
        const effectiveCriteres = getEffectiveCriteres(
          activeScenario.type,
          activeScenario.parametres.criteresV2 || []
        );
        const stageOptions = criteresToStageOptions(effectiveCriteres, {
          distanceMaxKm: activeScenario.parametres.suiviStage?.distanceMaxKm,
          dureeMaxMin: activeScenario.parametres.suiviStage?.dureeMaxMin,
        });

        // Calculer les paires de trajets (mode rapide avec Haversine)
        console.log('  - Calcul des paires (mode Haversine instantané)...');
        const distanceMaxKm = activeScenario.parametres.suiviStage?.distanceMaxKm ?? 25;
        const pairs: Array<{enseignantId: string; stageId: string; distanceKm: number; durationMin: number; isValid: boolean}> = [];
        
        for (const stage of stagesGeoInfo) {
          if (!stage.geo) continue;
          for (const ens of enseignantsGeoInfo) {
            if (!ens.homeGeo) continue;
            // Distance Haversine
            const R = 6371;
            const dLat = (stage.geo.lat - ens.homeGeo.lat) * Math.PI / 180;
            const dLon = (stage.geo.lon - ens.homeGeo.lon) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(ens.homeGeo.lat * Math.PI / 180) * Math.cos(stage.geo.lat * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distanceKm = R * c;
            
            // Filtrer par distance max
            if (distanceKm <= distanceMaxKm) {
              pairs.push({
                enseignantId: ens.enseignantId,
                stageId: stage.stageId,
                distanceKm: Math.round(distanceKm * 10) / 10,
                durationMin: Math.round(distanceKm * 1.5), // Estimation: 40 km/h en moyenne
                isValid: true,
              });
            }
          }
        }
        console.log('  - Paires calculées:', pairs.length, '(filtré à', distanceMaxKm, 'km max)');
        
        // Exécuter l'algorithme de matching
        console.log('  - Lancement solveStageMatching...');
        const result = solveStageMatching(
          stagesGeoInfo,
          enseignantsGeoInfo,
          pairs,
          {
            ...stageOptions,
            useLocalSearch: true,
            verbose: true,
          }
        );
        console.log('  - Résultat matching:', result.affectations.length, 'affectations');
        console.log('  - Non affectés:', result.nonAffectes.length);

        // Clear existing affectations for this scenario
        const existingForScenario = affectations.filter(a => a.scenarioId === activeScenario.id);
        console.log('  - Suppression de', existingForScenario.length, 'anciennes affectations...');
        for (const aff of existingForScenario) {
          await deleteAffectation(aff.id!);
        }
        console.log('  - Suppression terminée');

        // Créer les nouvelles affectations
        console.log('  - Création de', result.affectations.length, 'nouvelles affectations...');
        let createdCount = 0;
        for (const aff of result.affectations) {
          const stage = geocodedStages.find(s => s.id === aff.stageId);
          try {
            await addAffectation({
              eleveId: aff.eleveId,
              enseignantId: aff.enseignantId,
              scenarioId: activeScenario.id!,
              type: 'suivi_stage',
              metadata: {
                stageId: aff.stageId,
                distanceKm: aff.distanceKm,
                durationMin: aff.durationMin,
                entreprise: stage?.nomEntreprise,
            },
            scoreDetail: { trajet: Math.round(100 - aff.score) },
            scoreTotal: Math.round(100 - aff.score),
          });
            createdCount++;
          } catch (err) {
            console.error('  ❌ Erreur création affectation:', aff, err);
          }
        }
        console.log('  ✅ Création terminée:', createdCount, '/', result.affectations.length);

        setMatchingStats({
          total: geocodedStages.length,
          affected: result.affectations.length,
          score: result.stats.totalAffectes > 0 
            ? Math.round(100 - (result.stats.dureeMoyenneMin / 60) * 100) 
            : 0,
        });

        if (result.nonAffectes.length > 0) {
          const reasons = result.nonAffectes.slice(0, 3).map(n => n.raisons[0]).join('; ');
          setMatchingError(`${result.nonAffectes.length} stage(s) non affecté(s): ${reasons}`);
        }
      }
      // ============================================================
      // ORAL DNB - Mode Jury
      // ============================================================
      else if (isJuryMode && scenarioJurys.length > 0) {
        // Use DNB solver with jurys
        const result = solveOralDnbComplete(
          scenarioEleves,
          enseignants,
          scenarioJurys,
          activeScenario,
          { verbose: true }
        );

        // Store DNB results for display
        const resultsMap = new Map<string, MatchingResultDNB>();
        result.affectations.forEach(a => resultsMap.set(a.eleveId, a));
        setDnbResults(resultsMap);

        // Clear existing affectations for this scenario
        const existingForScenario = affectations.filter(a => a.scenarioId === activeScenario.id);
        for (const aff of existingForScenario) {
          await deleteAffectation(aff.id!);
        }

        // Add new affectations from DNB result
        for (const aff of result.affectations) {
          await addAffectation({
            eleveId: aff.eleveId,
            enseignantId: '', // No individual enseignant for jury mode
            juryId: aff.juryId,
            scenarioId: activeScenario.id!,
            type: 'oral_dnb',
            metadata: { source: 'algorithm' },
            explication: aff.explication,
            scoreDetail: aff.scoreDetail,
            scoreTotal: aff.score,
          });
        }

        setMatchingStats({
          total: scenarioEleves.length,
          affected: result.affectations.length,
          score: result.scoreGlobal,
          tauxMatiere: result.tauxMatchMatiere,
        });

        if (result.nonAffectes.length > 0) {
          setMatchingError(`${result.nonAffectes.length} élève(s) non affectés`);
        }
      } else {
        // Use standard solver
        const result = solveMatching(
          scenarioEleves,
          scenarioEnseignants,
          activeScenario,
          new Map(),
          { verbose: true }
        );

        const newAffectations = convertToAffectations(result.affectations, activeScenario);
        
        // Clear existing affectations for this scenario
        const existingForScenario = affectations.filter(a => a.scenarioId === activeScenario.id);
        for (const aff of existingForScenario) {
          await deleteAffectation(aff.id!);
        }

        // Add new affectations
        for (const aff of newAffectations) {
          await addAffectation(aff);
        }

        setMatchingStats({
          total: scenarioEleves.length,
          affected: result.affectations.length,
          score: result.scoreGlobal,
        });

        if (result.nonAffectes.length > 0) {
          setMatchingError(`${result.nonAffectes.length} élève(s) non affectés`);
        }
      }
    } catch (err) {
      setMatchingError(`Erreur: ${String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Reset all affectations for the active scenario
  const handleResetAffectations = async () => {
    if (!activeScenario) return;
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser toutes les affectations ? Cette action ne peut pas être annulée.')) {
      return;
    }

    try {
      await deleteAffectationsByScenario(activeScenario.id!);
      setMatchingStats(null);
      setMatchingError(null);
      setDnbResults(new Map());
    } catch (err) {
      setMatchingError(`Erreur lors de la réinitialisation : ${String(err)}`);
    }
  };

  const scenarioAffectations = affectations.filter(a => a.scenarioId === activeScenario?.id);
  const capacity = activeScenario?.parametres?.capaciteConfig?.capaciteBaseDefaut || 5;

  // Stats pour le suivi de stage
  const scenarioStages = useMemo(() => 
    stages.filter(s => s.scenarioId === activeScenario?.id), 
    [stages, activeScenario?.id]
  );
  const geocodedStagesCount = useMemo(() => 
    scenarioStages.filter(s => (s.geoStatus === 'ok' || s.geoStatus === 'manual') && s.lat && s.lon).length,
    [scenarioStages]
  );
  const geocodedEnseignantsCount = useMemo(() => 
    scenarioEnseignants.filter(e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon).length,
    [scenarioEnseignants]
  );
  const stageReadyForMatching = geocodedStagesCount > 0 && geocodedEnseignantsCount > 0;

  const jurysWithoutEnseignants = isJuryMode
    ? scenarioJurys.filter(j => !j.enseignantIds || j.enseignantIds.length === 0)
    : [];
  const hasJurysWithoutEnseignants = jurysWithoutEnseignants.length > 0;
  const jurysWithoutEnseignantsLabel = hasJurysWithoutEnseignants
    ? `${jurysWithoutEnseignants.slice(0, 3).map(j => j.nom).join(', ')}${jurysWithoutEnseignants.length > 3 ? '...' : ''}`
    : '';
  
  // Conditions de désactivation du bouton selon le type de scénario
  const runButtonDisabled = isRunning || !activeScenario 
    || (isJuryMode && (scenarioJurys.length === 0 || hasJurysWithoutEnseignants))
    || (isStageScenario && !stageReadyForMatching);
  
  const runButtonTitle = !activeScenario
    ? 'Sélectionnez un scénario pour lancer le matching'
    : isJuryMode && scenarioJurys.length === 0
      ? 'Créez d\'abord des jurys dans la page Scénarios'
      : isJuryMode && hasJurysWithoutEnseignants
        ? `Associez au moins un enseignant à chaque jury (${jurysWithoutEnseignantsLabel})`
        : isStageScenario && geocodedStagesCount === 0
          ? 'Géocodez d\'abord les stages dans la page Scénarios'
          : isStageScenario && geocodedEnseignantsCount === 0
            ? 'Les enseignants doivent avoir une adresse géocodée'
            : '';

  // Find active eleve for drag overlay
  const activeEleve = activeData?.eleve;

  return (
    <div className="board-container">
      {/* Toolbar */}
      <div className="board-toolbar">
        <div className="toolbar-left">
          <h1>Affectations</h1>
          {activeScenario && <span className="scenario-badge">{activeScenario.nom}</span>}
          {isJuryMode && <span className="mode-badge jury">Mode Jury DNB</span>}
          {isStageScenario && <span className="mode-badge stage">Mode Suivi Stage</span>}
          <span className="scenario-info">
            {isStageScenario 
              ? `${geocodedStagesCount}/${scenarioStages.length} stages • ${geocodedEnseignantsCount} enseignants`
              : `${scenarioEleves.length} élèves • ${isJuryMode ? `${scenarioJurys.length} jurys` : `${scenarioEnseignants.length} enseignants`}`
            }
          </span>
        </div>
        <div className="toolbar-right">
          <button
            className="btn-icon"
            title="Réinitialiser les affectations"
            onClick={handleResetAffectations}
            disabled={!activeScenario || isRunning}
          >
            <RotateCcw size={18} />
          </button>
          <button 
            className="btn-action" 
            onClick={runMatching} 
            disabled={runButtonDisabled}
            title={runButtonTitle}
          >
            {isRunning ? (
              <>
                <RefreshCw size={18} className="spinning" />
                En cours...
              </>
            ) : (
              <>
                <Wand2 size={18} />
                Lancer le matching
              </>
            )}
          </button>
        </div>
      </div>

      {/* Warning message for jury mode without jurys */}
      {isJuryMode && scenarioJurys.length === 0 && (
        <div className="matching-message warning">
          <AlertCircle size={18} />
          <span>
            <strong>Configuration requise :</strong> Allez dans Scénarios → {activeScenario?.nom} → Gestion des Jurys pour créer des jurys avant de lancer les affectations.
          </span>
        </div>
      )}

      {/* Warning message for stage mode without geocoded data */}
      {isStageScenario && !stageReadyForMatching && (
        <div className="matching-message warning">
          <AlertCircle size={18} />
          <span>
            <strong>Configuration requise :</strong> Allez dans Scénarios → {activeScenario?.nom} → Suivi de Stage pour importer et géocoder les stages avant de lancer les affectations.
            {geocodedStagesCount === 0 && ' (Aucun stage géocodé)'}
            {geocodedStagesCount > 0 && geocodedEnseignantsCount === 0 && ' (Aucun enseignant géocodé)'}
          </span>
        </div>
      )}

      {/* Messages */}
      {matchingError && (
        <div className="matching-message error">
          <AlertCircle size={18} />
          {matchingError}
          <button onClick={() => setMatchingError(null)}>×</button>
        </div>
      )}
      {matchingStats && !matchingError && (
        <div className="matching-message success">
          ✓ {matchingStats.affected}/{matchingStats.total} élèves affectés
          {matchingStats.tauxMatiere !== undefined && (
            <span className="matiere-info"> • {Math.round(matchingStats.tauxMatiere * 100)}% correspondance matière</span>
          )}
          <button onClick={() => setMatchingStats(null)}>×</button>
        </div>
      )}

      {/* Export Panel - affiché si scénario actif en mode jury OU suivi de stage */}
      {(isJuryMode || isStageScenario) && activeScenario && (
        <ExportButtons 
          scenario={activeScenario} 
          filteredEleveIds={scenarioEleves.map(e => e.id!)} 
        />
      )}

      {/* DnD Context */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="board-columns">
          {/* Column: Élèves non affectés */}
          <div className="board-column eleves-column">
            <div className="column-header">
              <h2>Élèves à affecter</h2>
              <span className="count-badge">{unassignedEleves.length}</span>
            </div>
            <UnassignedDropZone>
              {unassignedEleves.map(eleve => (
                <DraggableEleve 
                  key={eleve.id} 
                  eleve={eleve}
                  onContextMenu={handleContextMenuUnassigned}
                />
              ))}
              {unassignedEleves.length === 0 && (
                <div className="empty-state">
                  <p>Tous les élèves sont affectés</p>
                </div>
              )}
            </UnassignedDropZone>
          </div>

          {/* Column: Résultats */}
          <div className="board-column results-column">
            <div className="column-header">
              <h2>Résultats</h2>
              <span className="count-badge">{scenarioAffectations.length} affectations</span>
              {isJuryMode && matchingStats?.tauxMatiere !== undefined && (
                <span className="matiere-badge">
                  {Math.round(matchingStats.tauxMatiere)}% matières correspondantes
                </span>
              )}
            </div>
            <div className="results-grid">
              {isJuryMode ? (
                // Mode Jury pour Oral DNB
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
                    <p>Allez dans <strong>Scénarios</strong>, développez ce scénario et créez des jurys dans la section "Gestion des Jurys".</p>
                  </div>
                )
              ) : (
                // Mode standard - Enseignants individuels
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

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeId && activeEleve && (
            <div className="drag-overlay-item">
              {activeEleve.prenom} {activeEleve.nom} ({activeEleve.classe})
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={closeContextMenu}
        />
      )}

      {/* Info Modal */}
      {infoModalEleve && (
        <EleveInfoModal
          eleve={infoModalEleve.eleve}
          affectation={infoModalEleve.affectation}
          enseignant={infoModalEleve.enseignant}
          onClose={() => setInfoModalEleve(null)}
        />
      )}

      {/* Stage Map Drawer (only for suivi_stage scenarios) */}
      {isStageScenario && selectedTeacherForMap && (
        <StageAssignmentMapDrawer
          isOpen={mapDrawerOpen}
          onClose={handleCloseMapDrawer}
          teacher={selectedTeacherForMap}
          assignedStages={selectedTeacherStages}
          collegeGeo={COLLEGE_GEO}
        />
      )}
    </div>
  );
};
