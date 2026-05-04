// ============================================================
// COMPONENT - IMPORT CSV WIZARD
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, ChevronRight, ChevronLeft, Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import type { Eleve, ColumnMapping } from '../../domain/models';
import {
  parseCSVFile,
  generateAutoMapping,
  importElevesFromCSV,
  extractClassFromFilename,
  type ParsedCSVData,
} from '../../infrastructure/import';
import { ProgressIndicator, MultiStepProgress, type ProgressStep } from '../ui/ProgressIndicator';
import './ImportWizard.css';

interface ImportWizardProps {
  onImport: (eleves: Partial<Eleve>[]) => Promise<void>;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'classe' | 'preview' | 'importing';

const ELEVE_FIELDS: { key: keyof Eleve; label: string }[] = [
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'classe', label: 'Classe' },
  { key: 'dateNaissance', label: 'Date de naissance' },
  { key: 'sexe', label: 'Sexe' },
  { key: 'email', label: 'Email' },
  { key: 'regime', label: 'Régime' },
];

export function ImportWizard({ onImport, onClose }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSVData | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [classe, setClasse] = useState('');
  const [suggestedClasse, setSuggestedClasse] = useState<string | null>(null);
  const [previewEleves, setPreviewEleves] = useState<Partial<Eleve>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [lastMappings, setLastMappings] = useState<ColumnMapping[] | null>(null);
  const [lastHeaders, setLastHeaders] = useState<string[] | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Détecter si la colonne "Classe" est mappée dans le CSV
  const hasClasseColumn = mappings.some(m => m.targetField === 'classe');

  // Handle file selection
  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setErrors([]);
    setWarnings([]);

    try {
      // Extract class from filename
      const extracted = extractClassFromFilename(selectedFile.name);
      if (extracted) {
        setSuggestedClasse(extracted);
        setClasse(extracted);
      }

      // Parse CSV
      const data = await parseCSVFile(selectedFile);
      setParsedData(data);

      // Reuse last mapping if headers match
      const headersKey = [...data.headers].sort().join('|');
      const lastKey = lastHeaders ? [...lastHeaders].sort().join('|') : null;
      if (lastMappings && lastKey === headersKey) {
        setMappings(lastMappings);
      } else {
        const autoMappings = generateAutoMapping(data.headers);
        setMappings(autoMappings);
      }

      // Go to mapping step
      setStep('mapping');
    } catch (error) {
      setErrors([`Erreur lors de la lecture du fichier: ${error}`]);
    }
  }, [lastMappings, lastHeaders]);

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i];
        const ext = f.name.toLowerCase();
        if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
          validFiles.push(f);
        }
      }
      if (validFiles.length > 0) {
        handleFile(validFiles[0]);
        if (validFiles.length > 1) {
          setPendingFiles(prev => [...prev, ...validFiles.slice(1)]);
        }
      } else {
        setErrors(['Veuillez sélectionner un fichier CSV ou Excel']);
      }
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      handleFile(files[0]);
      if (files.length > 1) {
        setPendingFiles(prev => [...prev, ...files.slice(1)]);
      }
    }
  }, [handleFile]);

  // Update mapping
  const updateMapping = useCallback((csvHeader: string, targetField: keyof Eleve | null) => {
    setMappings(prev => prev.map(m => 
      m.csvHeader === csvHeader 
        ? { ...m, targetField, isIgnored: targetField === null }
        : m
    ));
  }, []);

  // Process import
  const processImport = useCallback(() => {
    if (!parsedData) return;
    
    const result = importElevesFromCSV(parsedData, mappings, classe);
    setPreviewEleves(result.eleves);
    setErrors(result.errors);
    setWarnings(result.warnings);
    setStep('preview');
  }, [parsedData, mappings, classe]);

  // Final import
  const finalImport = useCallback(async () => {
    setStep('importing');

    try {
      // Save mapping for reuse
      if (parsedData) {
        setLastMappings(mappings);
        setLastHeaders(parsedData.headers);
      }

      await onImport(previewEleves);
      setImportedCount(prev => prev + 1);

      if (pendingFiles.length > 0) {
        // Process next file
        const [next, ...rest] = pendingFiles;
        setPendingFiles(rest);
        setPreviewEleves([]);
        setErrors([]);
        setWarnings([]);
        setClasse('');
        handleFile(next);
      } else {
        onClose();
      }
    } catch (error) {
      setErrors([`Erreur lors de l'import: ${error}`]);
      setStep('preview');
    }
  }, [previewEleves, onImport, onClose, pendingFiles, parsedData, mappings, handleFile]);

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return (
          <div
            className={clsx('upload-zone', dragActive && 'active')}
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
              multiple
              onChange={handleFileInput}
              hidden
            />
            <Upload size={48} />
            <h3>Glissez vos fichiers ici</h3>
            <p>ou cliquez pour sélectionner (multi-fichiers supporté)</p>
            <div className="supported-formats">
              <span>Formats supportés : CSV (séparateur ; ou ,)</span>
              <span>Encodage : UTF-8 avec ou sans BOM</span>
            </div>
          </div>
        );

      case 'mapping':
        return (
          <div className="mapping-step">
            <div className="mapping-info">
              <FileSpreadsheet size={20} />
              <div>
                <strong>{file?.name}</strong>
                <span>{parsedData?.rows.length} lignes détectées • Séparateur: "{parsedData?.separator}"</span>
              </div>
            </div>
            
            <h4>Associez les colonnes du fichier aux champs élève</h4>
            
            <div className="mapping-list">
              {mappings.filter(m => !m.isIgnored || m.csvHeader).map(mapping => (
                <div key={mapping.csvHeader} className="mapping-row">
                  <div className="csv-header">
                    <span className="header-name">{mapping.csvHeader}</span>
                    <span className="header-sample">
                      Ex: {parsedData?.rows[0]?.[mapping.csvHeader] || '-'}
                    </span>
                  </div>
                  
                  <ChevronRight size={16} />
                  
                  <select
                    value={mapping.targetField || ''}
                    onChange={(e) => updateMapping(
                      mapping.csvHeader,
                      e.target.value as keyof Eleve || null
                    )}
                    className={clsx(mapping.targetField && 'mapped')}
                  >
                    <option value="">-- Ignorer --</option>
                    {ELEVE_FIELDS.map(f => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                  
                  {mapping.targetField && <Check size={16} className="check-icon" />}
                </div>
              ))}
            </div>
          </div>
        );

      case 'classe':
        return (
          <div className="classe-step">
            <h4>Quelle classe pour ces élèves ?</h4>
            <p>Le fichier importé ne contient pas de colonne "classe". Veuillez indiquer la classe commune.</p>
            
            <div className="classe-input-group">
              <input
                type="text"
                value={classe}
                onChange={(e) => setClasse(e.target.value.toUpperCase())}
                placeholder="Ex: 3A, 4B, 6C..."
                className="classe-input"
                autoFocus
              />
              
              {suggestedClasse && classe !== suggestedClasse && (
                <button 
                  className="suggestion-btn"
                  onClick={() => setClasse(suggestedClasse)}
                >
                  <RefreshCw size={14} />
                  Suggestion: {suggestedClasse}
                </button>
              )}
            </div>
            
            {suggestedClasse && (
              <p className="suggestion-info">
                💡 Classe "{suggestedClasse}" détectée dans le nom du fichier
              </p>
            )}
          </div>
        );

      case 'preview':
        return (
          <div className="preview-step">
            <div className="preview-summary">
              <div className="summary-item success">
                <Check size={18} />
                <span>{previewEleves.length} élèves prêts à importer</span>
              </div>
              
              {warnings.length > 0 && (
                <div className="summary-item warning">
                  <AlertTriangle size={18} />
                  <span>{warnings.length} avertissement(s)</span>
                </div>
              )}
              
              {errors.length > 0 && (
                <div className="summary-item error">
                  <X size={18} />
                  <span>{errors.length} erreur(s)</span>
                </div>
              )}
            </div>
            
            {warnings.length > 0 && (
              <div className="messages-list warnings">
                {warnings.map((w, i) => (
                  <div key={i} className="message warning">{w}</div>
                ))}
              </div>
            )}
            
            {errors.length > 0 && (
              <div className="messages-list errors">
                {errors.map((e, i) => (
                  <div key={i} className="message error">{e}</div>
                ))}
              </div>
            )}
            
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Classe</th>
                    <th>Date naiss.</th>
                    <th>Sexe</th>
                    <th>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {previewEleves.slice(0, 10).map((eleve, i) => (
                    <tr key={i}>
                      <td>{eleve.nom}</td>
                      <td>{eleve.prenom}</td>
                      <td><span className="classe-badge">{eleve.classe}</span></td>
                      <td>{eleve.dateNaissance || '-'}</td>
                      <td>{eleve.sexe || '-'}</td>
                      <td>{eleve.options?.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {previewEleves.length > 10 && (
                <p className="more-rows">... et {previewEleves.length - 10} autres élèves</p>
              )}
            </div>
          </div>
        );

      case 'importing':
        return (
          <div className="importing-step">
            <ProgressIndicator
              indeterminate
              status="loading"
              label="Import en cours..."
              subtitle={`${previewEleves.length} élèves à importer`}
              size="lg"
              variant="circular"
              showElapsedTime
            />
          </div>
        );
    }
  };

  // Render navigation
  const canGoNext = () => {
    switch (step) {
      case 'mapping': return mappings.some(m => m.targetField === 'nom');
      case 'classe': return classe.trim().length > 0;
      case 'preview': return previewEleves.length > 0 && errors.length === 0;
      default: return false;
    }
  };

  // Label du bouton selon le contexte
  const getNextLabel = () => {
    if (step === 'preview') return 'Importer';
    if (step === 'mapping' && hasClasseColumn) return 'Vérifier';
    return 'Suivant';
  };

  const handleNext = () => {
    switch (step) {
      case 'mapping':
        if (hasClasseColumn) {
          // Pas besoin de demander la classe, elle est dans le CSV
          processImport();
        } else {
          setStep('classe');
        }
        break;
      case 'classe':
        processImport();
        break;
      case 'preview':
        finalImport();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'mapping':
        setStep('upload');
        setFile(null);
        setParsedData(null);
        break;
      case 'classe':
        setStep('mapping');
        break;
      case 'preview':
        if (hasClasseColumn) {
          setStep('mapping');
        } else {
          setStep('classe');
        }
        break;
    }
  };

  return (
    <div className="import-wizard-overlay">
      <div className="import-wizard">
        <div className="wizard-header">
          <h2>
            Importer des élèves
            {(pendingFiles.length > 0 || importedCount > 0) && (
              <span style={{ fontSize: '0.8rem', fontWeight: 400, marginLeft: '0.75rem', color: '#94a3b8' }}>
                {importedCount > 0 && `${importedCount} fichier${importedCount > 1 ? 's' : ''} importé${importedCount > 1 ? 's' : ''}`}
                {pendingFiles.length > 0 && ` · ${pendingFiles.length} en attente`}
              </span>
            )}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        {/* Progress Steps */}
        <div className="wizard-steps">
          <MultiStepProgress
            steps={[
              { id: 'upload', label: 'Fichier', status: ['mapping', 'classe', 'preview', 'importing'].includes(step) ? 'success' : step === 'upload' ? 'loading' : 'idle' },
              { id: 'mapping', label: 'Colonnes', status: ['classe', 'preview', 'importing'].includes(step) ? 'success' : step === 'mapping' ? 'loading' : 'idle' },
              ...(!hasClasseColumn ? [{ id: 'classe', label: 'Classe', status: ['preview', 'importing'].includes(step) ? 'success' : step === 'classe' ? 'loading' : 'idle' } as ProgressStep] : []),
              { id: 'preview', label: 'Vérification', status: step === 'importing' ? 'success' : step === 'preview' ? 'loading' : 'idle' },
            ] as ProgressStep[]}
            currentStepIndex={
              hasClasseColumn
                ? ['upload', 'mapping', 'preview', 'importing'].indexOf(step)
                : ['upload', 'mapping', 'classe', 'preview', 'importing'].indexOf(step)
            }
          />
        </div>
        
        {/* Content */}
        <div className="wizard-content">
          {renderStepContent()}
        </div>
        
        {/* Footer */}
        {step !== 'upload' && step !== 'importing' && (
          <div className="wizard-footer">
            <button className="btn btn-secondary" onClick={handleBack}>
              <ChevronLeft size={16} />
              Retour
            </button>
            
            <button 
              className="btn btn-primary" 
              onClick={handleNext}
              disabled={!canGoNext()}
            >
              {getNextLabel()}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
