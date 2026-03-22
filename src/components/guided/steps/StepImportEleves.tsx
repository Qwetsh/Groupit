// ============================================================
// GUIDED STEP - IMPORT ELEVES (Multi-file support)
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, Check, Plus, Trash2, Users, ChevronRight, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '../../../stores/uiStore';
import { useEleveStore } from '../../../stores/eleveStore';
import {
  parseCSVFile,
  generateAutoMapping,
  importElevesFromCSV,
  extractClassFromFilename,
  type ParsedCSVData,
} from '../../../infrastructure/import';
import type { Eleve, ColumnMapping } from '../../../domain/models';
import '../GuidedMode.css';

interface ImportedFile {
  id: string;
  name: string;
  classe: string;
  elevesCount: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

interface StepImportElevesProps {
  onNext: () => void;
  onBack: () => void;
}

const ELEVE_FIELDS: { key: keyof Eleve; label: string }[] = [
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'classe', label: 'Classe' },
  { key: 'dateNaissance', label: 'Date de naissance' },
  { key: 'sexe', label: 'Sexe' },
  { key: 'email', label: 'Email' },
  { key: 'regime', label: 'Régime' },
];

export function StepImportEleves({ onNext, onBack }: StepImportElevesProps) {
  const { setGuidedImportedEleves } = useUIStore();
  const { addEleves, deleteAllEleves } = useEleveStore();
  const eleves = useEleveStore(state => state.eleves);

  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCSVData | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [classe, setClasse] = useState('');
  const [processing, setProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalImported = eleves.length;

  // Handle file selection
  const handleFile = useCallback(async (file: File) => {
    setCurrentFile(file);
    setProcessing(true);

    try {
      const extracted = extractClassFromFilename(file.name);
      if (extracted) {
        setClasse(extracted);
      } else {
        setClasse('');
      }

      const data = await parseCSVFile(file);
      setParsedData(data);

      const autoMappings = generateAutoMapping(data.headers);
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
  const updateMapping = useCallback((csvHeader: string, targetField: keyof Eleve | null) => {
    setMappings(prev => prev.map(m =>
      m.csvHeader === csvHeader
        ? { ...m, targetField, isIgnored: targetField === null }
        : m
    ));
  }, []);

  // Confirm import for current file
  const handleConfirmImport = useCallback(async () => {
    if (!parsedData || !currentFile) return;

    setProcessing(true);
    const fileId = Date.now().toString();

    try {
      const hasClasseInCSV = mappings.some(m => m.targetField === 'classe');
      const result = importElevesFromCSV(parsedData, mappings, classe);

      if (result.eleves.length > 0) {
        await addEleves(result.eleves as Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>[]);

        // Déterminer le label de classe pour l'affichage
        let classeLabel = classe || 'Non spécifiée';
        if (hasClasseInCSV) {
          const distinctClasses = [...new Set(result.eleves.map(e => e.classe).filter(Boolean))];
          classeLabel = distinctClasses.length > 1
            ? `${distinctClasses.length} classes (${distinctClasses.join(', ')})`
            : distinctClasses[0] || 'Non spécifiée';
        }

        setImportedFiles(prev => [...prev, {
          id: fileId,
          name: currentFile.name,
          classe: classeLabel,
          elevesCount: result.eleves.length,
          status: 'done',
        }]);

        setGuidedImportedEleves(totalImported + result.eleves.length);
      }

      // Reset for next file
      setShowMapping(false);
      setCurrentFile(null);
      setParsedData(null);
      setMappings([]);
      setClasse('');

    } catch (error) {
      setImportedFiles(prev => [...prev, {
        id: fileId,
        name: currentFile.name,
        classe: classe || 'Non spécifiée',
        elevesCount: 0,
        status: 'error',
        error: String(error),
      }]);
    } finally {
      setProcessing(false);
    }
  }, [parsedData, currentFile, mappings, classe, addEleves, setGuidedImportedEleves, totalImported]);

  // Cancel current import
  const handleCancelMapping = useCallback(() => {
    setShowMapping(false);
    setCurrentFile(null);
    setParsedData(null);
    setMappings([]);
    setClasse('');
  }, []);

  // Remove imported file (note: doesn't remove from DB, just from list)
  const handleRemoveFile = useCallback((id: string) => {
    setImportedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Reset all student data
  const handleReset = useCallback(async () => {
    if (!window.confirm('Supprimer tous les élèves importés ? Cette action est irréversible.')) return;
    await deleteAllEleves();
    setImportedFiles([]);
    setGuidedImportedEleves(0);
  }, [deleteAllEleves, setGuidedImportedEleves]);

  // Continue to next step
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

        {!mappings.some(m => m.targetField === 'classe') && (
          <div className="classe-section">
            <h3>Classe pour ces élèves</h3>
            <input
              type="text"
              value={classe}
              onChange={(e) => setClasse(e.target.value.toUpperCase())}
              placeholder="Ex: 3A, 3B..."
              className="classe-input"
            />
          </div>
        )}
        {mappings.some(m => m.targetField === 'classe') && (
          <div className="classe-section">
            <h3>Classe détectée dans le fichier</h3>
            <p style={{ color: 'var(--color-success, #22c55e)', fontSize: '0.9rem' }}>
              La colonne "Classe" sera utilisée pour affecter chaque élève à sa classe automatiquement.
            </p>
          </div>
        )}

        <div className="mapping-actions">
          <button className="btn btn-secondary" onClick={handleCancelMapping}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirmImport}
            disabled={!mappings.some(m => m.targetField === 'nom') || (!mappings.some(m => m.targetField === 'classe') && !classe.trim()) || processing}
          >
            {processing ? 'Import en cours...' : 'Importer ce fichier'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guided-step step-import">
      <h1 className="step-title">Importez vos élèves</h1>
      <p className="step-subtitle">
        Vous pouvez importer plusieurs fichiers si vos élèves sont répartis par classe.
      </p>

      {/* Drop zone */}
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
          onChange={handleFileInput}
          hidden
        />
        <Upload size={40} />
        <h3>Glissez vos fichiers ici</h3>
        <p>ou cliquez pour sélectionner</p>
        <span className="format-hint">CSV, Excel (.xlsx, .xls)</span>
      </div>

      {/* Imported files list */}
      {importedFiles.length > 0 && (
        <div className="imported-files">
          <h3>Fichiers importés</h3>
          {importedFiles.map(file => (
            <div key={file.id} className={clsx('imported-file', file.status)}>
              <FileSpreadsheet size={20} />
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-meta">
                  Classe {file.classe} • {file.elevesCount} élèves
                </span>
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

          <button
            className="add-another-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={18} />
            Ajouter un autre fichier
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="import-summary">
        <Users size={24} />
        <span className="summary-count">{totalImported}</span>
        <span className="summary-label">élèves au total</span>
        {totalImported > 0 && (
          <button
            className="btn btn-danger-outline btn-sm"
            onClick={handleReset}
            title="Supprimer tous les élèves"
            style={{ marginLeft: 'auto' }}
          >
            <RotateCcw size={14} />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button
          className="btn btn-primary btn-large"
          onClick={handleContinue}
          disabled={totalImported === 0}
        >
          J'ai terminé mes imports
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
