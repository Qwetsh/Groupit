// ============================================================
// GUIDED STEP - CONFIGURATION (Oral DNB avec sélection enseignants et jurys)
// ============================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronRight, Check, Users, GraduationCap, AlertTriangle, Shuffle, GripVertical, Filter, Clock, ShieldCheck, Calendar, CalendarOff } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useEleveStore } from '../../../stores/eleveStore';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import { useJuryStore } from '../../../stores/juryStore';
import type { Scenario, Enseignant, Jury } from '../../../domain/models';
import '../GuidedMode.css';

interface StepConfigurationProps {
  onNext: () => void;
  onBack: () => void;
}

// ============================================================
// SUB-COMPONENTS FOR DRAG & DROP
// ============================================================

interface DraggableEnseignantProps {
  enseignant: Enseignant;
  fromJuryId: string | null;
  demiJourneesOral?: string[];
}

function DraggableEnseignant({ enseignant, fromJuryId, demiJourneesOral }: DraggableEnseignantProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ens-${enseignant.id}`,
    data: { enseignant, fromJuryId },
  });

  const isIndispo = demiJourneesOral && demiJourneesOral.length > 0 && enseignant.indisponibilites?.some(d => demiJourneesOral.includes(d));

  return (
    <div
      ref={setNodeRef}
      className={clsx('jury-member', isDragging && 'dragging', isIndispo && 'indisponible')}
      title={isIndispo ? 'Indisponible le jour de l\'oral' : undefined}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={14} className="drag-handle" />
      {isIndispo && <CalendarOff size={12} className="indispo-icon" />}
      <span className="member-name">{enseignant.prenom} {enseignant.nom}</span>
      <span className="member-matiere">{enseignant.matierePrincipale || '-'}</span>
    </div>
  );
}

interface DroppableJuryProps {
  jury: Jury;
  enseignants: Enseignant[];
  onCapacityChange: (capacity: number) => void;
  demiJourneesOral?: string[];
}

function DroppableSuppleantZone({ juryId }: { juryId: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `suppleant-${juryId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx('jury-suppleant-drop', isOver && 'drop-target')}
    >
      <ShieldCheck size={12} />
      <span>Deposer ici pour suppleant</span>
    </div>
  );
}

function DroppableJury({ jury, enseignants, onCapacityChange, demiJourneesOral }: DroppableJuryProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `jury-${jury.id}`,
  });

  const juryEnseignants = enseignants.filter(e => jury.enseignantIds.includes(e.id!));
  const jurySuppleants = enseignants.filter(e => jury.suppleantsIds?.includes(e.id!));
  const matieres = [...new Set(juryEnseignants.map(e => e.matierePrincipale).filter(Boolean))];

  return (
    <div
      ref={setNodeRef}
      className={clsx('jury-card-guided', isOver && 'drop-target')}
    >
      <div className="jury-header">
        <span className="jury-name">{jury.nom}</span>
        <div className="jury-capacity-input">
          <input
            type="number"
            min={1}
            max={30}
            value={jury.capaciteMax}
            onChange={(e) => onCapacityChange(parseInt(e.target.value) || 8)}
            className="capacity-input"
          />
          <span className="capacity-label">places</span>
        </div>
      </div>
      <div className="jury-members">
        {juryEnseignants.map(ens => (
          <DraggableEnseignant
            key={ens.id}
            enseignant={ens}
            fromJuryId={jury.id!}
            demiJourneesOral={demiJourneesOral}
          />
        ))}
        {juryEnseignants.length === 0 && (
          <div className="empty-jury">Glissez des enseignants ici</div>
        )}
      </div>
      {jurySuppleants.length > 0 && (
        <div className="jury-suppleants">
          <span className="suppleant-label">
            <ShieldCheck size={12} />
            Suppleant{jurySuppleants.length > 1 ? 's' : ''}
          </span>
          {jurySuppleants.map(ens => (
            <DraggableEnseignant
              key={ens.id}
              enseignant={ens}
              fromJuryId={jury.id!}
              demiJourneesOral={demiJourneesOral}
            />
          ))}
        </div>
      )}
      <DroppableSuppleantZone juryId={jury.id!} />
      <div className="jury-footer">
        <span className="jury-matieres">
          {matieres.length > 0 ? matieres.join(', ') : 'Aucune matiere'}
        </span>
      </div>
    </div>
  );
}

interface DroppableUnassignedProps {
  enseignants: Enseignant[];
  selectedIds: Set<string>;
  demiJourneesOral?: string[];
}

function DroppableUnassigned({ enseignants, selectedIds, demiJourneesOral }: DroppableUnassignedProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
  });

  // Only show selected but unassigned enseignants
  const unassignedEnseignants = enseignants.filter(e => selectedIds.has(e.id!));

  return (
    <div
      ref={setNodeRef}
      className={clsx('unassigned-zone', isOver && 'drop-target')}
    >
      <h4>Enseignants disponibles ({unassignedEnseignants.length})</h4>
      <div className="unassigned-list">
        {unassignedEnseignants.map(ens => (
          <DraggableEnseignant
            key={ens.id}
            enseignant={ens}
            fromJuryId={null}
            demiJourneesOral={demiJourneesOral}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StepConfiguration({ onNext, onBack }: StepConfigurationProps) {
  const { guidedMode, setGuidedCreatedScenarioId } = useUIStore();
  const { scenarios, addScenario, setActiveScenario } = useScenarioStore();
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const { generateJurysAuto, updateJury, moveEnseignantBetweenJurys, getJurysByScenario, clearJurysByScenario } = useJuryStore();

  // State
  const [scenarioName, setScenarioName] = useState('');
  const [selectedEnseignantIds, setSelectedEnseignantIds] = useState<Set<string>>(new Set());
  const [elevesParJury, setElevesParJury] = useState(15);
  const [enseignantsParJury, setEnseignantsParJury] = useState(2);
  const [suppleants, setSuppleants] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createdScenarioId, setCreatedScenarioId] = useState<string | null>(null);
  const [showJuryEditor, setShowJuryEditor] = useState(false);
  const [activeEnseignant, setActiveEnseignant] = useState<Enseignant | null>(null);
  const [demiJourneesOral, setDemiJourneesOral] = useState<string[]>(['jeudi_matin']);
  const [filterNiveaux, setFilterNiveaux] = useState<Set<string>>(new Set());
  const [filterMatieres, setFilterMatieres] = useState<Set<string>>(new Set());

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Computed values
  const isOralDnb = guidedMode.scenarioType === 'oral_dnb';

  // For Oral DNB: auto-select all 3eme students
  const eleves3e = useMemo(() =>
    eleves.filter(e => e.classe?.startsWith('3')),
    [eleves]
  );

  const nbEleves = eleves3e.length;
  const nbSelectedEnseignants = selectedEnseignantIds.size;

  // Calculate required jurys
  const nbJurysNeeded = useMemo(() =>
    Math.ceil(nbEleves / elevesParJury),
    [nbEleves, elevesParJury]
  );

  const nbEnseignantsTitulaires = nbJurysNeeded * enseignantsParJury;
  const nbSuppleantsTotal = nbJurysNeeded * suppleants;
  const nbEnseignantsNeeded = nbEnseignantsTitulaires + nbSuppleantsTotal;

  // Time estimation: 20 min per student (5 min presentation + 15 min questions)
  // All jurys run in parallel, so total time = (eleves per jury) * 20 min
  const tempsPassageMin = elevesParJury * 20;
  const tempsHeures = Math.floor(tempsPassageMin / 60);
  const tempsMinutes = tempsPassageMin % 60;
  const tempsFormatted = tempsHeures > 0
    ? `${tempsHeures}h${tempsMinutes > 0 ? `${String(tempsMinutes).padStart(2, '0')}` : '00'}`
    : `${tempsMinutes} min`;
  const hasEnoughEnseignants = nbSelectedEnseignants >= nbEnseignantsNeeded;

  // Distinct niveaux and matières for filters
  const distinctNiveaux = useMemo(() => {
    const niveaux = new Set<string>();
    enseignants.forEach(e => {
      e.classesEnCharge?.forEach(cls => {
        const match = cls.match(/^(\d+)/);
        if (match) niveaux.add(match[1] + 'e');
      });
    });
    return Array.from(niveaux).sort();
  }, [enseignants]);

  const distinctMatieres = useMemo(() => {
    const mats = new Set<string>();
    enseignants.forEach(e => {
      if (e.matierePrincipale) mats.add(e.matierePrincipale);
    });
    return Array.from(mats).sort();
  }, [enseignants]);

  // Toggle filter helpers
  const toggleFilterNiveau = useCallback((niveau: string) => {
    setFilterNiveaux(prev => {
      const next = new Set(prev);
      if (next.has(niveau)) next.delete(niveau);
      else next.add(niveau);
      return next;
    });
  }, []);

  const toggleFilterMatiere = useCallback((matiere: string) => {
    setFilterMatieres(prev => {
      const next = new Set(prev);
      if (next.has(matiere)) next.delete(matiere);
      else next.add(matiere);
      return next;
    });
  }, []);

  const hasActiveFilters = filterNiveaux.size > 0 || filterMatieres.size > 0;

  const clearFilters = useCallback(() => {
    setFilterNiveaux(new Set());
    setFilterMatieres(new Set());
  }, []);

  // Filtered enseignants for display
  const filteredEnseignants = useMemo(() => {
    let list = enseignants;
    if (filterNiveaux.size > 0) {
      list = list.filter(e =>
        e.classesEnCharge?.some(cls => {
          const match = cls.match(/^(\d+)/);
          return match && filterNiveaux.has(match[1] + 'e');
        })
      );
    }
    if (filterMatieres.size > 0) {
      list = list.filter(e => e.matierePrincipale && filterMatieres.has(e.matierePrincipale));
    }
    return list;
  }, [enseignants, filterNiveaux, filterMatieres]);

  // Select filtered enseignants
  const selectFilteredEnseignants = useCallback(() => {
    setSelectedEnseignantIds(prev => {
      const next = new Set(prev);
      filteredEnseignants.forEach(e => next.add(e.id!));
      return next;
    });
  }, [filteredEnseignants]);

  // Get jurys for created scenario
  const scenarioJurys = createdScenarioId ? getJurysByScenario(createdScenarioId) : [];

  // Enseignants not in any jury (titulaires + suppléants)
  const assignedEnseignantIds = new Set([
    ...scenarioJurys.flatMap(j => j.enseignantIds),
    ...scenarioJurys.flatMap(j => j.suppleantsIds || []),
  ]);
  const unassignedSelectedEnseignants = enseignants.filter(
    e => selectedEnseignantIds.has(e.id!) && !assignedEnseignantIds.has(e.id!)
  );

  // Auto-set scenario name
  useEffect(() => {
    if (isOralDnb) {
      setScenarioName('Oral du DNB');
    } else {
      setScenarioName('Suivi de Stage 3eme');
    }
  }, [isOralDnb]);

  // Toggle enseignant selection
  const toggleEnseignant = useCallback((enseignantId: string) => {
    setSelectedEnseignantIds(prev => {
      const next = new Set(prev);
      if (next.has(enseignantId)) {
        next.delete(enseignantId);
      } else {
        next.add(enseignantId);
      }
      return next;
    });
  }, []);

  // Select all enseignants
  const selectAllEnseignants = useCallback(() => {
    setSelectedEnseignantIds(new Set(enseignants.map(e => e.id!)));
  }, [enseignants]);

  // Deselect all
  const deselectAllEnseignants = useCallback(() => {
    setSelectedEnseignantIds(new Set());
  }, []);

  // Create scenario and generate jurys
  const handleCreateAndGenerate = useCallback(async () => {
    if (!scenarioName.trim() || !hasEnoughEnseignants) return;

    setCreating(true);

    try {
      // Create scenario
      const newScenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> = {
        nom: scenarioName,
        type: isOralDnb ? 'oral_dnb' : 'suivi_stage',
        mode: isOralDnb ? 'groupes' : 'matching',
        parametres: {
          criteres: [],
          capaciteConfig: {
            capaciteBaseDefaut: elevesParJury,
            coefficients: { '6e': 0, '5e': 0, '4e': 0, '3e': 1 },
          },
          filtresEleves: {
            niveaux: ['3e'],
          },
          filtresEnseignants: {
            enseignantIds: Array.from(selectedEnseignantIds),
          },
          equilibrageActif: true,
          oralDnb: {
            matieresAutorisees: [],
            utiliserJurys: true,
            poidsMatiere: 50,
            criteresSecondaires: ['equilibrage'],
            capaciteJuryDefaut: elevesParJury,
            demiJourneesOral: demiJourneesOral.length > 0 ? demiJourneesOral : ['jeudi_matin'],
          },
        },
      };

      const createdScenario = await addScenario(newScenario);
      setCreatedScenarioId(createdScenario.id!);
      setGuidedCreatedScenarioId(createdScenario.id!);
      setActiveScenario(createdScenario.id!);

      // Generate jurys
      const selectedEnsList = enseignants.filter(e => selectedEnseignantIds.has(e.id!));
      await generateJurysAuto(createdScenario, selectedEnsList, {
        nbJurys: nbJurysNeeded,
        capaciteParJury: elevesParJury,
        enseignantsParJury,
        suppleantsParJury: suppleants,
        equilibrerMatieres: true,
      });

      setShowJuryEditor(true);
    } catch (error) {
      console.error('Error creating scenario:', error);
    } finally {
      setCreating(false);
    }
  }, [
    scenarioName, hasEnoughEnseignants, isOralDnb, elevesParJury, selectedEnseignantIds,
    addScenario, setGuidedCreatedScenarioId, setActiveScenario, enseignants,
    generateJurysAuto, nbJurysNeeded, enseignantsParJury
  ]);

  // Regenerate jurys
  const handleRegenerateJurys = useCallback(async () => {
    if (!createdScenarioId) return;

    const scenario = scenarios.find(s => s.id === createdScenarioId);
    if (!scenario) return;

    setCreating(true);
    try {
      await clearJurysByScenario(createdScenarioId);
      const selectedEnsList = enseignants.filter(e => selectedEnseignantIds.has(e.id!));
      await generateJurysAuto(scenario, selectedEnsList, {
        nbJurys: nbJurysNeeded,
        capaciteParJury: elevesParJury,
        enseignantsParJury,
        suppleantsParJury: suppleants,
        equilibrerMatieres: true,
      });
    } finally {
      setCreating(false);
    }
  }, [
    createdScenarioId, scenarios, clearJurysByScenario, enseignants,
    selectedEnseignantIds, generateJurysAuto, nbJurysNeeded, elevesParJury, enseignantsParJury
  ]);

  // Update jury capacity
  const handleJuryCapacityChange = useCallback(async (juryId: string, capacity: number) => {
    await updateJury(juryId, { capaciteMax: capacity });
  }, [updateJury]);

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { enseignant } = event.active.data.current as { enseignant: Enseignant };
    setActiveEnseignant(enseignant);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveEnseignant(null);

    const { active, over } = event;
    if (!over) return;

    const { enseignant, fromJuryId } = active.data.current as { enseignant: Enseignant; fromJuryId: string | null };
    const overId = String(over.id);

    // Dropped on suppléant zone
    if (overId.startsWith('suppleant-')) {
      const toJuryId = overId.replace('suppleant-', '');
      // Remove from source first
      if (fromJuryId) {
        await moveEnseignantBetweenJurys(enseignant.id!, fromJuryId, null);
      }
      // Add as suppléant
      const jury = getJurysByScenario(createdScenarioId || '').find(j => j.id === toJuryId);
      if (jury && !jury.suppleantsIds?.includes(enseignant.id!)) {
        await updateJury(toJuryId, {
          suppleantsIds: [...(jury.suppleantsIds || []), enseignant.id!],
        });
      }
      return;
    }

    let toJuryId: string | null = null;
    if (overId.startsWith('jury-')) {
      toJuryId = overId.replace('jury-', '');
    } else if (overId === 'unassigned') {
      toJuryId = null;
    }

    if (fromJuryId !== toJuryId) {
      await moveEnseignantBetweenJurys(enseignant.id!, fromJuryId, toJuryId);
    }
  }, [moveEnseignantBetweenJurys, getJurysByScenario, createdScenarioId, updateJury]);

  // Continue to next step
  const handleContinue = useCallback(() => {
    onNext();
  }, [onNext]);



  // Calculate total capacity of jurys
  const totalCapacity = scenarioJurys.reduce((sum, j) => sum + j.capaciteMax, 0);

  // ============================================================
  // RENDER: JURY EDITOR (after creation)
  // ============================================================
  if (showJuryEditor && createdScenarioId) {
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="guided-step step-config jury-editor">
          {/* Scrollable content */}
          <div className="jury-editor-scroll">
            <h1 className="step-title">Vos jurys sont prets !</h1>
            <p className="step-subtitle">
              {scenarioJurys.length} jurys crees pour {nbEleves} eleves. Vous pouvez reorganiser les membres par glisser-deposer.
            </p>

            {/* Stats */}
            <div className="jury-stats">
              <div className="stat-item">
                <span className="stat-value">{scenarioJurys.length}</span>
                <span className="stat-label">jurys</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{totalCapacity}</span>
                <span className="stat-label">places totales</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{nbEleves}</span>
                <span className="stat-label">eleves</span>
              </div>
              {totalCapacity < nbEleves && (
                <div className="stat-item warning">
                  <AlertTriangle size={20} />
                  <span>Capacite insuffisante</span>
                </div>
              )}
            </div>

            {/* Regenerate button */}
            <button
              className="btn btn-secondary regenerate-btn"
              onClick={handleRegenerateJurys}
              disabled={creating}
            >
              <Shuffle size={18} />
              Regenerer les jurys
            </button>

            {/* Jury grid */}
            <div className="jury-grid">
              {scenarioJurys.map(jury => (
                <DroppableJury
                  key={jury.id}
                  jury={jury}
                  enseignants={enseignants}
                  onCapacityChange={(cap) => handleJuryCapacityChange(jury.id!, cap)}
                  demiJourneesOral={demiJourneesOral}
                />
              ))}
            </div>

            {/* Unassigned zone — toujours visible pour pouvoir y déposer des enseignants */}
            <DroppableUnassigned
              enseignants={unassignedSelectedEnseignants}
              selectedIds={selectedEnseignantIds}
              demiJourneesOral={demiJourneesOral}
            />
          </div>

          {/* Actions — fixed at bottom */}
          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setShowJuryEditor(false)}>
              Retour
            </button>
            <button
              className="btn btn-primary btn-large"
              onClick={handleContinue}
              disabled={scenarioJurys.length === 0}
            >
              Continuer vers la repartition
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeEnseignant && (
            <div className="jury-member dragging-overlay">
              <GripVertical size={14} />
              <span className="member-name">{activeEnseignant.prenom} {activeEnseignant.nom}</span>
              <span className="member-matiere">{activeEnseignant.matierePrincipale || '-'}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    );
  }

  // ============================================================
  // RENDER: CONFIGURATION FORM (before creation)
  // ============================================================
  return (
    <div className="guided-step step-config">
      <h1 className="step-title">Configuration</h1>
      <p className="step-subtitle">
        {isOralDnb
          ? "Configurez l'oral du DNB et selectionnez les enseignants pour les jurys."
          : 'Configurez le suivi de stage pour vos eleves de 3eme.'}
      </p>

      <div className="config-form config-two-columns">
        {/* Colonne gauche : paramètres */}
        <div className="config-col-left">
          {/* Scenario name */}
          <div className="form-group">
            <label>Nom de la configuration</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Ex: Oral du DNB"
              className="form-input"
            />
          </div>

          {/* Eleves info (auto for Oral DNB) */}
          {isOralDnb && (
            <div className="form-group">
              <label>Eleves concernes</label>
              <div className="auto-selection-info">
                <Users size={20} />
                <div>
                  <strong>{nbEleves} eleves de 3eme</strong>
                  <span>Selection automatique de tous les eleves de 3eme</span>
                </div>
                <Check size={20} className="check-icon" />
              </div>
            </div>
          )}

          {/* Demi-journée(s) de l'oral */}
          {isOralDnb && (
            <div className="form-group">
              <label>
                <Calendar size={18} />
                Demi-journee(s) de l'oral
              </label>
              <div className="indispo-grid oral-grid">
                <div className="indispo-header">
                  <span className="indispo-label-col" />
                  {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map(jour => (
                    <span key={jour} className="indispo-jour-header">{jour.slice(0, 3)}</span>
                  ))}
                </div>
                {['Matin', 'Apres-midi'].map(periode => (
                  <div key={periode} className="indispo-row">
                    <span className="indispo-label-col">{periode === 'Apres-midi' ? 'AP' : 'AM'}</span>
                    {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'].map(jour => {
                      const id = `${jour}_${periode === 'Matin' ? 'matin' : 'aprem'}`;
                      const isSelected = demiJourneesOral.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`indispo-cell ${isSelected ? 'indispo' : 'dispo'}`}
                          title={`${jour.charAt(0).toUpperCase() + jour.slice(1)} ${periode}`}
                          onClick={() => {
                            setDemiJourneesOral(prev =>
                              isSelected ? prev.filter(d => d !== id) : [...prev, id]
                            );
                          }}
                        >
                          {isSelected ? <Check size={12} /> : ''}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="form-hint">Cliquez pour selectionner — les enseignants indisponibles seront signales</p>
            </div>
          )}

          {/* Eleves par jury + Enseignants par jury + Suppléants — side by side */}
          {isOralDnb && (
            <div className="form-row-3col">
              <div className="form-group">
                <label>Eleves par jury</label>
                <p className="form-hint">Capacite de chaque jury.</p>
                <div className="number-input-group">
                  <button
                    className="number-btn"
                    onClick={() => setElevesParJury(Math.max(5, elevesParJury - 1))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={elevesParJury}
                    onChange={(e) => setElevesParJury(parseInt(e.target.value) || 15)}
                    className="form-input number-input"
                  />
                  <button
                    className="number-btn"
                    onClick={() => setElevesParJury(Math.min(30, elevesParJury + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Membres par jury</label>
                <p className="form-hint">Enseignants titulaires.</p>
                <div className="number-input-group">
                  <button
                    className="number-btn"
                    onClick={() => setEnseignantsParJury(Math.max(1, enseignantsParJury - 1))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={enseignantsParJury}
                    onChange={(e) => setEnseignantsParJury(parseInt(e.target.value) || 2)}
                    className="form-input number-input"
                  />
                  <button
                    className="number-btn"
                    onClick={() => setEnseignantsParJury(Math.min(4, enseignantsParJury + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Suppleants / jury</label>
                <p className="form-hint">Enseignants de reserve.</p>
                <div className="number-input-group">
                  <button
                    className="number-btn"
                    onClick={() => setSuppleants(Math.max(0, suppleants - 1))}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={suppleants}
                    onChange={(e) => setSuppleants(parseInt(e.target.value) || 0)}
                    className="form-input number-input"
                  />
                  <button
                    className="number-btn"
                    onClick={() => setSuppleants(Math.min(3, suppleants + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calculation preview */}
          {isOralDnb && (
            <div className="calculation-preview">
              <div className="calc-item">
                <span className="calc-label">Jurys necessaires</span>
                <span className="calc-value">{nbJurysNeeded}</span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Enseignants necessaires</span>
                <span className="calc-value">{nbEnseignantsNeeded}</span>
                {nbSuppleantsTotal > 0 && (
                  <span className="calc-detail">({nbEnseignantsTitulaires} + {nbSuppleantsTotal} suppl.)</span>
                )}
              </div>
              <div className="calc-item">
                <span className="calc-label">Duree estimee</span>
                <span className="calc-value time">
                  <Clock size={18} />
                  {tempsFormatted}
                </span>
              </div>
              <div className="calc-item">
                <span className="calc-label">Enseignants selectionnes</span>
                <span className={clsx('calc-value', !hasEnoughEnseignants && 'warning')}>
                  {nbSelectedEnseignants}
                </span>
              </div>
            </div>
          )}

          {/* Warning if not enough enseignants */}
          {isOralDnb && !hasEnoughEnseignants && nbSelectedEnseignants > 0 && (
            <div className="warning-message">
              <AlertTriangle size={18} />
              <span>
                Il manque {nbEnseignantsNeeded - nbSelectedEnseignants} enseignant(s) pour creer {nbJurysNeeded} jurys.
                Selectionnez plus d'enseignants ou reduisez le nombre d'enseignants par jury.
              </span>
            </div>
          )}
        </div>

        {/* Colonne droite : sélection enseignants */}
        {isOralDnb && (
          <div className="config-col-right">
            <div className="form-group">
              <label>
                <GraduationCap size={18} />
                Enseignants pour les jurys
              </label>

              {/* Filters */}
              <div className="ens-filters-bar">
                <div className="ens-filter-group">
                  <span className="ens-filter-label">
                    <Filter size={14} />
                    Niveaux
                  </span>
                  <div className="ens-filter-chips">
                    {distinctNiveaux.map(n => (
                      <button
                        key={n}
                        className={clsx('filter-chip', filterNiveaux.has(n) && 'active')}
                        onClick={() => toggleFilterNiveau(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ens-filter-group">
                  <span className="ens-filter-label">Matieres</span>
                  <div className="ens-filter-chips">
                    {distinctMatieres.map(m => (
                      <button
                        key={m}
                        className={clsx('filter-chip', filterMatieres.has(m) && 'active')}
                        onClick={() => toggleFilterMatiere(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ens-filter-actions">
                  {hasActiveFilters && (
                    <>
                      <button className="btn btn-text" onClick={selectFilteredEnseignants}>
                        + {filteredEnseignants.length} affiches
                      </button>
                      <button className="btn btn-text" onClick={clearFilters}>
                        Effacer filtres
                      </button>
                    </>
                  )}
                  <button className="btn btn-text" onClick={selectAllEnseignants}>
                    Tous
                  </button>
                  <button className="btn btn-text" onClick={deselectAllEnseignants}>
                    Aucun
                  </button>
                </div>
              </div>

              <div className="enseignant-grid compact">
                {filteredEnseignants.map(ens => {
                  const isIndispo = demiJourneesOral.length > 0 && ens.indisponibilites?.some(d => demiJourneesOral.includes(d));
                  return (
                    <button
                      key={ens.id}
                      className={clsx(
                        'enseignant-chip compact',
                        selectedEnseignantIds.has(ens.id!) && 'selected',
                        isIndispo && 'indisponible'
                      )}
                      onClick={() => toggleEnseignant(ens.id!)}
                      title={isIndispo ? 'Indisponible le jour de l\'oral' : undefined}
                    >
                      {selectedEnseignantIds.has(ens.id!) && <Check size={12} />}
                      {isIndispo && <CalendarOff size={12} className="indispo-icon" />}
                      <span className="ens-name">{ens.nom} {ens.prenom}</span>
                      <span className="ens-matiere">{ens.matierePrincipale || '-'}</span>
                    </button>
                  );
                })}
                {filteredEnseignants.length === 0 && enseignants.length > 0 && (
                  <p className="no-data-warning">Aucun enseignant ne correspond aux filtres.</p>
                )}
              </div>
              {enseignants.length === 0 && (
                <p className="no-data-warning">
                  Aucun enseignant dans la base. Retournez a l'etape precedente pour en importer.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button
          className="btn btn-primary btn-large"
          onClick={handleCreateAndGenerate}
          disabled={!scenarioName.trim() || (isOralDnb && !hasEnoughEnseignants) || creating}
        >
          {creating ? 'Creation...' : isOralDnb ? 'Creer les jurys' : 'Creer la configuration'}
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
