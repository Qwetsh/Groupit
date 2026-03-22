import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  Users,
  GraduationCap,
  Plus,
  Trash2,
  X,
  Download,
  Upload,
  FileText,
  Home,
  DoorOpen,
  Settings2,
  MapPin,
  ShieldCheck,
  Link2,
  Unlink,
  Info,
} from 'lucide-react';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useLibreMode, type LibreGroupe } from '../hooks/useLibreMode';
import { SALLES_DISPONIBLES, CATEGORIES_SALLES } from '../domain/sallesConfig';
import type { Eleve, Enseignant } from '../domain/models';
import './LibreModePage.css';

// ============================================================
// HELPER: extract niveau from classe string
// ============================================================
function extractNiveau(classe: string): string {
  return classe.replace(/[^0-9eè]/g, '').replace(/[eè].*/, 'e');
}

// ============================================================
// CONTEXT MENU COMPONENT
// ============================================================

interface ContextMenuState {
  x: number;
  y: number;
  type: 'eleve' | 'enseignant';
  id: string;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  allEleves: Eleve[];
  allEnseignants: Enseignant[];
  eleveLinkGroups: string[][];
  linkMode: string | null;
  onClose: () => void;
  onStartLink: (eleveId: string) => void;
  onUnlink: (eleveId: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  menu,
  allEleves,
  allEnseignants,
  eleveLinkGroups,
  linkMode,
  onClose,
  onStartLink,
  onUnlink,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (menu.type === 'eleve') {
    const eleve = allEleves.find(e => e.id === menu.id);
    if (!eleve) return null;
    const linkGroup = eleveLinkGroups.find(g => g.includes(eleve.id));
    const linkedNames = linkGroup
      ? linkGroup.filter(id => id !== eleve.id).map(id => {
          const e = allEleves.find(el => el.id === id);
          return e ? `${e.prenom} ${e.nom}` : '?';
        })
      : [];

    return (
      <div ref={menuRef} className="libre-context-menu" style={{ left: menu.x, top: menu.y }}>
        <div className="ctx-header">
          <Info size={12} />
          {eleve.prenom} {eleve.nom}
        </div>
        <div className="ctx-info">
          <div><strong>Classe :</strong> {eleve.classe}</div>
          {eleve.sexe && <div><strong>Sexe :</strong> {eleve.sexe === 'M' ? 'Masculin' : 'Feminin'}</div>}
          {eleve.options.length > 0 && <div><strong>Options :</strong> {eleve.options.join(', ')}</div>}
          {eleve.parcoursOral && <div><strong>Parcours oral :</strong> {eleve.parcoursOral}</div>}
          {eleve.sujetOral && <div><strong>Sujet oral :</strong> {eleve.sujetOral}</div>}
          {eleve.matieresOral && eleve.matieresOral.length > 0 && (
            <div><strong>Matieres oral :</strong> {eleve.matieresOral.join(', ')}</div>
          )}
          {eleve.regime && <div><strong>Regime :</strong> {eleve.regime}</div>}
          {eleve.tags.length > 0 && <div><strong>Tags :</strong> {eleve.tags.join(', ')}</div>}
        </div>
        <div className="ctx-separator" />
        {linkedNames.length > 0 && (
          <div className="ctx-linked">
            <Link2 size={11} />
            Lie avec : {linkedNames.join(', ')}
          </div>
        )}
        <button className="ctx-action" onClick={() => { onStartLink(eleve.id); onClose(); }}>
          <Link2 size={12} />
          {linkMode ? 'Lier avec cet eleve' : 'Lier avec un autre eleve...'}
        </button>
        {linkGroup && (
          <button className="ctx-action danger" onClick={() => { onUnlink(eleve.id); onClose(); }}>
            <Unlink size={12} />
            Delier cet eleve
          </button>
        )}
      </div>
    );
  }

  // Enseignant context menu — info only
  const ens = allEnseignants.find(e => e.id === menu.id);
  if (!ens) return null;

  return (
    <div ref={menuRef} className="libre-context-menu" style={{ left: menu.x, top: menu.y }}>
      <div className="ctx-header">
        <Info size={12} />
        {ens.prenom} {ens.nom}
      </div>
      <div className="ctx-info">
        <div><strong>Matiere :</strong> {ens.matierePrincipale}</div>
        {ens.matiereSecondaire && ens.matiereSecondaire.length > 0 && (
          <div><strong>Secondaires :</strong> {ens.matiereSecondaire.join(', ')}</div>
        )}
        <div><strong>Classes :</strong> {ens.classesEnCharge.join(', ') || 'Aucune'}</div>
        {ens.estProfPrincipal && <div><strong>PP :</strong> {ens.classePP || 'Oui'}</div>}
        {ens.tags.length > 0 && <div><strong>Tags :</strong> {ens.tags.join(', ')}</div>}
      </div>
    </div>
  );
};

// ============================================================
// DRAGGABLE POOL ITEMS
// ============================================================

const DraggablePoolEleve: React.FC<{
  eleve: Eleve;
  isLinked: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}> = ({ eleve, isLinked, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-eleve:${eleve.id}`,
    data: { type: 'eleve', id: eleve.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`libre-pool-item eleve ${isDragging ? 'dragging' : ''} ${isLinked ? 'linked' : ''}`}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, eleve.id); }}
      {...listeners}
      {...attributes}
    >
      <span className="item-initial">{eleve.prenom[0]}{eleve.nom[0]}</span>
      <span className="item-name">{eleve.prenom} {eleve.nom}</span>
      {isLinked && <Link2 size={10} className="link-icon" />}
      <span className="item-detail">{eleve.classe}</span>
    </div>
  );
};

const DraggablePoolEnseignant: React.FC<{
  enseignant: Enseignant;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}> = ({ enseignant, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-ens:${enseignant.id}`,
    data: { type: 'enseignant', id: enseignant.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`libre-pool-item enseignant ${isDragging ? 'dragging' : ''}`}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, enseignant.id); }}
      {...listeners}
      {...attributes}
    >
      <span className="item-initial">{enseignant.prenom[0]}{enseignant.nom[0]}</span>
      <span className="item-name">{enseignant.prenom} {enseignant.nom}</span>
      <span className="item-detail">{enseignant.matierePrincipale}</span>
    </div>
  );
};

// ============================================================
// DRAGGABLE CHIP (inside group cards)
// ============================================================

const DraggableGroupEleve: React.FC<{
  eleve: Eleve;
  groupeId: string;
  isLinked: boolean;
  onRemove: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}> = ({ eleve, groupeId, isLinked, onRemove, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grp-eleve:${groupeId}:${eleve.id}`,
    data: { type: 'eleve', id: eleve.id, fromGroupe: groupeId },
  });

  return (
    <span
      ref={setNodeRef}
      className={`libre-group-eleve-chip ${isDragging ? 'dragging' : ''} ${isLinked ? 'linked' : ''}`}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, eleve.id); }}
      {...listeners}
      {...attributes}
    >
      {eleve.prenom} {eleve.nom.charAt(0)}.
      <span className="item-detail">{eleve.classe}</span>
      {isLinked && <Link2 size={8} className="link-icon" />}
      <span className="remove-eleve" onPointerDown={e => e.stopPropagation()} onClick={onRemove}>
        <X size={9} />
      </span>
    </span>
  );
};

const DraggableGroupEns: React.FC<{
  ens: Enseignant;
  groupeId: string;
  isSuppleant?: boolean;
  onRemove: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}> = ({ ens, groupeId, isSuppleant, onRemove, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grp-ens:${groupeId}:${ens.id}${isSuppleant ? ':sup' : ''}`,
    data: { type: 'enseignant', id: ens.id, fromGroupe: groupeId, isSuppleant },
  });

  return (
    <span
      ref={setNodeRef}
      className={`libre-group-ens-chip ${isSuppleant ? 'suppleant' : ''} ${isDragging ? 'dragging' : ''}`}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, ens.id); }}
      {...listeners}
      {...attributes}
    >
      {isSuppleant && <ShieldCheck size={10} className="sup-icon" />}
      {ens.prenom} {ens.nom.charAt(0)}.
      <span className="remove-ens" onPointerDown={e => e.stopPropagation()} onClick={onRemove}>
        <X size={10} />
      </span>
    </span>
  );
};

// ============================================================
// DROPPABLE GROUP CARD
// ============================================================

interface GroupCardProps {
  groupe: LibreGroupe;
  eleves: Eleve[];
  enseignants: Enseignant[];
  tailleJuryDefaut: number;
  nbReservesDefaut: number;
  eleveLinkGroups: string[][];
  isDraggingEnseignant: boolean;
  /** Classe de l'élève en cours de drag (null si pas un élève) */
  draggedEleveClasse: string | null;
  onUpdate: (id: string, patch: Partial<Pick<LibreGroupe, 'nom' | 'salle' | 'tailleJuryOverride' | 'nbReservesOverride'>>) => void;
  onRemove: (id: string) => void;
  onRemoveEleve: (eleveId: string, groupeId: string) => void;
  onRemoveEnseignant: (enseignantId: string, groupeId: string) => void;
  onRemoveSuppleant: (enseignantId: string, groupeId: string) => void;
  onEleveContextMenu: (e: React.MouseEvent, id: string) => void;
  onEnsContextMenu: (e: React.MouseEvent, id: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  groupe,
  eleves,
  enseignants,
  tailleJuryDefaut,
  nbReservesDefaut,
  eleveLinkGroups,
  isDraggingEnseignant,
  draggedEleveClasse,
  onUpdate,
  onRemove,
  onRemoveEleve,
  onRemoveEnseignant,
  onRemoveSuppleant,
  onEleveContextMenu,
  onEnsContextMenu,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `groupe:${groupe.id}` });
  const [showSallePicker, setShowSallePicker] = useState(false);

  const groupeEleves = useMemo(
    () => groupe.eleveIds.map(id => eleves.find(e => e.id === id)).filter(Boolean) as Eleve[],
    [groupe.eleveIds, eleves]
  );

  const groupeEnseignants = useMemo(
    () => groupe.enseignantIds.map(id => enseignants.find(e => e.id === id)).filter(Boolean) as Enseignant[],
    [groupe.enseignantIds, enseignants]
  );

  const groupeSuppleants = useMemo(
    () => groupe.suppleantsIds.map(id => enseignants.find(e => e.id === id)).filter(Boolean) as Enseignant[],
    [groupe.suppleantsIds, enseignants]
  );

  const tailleJury = groupe.tailleJuryOverride ?? tailleJuryDefaut;
  const nbReserves = groupe.nbReservesOverride ?? nbReservesDefaut;
  const hasEleves = groupeEleves.length > 0;

  const linkedEleveIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of eleveLinkGroups) {
      if (g.length >= 2) for (const id of g) set.add(id);
    }
    return set;
  }, [eleveLinkGroups]);

  const sallesByCategory = useMemo(() => {
    const map = new Map<string, typeof SALLES_DISPONIBLES>();
    for (const cat of CATEGORIES_SALLES) {
      map.set(cat, SALLES_DISPONIBLES.filter(s => s.categorie === cat));
    }
    return map;
  }, []);

  // Highlight: enseignant in this group has the dragged élève in their class
  const hasMatchingEns = useMemo(() => {
    if (!draggedEleveClasse) return false;
    const allGroupEns = [...groupeEnseignants, ...groupeSuppleants];
    return allGroupEns.some(ens => ens.classesEnCharge.includes(draggedEleveClasse));
  }, [draggedEleveClasse, groupeEnseignants, groupeSuppleants]);

  // Determine if drop would go to reserve
  const titulaireFull = groupeEnseignants.length >= tailleJury;
  const reserveAvailable = nbReserves > 0 && groupeSuppleants.length < nbReserves;
  const willDropToReserve = isOver && isDraggingEnseignant && titulaireFull && reserveAvailable;
  const dropBlocked = isOver && isDraggingEnseignant && titulaireFull && !reserveAvailable;

  return (
    <div
      ref={setNodeRef}
      className={`libre-group-card ${hasEleves ? 'has-eleves' : ''} ${isOver ? 'dropping' : ''} ${willDropToReserve ? 'dropping-reserve' : ''} ${dropBlocked ? 'dropping-blocked' : ''} ${hasMatchingEns ? 'ens-match' : ''}`}
    >
      {/* Drop indicator */}
      {willDropToReserve && (
        <div className="libre-drop-indicator reserve">
          <ShieldCheck size={12} /> Ajout en reserve
        </div>
      )}
      {dropBlocked && (
        <div className="libre-drop-indicator blocked">
          Groupe complet
        </div>
      )}
      {/* Header */}
      <div className="libre-group-header">
        <div className="libre-group-header-top">
          <div className="libre-group-name-row">
            <Users size={14} />
            <input
              className="libre-group-name"
              value={groupe.nom}
              onChange={e => onUpdate(groupe.id, { nom: e.target.value })}
              onBlur={e => { if (!e.target.value.trim()) onUpdate(groupe.id, { nom: 'Groupe' }); }}
            />
            {groupe.salle && (
              <span className="libre-group-salle-badge">Salle {groupe.salle}</span>
            )}
          </div>
          <div className="libre-group-actions">
            <div style={{ position: 'relative' }}>
              <button title="Salle" onClick={() => setShowSallePicker(!showSallePicker)}>
                <DoorOpen size={14} />
              </button>
              {showSallePicker && (
                <div className="libre-salle-picker">
                  <button
                    className={`salle-option ${!groupe.salle ? 'selected' : ''}`}
                    onClick={() => { onUpdate(groupe.id, { salle: null }); setShowSallePicker(false); }}
                  >
                    Aucune
                  </button>
                  {[...sallesByCategory.entries()].map(([cat, salles]) => (
                    <React.Fragment key={cat}>
                      <div className="salle-category">{cat}</div>
                      {salles.map(s => (
                        <button
                          key={s.numero}
                          className={`salle-option ${groupe.salle === s.numero ? 'selected' : ''}`}
                          onClick={() => { onUpdate(groupe.id, { salle: s.numero }); setShowSallePicker(false); }}
                        >
                          Salle {s.numero}
                        </button>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
            <button title={`Taille jury : ${tailleJury}`} onClick={() => {
              const next = tailleJury >= 4 ? 1 : tailleJury + 1;
              onUpdate(groupe.id, { tailleJuryOverride: next });
            }}>
              <Settings2 size={14} />
            </button>
            <button className="delete" title="Supprimer" onClick={() => onRemove(groupe.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="libre-group-meta">
          <span className="libre-group-count-badge">
            {groupeEleves.length} eleve{groupeEleves.length !== 1 ? 's' : ''}
          </span>
          <span className="libre-group-count-badge">
            {groupeEnseignants.length}/{tailleJury} ens.
          </span>
          {nbReserves > 0 && (
            <span className="libre-group-count-badge reserve">
              {groupeSuppleants.length}/{nbReserves} res.
            </span>
          )}
        </div>

        {/* Enseignants titulaires */}
        {groupeEnseignants.length > 0 ? (
          <div className="libre-group-enseignants">
            {groupeEnseignants.map(ens => (
              <DraggableGroupEns
                key={ens.id}
                ens={ens}
                groupeId={groupe.id}
                onRemove={() => onRemoveEnseignant(ens.id, groupe.id)}
                onContextMenu={onEnsContextMenu}
              />
            ))}
          </div>
        ) : (
          <div className="libre-group-ens-placeholder">Deposer des enseignants ici</div>
        )}

        {/* Suppléants */}
        {nbReserves > 0 && (
          <div className="libre-group-suppleants">
            <span className="suppleants-label"><ShieldCheck size={10} /> Reserve</span>
            {groupeSuppleants.length > 0 ? (
              groupeSuppleants.map(ens => (
                <DraggableGroupEns
                  key={ens.id}
                  ens={ens}
                  groupeId={groupe.id}
                  isSuppleant
                  onRemove={() => onRemoveSuppleant(ens.id, groupe.id)}
                  onContextMenu={onEnsContextMenu}
                />
              ))
            ) : (
              <span className="suppleants-empty">Aucun</span>
            )}
          </div>
        )}
      </div>

      {/* Élèves body */}
      <div className="libre-group-eleves">
        {groupeEleves.length > 0 ? (
          groupeEleves.map(eleve => (
            <DraggableGroupEleve
              key={eleve.id}
              eleve={eleve}
              groupeId={groupe.id}
              isLinked={linkedEleveIds.has(eleve.id)}
              onRemove={() => onRemoveEleve(eleve.id, groupe.id)}
              onContextMenu={onEleveContextMenu}
            />
          ))
        ) : (
          <div className="libre-group-drop-zone">Deposer des eleves ici</div>
        )}
      </div>

      {/* Progress bar */}
      <div className="libre-group-progress">
        <div
          className="libre-group-progress-fill"
          style={{ width: `${Math.min(100, groupeEleves.length * 5)}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================
// MAIN PAGE
// ============================================================

export const LibreModePage: React.FC = () => {
  const navigate = useNavigate();
  const allEleves = useEleveStore(state => state.eleves);
  const allEnseignants = useEnseignantStore(state => state.enseignants);

  const {
    groupes,
    config,
    eleveLinkGroups,
    assignedEleveIds,
    assignedEnseignantIds,
    setTailleJuryDefaut,
    setNbReservesDefaut,
    setShowDistance,
    addGroupe,
    removeGroupe,
    updateGroupe,
    addEleveToGroupe,
    removeEleveFromGroupe,
    addEnseignantToGroupe,
    removeEnseignantFromGroupe,
    addSuppleantToGroupe: addSuppleant,
    removeSuppleantFromGroupe,
    linkEleves,
    unlinkEleve,
    exportJSON,
    importJSON,
    resetAll,
  } = useLibreMode();

  // Filters
  const [eleveSearch, setEleveSearch] = useState('');
  const [eleveNiveau, setEleveNiveau] = useState('');
  const [eleveClasse, setEleveClasse] = useState('');
  const [ensSearch, setEnsSearch] = useState('');
  const [ensMatiere, setEnsMatiere] = useState('');
  const [ensNiveauEnseigne, setEnsNiveauEnseigne] = useState('');
  const [ensPPOnly, setEnsPPOnly] = useState(false);

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Compute the classe of the currently dragged élève (for group highlight)
  const draggedEleveClasse = useMemo(() => {
    if (!activeId) return null;
    const match = activeId.match(/(?:pool-eleve|grp-eleve:[^:]+):(.+)/);
    if (!match) return null;
    const eleve = allEleves.find(e => e.id === match[1]);
    return eleve?.classe ?? null;
  }, [activeId, allEleves]);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Link mode: when set, next right-click on an élève will link them
  const [linkMode, setLinkMode] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract unique values for filters
  const niveaux = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEleves) {
      const n = extractNiveau(e.classe);
      if (n) set.add(n);
    }
    return [...set].sort();
  }, [allEleves]);

  const classes = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEleves) set.add(e.classe);
    return [...set].sort();
  }, [allEleves]);

  const matieres = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEnseignants) {
      if (e.matierePrincipale) set.add(e.matierePrincipale);
    }
    return [...set].sort();
  }, [allEnseignants]);

  // Niveaux enseignés (extracted from classesEnCharge)
  const niveauxEnseignes = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEnseignants) {
      for (const c of e.classesEnCharge) {
        const n = extractNiveau(c);
        if (n) set.add(n);
      }
    }
    return [...set].sort();
  }, [allEnseignants]);

  // Linked eleve IDs set (for visual indicator)
  const linkedEleveIdsSet = useMemo(() => {
    const set = new Set<string>();
    for (const g of eleveLinkGroups) {
      if (g.length >= 2) for (const id of g) set.add(id);
    }
    return set;
  }, [eleveLinkGroups]);

  // Filtered pools
  const filteredEleves = useMemo(() => {
    return allEleves.filter(e => {
      if (assignedEleveIds.has(e.id)) return false;
      if (eleveSearch) {
        const s = eleveSearch.toLowerCase();
        if (!`${e.prenom} ${e.nom}`.toLowerCase().includes(s) && !e.classe.toLowerCase().includes(s)) return false;
      }
      if (eleveNiveau) {
        if (extractNiveau(e.classe) !== eleveNiveau) return false;
      }
      if (eleveClasse && e.classe !== eleveClasse) return false;
      return true;
    });
  }, [allEleves, assignedEleveIds, eleveSearch, eleveNiveau, eleveClasse]);

  const filteredEnseignants = useMemo(() => {
    return allEnseignants.filter(e => {
      if (assignedEnseignantIds.has(e.id)) return false;
      if (ensSearch) {
        const s = ensSearch.toLowerCase();
        if (!`${e.prenom} ${e.nom}`.toLowerCase().includes(s) && !e.matierePrincipale.toLowerCase().includes(s)) return false;
      }
      if (ensMatiere && e.matierePrincipale !== ensMatiere) return false;
      if (ensNiveauEnseigne) {
        const hasNiveau = e.classesEnCharge.some(c => extractNiveau(c) === ensNiveauEnseigne);
        if (!hasNiveau) return false;
      }
      if (ensPPOnly && !e.estProfPrincipal) return false;
      return true;
    });
  }, [allEnseignants, assignedEnseignantIds, ensSearch, ensMatiere, ensNiveauEnseigne, ensPPOnly]);

  // Context menu handlers
  const handleEleveContextMenu = useCallback((e: React.MouseEvent, eleveId: string) => {
    // If in link mode, link the two élèves
    if (linkMode && linkMode !== eleveId) {
      linkEleves(linkMode, eleveId);
      setLinkMode(null);
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'eleve', id: eleveId });
  }, [linkMode, linkEleves]);

  const handleEnsContextMenu = useCallback((e: React.MouseEvent, ensId: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'enseignant', id: ensId });
  }, []);

  const handleStartLink = useCallback((eleveId: string) => {
    setLinkMode(eleveId);
  }, []);

  const handleUnlink = useCallback((eleveId: string) => {
    unlinkEleve(eleveId);
  }, [unlinkEleve]);

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    if (!overId.startsWith('groupe:')) return;
    const groupeId = overId.replace('groupe:', '');

    const activeData = active.data.current;
    if (!activeData) return;

    if (activeData.type === 'eleve') {
      addEleveToGroupe(activeData.id, groupeId);
    } else if (activeData.type === 'enseignant') {
      // Try titulaire first, if full try suppléant
      const groupe = groupes.find(g => g.id === groupeId);
      if (groupe) {
        const maxTitulaires = groupe.tailleJuryOverride ?? config.tailleJuryDefaut;
        if (groupe.enseignantIds.length >= maxTitulaires) {
          addSuppleant(activeData.id, groupeId);
        } else {
          addEnseignantToGroupe(activeData.id, groupeId);
        }
      }
    }
  }, [addEleveToGroupe, addEnseignantToGroupe, addSuppleant, groupes, config.tailleJuryDefaut]);

  // Export PDF
  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const data = exportJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groupit-libre-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJSON]);

  // Import JSON
  const handleImportJSON = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        importJSON(data);
      } catch {
        alert('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importJSON]);

  // Drag overlay content
  const dragOverlayContent = useMemo(() => {
    if (!activeId) return null;
    const eleveMatch = activeId.match(/(?:pool-eleve|grp-eleve:[^:]+):(.+)/);
    if (eleveMatch) {
      const eleve = allEleves.find(e => e.id === eleveMatch[1]);
      if (!eleve) return null;
      return (
        <div className="libre-pool-item eleve" style={{ background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px' }}>
          <span className="item-initial">{eleve.prenom[0]}{eleve.nom[0]}</span>
          <span className="item-name">{eleve.prenom} {eleve.nom}</span>
        </div>
      );
    }
    const ensMatch = activeId.match(/(?:pool-ens|grp-ens:[^:]+):(.+?)(?::sup)?$/);
    if (ensMatch) {
      const ens = allEnseignants.find(e => e.id === ensMatch[1]);
      if (!ens) return null;
      return (
        <div className="libre-pool-item enseignant" style={{ background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px' }}>
          <span className="item-initial">{ens.prenom[0]}{ens.nom[0]}</span>
          <span className="item-name">{ens.prenom} {ens.nom}</span>
        </div>
      );
    }
    return null;
  }, [activeId, allEleves, allEnseignants]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="libre-page">
        {/* Link mode banner */}
        {linkMode && (
          <div className="libre-link-banner">
            <Link2 size={14} />
            Cliquez-droit sur un autre eleve pour le lier, ou
            <button onClick={() => setLinkMode(null)}>Annuler</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="libre-toolbar">
          <button className="libre-btn" onClick={() => navigate('/')} title="Retour accueil">
            <Home size={14} />
          </button>
          <h1>Mode Libre</h1>
          <div className="libre-toolbar-sep" />

          <div className="libre-toolbar-group">
            <label>Jury :</label>
            <select
              value={config.tailleJuryDefaut}
              onChange={e => setTailleJuryDefaut(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="libre-toolbar-group">
            <label>Reserve :</label>
            <select
              value={config.nbReservesDefaut}
              onChange={e => setNbReservesDefaut(Number(e.target.value))}
            >
              {[0, 1, 2, 3].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="libre-toolbar-group">
            <label className="toggle-distance">
              <input
                type="checkbox"
                checked={config.showDistance}
                onChange={e => setShowDistance(e.target.checked)}
              />
              <MapPin size={12} />
              Distance
            </label>
          </div>

          <div className="libre-toolbar-sep" />

          <button className="libre-btn primary" onClick={() => addGroupe()}>
            <Plus size={14} />
            Groupe
          </button>

          <div className="libre-toolbar-actions">
            <button className="libre-btn" onClick={handleExportPdf} title="Export PDF">
              <FileText size={14} />
              PDF
            </button>
            <button className="libre-btn" onClick={handleExportJSON} title="Export JSON">
              <Download size={14} />
              JSON
            </button>
            <button className="libre-btn" onClick={handleImportJSON} title="Import JSON">
              <Upload size={14} />
              Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
            <div className="libre-toolbar-sep" />
            <button className="libre-btn danger" onClick={resetAll} title="Tout reinitialiser">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="libre-content">
          {/* Left pool: élèves */}
          <div className="libre-pool">
            <div className="libre-pool-header">
              <h3>
                <Users size={14} />
                Eleves
                <span className="pool-count">({filteredEleves.length}/{allEleves.length})</span>
              </h3>
              <div className="libre-pool-filters">
                <select value={eleveNiveau} onChange={e => { setEleveNiveau(e.target.value); setEleveClasse(''); }}>
                  <option value="">Tous niveaux</option>
                  {niveaux.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select value={eleveClasse} onChange={e => setEleveClasse(e.target.value)}>
                  <option value="">Toutes classes</option>
                  {classes
                    .filter(c => !eleveNiveau || extractNiveau(c) === eleveNiveau)
                    .map(c => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>
              <input
                className="libre-pool-search"
                placeholder="Rechercher..."
                value={eleveSearch}
                onChange={e => setEleveSearch(e.target.value)}
              />
            </div>
            <div className="libre-pool-list">
              {filteredEleves.length > 0 ? (
                filteredEleves.map(e => (
                  <DraggablePoolEleve
                    key={e.id}
                    eleve={e}
                    isLinked={linkedEleveIdsSet.has(e.id)}
                    onContextMenu={handleEleveContextMenu}
                  />
                ))
              ) : (
                <div className="libre-pool-empty">
                  {assignedEleveIds.size === allEleves.length ? 'Tous les eleves sont assignes' : 'Aucun resultat'}
                </div>
              )}
            </div>
          </div>

          {/* Center: groups */}
          <div className="libre-groups">
            <div className="libre-groups-grid">
              {groupes.map(g => (
                <GroupCard
                  key={g.id}
                  groupe={g}
                  eleves={allEleves}
                  enseignants={allEnseignants}
                  tailleJuryDefaut={config.tailleJuryDefaut}
                  nbReservesDefaut={config.nbReservesDefaut}
                  eleveLinkGroups={eleveLinkGroups}
                  isDraggingEnseignant={!!activeId && (activeId.startsWith('pool-ens:') || activeId.startsWith('grp-ens:'))}
                  draggedEleveClasse={draggedEleveClasse}
                  onUpdate={updateGroupe}
                  onRemove={removeGroupe}
                  onRemoveEleve={removeEleveFromGroupe}
                  onRemoveEnseignant={removeEnseignantFromGroupe}
                  onRemoveSuppleant={removeSuppleantFromGroupe}
                  onEleveContextMenu={handleEleveContextMenu}
                  onEnsContextMenu={handleEnsContextMenu}
                />
              ))}
              <div className="libre-add-group" onClick={() => addGroupe()}>
                <Plus size={20} />
                Ajouter un groupe
              </div>
            </div>
          </div>

          {/* Right pool: enseignants */}
          <div className="libre-pool right">
            <div className="libre-pool-header">
              <h3>
                <GraduationCap size={14} />
                Enseignants
                <span className="pool-count">({filteredEnseignants.length}/{allEnseignants.length})</span>
              </h3>
              <div className="libre-pool-filters">
                <select value={ensMatiere} onChange={e => setEnsMatiere(e.target.value)}>
                  <option value="">Toutes matieres</option>
                  {matieres.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={ensNiveauEnseigne} onChange={e => setEnsNiveauEnseigne(e.target.value)}>
                  <option value="">Tous niveaux</option>
                  {niveauxEnseignes.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="libre-pool-filters">
                <label className="libre-pool-toggle">
                  <input type="checkbox" checked={ensPPOnly} onChange={e => setEnsPPOnly(e.target.checked)} />
                  PP uniquement
                </label>
              </div>
              <input
                className="libre-pool-search"
                placeholder="Rechercher..."
                value={ensSearch}
                onChange={e => setEnsSearch(e.target.value)}
              />
            </div>
            <div className="libre-pool-list">
              {filteredEnseignants.length > 0 ? (
                filteredEnseignants.map(e => (
                  <DraggablePoolEnseignant
                    key={e.id}
                    enseignant={e}
                    onContextMenu={handleEnsContextMenu}
                  />
                ))
              ) : (
                <div className="libre-pool-empty">
                  {assignedEnseignantIds.size === allEnseignants.length ? 'Tous les enseignants sont assignes' : 'Aucun resultat'}
                </div>
              )}
            </div>
          </div>
        </div>

        <DragOverlay>{dragOverlayContent}</DragOverlay>

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            menu={contextMenu}
            allEleves={allEleves}
            allEnseignants={allEnseignants}
            eleveLinkGroups={eleveLinkGroups}
            linkMode={linkMode}
            onClose={() => setContextMenu(null)}
            onStartLink={handleStartLink}
            onUnlink={handleUnlink}
          />
        )}
      </div>
    </DndContext>
  );
};
