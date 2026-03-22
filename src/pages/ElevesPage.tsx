import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { useEleveStore } from '../stores/eleveStore';
import { useStageStore } from '../stores/stageStore';
import { useUIStore } from '../stores/uiStore';
import { MATIERES_HEURES_3E, PARCOURS_ORAL_DNB } from '../domain/models';
import type { Eleve } from '../domain/models';
import { StageTab } from '../components/eleves';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import {
  generateTemplateOralDNB,
  parseOralDNBFile,
  type OralDNBImportRow,
} from '../infrastructure/export/templateOralDNB';
import {
  Search,
  Download,
  Upload,
  Calendar,
  BookOpen,
  Check,
  X,
  Filter,
  ChevronDown,
  Shuffle,
  Mic,
  Building2
} from 'lucide-react';
import './ElevesPage.css';

const AVAILABLE_MATIERES = MATIERES_HEURES_3E.map(m => m.matiere);

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findEleveMatch(nom: string, prenom: string, eleves: Eleve[]): Eleve | null {
  const nomClean = removeAccents(nom.trim().toLowerCase());
  const prenomClean = removeAccents(prenom.trim().toLowerCase());
  if (!nomClean) return null;
  return eleves.find(e => {
    const eNom = removeAccents(e.nom.toLowerCase());
    const ePrenom = removeAccents(e.prenom.toLowerCase());
    return (
      (eNom === nomClean && ePrenom === prenomClean) ||
      (eNom.includes(nomClean) && ePrenom.includes(prenomClean))
    );
  }) || null;
}

export const ElevesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const eleves = useEleveStore(state => state.eleves);
  const updateEleve = useEleveStore(state => state.updateEleve);
  const openModal = useUIStore(state => state.openModal);
  const addNotification = useUIStore(state => state.addNotification);

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [sortBy, setSortBy] = useState<'nom' | 'classe' | 'dateNaissance'>('nom');
  const [activeTab, setActiveTab] = useState<'liste' | 'sujets' | 'stage'>('liste');

  // Sujets tab state
  const [sujetSearchFilter, setSujetSearchFilter] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<{ eleveId: string; field: 'sujetOral' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showSujetImport, setShowSujetImport] = useState(false);
  const [sujetDragActive, setSujetDragActive] = useState(false);
  const [sujetImportPreview, setSujetImportPreview] = useState<
    Array<OralDNBImportRow & { eleveId: string | null; matched: boolean }>
  >([]);
  const [sujetImporting, setSujetImporting] = useState(false);
  const [sujetImportDone, setSujetImportDone] = useState(false);
  const [sujetImportStats, setSujetImportStats] = useState({ success: 0, skipped: 0 });
  const sujetFileInputRef = useRef<HTMLInputElement>(null);

  // Read tab param from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'stage' || tabParam === 'sujets' || tabParam === 'liste') {
      setActiveTab(tabParam);
    }
    // Backward compat: old "matieres" param redirects to "sujets"
    if (tabParam === 'matieres') {
      setActiveTab('sujets');
    }
  }, [searchParams]);

  // Get unique classes
  const classes = useMemo(() => {
    const set = new Set(eleves.map(e => e.classe).filter(Boolean));
    return Array.from(set).sort();
  }, [eleves]);

  // Stats stages
  const stages = useStageStore(state => state.stages);
  const stageStats = useMemo(() => {
    const globalStages = stages.filter(stage => !stage.scenarioId);
    const elevesWithStage = new Set(globalStages.map(stage => stage.eleveId));
    const withStage = eleves.filter(e => elevesWithStage.has(e.id)).length;
    const withoutStage = eleves.length - withStage;
    return { withStage, withoutStage, total: eleves.length };
  }, [eleves, stages]);

  // ============================================================
  // SUJETS TAB: 3ème students grouped by class
  // ============================================================

  const eleves3e = useMemo(
    () => eleves.filter(e => e.classe?.startsWith('3')),
    [eleves]
  );

  const classeGroups = useMemo(() => {
    const groups: Record<string, Eleve[]> = {};
    for (const e of eleves3e) {
      const cls = e.classe || 'Sans classe';
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(e);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [eleves3e]);

  // Auto-expand all classes initially
  useMemo(() => {
    if (expandedClasses.size === 0 && classeGroups.length > 0) {
      setExpandedClasses(new Set(classeGroups.map(([cls]) => cls)));
    }
  }, [classeGroups.length]);

  const sujetStats = useMemo(() => {
    const total = eleves3e.length;
    const complete = eleves3e.filter(e => e.parcoursOral && e.sujetOral).length;
    return { total, complete };
  }, [eleves3e]);

  const filteredSujetGroups = useMemo(() => {
    if (!sujetSearchFilter) return classeGroups;
    const lower = sujetSearchFilter.toLowerCase();
    return classeGroups
      .map(([cls, elvs]) => [
        cls,
        elvs.filter(
          e =>
            e.nom.toLowerCase().includes(lower) ||
            e.prenom.toLowerCase().includes(lower) ||
            (e.parcoursOral || '').toLowerCase().includes(lower) ||
            (e.sujetOral || '').toLowerCase().includes(lower) ||
            (e.matieresOral || []).some(m => m.toLowerCase().includes(lower))
        ),
      ] as [string, Eleve[]])
      .filter(([, elvs]) => elvs.length > 0);
  }, [classeGroups, sujetSearchFilter]);

  const toggleClass = useCallback((cls: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  }, []);

  // Inline editing handlers
  const handleSetParcours = useCallback(
    async (eleveId: string, parcours: string) => {
      await updateEleve(eleveId, { parcoursOral: parcours || undefined });
    },
    [updateEleve]
  );

  const handleSetMatiere = useCallback(
    async (eleveId: string, index: number, matiere: string) => {
      const eleve = eleves3e.find(e => e.id === eleveId);
      if (!eleve) return;
      const matieres = [...(eleve.matieresOral || [])];
      if (matiere) {
        matieres[index] = matiere;
      } else {
        matieres.splice(index, 1);
      }
      await updateEleve(eleveId, { matieresOral: matieres.filter(Boolean) });
    },
    [updateEleve, eleves3e]
  );

  const startEditSujet = useCallback((eleveId: string, currentValue: string) => {
    setEditingField({ eleveId, field: 'sujetOral' });
    setEditValue(currentValue || '');
  }, []);

  const commitEditSujet = useCallback(async () => {
    if (!editingField) return;
    await updateEleve(editingField.eleveId, { sujetOral: editValue.trim() || undefined });
    setEditingField(null);
    setEditValue('');
  }, [editingField, editValue, updateEleve]);

  // Template & import
  const handleDownloadTemplate = useCallback(async () => {
    await generateTemplateOralDNB(eleves3e);
  }, [eleves3e]);

  const handleRandomThemes = useCallback(async () => {
    const parcoursList = [...PARCOURS_ORAL_DNB];
    const matieresList = MATIERES_HEURES_3E.map(m => m.matiere);
    const sujets = [
      'La biodiversite au college', 'Mon stage en entreprise', 'Marie Curie',
      'Le harcelement scolaire', 'Le street art engage', "L'eau dans tous ses etats",
      'Les energies renouvelables', 'La Revolution francaise', 'Le systeme solaire',
      'Les reseaux sociaux', 'Le developpement durable', 'La musique et les maths',
    ];

    const elevesSans = eleves3e.filter(e => !e.parcoursOral).length;
    const confirmed = await confirm({
      title: 'Attribution aleatoire',
      message: `Remplir parcours/sujet/matieres pour ${elevesSans} eleve(s) sans parcours ?`,
      variant: 'warning',
      confirmLabel: 'Attribuer',
    });
    if (!confirmed) return;

    for (const eleve of eleves3e) {
      if (!eleve.parcoursOral) {
        const parcours = parcoursList[Math.floor(Math.random() * parcoursList.length)];
        const sujet = sujets[Math.floor(Math.random() * sujets.length)];
        const mat1 = matieresList[Math.floor(Math.random() * matieresList.length)];
        const mat2Candidates = matieresList.filter(m => m !== mat1);
        const mat2 = Math.random() > 0.5 ? mat2Candidates[Math.floor(Math.random() * mat2Candidates.length)] : undefined;
        await updateEleve(eleve.id!, {
          parcoursOral: parcours,
          sujetOral: sujet,
          matieresOral: mat2 ? [mat1, mat2] : [mat1],
        });
      }
    }
  }, [eleves3e, updateEleve, confirm]);

  const handleSujetFile = useCallback(
    async (file: File) => {
      try {
        const rows = await parseOralDNBFile(file);
        const preview = rows.map(row => {
          const eleve = findEleveMatch(row.nom, row.prenom, eleves3e);
          return { ...row, eleveId: eleve?.id || null, matched: !!eleve };
        });
        setSujetImportPreview(preview);
        setShowSujetImport(true);
        setSujetImportDone(false);
      } catch (error) {
        console.error('Error parsing file:', error);
      }
    },
    [eleves3e]
  );

  const handleSujetDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSujetDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleSujetFile(file);
    },
    [handleSujetFile]
  );

  const handleSujetDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSujetDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const executeSujetImport = useCallback(async () => {
    setSujetImporting(true);
    let success = 0;
    let skipped = 0;
    for (const item of sujetImportPreview) {
      if (item.eleveId && (item.parcours || item.sujet)) {
        await updateEleve(item.eleveId, {
          parcoursOral: item.parcours || undefined,
          sujetOral: item.sujet || undefined,
          matieresOral: item.matieres.length > 0 ? item.matieres : undefined,
        });
        success++;
      } else {
        skipped++;
      }
    }
    setSujetImportStats({ success, skipped });
    setSujetImporting(false);
    setSujetImportDone(true);
  }, [sujetImportPreview, updateEleve]);

  const resetSujetImport = useCallback(() => {
    setShowSujetImport(false);
    setSujetImportPreview([]);
    setSujetImportDone(false);
    setSujetImportStats({ success: 0, skipped: 0 });
  }, []);

  const sujetPreviewStats = useMemo(() => {
    const total = sujetImportPreview.length;
    const matched = sujetImportPreview.filter(r => r.matched).length;
    const withData = sujetImportPreview.filter(r => r.parcours || r.sujet).length;
    const ready = sujetImportPreview.filter(r => r.matched && (r.parcours || r.sujet)).length;
    return { total, matched, withData, ready };
  }, [sujetImportPreview]);

  // ============================================================
  // LISTE TAB
  // ============================================================

  const filteredEleves = useMemo(() => {
    let result = eleves;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.nom.toLowerCase().includes(query) ||
        e.prenom.toLowerCase().includes(query) ||
        e.classe?.toLowerCase().includes(query)
      );
    }
    if (selectedClasse) {
      result = result.filter(e => e.classe === selectedClasse);
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'nom': return a.nom.localeCompare(b.nom);
        case 'classe': return (a.classe || '').localeCompare(b.classe || '');
        case 'dateNaissance': return (a.dateNaissance || '').localeCompare(b.dateNaissance || '');
        default: return 0;
      }
    });
    return result;
  }, [eleves, searchQuery, selectedClasse, sortBy]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const handleExport = () => {
    if (eleves.length === 0) {
      addNotification({ type: 'warning', message: 'Aucun eleve a exporter' });
      return;
    }
    const headers = ['Nom', 'Prenom', 'Classe', 'Date de naissance', 'Sexe', 'Options', 'Parcours Oral', 'Sujet Oral', 'Matieres Oral', 'Tags'];
    const rows = eleves.map(e => [
      e.nom, e.prenom, e.classe || '', e.dateNaissance || '', e.sexe || '',
      e.options.join(';'), e.parcoursOral || '', e.sujetOral || '',
      e.matieresOral?.join(';') || '', e.tags.join(';')
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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="eleves-page">
      <div className="page-header">
        <div className="header-left">
          <h1>Eleves</h1>
          <span className="count">{eleves.length} eleves</span>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={18} />
            Exporter
          </button>
          <button className="btn-primary" onClick={() => openModal('import')}>
            <Upload size={18} />
            Importer des eleves (CSV)
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
          Liste des eleves
        </button>
        <button
          className={`tab-btn ${activeTab === 'sujets' ? 'active' : ''}`}
          onClick={() => setActiveTab('sujets')}
        >
          <Mic size={16} />
          Sujets Oral DNB
          {sujetStats.total > 0 && sujetStats.complete < sujetStats.total && (
            <span className="tab-badge warning">{sujetStats.total - sujetStats.complete}</span>
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

      {/* ============================================================ */}
      {/* Onglet Liste classique */}
      {/* ============================================================ */}
      {activeTab === 'liste' && (
        <>
          <div className="filters-bar">
            <div className="search-input">
              <Search size={18} />
              <input
                type="text"
                placeholder="Rechercher un eleve..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Classe:</label>
              <select value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
                <option value="">Toutes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Trier par:</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="nom">Nom</option>
                <option value="classe">Classe</option>
                <option value="dateNaissance">Date de naissance</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="eleves-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prenom</th>
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
                    <td><span className="classe-badge">{eleve.classe || '-'}</span></td>
                    <td>
                      <span className="date-cell">
                        <Calendar size={14} />
                        {formatDate(eleve.dateNaissance)}
                      </span>
                    </td>
                    <td>{eleve.sexe || '-'}</td>
                    <td className="options-cell">{eleve.options.length > 0 ? eleve.options.join(', ') : '-'}</td>
                    <td className="tags-cell">{eleve.tags.length > 0 ? eleve.tags.join(', ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEleves.length === 0 && (
              <div className="empty-state">
                <p>Aucun eleve trouve</p>
                {searchQuery || selectedClasse
                  ? <span>Essayez de modifier vos criteres de recherche</span>
                  : <span>Importez un fichier CSV pour ajouter des eleves</span>
                }
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* Onglet Sujets Oral DNB */}
      {/* ============================================================ */}
      {activeTab === 'sujets' && (
        <>
          {/* Import preview / done screens */}
          {showSujetImport ? (
            sujetImportDone ? (
              <div className="sujets-import-result">
                <div className="import-success-card">
                  <Check size={24} />
                  <div>
                    <strong>{sujetImportStats.success} eleve(s) mis a jour</strong>
                    {sujetImportStats.skipped > 0 && <span>, {sujetImportStats.skipped} ignore(s)</span>}
                  </div>
                </div>
                <button className="btn-primary" onClick={resetSujetImport}>
                  Retour a la liste
                </button>
              </div>
            ) : (
              <div className="sujets-import-preview">
                <h3>Verification de l'import</h3>
                <div className="import-stats-bar-page">
                  <div className="import-stat-page">
                    <span className="stat-value">{sujetPreviewStats.total}</span>
                    <span className="stat-label">lignes</span>
                  </div>
                  <div className="import-stat-page">
                    <span className="stat-value">{sujetPreviewStats.matched}</span>
                    <span className="stat-label">eleves trouves</span>
                  </div>
                  <div className={clsx('import-stat-page', sujetPreviewStats.ready > 0 && 'success')}>
                    <span className="stat-value">{sujetPreviewStats.ready}</span>
                    <span className="stat-label">prets</span>
                  </div>
                </div>

                <div className="sujets-preview-table">
                  <div className="sujets-preview-header">
                    <span>Eleve</span>
                    <span>Parcours</span>
                    <span>Sujet</span>
                    <span>Matiere(s)</span>
                    <span>Match</span>
                  </div>
                  <div className="sujets-preview-body">
                    {sujetImportPreview.map((item, i) => (
                      <div key={i} className={clsx('sujets-preview-row', !item.matched && 'no-match')}>
                        <span>{item.nom} {item.prenom}</span>
                        <span>{item.parcours || '—'}</span>
                        <span className="preview-sujet">{item.sujet || '—'}</span>
                        <span>{item.matieres.length > 0 ? item.matieres.join(', ') : '—'}</span>
                        <span className={clsx('match-badge-page', item.matched ? 'ok' : 'none')}>
                          {item.matched ? <><Check size={12} /> OK</> : <><X size={12} /> ?</>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="import-actions">
                  <button className="btn-secondary" onClick={resetSujetImport}>Annuler</button>
                  <button
                    className="btn-primary"
                    onClick={executeSujetImport}
                    disabled={sujetPreviewStats.ready === 0 || sujetImporting}
                  >
                    {sujetImporting ? 'Import en cours...' : `Importer ${sujetPreviewStats.ready} sujet(s)`}
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              {/* Stats bar */}
              <div className="themes-stats-bar">
                <div className="themes-stat">
                  <BookOpen size={20} />
                  <span className="stat-value">{sujetStats.complete}</span>
                  <span className="stat-label">/ {sujetStats.total} eleves completes</span>
                </div>
                {sujetStats.complete === sujetStats.total && sujetStats.total > 0 && (
                  <span className="all-done-badge">
                    <Check size={14} /> Complet
                  </span>
                )}
              </div>

              {/* Actions bar */}
              <div className="themes-actions-bar">
                <div className="themes-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Rechercher un eleve, parcours, sujet..."
                    value={sujetSearchFilter}
                    onChange={e => setSujetSearchFilter(e.target.value)}
                  />
                </div>
                <button className="btn-secondary" onClick={handleDownloadTemplate}>
                  <Download size={16} />
                  Template
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleRandomThemes}
                  title="DEV: Remplir aleatoirement"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b', fontSize: '0.75rem' }}
                >
                  <Shuffle size={16} />
                  Random
                </button>
                <div
                  className="import-drop-zone-inline"
                  onDragEnter={handleSujetDrag}
                  onDragLeave={handleSujetDrag}
                  onDragOver={handleSujetDrag}
                  onDrop={handleSujetDrop}
                  onClick={() => sujetFileInputRef.current?.click()}
                >
                  <input
                    ref={sujetFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={e => e.target.files?.[0] && handleSujetFile(e.target.files[0])}
                    hidden
                  />
                  <Upload size={16} className={clsx(sujetDragActive && 'drag-active')} />
                  <span>Importer</span>
                </div>
              </div>

              {/* Students grouped by class */}
              <div className="themes-class-list">
                {filteredSujetGroups.map(([cls, elvs]) => (
                  <div key={cls} className="themes-class-group">
                    <button
                      className={clsx('class-group-header', expandedClasses.has(cls) && 'expanded')}
                      onClick={() => toggleClass(cls)}
                    >
                      <ChevronDown size={16} className="expand-icon" />
                      <span className="class-name">{cls}</span>
                      <span className="class-count">
                        {elvs.filter(e => e.parcoursOral && e.sujetOral).length}/{elvs.length}
                      </span>
                    </button>

                    {expandedClasses.has(cls) && (
                      <div className="class-students oral-table">
                        <div className="oral-table-header">
                          <span className="col-name">Eleve</span>
                          <span className="col-parcours">Parcours</span>
                          <span className="col-sujet">Sujet</span>
                          <span className="col-matiere">Matiere 1</span>
                          <span className="col-matiere">Matiere 2</span>
                        </div>
                        {elvs.map(eleve => {
                          const isComplete = eleve.parcoursOral && eleve.sujetOral;
                          const isEditingSujet =
                            editingField?.eleveId === eleve.id && editingField.field === 'sujetOral';

                          return (
                            <div
                              key={eleve.id}
                              className={clsx('oral-table-row', isComplete && 'complete')}
                            >
                              <span className="col-name student-name">
                                {eleve.nom} {eleve.prenom}
                              </span>

                              <select
                                className={clsx('oral-select', eleve.parcoursOral && 'has-value')}
                                value={eleve.parcoursOral || ''}
                                onChange={e => handleSetParcours(eleve.id!, e.target.value)}
                              >
                                <option value="">--</option>
                                {PARCOURS_ORAL_DNB.map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>

                              {isEditingSujet ? (
                                <input
                                  className="oral-input col-sujet"
                                  type="text"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={commitEditSujet}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') commitEditSujet();
                                    if (e.key === 'Escape') setEditingField(null);
                                  }}
                                  autoFocus
                                  placeholder="Titre du sujet..."
                                />
                              ) : (
                                <span
                                  className={clsx('col-sujet sujet-cell', !eleve.sujetOral && 'empty')}
                                  onClick={() => startEditSujet(eleve.id!, eleve.sujetOral || '')}
                                  title="Cliquer pour modifier"
                                >
                                  {eleve.sujetOral || 'Cliquer pour saisir...'}
                                </span>
                              )}

                              <select
                                className={clsx('oral-select oral-select-sm', eleve.matieresOral?.[0] && 'has-value')}
                                value={eleve.matieresOral?.[0] || ''}
                                onChange={e => handleSetMatiere(eleve.id!, 0, e.target.value)}
                              >
                                <option value="">--</option>
                                {AVAILABLE_MATIERES.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>

                              <select
                                className={clsx('oral-select oral-select-sm', eleve.matieresOral?.[1] && 'has-value')}
                                value={eleve.matieresOral?.[1] || ''}
                                onChange={e => handleSetMatiere(eleve.id!, 1, e.target.value)}
                              >
                                <option value="">--</option>
                                {AVAILABLE_MATIERES.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>

                              {isComplete && <Check size={14} className="row-check" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {filteredSujetGroups.length === 0 && (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <p>{sujetSearchFilter
                      ? 'Aucun eleve ne correspond a votre recherche.'
                      : "Aucun eleve de 3eme trouve. Importez des eleves depuis l'onglet Liste."
                    }</p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* Onglet Stages */}
      {/* ============================================================ */}
      {activeTab === 'stage' && (
        <StageTab />
      )}

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
