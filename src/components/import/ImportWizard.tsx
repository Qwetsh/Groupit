// ============================================================
// COMPONENT - IMPORT CSV WIZARD
// ============================================================

import { useState, useCallback, useRef } from 'react';
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
import './ImportWizard.css';

interface ImportWizardProps {
  onImport: (eleves: Partial<Eleve>[]) => Promise<void>;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'classe' | 'preview' | 'importing';

const ELEVE_FIELDS: { key: keyof Eleve; label: string }[] = [
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
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
  const [_importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      // Generate auto-mapping
      const autoMappings = generateAutoMapping(data.headers);
      setMappings(autoMappings);
      
      // Go to mapping step
      setStep('mapping');
    } catch (error) {
      setErrors([`Erreur lors de la lecture du fichier: ${error}`]);
    }
  }, []);

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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.CSV')) {
        handleFile(droppedFile);
      } else {
        setErrors(['Veuillez sélectionner un fichier CSV']);
      }
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
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
    setImporting(true);
    setStep('importing');
    
    try {
      await onImport(previewEleves);
      onClose();
    } catch (error) {
      setErrors([`Erreur lors de l'import: ${error}`]);
      setStep('preview');
    } finally {
      setImporting(false);
    }
  }, [previewEleves, onImport, onClose]);

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
              accept=".csv,.CSV"
              onChange={handleFileInput}
              hidden
            />
            <Upload size={48} />
            <h3>Glissez votre fichier CSV ici</h3>
            <p>ou cliquez pour sélectionner</p>
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
            <div className="spinner"></div>
            <p>Import en cours...</p>
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

  const handleNext = () => {
    switch (step) {
      case 'mapping':
        setStep('classe');
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
        setStep('classe');
        break;
    }
  };

  return (
    <div className="import-wizard-overlay">
      <div className="import-wizard">
        <div className="wizard-header">
          <h2>Importer des élèves</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        {/* Progress Steps */}
        <div className="wizard-steps">
          {['upload', 'mapping', 'classe', 'preview'].map((s, i) => (
            <div 
              key={s} 
              className={clsx(
                'step-indicator',
                step === s && 'active',
                ['mapping', 'classe', 'preview', 'importing'].indexOf(step) > i && 'completed'
              )}
            >
              <span className="step-number">{i + 1}</span>
              <span className="step-label">
                {s === 'upload' && 'Fichier'}
                {s === 'mapping' && 'Colonnes'}
                {s === 'classe' && 'Classe'}
                {s === 'preview' && 'Vérification'}
              </span>
            </div>
          ))}
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
              {step === 'preview' ? 'Importer' : 'Suivant'}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
