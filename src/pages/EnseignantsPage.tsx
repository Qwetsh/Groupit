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
  MapPin,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Users,
  Award,
  ChevronDown
} from 'lucide-react';
import { EnseignantProfileDrawer } from '../components/enseignant/EnseignantProfileDrawer';
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
    <div className="enseignant-card-v2" onClick={onClick}>
      {/* Header avec avatar et nom */}
      <div className="card-v2-header">
        <div className="avatar-v2">
          {enseignant.prenom?.[0]}{enseignant.nom[0]}
        </div>
        <div className="identity">
          <h3>{enseignant.prenom} <span className="nom-upper">{enseignant.nom.toUpperCase()}</span></h3>
          {enseignant.matierePrincipale && (
            <span className="matiere-badge">
              <BookOpen size={12} />
              {enseignant.matierePrincipale}
            </span>
          )}
        </div>
        <div className="menu-trigger" onClick={handleMenuClick}>
          <MoreVertical size={18} />
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
      </div>

      {/* Body avec infos clés */}
      <div className="card-v2-body">
        {/* Classes en charge */}
        {enseignant.classesEnCharge && enseignant.classesEnCharge.length > 0 && (
          <div className="info-row">
            <Users size={14} />
            <span className="classes-list">
              {enseignant.classesEnCharge.slice(0, 4).join(', ')}
              {enseignant.classesEnCharge.length > 4 && ` +${enseignant.classesEnCharge.length - 4}`}
            </span>
          </div>
        )}

        {/* PP badge */}
        {enseignant.estProfPrincipal && (
          <div className="info-row pp-row">
            <Award size={14} />
            <span>Prof Principal</span>
            {enseignant.classePP && <span className="pp-classe">{enseignant.classePP}</span>}
          </div>
        )}

        {/* Adresse avec statut géocodage */}
        {(enseignant.adresse || enseignant.commune) && (
          <div className="info-row geo-row">
            <MapPin size={14} />
            <span className="address-text">
              {enseignant.commune || enseignant.adresse}
            </span>
            {enseignant.geoStatus === 'ok' && (
              <CheckCircle size={12} className="geo-ok" />
            )}
            {enseignant.geoStatus === 'error' && (
              <AlertCircle size={12} className="geo-error" />
            )}
          </div>
        )}
      </div>

      {/* Footer avec tags */}
      <div className="card-v2-footer">
        {enseignant.tags && enseignant.tags.length > 0 ? (
          <div className="tags-row">
            {enseignant.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="tag-badge">{tag}</span>
            ))}
            {enseignant.tags.length > 3 && (
              <span className="tags-more">+{enseignant.tags.length - 3}</span>
            )}
          </div>
        ) : (
          <div className="footer-spacer" />
        )}
        <span className="view-profile">Voir profil →</span>
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

  // Stores
  const enseignants = useEnseignantStore(s => s.enseignants);
  const loadEnseignants = useEnseignantStore(s => s.loadEnseignants);
  const deleteEnseignant = useEnseignantStore(s => s.deleteEnseignant);
  const addEnseignant = useEnseignantStore(s => s.addEnseignant);
  const openModal = useUIStore(s => s.openModal);

  // Load on mount
  useEffect(() => {
    loadEnseignants();
  }, [loadEnseignants]);

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
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${fullName} ?\n\nCette action est irréversible.`)) {
      await deleteEnseignant(enseignant.id!);
      if (selectedEnseignantId === enseignant.id) {
        setIsDrawerOpen(false);
        setSelectedEnseignantId(null);
      }
    }
  }, [deleteEnseignant, selectedEnseignantId]);

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
      {filteredEnseignants.length === 0 && (
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
    </div>
  );
};
