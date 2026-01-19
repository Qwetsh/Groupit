// ============================================================
// JURY MANAGER - Gestion des jurys pour l'Oral DNB avec Drag & Drop
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  Plus, Trash2, Users, GraduationCap, Edit2, Save, X,
  Wand2, RefreshCw, UserPlus, AlertTriangle, CheckCircle, GripVertical, ArrowRight
} from 'lucide-react';
import { useJuryStore } from '../../stores/juryStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useAffectationStore } from '../../stores/affectationStore';
import { useEleveStore } from '../../stores/eleveStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import type { Jury, Enseignant, Scenario } from '../../domain/models';
import { getHeuresMatiere, MATIERES_HEURES_3E } from '../../domain/models';
import './JuryManager.css';

interface JuryManagerProps {
  scenario: Scenario;
}

// ============================================================
// COMPOSANTS DRAGGABLE / DROPPABLE
// ============================================================

interface DraggableEnseignantProps {
  enseignant: Enseignant;
  juryId: string | null;
}

function DraggableEnseignant({ enseignant, juryId }: DraggableEnseignantProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ens-${enseignant.id}`,
    data: { enseignant, fromJuryId: juryId },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Trouver la catégorie de la matière pour la couleur
  const matiereRef = MATIERES_HEURES_3E.find(m =>
    m.matiere.toLowerCase() === enseignant.matierePrincipale?.toLowerCase() ||
    enseignant.matierePrincipale?.toLowerCase().includes(m.matiere.toLowerCase())
  );
  const categorie = matiereRef?.categorie || 'autre';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-enseignant categorie-${categorie} ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={14} className="drag-handle" />
      <div className="ens-info">
        <span className="ens-name">{enseignant.prenom} {enseignant.nom}</span>
        <span className="ens-matiere">{enseignant.matierePrincipale}</span>
      </div>
      <span className="ens-heures">{getHeuresMatiere(enseignant.matierePrincipale)}h</span>
    </div>
  );
}

interface DroppableJuryProps {
  jury: Jury;
  enseignants: Enseignant[];
  juryEnseignants: Enseignant[];
  stats: { nbEleves: number; matieres: string[] };
  isEditing: boolean;
  editingName: string;
  editingCapacite: number;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onEditNameChange: (name: string) => void;
  onEditCapaciteChange: (cap: number) => void;
}

function DroppableJury({
  jury,
  juryEnseignants,
  stats,
  isEditing,
  editingName,
  editingCapacite,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditNameChange,
  onEditCapaciteChange,
}: DroppableJuryProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `jury-${jury.id}`,
    data: { jury },
  });

  const isFull = stats.nbEleves >= jury.capaciteMax;

  return (
    <div
      ref={setNodeRef}
      className={`droppable-jury ${isOver ? 'drag-over' : ''}`}
    >
      <div className="jury-header-row">
        {isEditing ? (
          <div className="jury-edit-form">
            <input
              type="text"
              value={editingName}
              onChange={e => onEditNameChange(e.target.value)}
              placeholder="Nom du jury"
              autoFocus
            />
            <div className="capacite-input">
              <span>Cap:</span>
              <input
                type="number"
                min={1}
                max={30}
                value={editingCapacite}
                onChange={e => onEditCapaciteChange(parseInt(e.target.value) || 8)}
              />
            </div>
            <button className="btn-icon-sm success" onClick={onSaveEdit}>
              <Save size={14} />
            </button>
            <button className="btn-icon-sm" onClick={onCancelEdit}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="jury-title">
              <span className="jury-name">{jury.nom}</span>
              <span className={`capacity-badge ${isFull ? 'full' : ''}`}>
                {stats.nbEleves}/{jury.capaciteMax}
              </span>
            </div>
            <div className="jury-header-actions">
              <button className="btn-icon-sm" onClick={onStartEdit} title="Modifier">
                <Edit2 size={14} />
              </button>
              <button className="btn-icon-sm danger" onClick={onDelete} title="Supprimer">
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      {stats.matieres.length > 0 && (
        <div className="jury-matieres">
          {stats.matieres.map(m => (
            <span key={m} className="matiere-mini-tag">{m}</span>
          ))}
        </div>
      )}

      <div className={`jury-enseignants-zone ${juryEnseignants.length === 0 ? 'empty' : ''}`}>
        {juryEnseignants.length === 0 ? (
          <div className="drop-placeholder">
            <UserPlus size={20} />
            <span>Glissez des enseignants ici</span>
          </div>
        ) : (
          juryEnseignants.map(ens => (
            <DraggableEnseignant key={ens.id} enseignant={ens} juryId={jury.id!} />
          ))
        )}
      </div>

      {stats.nbEleves > 0 && (
        <div className="jury-affectations-count">
          <CheckCircle size={12} />
          {stats.nbEleves} élève(s)
        </div>
      )}
    </div>
  );
}

// Zone des enseignants non assignés
function DroppableUnassignedZone({ enseignants }: { enseignants: Enseignant[] }) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'unassigned',
    data: { isUnassigned: true },
  });

  return (
    <div className="unassigned-zone-wrapper">
      <div className="unassigned-header">
        <Users size={18} />
        <span>Enseignants disponibles ({enseignants.length})</span>
      </div>
      <div
        ref={setNodeRef}
        className={`unassigned-zone ${isOver ? 'drag-over' : ''} ${enseignants.length === 0 ? 'empty' : ''}`}
      >
        {enseignants.length === 0 ? (
          <div className="drop-placeholder">
            <CheckCircle size={16} />
            <span>Tous les enseignants sont assignés</span>
            <span className="drop-hint">Glissez un enseignant ici pour le désassigner</span>
          </div>
        ) : (
          enseignants.map(ens => (
            <DraggableEnseignant key={ens.id} enseignant={ens} juryId={null} />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export function JuryManager({ scenario }: JuryManagerProps) {
  const navigate = useNavigate();
  const setCurrentScenario = useScenarioStore(state => state.setCurrentScenario);
  
  // Store hooks
  const allJurys = useJuryStore(state => state.jurys);
  const addJury = useJuryStore(state => state.addJury);
  const updateJury = useJuryStore(state => state.updateJury);
  const deleteJury = useJuryStore(state => state.deleteJury);
  const moveEnseignantBetweenJurys = useJuryStore(state => state.moveEnseignantBetweenJurys);
  const generateJurysAuto = useJuryStore(state => state.generateJurysAuto);
  const computeJuryMatieres = useJuryStore(state => state.computeJuryMatieres);

  const enseignants = useEnseignantStore(state => state.enseignants);
  const affectations = useAffectationStore(state => state.affectations);
  const eleves = useEleveStore(state => state.eleves);

  // Filter jurys for this scenario
  const jurys = useMemo(() => {
    return allJurys.filter(j => j.scenarioId === scenario.id);
  }, [allJurys, scenario.id]);

  // ============================================================
  // FILTRAGE DES ENSEIGNANTS SELON LES FILTRES DU SCÉNARIO
  // ============================================================
  // Utilise scenario.parametres.filtresEnseignants pour filtrer
  // (classesEnCharge, matieres, ppOnly) comme dans Board.tsx
  const enseignantsSource = useMemo(() => {
    const filters = scenario.parametres?.filtresEnseignants;
    
    // Si pas de filtres, retourner tous les enseignants
    if (!filters) {
      console.log('[JuryManager] Pas de filtres, tous enseignants:', enseignants.length);
      return enseignants;
    }

    const filtered = enseignants.filter(e => {
      // Filtre prof principal only
      if (filters.ppOnly && !e.estProfPrincipal) {
        return false;
      }
      
      // Filtre par matières
      if (filters.matieres && filters.matieres.length > 0) {
        if (!e.matierePrincipale || !filters.matieres.includes(e.matierePrincipale)) {
          return false;
        }
      }
      
      // Filtre par classes en charge (ex: avoir une classe de 3ème)
      if (filters.classesEnCharge && filters.classesEnCharge.length > 0) {
        const ensClasses = e.classesEnCharge || [];
        const hasMatchingClass = filters.classesEnCharge.some(fc => 
          ensClasses.some(ec => ec.toLowerCase().includes(fc.toLowerCase()))
        );
        if (!hasMatchingClass) {
          return false;
        }
      }
      
      return true;
    });

    console.log('[JuryManager] Filtres scénario:', filters);
    console.log('[JuryManager] Enseignants après filtrage:', filtered.length, '/', enseignants.length);
    
    return filtered;
  }, [enseignants, scenario.parametres?.filtresEnseignants]);

  // Local state
  const [editingJuryId, setEditingJuryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCapacite, setEditingCapacite] = useState(8);
  const [activeEnseignant, setActiveEnseignant] = useState<Enseignant | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [nbJurysToGenerate, setNbJurysToGenerate] = useState(3);
  const [nbEnseignantsParJury, setNbEnseignantsParJury] = useState(2);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Enseignants déjà assignés à des jurys
  const assignedEnseignantIds = useMemo(() => {
    const ids = new Set<string>();
    jurys.forEach(j => j.enseignantIds.forEach(id => ids.add(id)));
    return ids;
  }, [jurys]);

  // Enseignants disponibles (non assignés)
  const availableEnseignants = useMemo(() => {
    return enseignantsSource.filter(e => !assignedEnseignantIds.has(e.id!));
  }, [enseignantsSource, assignedEnseignantIds]);

  // Stats par jury
  const juryStats = useMemo(() => {
    const stats: Record<string, { nbEleves: number; matieres: string[] }> = {};
    jurys.forEach(jury => {
      const juryAffectations = affectations.filter(
        a => a.scenarioId === scenario.id && a.juryId === jury.id
      );
      stats[jury.id!] = {
        nbEleves: juryAffectations.length,
        matieres: computeJuryMatieres(jury, enseignantsSource),
      };
    });
    return stats;
  }, [jurys, affectations, scenario.id, enseignantsSource, computeJuryMatieres]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleAddJury = async () => {
    const juryNumber = jurys.length + 1;
    await addJury({
      scenarioId: scenario.id!,
      nom: `Jury ${juryNumber}`,
      enseignantIds: [],
      capaciteMax: scenario.parametres.oralDnb?.capaciteJuryDefaut || 8,
    });
  };

  const handleGenerateAuto = async () => {
    console.log('[JuryManager] === GÉNÉRATION AUTOMATIQUE ===');
    console.log('[JuryManager] Nombre jurys demandés:', nbJurysToGenerate);
    console.log('[JuryManager] Enseignants par jury:', nbEnseignantsParJury);
    console.log('[JuryManager] Enseignants source:', enseignantsSource.length);
    console.log('[JuryManager] Enseignants source détail:', enseignantsSource.map(e => `${e.nom} (${e.matierePrincipale})`));
    
    if (jurys.length > 0) {
      const confirmed = confirm(
        'Cette action va remplacer tous les jurys existants. Continuer ?'
      );
      if (!confirmed) return;
    }

    setIsGenerating(true);
    try {
      await generateJurysAuto(scenario, enseignantsSource, {
        nbJurys: nbJurysToGenerate,
        capaciteParJury: scenario.parametres.oralDnb?.capaciteJuryDefaut || 8,
        enseignantsParJury: nbEnseignantsParJury,
        equilibrerMatieres: true,
      });
      console.log('[JuryManager] Génération terminée avec succès');
    } catch (error) {
      console.error('[JuryManager] Erreur génération jurys:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartEdit = (jury: Jury) => {
    setEditingJuryId(jury.id!);
    setEditingName(jury.nom);
    setEditingCapacite(jury.capaciteMax);
  };

  const handleSaveEdit = async () => {
    if (editingJuryId) {
      await updateJury(editingJuryId, {
        nom: editingName.trim() || `Jury ${jurys.findIndex(j => j.id === editingJuryId) + 1}`,
        capaciteMax: editingCapacite,
      });
      setEditingJuryId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingJuryId(null);
  };

  const handleDeleteJury = async (juryId: string) => {
    if (confirm('Supprimer ce jury ? Les affectations seront perdues.')) {
      await deleteJury(juryId);
    }
  };

  // DnD Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.enseignant) {
      setActiveEnseignant(data.enseignant);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveEnseignant(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData?.enseignant) {
      setActiveEnseignant(null);
      return;
    }

    const enseignantId = activeData.enseignant.id;
    const fromJuryId = activeData.fromJuryId;
    let toJuryId: string | null = null;

    if (overData?.jury) {
      toJuryId = overData.jury.id;
    } else if (overData?.isUnassigned) {
      toJuryId = null;
    } else {
      setActiveEnseignant(null);
      return;
    }

    // Ne rien faire si même destination
    if (fromJuryId === toJuryId) {
      setActiveEnseignant(null);
      return;
    }

    await moveEnseignantBetweenJurys(enseignantId, fromJuryId, toJuryId);
    setActiveEnseignant(null);
  }, [moveEnseignantBetweenJurys]);

  // Calcul totaux
  const totalCapacite = jurys.reduce((sum, j) => sum + j.capaciteMax, 0);
  const totalEleves = Object.values(juryStats).reduce((sum, s) => sum + s.nbEleves, 0);

  // Calcul en temps réel de la capacité potentielle avec les paramètres actuels
  const capaciteJuryDefaut = scenario.parametres.oralDnb?.capaciteJuryDefaut || 8;
  const capacitePotentielle = nbJurysToGenerate * capaciteJuryDefaut;
  
  // Nombre d'élèves du scénario (filtrés selon les filtres du scénario)
  const nbElevesScenario = useMemo(() => {
    const filtres = scenario.parametres?.filtresEleves;
    if (!filtres) return eleves.length;
    
    return eleves.filter(e => {
      if (filtres.classes && filtres.classes.length > 0) {
        if (!e.classe || !filtres.classes.includes(e.classe)) return false;
      }
      return true;
    }).length;
  }, [eleves, scenario.parametres?.filtresEleves]);
  
  // Élèves potentiellement non affectés
  const elevesNonAffectesPotentiels = Math.max(0, nbElevesScenario - capacitePotentielle);
  
  // Vérifier si assez d'enseignants disponibles pour créer tous les jurys
  const enseignantsNecessaires = nbJurysToGenerate * nbEnseignantsParJury;
  const manqueEnseignants = Math.max(0, enseignantsNecessaires - enseignantsSource.length);

  // Vérifier si la configuration est prête pour le matching
  const jurysAvecEnseignants = jurys.filter(j => j.enseignantIds && j.enseignantIds.length > 0);
  const isJuryConfigurationReady = jurysAvecEnseignants.length > 0 && jurysAvecEnseignants.length === jurys.length;

  // Naviguer vers la page Affectations
  const handleGoToAffectations = () => {
    setCurrentScenario(scenario.id!);
    navigate('/board');
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="jury-manager-dnd">
        {/* Header avec actions */}
        <div className="jury-manager-header">
          <div className="header-info">
            <h3><Users size={20} /> Jurys ({jurys.length})</h3>
            {jurys.length > 0 && (
              <span className="capacity-summary">
                Capacité: <strong>{totalCapacite}</strong> élèves
                {totalEleves > 0 && ` • ${totalEleves} affectés`}
              </span>
            )}
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={handleAddJury}>
              <Plus size={16} /> Jury vide
            </button>
          </div>
        </div>

        {/* Génération automatique */}
        <div className="auto-generate-section">
          <div className="auto-generate-card">
            <Wand2 size={20} />
            <div className="auto-generate-info">
              <span className="auto-title">Génération automatique</span>
              <span className="auto-desc">
                Répartit équitablement les enseignants par catégorie de matière
              </span>
            </div>
            <div className="auto-generate-controls">
              <label>
                Nb jurys:
                <input
                  type="number"
                  min={1}
                  max={Math.max(enseignantsSource.length, 10)}
                  value={nbJurysToGenerate}
                  onChange={e => setNbJurysToGenerate(parseInt(e.target.value) || 3)}
                />
              </label>
              <label>
                Ens/jury:
                <input
                  type="number"
                  min={1}
                  max={Math.max(enseignantsSource.length, 1)}
                  value={nbEnseignantsParJury}
                  onChange={e => setNbEnseignantsParJury(parseInt(e.target.value) || 1)}
                />
              </label>
              <button
                className="btn-primary"
                onClick={handleGenerateAuto}
                disabled={isGenerating || enseignantsSource.length === 0}
              >
                {isGenerating ? <RefreshCw size={16} className="spin" /> : <Wand2 size={16} />}
                {jurys.length > 0 ? 'Regénérer' : 'Générer'}
              </button>
            </div>
          </div>
          {enseignantsSource.length === 0 && (
            <div className="warning-notice">
              <AlertTriangle size={16} />
              Importez d'abord des enseignants pour générer les jurys
            </div>
          )}
          
          {/* Avertissement: trop de jurys par rapport aux enseignants disponibles */}
          {manqueEnseignants > 0 && (
            <div className="warning-notice">
              <AlertTriangle size={16} />
              Pas assez d'enseignants ! Il vous manque {manqueEnseignants} enseignant{manqueEnseignants > 1 ? 's' : ''} pour créer {nbJurysToGenerate} jurys avec {nbEnseignantsParJury} enseignant{nbEnseignantsParJury > 1 ? 's' : ''} chacun
              ({enseignantsSource.length} disponible{enseignantsSource.length > 1 ? 's' : ''} / {enseignantsNecessaires} nécessaire{enseignantsNecessaires > 1 ? 's' : ''})
            </div>
          )}
          
          {/* Capacité prévisionnelle en temps réel */}
          <div className="capacity-preview">
            <div className="preview-stat">
              <span className="preview-label">Capacité prévue:</span>
              <span className="preview-value">{capacitePotentielle} élèves</span>
              <span className="preview-detail">({nbJurysToGenerate} jurys × {capaciteJuryDefaut} places)</span>
            </div>
            <div className="preview-stat">
              <span className="preview-label">Élèves à affecter:</span>
              <span className="preview-value">{nbElevesScenario}</span>
            </div>
            {elevesNonAffectesPotentiels > 0 ? (
              <div className="preview-stat warning">
                <AlertTriangle size={16} />
                <span className="preview-label">Non affectés:</span>
                <span className="preview-value danger">{elevesNonAffectesPotentiels}</span>
              </div>
            ) : (
              <div className="preview-stat success">
                <CheckCircle size={16} />
                <span className="preview-value success">Capacité OK</span>
              </div>
            )}
          </div>
        </div>

        {/* Zone principale: Drag & Drop */}
        <div className="dnd-workspace">
          {/* Zone des enseignants non assignés */}
          <DroppableUnassignedZone enseignants={availableEnseignants} />

          {/* Grille des jurys */}
          <div className="jurys-grid">
            {jurys.length === 0 ? (
              <div className="empty-jurys">
                <GraduationCap size={40} />
                <p>Aucun jury créé</p>
                <span>Utilisez la génération automatique ou créez des jurys manuellement</span>
              </div>
            ) : (
              jurys.map(jury => {
                const stats = juryStats[jury.id!] || { nbEleves: 0, matieres: [] };
                const juryEnseignants = jury.enseignantIds
                  .map(id => enseignantsSource.find(e => e.id === id))
                  .filter(Boolean) as Enseignant[];

                return (
                  <DroppableJury
                    key={jury.id}
                    jury={jury}
                    enseignants={enseignants}
                    juryEnseignants={juryEnseignants}
                    stats={stats}
                    isEditing={editingJuryId === jury.id}
                    editingName={editingName}
                    editingCapacite={editingCapacite}
                    onStartEdit={() => handleStartEdit(jury)}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    onDelete={() => handleDeleteJury(jury.id!)}
                    onEditNameChange={setEditingName}
                    onEditCapaciteChange={setEditingCapacite}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={{ duration: 0, easing: 'ease' }}>
          {activeEnseignant && (
            <div className="draggable-enseignant dragging-overlay">
              <GripVertical size={14} className="drag-handle" />
              <div className="ens-info">
                <span className="ens-name">{activeEnseignant.prenom} {activeEnseignant.nom}</span>
                <span className="ens-matiere">{activeEnseignant.matierePrincipale}</span>
              </div>
            </div>
          )}
        </DragOverlay>
      </div>

      {/* Bandeau de guidage vers les affectations */}
      {isJuryConfigurationReady && (
        <div className="jury-ready-banner">
          <div className="ready-content">
            <CheckCircle size={20} />
            <div className="ready-text">
              <strong>Configuration terminée !</strong>
              <span>{jurys.length} jury(s) configuré(s) • Capacité totale : {totalCapacite} élèves</span>
            </div>
          </div>
          <button className="btn-go-affectations" onClick={handleGoToAffectations}>
            Lancer les affectations
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </DndContext>
  );
}
