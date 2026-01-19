// ============================================================
// COMPONENT - IMPORT MATIÈRES ORAL DNB
// ============================================================

import { useState, useCallback, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  AlertTriangle, 
  Users,
  Search
} from 'lucide-react';
import Papa from 'papaparse';
import { useEleveStore } from '../../stores/eleveStore';
import { MATIERES_HEURES_3E } from '../../domain/models';
import type { Eleve } from '../../domain/models';
import './ImportMatiereOralModal.css';

interface ImportMatiereOralModalProps {
  onClose: () => void;
  matieresAutorisees?: string[];
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing';

interface ParsedRow {
  [key: string]: string;
}

interface MatiereMapping {
  eleveId: string | null;
  nom: string;
  prenom: string;
  matieres: string[];
  matchConfidence: 'exact' | 'partial' | 'none';
  originalRow: ParsedRow;
}

// Matières connues pour la détection automatique
const MATIERES_CONNUES = MATIERES_HEURES_3E.map(m => m.matiere.toLowerCase());

// Aliases pour les matières
const MATIERE_ALIASES: Record<string, string> = {
  'francais': 'Français',
  'français': 'Français',
  'maths': 'Mathématiques',
  'math': 'Mathématiques',
  'mathematiques': 'Mathématiques',
  'mathématiques': 'Mathématiques',
  'histoire': 'Histoire-Géographie-EMC',
  'histoire-geo': 'Histoire-Géographie-EMC',
  'histoire-géo': 'Histoire-Géographie-EMC',
  'hg': 'Histoire-Géographie-EMC',
  'hgemc': 'Histoire-Géographie-EMC',
  'svt': 'SVT',
  'sciences de la vie': 'SVT',
  'physique': 'Physique-Chimie',
  'physique-chimie': 'Physique-Chimie',
  'pc': 'Physique-Chimie',
  'technologie': 'Technologie',
  'techno': 'Technologie',
  'anglais': 'Anglais LV1',
  'lv1': 'Anglais LV1',
  'espagnol': 'Espagnol LV2',
  'allemand': 'Allemand LV2',
  'lv2': 'Espagnol LV2',
  'eps': 'EPS',
  'sport': 'EPS',
  'musique': 'Éducation Musicale',
  'education musicale': 'Éducation Musicale',
  'éducation musicale': 'Éducation Musicale',
  'arts plastiques': 'Arts Plastiques',
  'arts': 'Arts Plastiques',
  'dessin': 'Arts Plastiques',
  'latin': 'Latin (option)',
  'grec': 'Grec (option)',
};

export function ImportMatiereOralModal({ onClose, matieresAutorisees }: ImportMatiereOralModalProps) {
  const eleves = useEleveStore(state => state.eleves);
  const updateEleve = useEleveStore(state => state.updateEleve);
  
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Mapping columns
  const [nomColumn, setNomColumn] = useState<string>('');
  const [prenomColumn, setPrenomColumn] = useState<string>('');
  const [matiereColumns, setMatiereColumns] = useState<string[]>([]);
  const [singleMatiereColumn, setSingleMatiereColumn] = useState<string>('');
  const [importMode, setImportMode] = useState<'columns' | 'single'>('columns');
  
  // Preview data
  const [mappings, setMappings] = useState<MatiereMapping[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [_importing, setImporting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize matière name
  const normalizeMatiere = useCallback((raw: string): string | null => {
    if (!raw || !raw.trim()) return null;
    
    const cleaned = raw.trim().toLowerCase();
    
    // Check aliases first
    if (MATIERE_ALIASES[cleaned]) {
      return MATIERE_ALIASES[cleaned];
    }
    
    // Check if it's a known matière (case-insensitive)
    const found = MATIERES_HEURES_3E.find(
      m => m.matiere.toLowerCase() === cleaned
    );
    if (found) return found.matiere;
    
    // Partial match
    const partial = MATIERES_HEURES_3E.find(
      m => m.matiere.toLowerCase().includes(cleaned) || cleaned.includes(m.matiere.toLowerCase())
    );
    if (partial) return partial.matiere;
    
    // Return original with capitalization if not found
    return raw.trim();
  }, []);

  // Find matching élève
  const findEleveMatch = useCallback((nom: string, prenom: string): { eleve: Eleve | null; confidence: 'exact' | 'partial' | 'none' } => {
    const nomClean = nom.trim().toLowerCase();
    const prenomClean = prenom.trim().toLowerCase();
    
    // Exact match
    const exact = eleves.find(e => 
      e.nom.toLowerCase() === nomClean && 
      e.prenom.toLowerCase() === prenomClean
    );
    if (exact) return { eleve: exact, confidence: 'exact' };
    
    // Partial match (just nom or with accents)
    const partial = eleves.find(e => {
      const eNom = e.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ePrenom = e.prenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const searchNom = nomClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const searchPrenom = prenomClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      return (eNom === searchNom && ePrenom === searchPrenom) ||
             (eNom.includes(searchNom) && ePrenom.includes(searchPrenom));
    });
    if (partial) return { eleve: partial, confidence: 'partial' };
    
    return { eleve: null, confidence: 'none' };
  }, [eleves]);

  // Parse CSV file
  const parseFile = useCallback(async (selectedFile: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          const data = results.data as ParsedRow[];
          if (data.length > 0) {
            const hdrs = Object.keys(data[0]);
            setHeaders(hdrs);
            setRows(data);
            
            // Auto-detect columns
            autoDetectColumns(hdrs);
            resolve();
          } else {
            reject(new Error('Fichier vide'));
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }, []);

  // Auto-detect column mappings
  const autoDetectColumns = useCallback((hdrs: string[]) => {
    const nomCandidates = ['nom', 'élève', 'eleve', 'nom élève', 'nom eleve', 'name', 'lastname'];
    const prenomCandidates = ['prénom', 'prenom', 'firstname', 'prénom élève'];
    const matiereCandidates = ['matière', 'matiere', 'sujet', 'thème', 'theme', 'discipline', 'oral'];
    
    for (const h of hdrs) {
      const hLower = h.toLowerCase();
      
      if (nomCandidates.some(c => hLower.includes(c))) {
        setNomColumn(h);
      }
      if (prenomCandidates.some(c => hLower.includes(c))) {
        setPrenomColumn(h);
      }
      if (matiereCandidates.some(c => hLower.includes(c))) {
        setSingleMatiereColumn(h);
        setImportMode('single');
      }
    }
    
    // Detect matière columns (when column name is a matière)
    const detectedMatieres: string[] = [];
    for (const h of hdrs) {
      const hLower = h.toLowerCase();
      if (MATIERES_CONNUES.some(m => hLower.includes(m)) || MATIERE_ALIASES[hLower]) {
        detectedMatieres.push(h);
      }
    }
    if (detectedMatieres.length > 0) {
      setMatiereColumns(detectedMatieres);
      setImportMode('columns');
    }
  }, []);

  // Handle file selection
  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setErrors([]);
    setWarnings([]);
    
    try {
      await parseFile(selectedFile);
      setStep('mapping');
    } catch (error) {
      setErrors([`Erreur lors de la lecture du fichier: ${error}`]);
    }
  }, [parseFile]);

  // File input handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv')) {
      handleFile(droppedFile);
    } else {
      setErrors(['Veuillez sélectionner un fichier CSV']);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  // Generate preview mappings
  const generateMappings = useCallback(() => {
    const newMappings: MatiereMapping[] = [];
    const newWarnings: string[] = [];
    
    for (const row of rows) {
      const nom = row[nomColumn] || '';
      const prenom = row[prenomColumn] || '';
      
      if (!nom && !prenom) continue;
      
      // Extract matières
      let matieres: string[] = [];
      
      if (importMode === 'single' && singleMatiereColumn) {
        const raw = row[singleMatiereColumn];
        if (raw) {
          // Split by comma, semicolon, or "et"
          const parts = raw.split(/[,;]|\s+et\s+/i);
          for (const part of parts) {
            const normalized = normalizeMatiere(part);
            if (normalized) matieres.push(normalized);
          }
        }
      } else {
        // Check each matière column
        for (const col of matiereColumns) {
          const value = row[col];
          if (value && value.trim() && value.toLowerCase() !== 'non' && value !== '0') {
            const normalized = normalizeMatiere(col) || normalizeMatiere(value);
            if (normalized) matieres.push(normalized);
          }
        }
      }
      
      // Filter by authorized matières if specified
      if (matieresAutorisees && matieresAutorisees.length > 0) {
        const filtered = matieres.filter(m => matieresAutorisees.includes(m));
        if (filtered.length < matieres.length) {
          newWarnings.push(`${prenom} ${nom}: certaines matières non autorisées ignorées`);
        }
        matieres = filtered;
      }
      
      // Remove duplicates
      matieres = [...new Set(matieres)];
      
      // Find matching élève
      const { eleve, confidence } = findEleveMatch(nom, prenom);
      
      if (!eleve) {
        newWarnings.push(`${prenom} ${nom}: élève non trouvé dans la base`);
      }
      
      newMappings.push({
        eleveId: eleve?.id || null,
        nom,
        prenom,
        matieres,
        matchConfidence: confidence,
        originalRow: row,
      });
    }
    
    setMappings(newMappings);
    setWarnings(newWarnings);
  }, [rows, nomColumn, prenomColumn, importMode, singleMatiereColumn, matiereColumns, normalizeMatiere, findEleveMatch, matieresAutorisees]);

  // Go to preview step
  const handleGoToPreview = useCallback(() => {
    if (!nomColumn || !prenomColumn) {
      setErrors(['Veuillez sélectionner les colonnes Nom et Prénom']);
      return;
    }
    if (importMode === 'single' && !singleMatiereColumn) {
      setErrors(['Veuillez sélectionner la colonne contenant les matières']);
      return;
    }
    if (importMode === 'columns' && matiereColumns.length === 0) {
      setErrors(['Veuillez sélectionner au moins une colonne matière']);
      return;
    }
    
    setErrors([]);
    generateMappings();
    setStep('preview');
  }, [nomColumn, prenomColumn, importMode, singleMatiereColumn, matiereColumns, generateMappings]);

  // Execute import
  const executeImport = useCallback(async () => {
    setImporting(true);
    setStep('importing');
    
    try {
      let successCount = 0;
      let skipCount = 0;
      const errorMessages: string[] = [];
      
      for (const mapping of mappings) {
        if (mapping.eleveId && mapping.matieres.length > 0) {
          const eleve = eleves.find(e => e.id === mapping.eleveId);
          if (eleve) {
            try {
              await updateEleve(mapping.eleveId, {
                matieresOral: mapping.matieres,
              });
              successCount++;
            } catch (err) {
              errorMessages.push(`Erreur pour ${mapping.prenom} ${mapping.nom}`);
            }
          }
        } else {
          skipCount++;
        }
      }
      
      // Show success message
      const message = successCount > 0 
        ? `✅ ${successCount} élève(s) ont reçu leur matière${skipCount > 0 ? ` (${skipCount} non traité(s))` : ''}`
        : '⚠️ Aucun élève n\'a pu être mis à jour';
      
      alert(message);
      
      // Close after success
      setTimeout(() => {
        onClose();
      }, 500);
      
    } catch (error) {
      setErrors([`Erreur lors de l'import: ${error}`]);
      setStep('preview');
    } finally {
      setImporting(false);
    }
  }, [mappings, eleves, updateEleve, onClose]);

  // Stats
  const stats = useMemo(() => {
    const total = mappings.length;
    const matched = mappings.filter(m => m.eleveId).length;
    const withMatieres = mappings.filter(m => m.matieres.length > 0).length;
    const ready = mappings.filter(m => m.eleveId && m.matieres.length > 0).length;
    
    return { total, matched, withMatieres, ready };
  }, [mappings]);

  // Filtered mappings for display
  const filteredMappings = useMemo(() => {
    if (!searchFilter) return mappings;
    const lower = searchFilter.toLowerCase();
    return mappings.filter(m => 
      m.nom.toLowerCase().includes(lower) || 
      m.prenom.toLowerCase().includes(lower) ||
      m.matieres.some(mat => mat.toLowerCase().includes(lower))
    );
  }, [mappings, searchFilter]);

  // Toggle matière column
  const toggleMatiereColumn = (col: string) => {
    setMatiereColumns(prev => 
      prev.includes(col) 
        ? prev.filter(c => c !== col)
        : [...prev, col]
    );
  };

  return (
    <div className="import-matiere-overlay" onClick={onClose}>
      <div className="import-matiere-wizard" onClick={e => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Importer les matières Oral DNB</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="wizard-steps">
          <div className={`step-indicator ${step === 'upload' ? 'active' : ''} ${['mapping', 'preview', 'importing'].includes(step) ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Fichier</span>
          </div>
          <div className={`step-indicator ${step === 'mapping' ? 'active' : ''} ${['preview', 'importing'].includes(step) ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Colonnes</span>
          </div>
          <div className={`step-indicator ${step === 'preview' ? 'active' : ''} ${step === 'importing' ? 'completed' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Aperçu</span>
          </div>
        </div>

        <div className="wizard-content">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div 
              className={`upload-zone ${dragActive ? 'active' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} />
              <h3>Glissez votre fichier CSV ici</h3>
              <p>ou cliquez pour sélectionner</p>
              <div className="supported-formats">
                <span>Formats supportés : CSV (séparateur ; ou ,)</span>
                <span>Encodage : UTF-8 avec ou sans BOM</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && (
            <div className="mapping-step">
              <div className="file-info">
                <FileSpreadsheet size={20} />
                <span>{file?.name}</span>
                <span className="row-count">{rows.length} lignes</span>
              </div>

              <div className="mapping-section">
                <h4>Colonnes d'identification</h4>
                <div className="mapping-row">
                  <label>Colonne Nom :</label>
                  <select value={nomColumn} onChange={e => setNomColumn(e.target.value)}>
                    <option value="">-- Sélectionner --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div className="mapping-row">
                  <label>Colonne Prénom :</label>
                  <select value={prenomColumn} onChange={e => setPrenomColumn(e.target.value)}>
                    <option value="">-- Sélectionner --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mapping-section">
                <h4>Mode d'import des matières</h4>
                <div className="import-mode-selector">
                  <label className={`mode-option ${importMode === 'single' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      checked={importMode === 'single'}
                      onChange={() => setImportMode('single')}
                    />
                    <span className="mode-title">Colonne unique</span>
                    <span className="mode-desc">Les matières sont dans une seule colonne (séparées par virgule)</span>
                  </label>
                  <label className={`mode-option ${importMode === 'columns' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      checked={importMode === 'columns'}
                      onChange={() => setImportMode('columns')}
                    />
                    <span className="mode-title">Colonnes multiples</span>
                    <span className="mode-desc">Chaque matière a sa propre colonne (oui/non ou valeur)</span>
                  </label>
                </div>
              </div>

              {importMode === 'single' && (
                <div className="mapping-section">
                  <h4>Colonne matière</h4>
                  <div className="mapping-row">
                    <label>Colonne contenant les matières :</label>
                    <select value={singleMatiereColumn} onChange={e => setSingleMatiereColumn(e.target.value)}>
                      <option value="">-- Sélectionner --</option>
                      {headers.filter(h => h !== nomColumn && h !== prenomColumn).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {importMode === 'columns' && (
                <div className="mapping-section">
                  <h4>Colonnes matières</h4>
                  <p className="section-hint">Sélectionnez les colonnes correspondant à des matières</p>
                  <div className="matiere-columns-grid">
                    {headers.filter(h => h !== nomColumn && h !== prenomColumn).map(h => (
                      <label key={h} className={`matiere-column-option ${matiereColumns.includes(h) ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={matiereColumns.includes(h)}
                          onChange={() => toggleMatiereColumn(h)}
                        />
                        <span>{h}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {errors.length > 0 && (
                <div className="errors-box">
                  {errors.map((err, i) => (
                    <div key={i} className="error-item">
                      <AlertTriangle size={14} />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="preview-step">
              <div className="preview-stats">
                <div className="stat-item">
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">Lignes</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.matched}</span>
                  <span className="stat-label">Élèves trouvés</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.withMatieres}</span>
                  <span className="stat-label">Avec matières</span>
                </div>
                <div className="stat-item success">
                  <span className="stat-value">{stats.ready}</span>
                  <span className="stat-label">Prêts à importer</span>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="warnings-box">
                  <div className="warnings-header">
                    <AlertTriangle size={16} />
                    <span>{warnings.length} avertissement(s)</span>
                  </div>
                  <div className="warnings-list">
                    {warnings.slice(0, 5).map((w, i) => (
                      <div key={i} className="warning-item">{w}</div>
                    ))}
                    {warnings.length > 5 && (
                      <div className="warning-more">...et {warnings.length - 5} autres</div>
                    )}
                  </div>
                </div>
              )}

              <div className="preview-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un élève..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                />
              </div>

              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Élève</th>
                      <th>Correspondance</th>
                      <th>Matières</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMappings.map((mapping, i) => (
                      <tr key={i} className={mapping.matchConfidence === 'none' ? 'no-match' : ''}>
                        <td>
                          <div className="eleve-cell">
                            <span className="eleve-name">{mapping.prenom} {mapping.nom}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`match-badge ${mapping.matchConfidence}`}>
                            {mapping.matchConfidence === 'exact' && <><Check size={12} /> Exact</>}
                            {mapping.matchConfidence === 'partial' && <><AlertTriangle size={12} /> Partiel</>}
                            {mapping.matchConfidence === 'none' && <><X size={12} /> Non trouvé</>}
                          </span>
                        </td>
                        <td>
                          <div className="matieres-cell">
                            {mapping.matieres.length > 0 ? (
                              mapping.matieres.map((m, j) => (
                                <span key={j} className="matiere-badge">{m}</span>
                              ))
                            ) : (
                              <span className="no-matiere">Aucune matière</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="importing-step">
              <div className="importing-animation">
                <Users size={48} />
                <div className="progress-bar">
                  <div className="progress-fill" />
                </div>
                <p>Import en cours...</p>
                <span>{stats.ready} élève(s) mis à jour</span>
              </div>
            </div>
          )}
        </div>

        <div className="wizard-footer">
          {step === 'upload' && (
            <button className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
          )}

          {step === 'mapping' && (
            <>
              <button className="btn-secondary" onClick={() => setStep('upload')}>
                <ChevronLeft size={16} />
                Retour
              </button>
              <button className="btn-primary" onClick={handleGoToPreview}>
                Aperçu
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button className="btn-secondary" onClick={() => setStep('mapping')}>
                <ChevronLeft size={16} />
                Retour
              </button>
              <button 
                className="btn-primary" 
                onClick={executeImport}
                disabled={stats.ready === 0}
              >
                <Check size={16} />
                Importer {stats.ready} élève(s)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
