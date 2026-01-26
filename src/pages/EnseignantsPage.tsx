// ============================================================
// ENSEIGNANTS PAGE - Refonte complète
// Cards avec drawer profil et historique
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useUIStore } from '../stores/uiStore';
import {
  Search,
  Plus,
  Filter,
  X,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Users,
  Award,
  ChevronDown
} from 'lucide-react';
import { EnseignantProfileDrawer } from '../components/enseignant/EnseignantProfileDrawer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useConfirmDelete } from '../hooks/useConfirm';
import type { Enseignant } from '../domain/models';
import './EnseignantsPage.css';

// ============================================================
// CONTEXT MENU COMPONENT
// ============================================================

interface ContextMenuProps {
  enseignant: Enseignant;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

function ContextMenu({ onEdit, onDelete, onDuplicate, onClose }: ContextMenuProps) {
  return (
    <div className="context-menu" onClick={e => e.stopPropagation()}>
      <button className="context-item" onClick={() => { onEdit(); onClose(); }}>
        <Edit2 size={14} />
        Modifier
      </button>
      <button className="context-item" onClick={() => { onDuplicate(); onClose(); }}>
        <Copy size={14} />
        Dupliquer
      </button>
      <div className="context-divider" />
      <button className="context-item danger" onClick={() => { onDelete(); onClose(); }}>
        <Trash2 size={14} />
        Supprimer
      </button>
    </div>
  );
}

// ============================================================
// ENSEIGNANT CARD COMPONENT
// ============================================================

interface EnseignantCardProps {
  enseignant: Enseignant;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function EnseignantCard({ enseignant, onClick, onEdit, onDelete, onDuplicate }: EnseignantCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // Close menu on outside click
  useEffect(() => {
    if (showMenu) {
      const handleClick = () => setShowMenu(false);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  return (
    <div className="enseignant-mini-card" onClick={onClick}>
      {/* Menu button */}
      <div className="mini-card-menu" onClick={handleMenuClick}>
        <MoreVertical size={14} />
      </div>
      {showMenu && (
        <ContextMenu
          enseignant={enseignant}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onClose={() => setShowMenu(false)}
        />
      )}

      {/* Avatar centré */}
      <div className="mini-avatar">
        {enseignant.prenom?.[0]}{enseignant.nom[0]}
      </div>

      {/* Nom */}
      <div className="mini-name">
        <span className="prenom">{enseignant.prenom}</span>
        <span className="nom">{enseignant.nom.toUpperCase()}</span>
      </div>

      {/* Séparateur */}
      <div className="mini-divider" />

      {/* Badge PP - positionné en haut gauche */}
      {enseignant.estProfPrincipal && (
        <span className="mini-pp-badge">
          <Award size={10} />
          PP {enseignant.classePP}
        </span>
      )}

      {/* Matière */}
      {enseignant.matierePrincipale && (
        <span className="mini-matiere">{enseignant.matierePrincipale}</span>
      )}

      {/* Hover overlay */}
      <div className="mini-hover-overlay">
        <span>Voir profil</span>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export const EnseignantsPage: React.FC = () => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMatiere, setFilterMatiere] = useState('');
  const [filterPP, setFilterPP] = useState<boolean | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEnseignantId, setSelectedEnseignantId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Confirm modal
  const { confirmState, confirmDelete, handleConfirm, handleCancel } = useConfirmDelete();

  // Stores
  const enseignants = useEnseignantStore(s => s.enseignants);
  const loading = useEnseignantStore(s => s.loading);
  const loadEnseignants = useEnseignantStore(s => s.loadEnseignants);
  const deleteEnseignant = useEnseignantStore(s => s.deleteEnseignant);
  const addEnseignant = useEnseignantStore(s => s.addEnseignant);
  const openModal = useUIStore(s => s.openModal);

  // Load on mount only if not already loaded
  useEffect(() => {
    if (enseignants.length === 0 && !loading) {
      loadEnseignants();
    }
  }, [enseignants.length, loading, loadEnseignants]);

  // Get distinct matieres for filter
  const distinctMatieres = useMemo(() => {
    const matieres = new Set(enseignants.map(e => e.matierePrincipale).filter(Boolean));
    return Array.from(matieres).sort();
  }, [enseignants]);

  // Filter and search
  const filteredEnseignants = useMemo(() => {
    let data = [...enseignants];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(e => 
        e.nom.toLowerCase().includes(query) ||
        e.prenom?.toLowerCase().includes(query) ||
        e.matierePrincipale?.toLowerCase().includes(query) ||
        e.classesEnCharge?.some(c => c.toLowerCase().includes(query))
      );
    }

    // Filter by matiere
    if (filterMatiere) {
      data = data.filter(e => e.matierePrincipale === filterMatiere);
    }

    // Filter by PP
    if (filterPP !== null) {
      data = data.filter(e => e.estProfPrincipal === filterPP);
    }

    // Sort by nom
    return data.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [enseignants, searchQuery, filterMatiere, filterPP]);

  // Get selected enseignant
  const selectedEnseignant = useMemo(() => 
    enseignants.find(e => e.id === selectedEnseignantId),
    [enseignants, selectedEnseignantId]
  );

  // Handlers
  const handleCardClick = useCallback((enseignantId: string) => {
    setSelectedEnseignantId(enseignantId);
    setIsDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((enseignantId: string) => {
    openModal('editEnseignant', { enseignantId });
  }, [openModal]);

  const handleDelete = useCallback(async (enseignant: Enseignant) => {
    const fullName = `${enseignant.prenom} ${enseignant.nom}`;
    const confirmed = await confirmDelete(fullName);
    if (confirmed) {
      await deleteEnseignant(enseignant.id!);
      if (selectedEnseignantId === enseignant.id) {
        setIsDrawerOpen(false);
        setSelectedEnseignantId(null);
      }
    }
  }, [deleteEnseignant, selectedEnseignantId, confirmDelete]);

  const handleDuplicate = useCallback(async (enseignant: Enseignant) => {
    const { id, createdAt, updatedAt, ...data } = enseignant;
    await addEnseignant({
      ...data,
      nom: `${data.nom} (copie)`,
    });
  }, [addEnseignant]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const clearFilters = () => {
    setFilterMatiere('');
    setFilterPP(null);
  };

  const hasActiveFilters = filterMatiere || filterPP !== null;

  return (
    <div className="enseignants-page-v2">
      {/* Header */}
      <div className="page-header-v2">
        <div className="header-title">
          <h1>Enseignants</h1>
          <span className="count-badge">{enseignants.length}</span>
        </div>
        <button className="btn-add" onClick={() => openModal('editEnseignant')}>
          <Plus size={18} />
          Ajouter un enseignant
        </button>
      </div>

      {/* Search & Filters */}
      <div className="toolbar-v2">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher un enseignant..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <button 
          className={`btn-filter ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          Filtres
          {hasActiveFilters && <span className="filter-dot" />}
          <ChevronDown size={14} className={showFilters ? 'rotate' : ''} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-group">
            <label>Matière</label>
            <select value={filterMatiere} onChange={e => setFilterMatiere(e.target.value)}>
              <option value="">Toutes les matières</option>
              {distinctMatieres.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Prof Principal</label>
            <select 
              value={filterPP === null ? '' : filterPP ? 'true' : 'false'} 
              onChange={e => setFilterPP(e.target.value === '' ? null : e.target.value === 'true')}
            >
              <option value="">Tous</option>
              <option value="true">PP uniquement</option>
              <option value="false">Non PP</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button className="btn-clear-filters" onClick={clearFilters}>
              <X size={14} />
              Effacer les filtres
            </button>
          )}
        </div>
      )}

      {/* Results info */}
      {(searchQuery || hasActiveFilters) && (
        <div className="results-info">
          {filteredEnseignants.length} résultat(s) sur {enseignants.length}
        </div>
      )}

      {/* Cards grid */}
      <div className="enseignants-grid-v2">
        {filteredEnseignants.map(enseignant => (
          <EnseignantCard
            key={enseignant.id}
            enseignant={enseignant}
            onClick={() => handleCardClick(enseignant.id!)}
            onEdit={() => handleEdit(enseignant.id!)}
            onDelete={() => handleDelete(enseignant)}
            onDuplicate={() => handleDuplicate(enseignant)}
          />
        ))}
      </div>

      {/* Empty state */}
      {filteredEnseignants.length === 0 && !loading && (
        <div className="empty-state-v2">
          {enseignants.length === 0 ? (
            <>
              <Users size={48} />
              <h3>Aucun enseignant</h3>
              <p>Commencez par ajouter des enseignants pour les gérer</p>
              <button className="btn-add" onClick={() => openModal('editEnseignant')}>
                <Plus size={18} />
                Ajouter un enseignant
              </button>
            </>
          ) : (
            <>
              <Search size={48} />
              <h3>Aucun résultat</h3>
              <p>Aucun enseignant ne correspond à vos critères de recherche</p>
              <button className="btn-clear-filters" onClick={() => { setSearchQuery(''); clearFilters(); }}>
                Réinitialiser la recherche
              </button>
            </>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && enseignants.length === 0 && (
        <div className="empty-state-v2">
          <div className="loading-spinner" />
          <p>Chargement des enseignants...</p>
        </div>
      )}

      {/* Profile Drawer */}
      {selectedEnseignant && (
        <EnseignantProfileDrawer
          enseignant={selectedEnseignant}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onEdit={() => handleEdit(selectedEnseignant.id!)}
          onDelete={() => handleDelete(selectedEnseignant)}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};
