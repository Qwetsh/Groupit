// ============================================================
// GUIDED STEP - IMPORT ENSEIGNANTS
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, Check, Plus, Trash2, GraduationCap, ChevronRight, Users, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '../../../stores/uiStore';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import {
  parseCSVFile,
  generateAutoMappingEnseignants,
  importEnseignantsFromCSV,
  type ParsedCSVData,
} from '../../../infrastructure/import';
import type { Enseignant, EnseignantColumnMapping } from '../../../domain/models';
import '../GuidedMode.css';

interface ImportedFile {
  id: string;
  name: string;
  count: number;
  status: 'done' | 'error';
  error?: string;
}

interface StepImportEnseignantsProps {
  onNext: () => void;
  onBack: () => void;
}

const ENSEIGNANT_FIELDS: { key: keyof Enseignant; label: string }[] = [
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'matierePrincipale', label: 'Matière principale' },
  { key: 'adresse', label: 'Adresse' },
  { key: 'commune', label: 'Commune' },
];

export function StepImportEnseignants({ onNext, onBack }: StepImportEnseignantsProps) {
  const { setGuidedImportedEnseignants } = useUIStore();
  const { addEnseignants } = useEnseignantStore();
  const enseignants = useEnseignantStore(state => state.enseignants);

  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [showImportSection, setShowImportSection] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSVData | null>(null);
  const [mappings, setMappings] = useState<EnseignantColumnMapping[]>([]);
  const [processing, setProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingCount = enseignants.length;
  const newlyImported = importedFiles.reduce((sum, f) => sum + (f.status === 'done' ? f.count : 0), 0);
  const totalCount = existingCount + newlyImported;

  // Handle file selection
  const handleFile = useCallback(async (file: File) => {
    setCurrentFile(file);
    setProcessing(true);

    try {
      const data = await parseCSVFile(file);
      setParsedData(data);

      const autoMappings = generateAutoMappingEnseignants(data.headers);
      setMappings(autoMappings);

      setShowMapping(true);
    } catch (error) {
      console.error('Error parsing file:', error);
    } finally {
      setProcessing(false);
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
      const ext = droppedFile.name.toLowerCase();
      if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        handleFile(droppedFile);
      }
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  // Update mapping
  const updateMapping = useCallback((csvHeader: string, targetField: keyof Enseignant | null) => {
    setMappings(prev => prev.map(m =>
      m.csvHeader === csvHeader
        ? { ...m, targetField, isIgnored: targetField === null }
        : m
    ));
  }, []);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    if (!parsedData || !currentFile) return;

    setProcessing(true);
    const fileId = Date.now().toString();

    try {
      const result = importEnseignantsFromCSV(parsedData, mappings);

      if (result.enseignants.length > 0) {
        await addEnseignants(result.enseignants as Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>[]);

        setImportedFiles(prev => [...prev, {
          id: fileId,
          name: currentFile.name,
          count: result.enseignants.length,
          status: 'done',
        }]);

        setGuidedImportedEnseignants(totalCount + result.enseignants.length);
      }

      // Reset
      setShowMapping(false);
      setCurrentFile(null);
      setParsedData(null);
      setMappings([]);

    } catch (error) {
      setImportedFiles(prev => [...prev, {
        id: fileId,
        name: currentFile.name,
        count: 0,
        status: 'error',
        error: String(error),
      }]);
    } finally {
      setProcessing(false);
    }
  }, [parsedData, currentFile, mappings, addEnseignants, setGuidedImportedEnseignants, totalCount]);

  // Cancel mapping
  const handleCancelMapping = useCallback(() => {
    setShowMapping(false);
    setCurrentFile(null);
    setParsedData(null);
    setMappings([]);
  }, []);

  // Remove file from list
  const handleRemoveFile = useCallback((id: string) => {
    setImportedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Continue
  const handleContinue = useCallback(() => {
    onNext();
  }, [onNext]);

  // Render mapping modal
  if (showMapping && parsedData) {
    return (
      <div className="guided-step step-import">
        <h1 className="step-title">Configuration de l'import</h1>
        <p className="step-subtitle">
          Fichier : <strong>{currentFile?.name}</strong>
        </p>

        <div className="mapping-section">
          <h3>Associez les colonnes aux champs</h3>
          <div className="mapping-list compact">
            {mappings.filter(m => !m.isIgnored || m.csvHeader).map(mapping => (
              <div key={mapping.csvHeader} className="mapping-row">
                <div className="csv-header">
                  <span className="header-name">{mapping.csvHeader}</span>
                  <span className="header-sample">
                    {parsedData.rows[0]?.[mapping.csvHeader] || '-'}
                  </span>
                </div>

                <select
                  value={mapping.targetField || ''}
                  onChange={(e) => updateMapping(
                    mapping.csvHeader,
                    e.target.value as keyof Enseignant || null
                  )}
                  className={clsx(mapping.targetField && 'mapped')}
                >
                  <option value="">-- Ignorer --</option>
                  {ENSEIGNANT_FIELDS.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>

                {mapping.targetField && <Check size={16} className="check-icon" />}
              </div>
            ))}
          </div>
        </div>

        <div className="mapping-actions">
          <button className="btn btn-secondary" onClick={handleCancelMapping}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirmImport}
            disabled={!mappings.some(m => m.targetField === 'nom') || processing}
          >
            {processing ? 'Import en cours...' : 'Importer ce fichier'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guided-step step-import">
      <h1 className="step-title">Vos enseignants</h1>
      <p className="step-subtitle">
        Les enseignants qui participeront aux affectations.
      </p>

      {/* Existing enseignants - PRIMARY */}
      <div className="existing-data-card">
        <div className="existing-data-icon">
          <Users size={32} />
        </div>
        <div className="existing-data-content">
          <div className="existing-data-count">{existingCount}</div>
          <div className="existing-data-label">
            enseignant{existingCount !== 1 ? 's' : ''} dans votre base de données
          </div>
        </div>
        {existingCount > 0 && (
          <div className="existing-data-check">
            <Check size={24} />
          </div>
        )}
      </div>

      {/* Import section - SECONDARY (collapsible) */}
      <div className="import-section-toggle">
        <button
          className={clsx('toggle-import-btn', showImportSection && 'expanded')}
          onClick={() => setShowImportSection(!showImportSection)}
        >
          <Plus size={18} />
          <span>Importer d'autres enseignants</span>
          <ChevronDown size={18} className="toggle-icon" />
        </button>
      </div>

      {showImportSection && (
        <div className="import-section-content">
          {/* Drop zone */}
          <div
            className={clsx('upload-zone-guided compact', dragActive && 'active')}
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
              onChange={handleFileInput}
              hidden
            />
            <Upload size={28} />
            <p>Glissez un fichier ou cliquez pour sélectionner</p>
            <span className="format-hint">CSV, Excel (.xlsx, .xls)</span>
          </div>

          {/* Imported files list */}
          {importedFiles.length > 0 && (
            <div className="imported-files">
              {importedFiles.map(file => (
                <div key={file.id} className={clsx('imported-file', file.status)}>
                  <FileSpreadsheet size={20} />
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-meta">+{file.count} enseignants</span>
                  </div>
                  {file.status === 'done' && <Check size={18} className="status-icon success" />}
                  <button
                    className="remove-file-btn"
                    onClick={() => handleRemoveFile(file.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="import-summary">
        <GraduationCap size={24} />
        <span className="summary-count">{totalCount}</span>
        <span className="summary-label">enseignant{totalCount !== 1 ? 's' : ''} au total</span>
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button
          className="btn btn-primary btn-large"
          onClick={handleContinue}
          disabled={totalCount === 0}
        >
          Continuer
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
