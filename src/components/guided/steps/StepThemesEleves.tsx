// ============================================================
// GUIDED STEP - SUJETS ORAL DNB (Parcours + Sujet + Matières)
// ============================================================

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  Upload,
  Download,
  Check,
  ChevronRight,
  ChevronDown,
  Search,
  BookOpen,
  X,
  Shuffle,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { useEleveStore } from '../../../stores/eleveStore';
import { MATIERES_HEURES_3E, PARCOURS_ORAL_DNB, LANGUES_ETRANGERES } from '../../../domain/models';
import type { Eleve } from '../../../domain/models';
import {
  generateTemplateOralDNB,
  parseOralDNBFile,
  type OralDNBImportRow,
} from '../../../infrastructure/export/templateOralDNB';
import '../GuidedMode.css';

interface StepThemesElevesProps {
  onNext: () => void;
  onBack: () => void;
}

const AVAILABLE_MATIERES = MATIERES_HEURES_3E.map(m => m.matiere);

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findEleveMatch(
  nom: string,
  prenom: string,
  eleves: Eleve[]
): Eleve | null {
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

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StepThemesEleves({ onNext, onBack }: StepThemesElevesProps) {
  const eleves = useEleveStore(state => state.eleves);
  const updateEleve = useEleveStore(state => state.updateEleve);
  const deleteEleve = useEleveStore(state => state.deleteEleve);

  const [searchFilter, setSearchFilter] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Import state
  const [importPreview, setImportPreview] = useState<
    Array<OralDNBImportRow & { eleveId: string | null; matched: boolean }>
  >([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importStats, setImportStats] = useState({ success: 0, skipped: 0 });

  // Inline editing
  const [editingField, setEditingField] = useState<{
    eleveId: string;
    field: 'sujetOral';
  } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter 3eme students
  const eleves3e = useMemo(
    () => eleves.filter(e => e.classe?.startsWith('3')),
    [eleves]
  );

  // Group by class
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
  useEffect(() => {
    if (expandedClasses.size === 0 && classeGroups.length > 0) {
      setExpandedClasses(new Set(classeGroups.map(([cls]) => cls)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeGroups.length]);

  // Stats
  const totalEleves = eleves3e.length;
  const elevesComplete = eleves3e.filter(
    e => e.parcoursOral && e.sujetOral
  ).length;

  // Filtered eleves
  const filteredGroups = useMemo(() => {
    if (!searchFilter) return classeGroups;
    const lower = searchFilter.toLowerCase();
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
  }, [classeGroups, searchFilter]);

  // Toggle class expansion
  const toggleClass = useCallback((cls: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  }, []);

  // ============================================================
  // INLINE EDITING
  // ============================================================

  const handleSetParcours = useCallback(
    async (eleveId: string, parcours: string) => {
      await updateEleve(eleveId, {
        parcoursOral: parcours || undefined,
      });
    },
    [updateEleve]
  );

  const handleSetLangue = useCallback(
    async (eleveId: string, langue: string) => {
      await updateEleve(eleveId, {
        langueEtrangere: langue || undefined,
      });
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

  const handleSetTiersTemps = useCallback(
    async (eleveId: string, checked: boolean) => {
      await updateEleve(eleveId, { tiersTemps: checked || undefined });
    },
    [updateEleve]
  );

  const handleDeleteEleve = useCallback(
    async (eleveId: string, displayName: string) => {
      if (!window.confirm(`Supprimer ${displayName} de la liste ?`)) return;
      await deleteEleve(eleveId);
    },
    [deleteEleve]
  );

  const startEditSujet = useCallback((eleveId: string, currentValue: string) => {
    setEditingField({ eleveId, field: 'sujetOral' });
    setEditValue(currentValue || '');
  }, []);

  const commitEditSujet = useCallback(async () => {
    if (!editingField) return;
    await updateEleve(editingField.eleveId, {
      sujetOral: editValue.trim() || undefined,
    });
    setEditingField(null);
    setEditValue('');
  }, [editingField, editValue, updateEleve]);

  // ============================================================
  // TEMPLATE DOWNLOAD
  // ============================================================

  const handleDownloadTemplate = useCallback(async () => {
    await generateTemplateOralDNB(eleves3e);
  }, [eleves3e]);

  // DEV: assign random data for testing
  const handleRandomThemes = useCallback(async () => {
    const parcoursList = [...PARCOURS_ORAL_DNB];
    const matieresList = MATIERES_HEURES_3E.map(m => m.matiere);
    const sujets = [
      'La biodiversité au collège', 'Mon stage en entreprise', 'Marie Curie',
      'Le harcèlement scolaire', 'Le street art engagé', "L'eau dans tous ses états",
      'Les énergies renouvelables', 'La Révolution française', 'Le système solaire',
      'Les réseaux sociaux', 'Le développement durable', 'La musique et les maths',
    ];
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
  }, [eleves3e, updateEleve]);

  // ============================================================
  // FILE IMPORT
  // ============================================================

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const rows = await parseOralDNBFile(file);

        const preview = rows.map(row => {
          const eleve = findEleveMatch(row.nom, row.prenom, eleves3e);
          return {
            ...row,
            eleveId: eleve?.id || null,
            matched: !!eleve,
          };
        });

        setImportPreview(preview);
        setShowImport(true);
        setImportDone(false);
      } catch (error) {
        console.error('Error parsing file:', error);
      }
    },
    [eleves3e]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const executeImport = useCallback(async () => {
    setImporting(true);
    let success = 0;
    let skipped = 0;

    for (const item of importPreview) {
      if (item.eleveId && (item.parcours || item.sujet)) {
        await updateEleve(item.eleveId, {
          parcoursOral: item.parcours || undefined,
          sujetOral: item.sujet || undefined,
          matieresOral: item.matieres.length > 0 ? item.matieres : undefined,
          langueEtrangere: item.langue || undefined,
          tiersTemps: item.tiersTemps || undefined,
        });
        success++;
      } else {
        skipped++;
      }
    }

    setImportStats({ success, skipped });
    setImporting(false);
    setImportDone(true);
  }, [importPreview, updateEleve]);

  const resetImport = useCallback(() => {
    setShowImport(false);
    setImportPreview([]);
    setImportDone(false);
    setImportStats({ success: 0, skipped: 0 });
  }, []);

  // Preview stats
  const previewStats = useMemo(() => {
    const total = importPreview.length;
    const matched = importPreview.filter(r => r.matched).length;
    const withData = importPreview.filter(r => r.parcours || r.sujet).length;
    const ready = importPreview.filter(r => r.matched && (r.parcours || r.sujet)).length;
    return { total, matched, withData, ready };
  }, [importPreview]);

  // ============================================================
  // RENDER: IMPORT MODE
  // ============================================================
  if (showImport) {
    if (importDone) {
      return (
        <div className="guided-step step-themes">
          <h1 className="step-title success">Import terminé !</h1>
          <p className="step-subtitle">
            {importStats.success} élève(s) mis à jour
            {importStats.skipped > 0 && `, ${importStats.skipped} ignoré(s)`}.
          </p>
          <div className="step-actions">
            <button className="btn btn-primary btn-large" onClick={resetImport}>
              <Check size={20} />
              Retour à la liste
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="guided-step step-themes">
        <h1 className="step-title">Vérification de l'import</h1>

        <div className="import-stats-bar">
          <div className="import-stat">
            <span className="stat-value">{previewStats.total}</span>
            <span className="stat-label">lignes</span>
          </div>
          <div className="import-stat">
            <span className="stat-value">{previewStats.matched}</span>
            <span className="stat-label">élèves trouvés</span>
          </div>
          <div className="import-stat">
            <span className="stat-value">{previewStats.withData}</span>
            <span className="stat-label">avec données</span>
          </div>
          <div className={clsx('import-stat', previewStats.ready > 0 && 'success')}>
            <span className="stat-value">{previewStats.ready}</span>
            <span className="stat-label">prêts</span>
          </div>
        </div>

        <div className="import-preview-table">
          <div className="preview-header-row oral-preview">
            <span>Élève</span>
            <span>Parcours</span>
            <span>Sujet</span>
            <span>Matière(s)</span>
            <span>Match</span>
          </div>
          <div className="preview-body">
            {importPreview.map((item, i) => (
              <div key={i} className={clsx('preview-row oral-preview', !item.matched && 'no-match')}>
                <span className="preview-cell-name">{item.nom} {item.prenom}</span>
                <span className="preview-cell-parcours">
                  {item.parcours ? (
                    <span className="parcours-badge-small">{item.parcours}</span>
                  ) : '—'}
                </span>
                <span className="preview-cell-sujet">{item.sujet || '—'}</span>
                <span className="preview-cell-matieres">
                  {item.matieres.length > 0 ? item.matieres.join(', ') : '—'}
                </span>
                <span className={clsx('match-badge', item.matched ? 'exact' : 'none')}>
                  {item.matched ? <><Check size={12} /> OK</> : <><X size={12} /> ?</>}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="step-actions">
          <button className="btn btn-secondary" onClick={resetImport}>
            Annuler
          </button>
          <button
            className="btn btn-primary btn-large"
            onClick={executeImport}
            disabled={previewStats.ready === 0 || importing}
          >
            {importing ? 'Import en cours...' : `Importer ${previewStats.ready} sujet(s)`}
            <Check size={20} />
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: MAIN VIEW (tableau éditable)
  // ============================================================
  return (
    <div className="guided-step step-themes">
      <h1 className="step-title">Sujets de l'oral DNB</h1>
      <p className="step-subtitle">
        Attribuez à chaque élève son parcours, sujet et matière(s) pour l'oral.
      </p>

      {/* Stats bar */}
      <div className="themes-stats-bar">
        <div className="themes-stat">
          <BookOpen size={20} />
          <span className="stat-value">{elevesComplete}</span>
          <span className="stat-label">/ {totalEleves} élèves complétés</span>
        </div>
        {elevesComplete === totalEleves && totalEleves > 0 && (
          <span className="all-done-badge">
            <Check size={14} /> Complet
          </span>
        )}
      </div>

      {/* Actions: search + template + import */}
      <div className="themes-actions-bar">
        <div className="themes-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher un élève, parcours, sujet..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
          <Download size={16} />
          Télécharger le template
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleRandomThemes}
          title="DEV: Remplir aléatoirement"
          style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b', fontSize: '0.75rem' }}
        >
          <Shuffle size={16} />
          Random
        </button>
        <div
          className="import-drop-zone-inline"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            hidden
          />
          <Upload size={16} className={clsx(dragActive && 'drag-active')} />
          <span>Importer</span>
        </div>
      </div>

      {/* Students grouped by class */}
      <div className="themes-class-list">
        {filteredGroups.map(([cls, elvs]) => (
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
                {/* Table header */}
                <div className="oral-table-header">
                  <span className="col-name">Élève</span>
                  <span className="col-parcours">Parcours</span>
                  <span className="col-sujet">Sujet</span>
                  <span className="col-matiere">Matière 1</span>
                  <span className="col-matiere">Matière 2</span>
                  <span className="col-langue">Langue</span>
                  <span className="col-tiers" title="Tiers temps">Tiers T.</span>
                  <span className="col-actions"></span>
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
                      {/* Nom */}
                      <span className="col-name student-name">
                        {eleve.nom} {eleve.prenom}
                      </span>

                      {/* Parcours (select) */}
                      <select
                        className={clsx('oral-select', eleve.parcoursOral && 'has-value')}
                        value={eleve.parcoursOral || ''}
                        onChange={e => handleSetParcours(eleve.id!, e.target.value)}
                      >
                        <option value="">--</option>
                        {PARCOURS_ORAL_DNB.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        {/* Afficher la valeur custom si elle n'est pas dans la liste */}
                        {eleve.parcoursOral && !PARCOURS_ORAL_DNB.includes(eleve.parcoursOral as typeof PARCOURS_ORAL_DNB[number]) && (
                          <option value={eleve.parcoursOral}>{eleve.parcoursOral}</option>
                        )}
                      </select>

                      {/* Sujet (click to edit) */}
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

                      {/* Matière 1 */}
                      <select
                        className={clsx('oral-select oral-select-sm', eleve.matieresOral?.[0] && 'has-value')}
                        value={eleve.matieresOral?.[0] || ''}
                        onChange={e => handleSetMatiere(eleve.id!, 0, e.target.value)}
                      >
                        <option value="">--</option>
                        {AVAILABLE_MATIERES.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      {/* Matière 2 */}
                      <select
                        className={clsx('oral-select oral-select-sm', eleve.matieresOral?.[1] && 'has-value')}
                        value={eleve.matieresOral?.[1] || ''}
                        onChange={e => handleSetMatiere(eleve.id!, 1, e.target.value)}
                      >
                        <option value="">--</option>
                        {AVAILABLE_MATIERES.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      {/* Langue étrangère */}
                      <select
                        className={clsx('oral-select oral-select-sm', eleve.langueEtrangere && 'has-value')}
                        value={eleve.langueEtrangere || ''}
                        onChange={e => handleSetLangue(eleve.id!, e.target.value)}
                      >
                        <option value="">--</option>
                        {LANGUES_ETRANGERES.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>

                      {/* Tiers temps */}
                      <label className="col-tiers tiers-checkbox">
                        <input
                          type="checkbox"
                          checked={!!eleve.tiersTemps}
                          onChange={e => handleSetTiersTemps(eleve.id!, e.target.checked)}
                        />
                      </label>

                      {/* Status indicator */}
                      {isComplete && <Check size={14} className="row-check" />}

                      {/* Delete button */}
                      <button
                        className="col-actions delete-eleve-btn"
                        onClick={() => handleDeleteEleve(eleve.id!, `${eleve.nom} ${eleve.prenom}`)}
                        title={`Supprimer ${eleve.nom} ${eleve.prenom}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="no-data-warning">
            {searchFilter
              ? 'Aucun élève ne correspond à votre recherche.'
              : "Aucun élève de 3ème trouvé. Retournez à l'étape précédente pour en importer."}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button className="btn btn-primary btn-large" onClick={onNext}>
          Continuer
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
