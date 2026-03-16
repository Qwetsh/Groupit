// ============================================================
// GUIDED STEP - THEMES / MATIERES ORAL DNB
// ============================================================

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Check,
  ChevronRight,
  ChevronDown,
  Search,
  BookOpen,
  AlertTriangle,
  X,
  Shuffle,
} from 'lucide-react';
import clsx from 'clsx';
import Papa from 'papaparse';
import { useEleveStore } from '../../../stores/eleveStore';
import { MATIERES_HEURES_3E } from '../../../domain/models';
import type { Eleve } from '../../../domain/models';
import '../GuidedMode.css';

interface StepThemesElevesProps {
  onNext: () => void;
  onBack: () => void;
}

// For now themes = matières. Later this will be a proper Theme model
// with associated matières (e.g. "Histoire de l'art" -> ["Arts Plastiques", "Histoire-Géographie"])
const AVAILABLE_THEMES = MATIERES_HEURES_3E.map(m => m.matiere);

// Aliases for smart CSV import
const MATIERE_ALIASES: Record<string, string> = {
  'francais': 'Français',
  'français': 'Français',
  'maths': 'Mathématiques',
  'math': 'Mathématiques',
  'mathematiques': 'Mathématiques',
  'mathématiques': 'Mathématiques',
  'histoire': 'Histoire-Géographie',
  'histoire-geo': 'Histoire-Géographie',
  'histoire-géo': 'Histoire-Géographie',
  'histoire geo': 'Histoire-Géographie',
  'histoire géo': 'Histoire-Géographie',
  'hg': 'Histoire-Géographie',
  'hgemc': 'Histoire-Géographie',
  'svt': 'SVT',
  'sciences de la vie': 'SVT',
  'physique': 'Physique-Chimie',
  'physique-chimie': 'Physique-Chimie',
  'physique chimie': 'Physique-Chimie',
  'pc': 'Physique-Chimie',
  'technologie': 'Technologie',
  'techno': 'Technologie',
  'anglais': 'Anglais',
  'espagnol': 'Espagnol',
  'allemand': 'Allemand',
  'italien': 'Italien',
  'eps': 'EPS',
  'sport': 'EPS',
  'musique': 'Éducation Musicale',
  'education musicale': 'Éducation Musicale',
  'éducation musicale': 'Éducation Musicale',
  'arts plastiques': 'Arts Plastiques',
  'arts': 'Arts Plastiques',
  'dessin': 'Arts Plastiques',
  'latin': 'Latin',
  'grec': 'Grec',
  'emc': 'EMC',
  'lv2': 'LV2',
};

function normalizeTheme(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().toLowerCase();

  // Check aliases
  if (MATIERE_ALIASES[cleaned]) return MATIERE_ALIASES[cleaned];

  // Exact match (case-insensitive)
  const exact = AVAILABLE_THEMES.find(t => t.toLowerCase() === cleaned);
  if (exact) return exact;

  // Partial match
  const partial = AVAILABLE_THEMES.find(
    t => t.toLowerCase().includes(cleaned) || cleaned.includes(t.toLowerCase())
  );
  if (partial) return partial;

  // Return as-is with capitalization (custom theme)
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
}

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findEleveMatch(
  nom: string,
  prenom: string,
  eleves: Eleve[]
): { eleve: Eleve | null; confidence: 'exact' | 'partial' | 'none' } {
  const nomClean = nom.trim().toLowerCase();
  const prenomClean = prenom.trim().toLowerCase();

  // Exact match
  const exact = eleves.find(
    e => e.nom.toLowerCase() === nomClean && e.prenom.toLowerCase() === prenomClean
  );
  if (exact) return { eleve: exact, confidence: 'exact' };

  // Match without accents
  const nomNoAccent = removeAccents(nomClean);
  const prenomNoAccent = removeAccents(prenomClean);
  const partial = eleves.find(e => {
    const eNom = removeAccents(e.nom.toLowerCase());
    const ePrenom = removeAccents(e.prenom.toLowerCase());
    return (
      (eNom === nomNoAccent && ePrenom === prenomNoAccent) ||
      (eNom.includes(nomNoAccent) && ePrenom.includes(prenomNoAccent))
    );
  });
  if (partial) return { eleve: partial, confidence: 'partial' };

  // Try nom only (for common cases where prénom is in the same column)
  const nomOnly = eleves.find(e => {
    const fullName = removeAccents(`${e.nom} ${e.prenom}`.toLowerCase());
    const fullSearch = removeAccents(`${nomClean} ${prenomClean}`);
    return fullName === fullSearch || fullName.includes(fullSearch) || fullSearch.includes(fullName);
  });
  if (nomOnly) return { eleve: nomOnly, confidence: 'partial' };

  return { eleve: null, confidence: 'none' };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StepThemesEleves({ onNext, onBack }: StepThemesElevesProps) {
  const eleves = useEleveStore(state => state.eleves);
  const updateEleve = useEleveStore(state => state.updateEleve);

  const [searchFilter, setSearchFilter] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [dragActive, setDragActive] = useState(false);

  // Import state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [nomColumn, setNomColumn] = useState('');
  const [prenomColumn, setPrenomColumn] = useState('');
  const [themeColumn, setThemeColumn] = useState('');
  const [importPreview, setImportPreview] = useState<
    Array<{
      nom: string;
      prenom: string;
      theme: string | null;
      eleveId: string | null;
      confidence: 'exact' | 'partial' | 'none';
    }>
  >([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importStats, setImportStats] = useState({ success: 0, skipped: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter 3ème students
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
    // Sort classes
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [eleves3e]);

  // Auto-expand all classes initially
  useMemo(() => {
    if (expandedClasses.size === 0 && classeGroups.length > 0) {
      setExpandedClasses(new Set(classeGroups.map(([cls]) => cls)));
    }
  }, [classeGroups.length]);

  // Stats
  const totalEleves = eleves3e.length;
  const elevesWithTheme = eleves3e.filter(e => e.matieresOral && e.matieresOral.length > 0).length;

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

  // DEV: assign random themes to all students without one
  const handleRandomThemes = useCallback(async () => {
    for (const eleve of eleves3e) {
      if (!eleve.matieresOral?.length) {
        const randomTheme = AVAILABLE_THEMES[Math.floor(Math.random() * AVAILABLE_THEMES.length)];
        await updateEleve(eleve.id!, { matieresOral: [randomTheme] });
      }
    }
  }, [eleves3e, updateEleve]);

  // Set theme for an eleve
  const handleSetTheme = useCallback(
    async (eleveId: string, theme: string) => {
      if (theme === '') {
        await updateEleve(eleveId, { matieresOral: [] });
      } else {
        await updateEleve(eleveId, { matieresOral: [theme] });
      }
    },
    [updateEleve]
  );

  // ============================================================
  // CSV IMPORT
  // ============================================================

  const handleFile = useCallback(
    async (file: File) => {
      return new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          complete: results => {
            const data = results.data as Record<string, string>[];
            if (data.length > 0) {
              const hdrs = Object.keys(data[0]);
              setCsvHeaders(hdrs);
              setCsvRows(data);

              // Auto-detect columns
              const nomCandidates = ['nom', 'élève', 'eleve', 'nom élève', 'nom eleve', 'name', 'lastname', 'nom de famille'];
              const prenomCandidates = ['prénom', 'prenom', 'firstname'];
              const themeCandidates = ['matière', 'matiere', 'sujet', 'thème', 'theme', 'discipline', 'oral', 'matière oral', 'sujet oral'];

              for (const h of hdrs) {
                const hLower = h.toLowerCase();
                if (nomCandidates.some(c => hLower.includes(c)) && !nomColumn) setNomColumn(h);
                if (prenomCandidates.some(c => hLower.includes(c)) && !prenomColumn) setPrenomColumn(h);
                if (themeCandidates.some(c => hLower.includes(c)) && !themeColumn) setThemeColumn(h);
              }

              setImportStep('mapping');
              resolve();
            } else {
              reject(new Error('Fichier vide'));
            }
          },
          error: err => reject(err),
        });
      });
    },
    [nomColumn, prenomColumn, themeColumn]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const generatePreview = useCallback(() => {
    const preview = csvRows.map(row => {
      const nom = row[nomColumn] || '';
      const prenom = row[prenomColumn] || '';
      const rawTheme = row[themeColumn] || '';

      const theme = normalizeTheme(rawTheme);
      const { eleve, confidence } = findEleveMatch(nom, prenom, eleves3e);

      return {
        nom,
        prenom,
        theme,
        eleveId: eleve?.id || null,
        confidence,
      };
    }).filter(r => r.nom || r.prenom);

    setImportPreview(preview);
    setImportStep('preview');
  }, [csvRows, nomColumn, prenomColumn, themeColumn, eleves3e]);

  const executeImport = useCallback(async () => {
    setImporting(true);
    let success = 0;
    let skipped = 0;

    for (const item of importPreview) {
      if (item.eleveId && item.theme) {
        await updateEleve(item.eleveId, { matieresOral: [item.theme] });
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
    setImportStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setNomColumn('');
    setPrenomColumn('');
    setThemeColumn('');
    setImportPreview([]);
    setImportDone(false);
    setImportStats({ success: 0, skipped: 0 });
  }, []);

  // Preview stats
  const previewStats = useMemo(() => {
    const total = importPreview.length;
    const matched = importPreview.filter(r => r.eleveId).length;
    const withTheme = importPreview.filter(r => r.theme).length;
    const ready = importPreview.filter(r => r.eleveId && r.theme).length;
    return { total, matched, withTheme, ready };
  }, [importPreview]);

  // ============================================================
  // RENDER: IMPORT MODE
  // ============================================================
  if (showImport) {
    // Import done
    if (importDone) {
      return (
        <div className="guided-step step-themes">
          <h1 className="step-title success">Import termine !</h1>
          <p className="step-subtitle">
            {importStats.success} eleve(s) mis a jour
            {importStats.skipped > 0 && `, ${importStats.skipped} ignore(s)`}.
          </p>
          <div className="step-actions">
            <button className="btn btn-primary btn-large" onClick={resetImport}>
              <Check size={20} />
              Retour a la liste
            </button>
          </div>
        </div>
      );
    }

    // Upload step
    if (importStep === 'upload') {
      return (
        <div className="guided-step step-themes">
          <h1 className="step-title">Importer les themes</h1>
          <p className="step-subtitle">
            Importez un fichier CSV contenant les noms des eleves et leur theme/matiere d'oral.
          </p>

          <div
            className={clsx('upload-zone-guided', dragActive && 'active')}
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
            <Upload size={40} />
            <h3>Glissez votre fichier ici</h3>
            <p>ou cliquez pour selectionner</p>
            <span className="format-hint">CSV, Excel (.xlsx, .xls)</span>
          </div>

          <div className="import-help-box">
            <h4>Format attendu</h4>
            <p>Votre fichier doit contenir au minimum :</p>
            <ul>
              <li>Une colonne <strong>Nom</strong> de l'eleve</li>
              <li>Une colonne <strong>Prenom</strong> de l'eleve</li>
              <li>Une colonne <strong>Theme/Matiere</strong> choisi(e)</li>
            </ul>
            <p className="import-help-note">
              Les noms d'eleves seront automatiquement associes a ceux deja importes,
              meme en cas de differences d'accents ou de casse.
            </p>
          </div>

          <div className="step-actions">
            <button className="btn btn-secondary" onClick={resetImport}>
              Annuler
            </button>
          </div>
        </div>
      );
    }

    // Mapping step
    if (importStep === 'mapping') {
      return (
        <div className="guided-step step-themes">
          <h1 className="step-title">Configuration des colonnes</h1>
          <p className="step-subtitle">
            {csvRows.length} lignes detectees. Associez les colonnes a leurs champs.
          </p>

          <div className="config-form">
            <div className="form-group">
              <label>Colonne Nom</label>
              <select
                className="form-input"
                value={nomColumn}
                onChange={e => setNomColumn(e.target.value)}
              >
                <option value="">-- Selectionner --</option>
                {csvHeaders.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Colonne Prenom</label>
              <select
                className="form-input"
                value={prenomColumn}
                onChange={e => setPrenomColumn(e.target.value)}
              >
                <option value="">-- Selectionner --</option>
                {csvHeaders.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Colonne Theme / Matiere</label>
              <select
                className="form-input"
                value={themeColumn}
                onChange={e => setThemeColumn(e.target.value)}
              >
                <option value="">-- Selectionner --</option>
                {csvHeaders.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview of first rows */}
          {nomColumn && prenomColumn && themeColumn && (
            <div className="import-preview-sample">
              <h4>Apercu des premieres lignes</h4>
              <div className="preview-sample-list">
                {csvRows.slice(0, 3).map((row, i) => (
                  <div key={i} className="preview-sample-row">
                    <span className="sample-name">{row[prenomColumn]} {row[nomColumn]}</span>
                    <span className="sample-arrow">→</span>
                    <span className="sample-theme">{normalizeTheme(row[themeColumn]) || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setImportStep('upload')}>
              Retour
            </button>
            <button
              className="btn btn-primary btn-large"
              onClick={generatePreview}
              disabled={!nomColumn || !prenomColumn || !themeColumn}
            >
              Apercu
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      );
    }

    // Preview step
    return (
      <div className="guided-step step-themes">
        <h1 className="step-title">Verification de l'import</h1>

        <div className="import-stats-bar">
          <div className="import-stat">
            <span className="stat-value">{previewStats.total}</span>
            <span className="stat-label">lignes</span>
          </div>
          <div className="import-stat">
            <span className="stat-value">{previewStats.matched}</span>
            <span className="stat-label">eleves trouves</span>
          </div>
          <div className="import-stat">
            <span className="stat-value">{previewStats.withTheme}</span>
            <span className="stat-label">avec theme</span>
          </div>
          <div className={clsx('import-stat', previewStats.ready > 0 && 'success')}>
            <span className="stat-value">{previewStats.ready}</span>
            <span className="stat-label">prets</span>
          </div>
        </div>

        <div className="import-preview-table">
          <div className="preview-header-row">
            <span>Eleve (fichier)</span>
            <span>Correspondance</span>
            <span>Theme</span>
          </div>
          <div className="preview-body">
            {importPreview.map((item, i) => (
              <div key={i} className={clsx('preview-row', item.confidence === 'none' && 'no-match')}>
                <span className="preview-cell-name">{item.prenom} {item.nom}</span>
                <span className={clsx('match-badge', item.confidence)}>
                  {item.confidence === 'exact' && <><Check size={12} /> Exact</>}
                  {item.confidence === 'partial' && <><AlertTriangle size={12} /> Partiel</>}
                  {item.confidence === 'none' && <><X size={12} /> Non trouve</>}
                </span>
                <span className="preview-cell-theme">
                  {item.theme ? (
                    <span className="theme-badge-small">{item.theme}</span>
                  ) : (
                    <span className="no-theme">—</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="step-actions">
          <button className="btn btn-secondary" onClick={() => setImportStep('mapping')}>
            Retour
          </button>
          <button
            className="btn btn-primary btn-large"
            onClick={executeImport}
            disabled={previewStats.ready === 0 || importing}
          >
            {importing ? 'Import en cours...' : `Importer ${previewStats.ready} theme(s)`}
            <Check size={20} />
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: MANUAL MODE (default view)
  // ============================================================
  return (
    <div className="guided-step step-themes">
      <h1 className="step-title">Themes de l'oral</h1>
      <p className="step-subtitle">
        Attribuez a chaque eleve son theme ou sa matiere pour l'oral du DNB.
      </p>

      {/* Stats bar */}
      <div className="themes-stats-bar">
        <div className="themes-stat">
          <BookOpen size={20} />
          <span className="stat-value">{elevesWithTheme}</span>
          <span className="stat-label">/ {totalEleves} eleves avec un theme</span>
        </div>
        {elevesWithTheme === totalEleves && totalEleves > 0 && (
          <span className="all-done-badge">
            <Check size={14} /> Complet
          </span>
        )}
      </div>

      {/* Actions: search + import */}
      <div className="themes-actions-bar">
        <div className="themes-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Rechercher un eleve..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
          <FileSpreadsheet size={16} />
          Importer un fichier
        </button>
        <button
          className="btn btn-secondary dev-random-btn"
          onClick={handleRandomThemes}
          title="DEV: Attribuer des themes aleatoires"
        >
          <Shuffle size={16} />
          Random
        </button>
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
                {elvs.filter(e => e.matieresOral?.length).length}/{elvs.length}
              </span>
            </button>

            {expandedClasses.has(cls) && (
              <div className="class-students">
                {elvs.map(eleve => (
                  <div key={eleve.id} className="student-theme-row">
                    <span className="student-name">
                      {eleve.nom} {eleve.prenom}
                    </span>
                    <select
                      className={clsx(
                        'theme-select',
                        eleve.matieresOral?.length && 'has-theme'
                      )}
                      value={eleve.matieresOral?.[0] || ''}
                      onChange={e => handleSetTheme(eleve.id!, e.target.value)}
                    >
                      <option value="">-- Choisir un theme --</option>
                      {AVAILABLE_THEMES.map(theme => (
                        <option key={theme} value={theme}>
                          {theme}
                        </option>
                      ))}
                    </select>
                    {eleve.matieresOral?.length ? (
                      <Check size={16} className="theme-check" />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="no-data-warning">
            {searchFilter
              ? 'Aucun eleve ne correspond a votre recherche.'
              : 'Aucun eleve de 3eme trouve. Retournez a l\'etape precedente pour en importer.'}
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
          onClick={onNext}
        >
          Continuer
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
