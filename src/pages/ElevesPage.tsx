import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEleveStore } from '../stores/eleveStore';
import { useStageStore } from '../stores/stageStore';
import { useUIStore } from '../stores/uiStore';
import { MATIERES_HEURES_3E } from '../domain/models';
import { ImportMatiereOralModal } from '../components/import';
import { StageTab } from '../components/eleves';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import {
  Search,
  Download,
  Upload,
  Calendar,
  BookOpen,
  Check,
  X,
  AlertTriangle,
  Filter,
  Edit2,
  Save,
  ChevronDown,
  Mic,
  Building2
} from 'lucide-react';
import './ElevesPage.css';

// Liste des matières disponibles pour l'oral DNB
const MATIERES_ORAL = MATIERES_HEURES_3E.map(m => m.matiere);

export const ElevesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const eleves = useEleveStore(state => state.eleves);
  const updateEleve = useEleveStore(state => state.updateEleve);
  const openModal = useUIStore(state => state.openModal);
  const addNotification = useUIStore(state => state.addNotification);

  // Confirm modal
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [sortBy, setSortBy] = useState<'nom' | 'classe' | 'dateNaissance' | 'matiere'>('nom');
  const [filterMatiere, setFilterMatiere] = useState<'all' | 'with' | 'without'>('all');
  const [activeTab, setActiveTab] = useState<'liste' | 'matieres' | 'stage'>('liste');

  // Lire le paramètre tab de l'URL pour ouvrir l'onglet correspondant
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'stage' || tabParam === 'matieres' || tabParam === 'liste') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  // Pour édition en ligne des matières
  const [editingEleveId, setEditingEleveId] = useState<string | null>(null);
  const [selectedMatieres, setSelectedMatieres] = useState<string[]>([]);
  const [showMatiereDropdown, setShowMatiereDropdown] = useState<string | null>(null);
  const matiereDropdownRef = useRef<HTMLDivElement>(null);
  const [showImportMatiereModal, setShowImportMatiereModal] = useState(false);

  // Click-outside handler pour fermer le dropdown matière
  useEffect(() => {
    if (!showMatiereDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (matiereDropdownRef.current && !matiereDropdownRef.current.contains(e.target as Node)) {
        setShowMatiereDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMatiereDropdown]);

  // Get unique classes
  const classes = useMemo(() => {
    const set = new Set(eleves.map(e => e.classe).filter(Boolean));
    return Array.from(set).sort();
  }, [eleves]);

  // Stats matières
  const matiereStats = useMemo(() => {
    const withMatiere = eleves.filter(e => e.matieresOral && e.matieresOral.length > 0).length;
    const withoutMatiere = eleves.length - withMatiere;
    return { withMatiere, withoutMatiere, total: eleves.length };
  }, [eleves]);

  // Stats stages (utilise le store pour obtenir les stages globaux)
  const stages = useStageStore(state => state.stages);
  const stageStats = useMemo(() => {
    const globalStages = stages.filter(stage => !stage.scenarioId);
    const elevesWithStage = new Set(globalStages.map(stage => stage.eleveId));
    const withStage = eleves.filter(e => elevesWithStage.has(e.id)).length;
    const withoutStage = eleves.length - withStage;
    return { withStage, withoutStage, total: eleves.length };
  }, [eleves, stages]);

  // Filter and sort eleves
  const filteredEleves = useMemo(() => {
    let result = eleves;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.nom.toLowerCase().includes(query) ||
        e.prenom.toLowerCase().includes(query) ||
        e.classe?.toLowerCase().includes(query) ||
        e.matieresOral?.some(m => m.toLowerCase().includes(query))
      );
    }

    // Classe filter
    if (selectedClasse) {
      result = result.filter(e => e.classe === selectedClasse);
    }

    // Matière filter
    if (filterMatiere === 'with') {
      result = result.filter(e => e.matieresOral && e.matieresOral.length > 0);
    } else if (filterMatiere === 'without') {
      result = result.filter(e => !e.matieresOral || e.matieresOral.length === 0);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nom':
          return a.nom.localeCompare(b.nom);
        case 'classe':
          return (a.classe || '').localeCompare(b.classe || '');
        case 'dateNaissance':
          return (a.dateNaissance || '').localeCompare(b.dateNaissance || '');
        case 'matiere':
          const mA = a.matieresOral?.[0] || 'zzz';
          const mB = b.matieresOral?.[0] || 'zzz';
          return mA.localeCompare(mB);
        default:
          return 0;
      }
    });

    return result;
  }, [eleves, searchQuery, selectedClasse, sortBy, filterMatiere]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
  };

  const handleExport = () => {
    if (eleves.length === 0) {
      addNotification({ type: 'warning', message: 'Aucun élève à exporter' });
      return;
    }
    const headers = ['Nom', 'Prénom', 'Classe', 'Date de naissance', 'Sexe', 'Options', 'Matières Oral', 'Tags'];
    const rows = eleves.map(e => [
      e.nom,
      e.prenom,
      e.classe || '',
      e.dateNaissance || '',
      e.sexe || '',
      e.options.join(';'),
      e.matieresOral?.join(';') || '',
      e.tags.join(';')
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eleves_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Gestion édition matières
  const startEditMatiere = useCallback((eleveId: string) => {
    const eleve = eleves.find(e => e.id === eleveId);
    setEditingEleveId(eleveId);
    setSelectedMatieres(eleve?.matieresOral || []);
  }, [eleves]);

  const cancelEditMatiere = useCallback(() => {
    setEditingEleveId(null);
    setSelectedMatieres([]);
    setShowMatiereDropdown(null);
  }, []);

  const saveMatiere = useCallback(async (eleveId: string) => {
    try {
      await updateEleve(eleveId, { matieresOral: selectedMatieres });
      setEditingEleveId(null);
      setSelectedMatieres([]);
    } catch (error) {
      console.error('Erreur sauvegarde matière:', error);
    }
  }, [updateEleve, selectedMatieres]);

  const toggleMatiere = useCallback((matiere: string) => {
    setSelectedMatieres(prev => 
      prev.includes(matiere) 
        ? prev.filter(m => m !== matiere)
        : [...prev, matiere]
    );
  }, []);

  // Attribution rapide de matière (clic direct)
  const quickAssignMatiere = useCallback(async (eleveId: string, matiere: string) => {
    const eleve = eleves.find(e => e.id === eleveId);
    const currentMatieres = eleve?.matieresOral || [];
    
    // Toggle la matière
    const newMatieres = currentMatieres.includes(matiere)
      ? currentMatieres.filter(m => m !== matiere)
      : [...currentMatieres, matiere];
    
    try {
      await updateEleve(eleveId, { matieresOral: newMatieres });
    } catch (error) {
      console.error('Erreur attribution matière:', error);
    }
    setShowMatiereDropdown(null);
  }, [eleves, updateEleve]);

  // Attribution aléatoire de matières (pour tests)
  const assignRandomMatieres = useCallback(async () => {
    if (eleves.length === 0) return;

    const elevesSansMatiere = eleves.filter(e => !e.matieresOral || e.matieresOral.length === 0).length;
    const confirmed = await confirm({
      title: 'Attribution aléatoire',
      message: `Assigner une matière aléatoire à ${elevesSansMatiere} élève(s) sans matière ?`,
      variant: 'warning',
      confirmLabel: 'Attribuer',
    });

    if (!confirmed) return;
    
    let count = 0;
    for (const eleve of eleves) {
      if (!eleve.matieresOral || eleve.matieresOral.length === 0) {
        const randomMatiere = MATIERES_ORAL[Math.floor(Math.random() * MATIERES_ORAL.length)];
        try {
          await updateEleve(eleve.id, { matieresOral: [randomMatiere] });
          count++;
        } catch (error) {
          console.error(`Erreur pour ${eleve.prenom} ${eleve.nom}:`, error);
        }
      }
    }
  }, [eleves, updateEleve, confirm]);

  return (
    <div className="eleves-page">
      <div className="page-header">
        <div className="header-left">
          <h1>Élèves</h1>
          <span className="count">{eleves.length} élèves</span>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={18} />
            Exporter
          </button>
          <button className="btn-primary" onClick={() => openModal('import')}>
            <Upload size={18} />
            Importer des élèves (CSV)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="page-tabs">
        <button 
          className={`tab-btn ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          <Filter size={16} />
          Liste des élèves
        </button>
        <button
          className={`tab-btn ${activeTab === 'matieres' ? 'active' : ''}`}
          onClick={() => setActiveTab('matieres')}
        >
          <Mic size={16} />
          Matières Oral DNB
          {matiereStats.withoutMatiere > 0 && (
            <span className="tab-badge warning">{matiereStats.withoutMatiere}</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'stage' ? 'active' : ''}`}
          onClick={() => setActiveTab('stage')}
        >
          <Building2 size={16} />
          Stages
          {stageStats.withoutStage > 0 && (
            <span className="tab-badge warning">{stageStats.withoutStage}</span>
          )}
        </button>
      </div>

      {/* Onglet Liste classique */}
      {activeTab === 'liste' && (
        <>
          {/* Filters */}
          <div className="filters-bar">
            <div className="search-input">
              <Search size={18} />
              <input
                type="text"
                placeholder="Rechercher un élève..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Classe:</label>
              <select 
                value={selectedClasse} 
                onChange={e => setSelectedClasse(e.target.value)}
              >
                <option value="">Toutes</option>
                {classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Trier par:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="nom">Nom</option>
                <option value="classe">Classe</option>
                <option value="dateNaissance">Date de naissance</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="eleves-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Classe</th>
                  <th>Date de naissance</th>
                  <th>Sexe</th>
                  <th>Options</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {filteredEleves.map(eleve => (
                  <tr key={eleve.id}>
                    <td className="nom-cell">{eleve.nom}</td>
                    <td>{eleve.prenom}</td>
                    <td>
                      <span className="classe-badge">{eleve.classe || '-'}</span>
                    </td>
                    <td>
                      <span className="date-cell">
                        <Calendar size={14} />
                        {formatDate(eleve.dateNaissance)}
                      </span>
                    </td>
                    <td>{eleve.sexe || '-'}</td>
                    <td className="options-cell">
                      {eleve.options.length > 0 ? eleve.options.join(', ') : '-'}
                    </td>
                    <td className="tags-cell">
                      {eleve.tags.length > 0 ? eleve.tags.join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredEleves.length === 0 && (
              <div className="empty-state">
                <p>Aucun élève trouvé</p>
                {searchQuery || selectedClasse ? (
                  <span>Essayez de modifier vos critères de recherche</span>
                ) : (
                  <span>Importez un fichier CSV pour ajouter des élèves</span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Onglet Matières Oral DNB */}
      {activeTab === 'matieres' && (
        <>
          {/* Stats banner */}
          <div className="matieres-stats-banner">
            <div className="stat-item">
              <BookOpen size={20} />
              <div className="stat-content">
                <span className="stat-value">{matiereStats.withMatiere}</span>
                <span className="stat-label">avec matière</span>
              </div>
            </div>
            <div className="stat-item warning">
              <AlertTriangle size={20} />
              <div className="stat-content">
                <span className="stat-value">{matiereStats.withoutMatiere}</span>
                <span className="stat-label">sans matière</span>
              </div>
            </div>
            <div className="stat-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(matiereStats.withMatiere / Math.max(matiereStats.total, 1)) * 100}%` }}
                />
              </div>
              <span className="progress-label">
                {Math.round((matiereStats.withMatiere / Math.max(matiereStats.total, 1)) * 100)}% complété
              </span>
            </div>
            <button 
              className="btn-primary"
              onClick={() => setShowImportMatiereModal(true)}
            >
              <Upload size={18} />
              Importer les sujets des élèves (CSV)
            </button>
            <button 
              className="btn-secondary"
              onClick={assignRandomMatieres}
              style={{ marginLeft: '8px' }}
              title="Pour tests - assigne une matière aléatoire aux élèves sans matière"
            >
              🎲 Matières aléatoires
            </button>
          </div>

          {/* Filters for matieres tab */}
          <div className="filters-bar">
            <div className="search-input">
              <Search size={18} />
              <input
                type="text"
                placeholder="Rechercher un élève ou une matière..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Classe:</label>
              <select 
                value={selectedClasse} 
                onChange={e => setSelectedClasse(e.target.value)}
              >
                <option value="">Toutes</option>
                {classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Matière oral:</label>
              <select
                value={filterMatiere}
                onChange={e => setFilterMatiere(e.target.value as typeof filterMatiere)}
              >
                <option value="all">Tous</option>
                <option value="with">Avec matière</option>
                <option value="without">Sans matière ⚠️</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Trier par:</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="nom">Nom</option>
                <option value="classe">Classe</option>
                <option value="matiere">Matière oral</option>
              </select>
            </div>
          </div>

          {/* Table with matiere editing */}
          <div className="table-container matieres-table-container">
            <table className="eleves-table matieres-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Classe</th>
                  <th className="matiere-col">Matière(s) Oral</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEleves.map(eleve => {
                  const isEditing = editingEleveId === eleve.id;
                  const hasMatieres = eleve.matieresOral && eleve.matieresOral.length > 0;
                  
                  return (
                    <tr key={eleve.id} className={!hasMatieres ? 'no-matiere' : ''}>
                      <td className="nom-cell">{eleve.nom}</td>
                      <td>{eleve.prenom}</td>
                      <td>
                        <span className="classe-badge">{eleve.classe || '-'}</span>
                      </td>
                      <td className="matiere-cell">
                        {isEditing ? (
                          <div className="matiere-edit-mode">
                            <div className="selected-matieres">
                              {selectedMatieres.length === 0 ? (
                                <span className="placeholder">Cliquez pour sélectionner...</span>
                              ) : (
                                selectedMatieres.map(m => (
                                  <span key={m} className="matiere-tag selected">
                                    {m}
                                    <button 
                                      className="remove-matiere"
                                      onClick={() => toggleMatiere(m)}
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                            <div className="matiere-dropdown">
                              {MATIERES_ORAL.filter(m => !selectedMatieres.includes(m)).map(m => (
                                <button 
                                  key={m}
                                  className="matiere-option"
                                  onClick={() => toggleMatiere(m)}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="matiere-display">
                            {hasMatieres ? (
                              eleve.matieresOral!.map(m => (
                                <span key={m} className="matiere-tag">{m}</span>
                              ))
                            ) : (
                              <span className="no-matiere-badge">
                                <AlertTriangle size={14} />
                                Non renseignée
                              </span>
                            )}
                            {/* Quick assign dropdown */}
                            <div className="quick-assign" ref={showMatiereDropdown === eleve.id ? matiereDropdownRef : undefined}>
                              <button
                                className="quick-assign-btn"
                                onClick={() => setShowMatiereDropdown(
                                  showMatiereDropdown === eleve.id ? null : eleve.id!
                                )}
                              >
                                <ChevronDown size={14} />
                              </button>
                              {showMatiereDropdown === eleve.id && (
                                <div className="quick-dropdown">
                                  {MATIERES_ORAL.map(m => (
                                    <button 
                                      key={m}
                                      className={`quick-option ${eleve.matieresOral?.includes(m) ? 'selected' : ''}`}
                                      onClick={() => quickAssignMatiere(eleve.id!, m)}
                                    >
                                      {eleve.matieresOral?.includes(m) && <Check size={12} />}
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="actions-cell">
                        {isEditing ? (
                          <div className="edit-actions">
                            <button 
                              className="btn-icon save"
                              onClick={() => saveMatiere(eleve.id!)}
                              title="Enregistrer"
                            >
                              <Save size={16} />
                            </button>
                            <button 
                              className="btn-icon cancel"
                              onClick={cancelEditMatiere}
                              title="Annuler"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            className="btn-icon edit"
                            onClick={() => startEditMatiere(eleve.id!)}
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredEleves.length === 0 && (
              <div className="empty-state">
                <p>Aucun élève trouvé</p>
                <span>Modifiez vos filtres pour voir plus d'élèves</span>
              </div>
            )}
          </div>

          {/* Help section */}
          <div className="matieres-help">
            <h4>💡 Conseils</h4>
            <ul>
              <li>Utilisez le menu déroulant <ChevronDown size={12} /> pour attribuer rapidement une matière</li>
              <li>Cliquez sur <Edit2 size={12} /> pour sélectionner plusieurs matières</li>
              <li>Filtrez par "Sans matière" pour voir les élèves à compléter</li>
              <li>Utilisez "Importer CSV" pour charger les matières en masse depuis un fichier</li>
            </ul>
          </div>
        </>
      )}

      {/* Onglet Stages */}
      {activeTab === 'stage' && (
        <StageTab />
      )}

      {/* Modal Import Matières Oral */}
      {showImportMatiereModal && (
        <ImportMatiereOralModal
          onClose={() => setShowImportMatiereModal(false)}
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
