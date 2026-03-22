import React, { useState, useMemo, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useLibreMode, type LibreGroupe } from '../hooks/useLibreMode';
import { SALLES_DISPONIBLES, CATEGORIES_SALLES } from '../domain/sallesConfig';
import type { Eleve, Enseignant } from '../domain/models';
import './LibreModePage.css';

// ============================================================
// DRAGGABLE POOL ITEMS
// ============================================================

const DraggablePoolEleve: React.FC<{ eleve: Eleve }> = ({ eleve }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-eleve:${eleve.id}`,
    data: { type: 'eleve', id: eleve.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`libre-pool-item eleve ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <span className="item-initial">{eleve.prenom[0]}{eleve.nom[0]}</span>
      <span className="item-name">{eleve.prenom} {eleve.nom}</span>
      <span className="item-detail">{eleve.classe}</span>
    </div>
  );
};

const DraggablePoolEnseignant: React.FC<{ enseignant: Enseignant }> = ({ enseignant }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-ens:${enseignant.id}`,
    data: { type: 'enseignant', id: enseignant.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`libre-pool-item enseignant ${isDragging ? 'dragging' : ''}`}
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
// DROPPABLE GROUP CARD
// ============================================================

interface GroupCardProps {
  groupe: LibreGroupe;
  eleves: Eleve[];
  enseignants: Enseignant[];
  tailleJuryDefaut: number;
  onUpdate: (id: string, patch: Partial<Pick<LibreGroupe, 'nom' | 'salle' | 'tailleJuryOverride'>>) => void;
  onRemove: (id: string) => void;
  onRemoveEleve: (eleveId: string, groupeId: string) => void;
  onRemoveEnseignant: (enseignantId: string, groupeId: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  groupe,
  eleves,
  enseignants,
  tailleJuryDefaut,
  onUpdate,
  onRemove,
  onRemoveEleve,
  onRemoveEnseignant,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `groupe:${groupe.id}` });
  const [showSallePicker, setShowSallePicker] = useState(false);
  const salleRef = useRef<HTMLDivElement>(null);

  const groupeEleves = useMemo(
    () => groupe.eleveIds.map(id => eleves.find(e => e.id === id)).filter(Boolean) as Eleve[],
    [groupe.eleveIds, eleves]
  );

  const groupeEnseignants = useMemo(
    () => groupe.enseignantIds.map(id => enseignants.find(e => e.id === id)).filter(Boolean) as Enseignant[],
    [groupe.enseignantIds, enseignants]
  );

  const tailleJury = groupe.tailleJuryOverride ?? tailleJuryDefaut;
  const hasEleves = groupeEleves.length > 0;

  const sallesByCategory = useMemo(() => {
    const map = new Map<string, typeof SALLES_DISPONIBLES>();
    for (const cat of CATEGORIES_SALLES) {
      map.set(cat, SALLES_DISPONIBLES.filter(s => s.categorie === cat));
    }
    return map;
  }, []);

  return (
    <div
      ref={setNodeRef}
      className={`libre-group-card ${hasEleves ? 'has-eleves' : ''} ${isOver ? 'dropping' : ''}`}
    >
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
            <div style={{ position: 'relative' }} ref={salleRef}>
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
            <button title="Taille jury" onClick={() => {
              const current = groupe.tailleJuryOverride ?? tailleJuryDefaut;
              const next = current >= 4 ? 1 : current + 1;
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
        </div>

        {/* Enseignants */}
        {groupeEnseignants.length > 0 ? (
          <div className="libre-group-enseignants">
            {groupeEnseignants.map(ens => (
              <span key={ens.id} className="libre-group-ens-chip">
                {ens.prenom} {ens.nom.charAt(0)}.
                <span className="remove-ens" onClick={() => onRemoveEnseignant(ens.id, groupe.id)}>
                  <X size={10} />
                </span>
              </span>
            ))}
          </div>
        ) : (
          <div className="libre-group-ens-placeholder">Deposer des enseignants ici</div>
        )}
      </div>

      {/* Élèves body */}
      <div className="libre-group-eleves">
        {groupeEleves.length > 0 ? (
          groupeEleves.map(eleve => (
            <span key={eleve.id} className="libre-group-eleve-chip">
              {eleve.prenom} {eleve.nom.charAt(0)}.
              <span className="item-detail">{eleve.classe}</span>
              <span className="remove-eleve" onClick={() => onRemoveEleve(eleve.id, groupe.id)}>
                <X size={9} />
              </span>
            </span>
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
    assignedEleveIds,
    assignedEnseignantIds,
    setTailleJuryDefaut,
    setShowDistance,
    addGroupe,
    removeGroupe,
    updateGroupe,
    addEleveToGroupe,
    removeEleveFromGroupe,
    addEnseignantToGroupe,
    removeEnseignantFromGroupe,
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

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract unique values for filters
  const niveaux = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEleves) {
      const niveau = e.classe.replace(/[^0-9eè]/g, '').replace(/[eè].*/, 'e');
      if (niveau) set.add(niveau);
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

  // Filtered pools
  const filteredEleves = useMemo(() => {
    return allEleves.filter(e => {
      if (assignedEleveIds.has(e.id)) return false;
      if (eleveSearch) {
        const s = eleveSearch.toLowerCase();
        if (!`${e.prenom} ${e.nom}`.toLowerCase().includes(s) && !e.classe.toLowerCase().includes(s)) return false;
      }
      if (eleveNiveau) {
        const niveau = e.classe.replace(/[^0-9eè]/g, '').replace(/[eè].*/, 'e');
        if (niveau !== eleveNiveau) return false;
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
      return true;
    });
  }, [allEnseignants, assignedEnseignantIds, ensSearch, ensMatiere]);

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
      addEnseignantToGroupe(activeData.id, groupeId);
    }
  }, [addEleveToGroupe, addEnseignantToGroupe]);

  // Export PDF (simple print for now)
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
    if (activeId.startsWith('pool-eleve:')) {
      const id = activeId.replace('pool-eleve:', '');
      const eleve = allEleves.find(e => e.id === id);
      if (!eleve) return null;
      return (
        <div className="libre-pool-item eleve" style={{ background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px' }}>
          <span className="item-initial">{eleve.prenom[0]}{eleve.nom[0]}</span>
          <span className="item-name">{eleve.prenom} {eleve.nom}</span>
        </div>
      );
    }
    if (activeId.startsWith('pool-ens:')) {
      const id = activeId.replace('pool-ens:', '');
      const ens = allEnseignants.find(e => e.id === id);
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
        {/* Toolbar */}
        <div className="libre-toolbar">
          <button className="libre-btn" onClick={() => navigate('/')} title="Retour accueil">
            <Home size={14} />
          </button>
          <h1>Mode Libre</h1>
          <div className="libre-toolbar-sep" />

          <div className="libre-toolbar-group">
            <label>Jury par defaut :</label>
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
                    .filter(c => !eleveNiveau || c.replace(/[^0-9eè]/g, '').replace(/[eè].*/, 'e') === eleveNiveau)
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
                filteredEleves.map(e => <DraggablePoolEleve key={e.id} eleve={e} />)
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
                  onUpdate={updateGroupe}
                  onRemove={removeGroupe}
                  onRemoveEleve={removeEleveFromGroupe}
                  onRemoveEnseignant={removeEnseignantFromGroupe}
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
                filteredEnseignants.map(e => <DraggablePoolEnseignant key={e.id} enseignant={e} />)
              ) : (
                <div className="libre-pool-empty">
                  {assignedEnseignantIds.size === allEnseignants.length ? 'Tous les enseignants sont assignes' : 'Aucun resultat'}
                </div>
              )}
            </div>
          </div>
        </div>

        <DragOverlay>{dragOverlayContent}</DragOverlay>
      </div>
    </DndContext>
  );
};
