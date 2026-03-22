// ============================================================
// GUIDED STEP - IMPORT STAGES (CSV/XLSX avec matching élèves)
// ============================================================

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Upload, FileSpreadsheet, Check, Briefcase, ChevronRight, AlertTriangle, X, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useUIStore } from '../../../stores/uiStore';
import { useEleveStore } from '../../../stores/eleveStore';
import { useStageStore } from '../../../stores/stageStore';
import {
  importStagesFromFile,
  convertMatchedRowsToStageData,
  resolveAmbiguousMatch,
  type StageImportResult,
} from '../../../services/stageImportService';
import '../GuidedMode.css';

interface StepImportStagesProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepImportStages({ onNext, onBack }: StepImportStagesProps) {
  const { setGuidedImportedStages } = useUIStore();
  const eleves = useEleveStore(state => state.eleves);
  const stages = useStageStore(state => state.stages);
  const loadStages = useStageStore(state => state.loadStages);
  const bulkUpsertStagesForEleves = useStageStore(state => state.bulkUpsertStagesForEleves);

  const [importResult, setImportResult] = useState<StageImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importStats, setImportStats] = useState<{ created: number; updated: number } | null>(null);

  // Resolved ambiguous matches
  const [ambiguousSelections, setAmbiguousSelections] = useState<Record<number, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load stages on mount
  useEffect(() => {
    loadStages();
  }, [loadStages]);

  // Existing stages for 3ème students
  const eleves3e = useMemo(() => eleves.filter(e => e.classe?.startsWith('3')), [eleves]);
  const eleves3eIds = useMemo(() => new Set(eleves3e.map(e => e.id)), [eleves3e]);
  const existingStages = useMemo(
    () => stages.filter(s => !s.scenarioId && s.eleveId && eleves3eIds.has(s.eleveId)),
    [stages, eleves3eIds]
  );

  const canContinue = existingStages.length > 0 || importDone;

  // Handle file
  const handleFile = useCallback(async (file: File) => {
    setProcessing(true);
    setImportResult(null);
    setImportDone(false);
    setImportStats(null);
    setAmbiguousSelections({});

    try {
      const result = await importStagesFromFile(file, eleves);
      setImportResult(result);
    } catch (error) {
      console.error('Erreur parsing stages:', error);
    } finally {
      setProcessing(false);
    }
  }, [eleves]);

  // Drag & Drop
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
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        handleFile(file);
      }
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  // Resolve ambiguous
  const handleAmbiguousSelect = useCallback((index: number, eleveId: string) => {
    setAmbiguousSelections(prev => ({ ...prev, [index]: eleveId }));
  }, []);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    if (!importResult) return;
    setProcessing(true);

    try {
      // Collect all matched: auto-matched + resolved ambiguous
      const allMatched = [...importResult.matched];

      // Add resolved ambiguous
      for (const [indexStr, eleveId] of Object.entries(ambiguousSelections)) {
        const idx = parseInt(indexStr, 10);
        const amb = importResult.ambiguous[idx];
        if (amb) {
          const resolved = resolveAmbiguousMatch(amb, eleveId);
          if (resolved) allMatched.push(resolved);
        }
      }

      // Convert to stage data
      const stageData = convertMatchedRowsToStageData(allMatched);

      // Upsert stages
      const result = await bulkUpsertStagesForEleves(stageData);
      setImportStats(result);
      setImportDone(true);
      setGuidedImportedStages(result.created + result.updated);

      // Reload stages
      await loadStages();
    } catch (error) {
      console.error('Erreur import stages:', error);
    } finally {
      setProcessing(false);
    }
  }, [importResult, ambiguousSelections, bulkUpsertStagesForEleves, loadStages, setGuidedImportedStages]);

  // Cancel import result (go back to upload zone)
  const handleCancelResult = useCallback(() => {
    setImportResult(null);
    setImportDone(false);
    setImportStats(null);
    setAmbiguousSelections({});
  }, []);

  // Show import result review
  if (importResult && !importDone) {
    const { stats, ambiguous, unmatched } = importResult;
    const resolvedCount = Object.keys(ambiguousSelections).length;

    return (
      <div className="guided-step step-import">
        <h1 className="step-title">Resultat du matching</h1>
        <p className="step-subtitle">
          {stats.total} lignes lues — vérifiez la correspondance avec vos élèves
        </p>

        {/* Stats cards */}
        <div className="stage-matching-stats">
          {stats.matched > 0 && (
            <div className="stage-match-card success">
              <Check size={18} />
              <strong>{stats.matched}</strong> élèves identifiés automatiquement
            </div>
          )}
          {stats.ambiguous > 0 && (
            <div className="stage-match-card warning">
              <AlertTriangle size={18} />
              <strong>{stats.ambiguous}</strong> cas ambigus
              {resolvedCount > 0 && <span className="resolved-count">({resolvedCount} résolus)</span>}
            </div>
          )}
          {stats.unmatched > 0 && (
            <div className="stage-match-card error">
              <X size={18} />
              <strong>{stats.unmatched}</strong> non trouvés
            </div>
          )}
          {stats.errors > 0 && (
            <div className="stage-match-card error">
              <AlertTriangle size={18} />
              <strong>{stats.errors}</strong> erreurs de lecture
            </div>
          )}
        </div>

        {/* Ambiguous resolution */}
        {ambiguous.length > 0 && (
          <div className="stage-ambiguous-section">
            <h3>Cas ambigus — choisissez le bon élève</h3>
            <div className="stage-ambiguous-list">
              {ambiguous.map((amb, idx) => (
                <div key={idx} className="stage-ambiguous-row">
                  <div className="amb-import-info">
                    <strong>{amb.nom} {amb.prenom}</strong>
                    {amb.classe && <span className="amb-classe">{amb.classe}</span>}
                    {amb.entreprise && <span className="amb-detail">{amb.entreprise}</span>}
                  </div>
                  <div className="amb-select-wrapper">
                    <select
                      value={ambiguousSelections[idx] || ''}
                      onChange={(e) => handleAmbiguousSelect(idx, e.target.value)}
                      className={clsx('amb-select', ambiguousSelections[idx] && 'resolved')}
                    >
                      <option value="">-- Choisir --</option>
                      {amb.candidates.map(c => (
                        <option key={c.eleve.id} value={c.eleve.id!}>
                          {c.eleve.nom} {c.eleve.prenom} ({c.eleve.classe}) — {Math.round(c.score * 100)}%
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="select-chevron" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unmatched list */}
        {unmatched.length > 0 && (
          <div className="stage-unmatched-section">
            <h3>Non trouvés</h3>
            <div className="stage-unmatched-list">
              {unmatched.slice(0, 10).map((um, idx) => (
                <div key={idx} className="stage-unmatched-row">
                  <span className="um-name">{um.nom} {um.prenom}</span>
                  <span className="um-reason">{um.reason}</span>
                  {um.suggestions && um.suggestions.length > 0 && (
                    <span className="um-suggestions">
                      Suggestions : {um.suggestions.join(', ')}
                    </span>
                  )}
                </div>
              ))}
              {unmatched.length > 10 && (
                <p className="um-more">... et {unmatched.length - 10} autres</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="step-actions">
          <button className="btn btn-secondary" onClick={handleCancelResult}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirmImport}
            disabled={stats.matched + resolvedCount === 0 || processing}
          >
            {processing ? 'Import en cours...' : `Importer ${stats.matched + resolvedCount} stage(s)`}
          </button>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="guided-step step-import">
      <h1 className="step-title">Stages des élèves</h1>
      <p className="step-subtitle">
        Importez les informations de stage de vos élèves de 3ème.
      </p>

      {/* Existing stages detection */}
      {existingStages.length > 0 && (
        <div className="existing-stages-card">
          <Check size={20} />
          <div>
            <strong>{existingStages.length} stage(s) déjà présents</strong>
            <span>pour {new Set(existingStages.map(s => s.eleveId)).size} élèves de 3ème</span>
          </div>
        </div>
      )}

      {/* Import done success */}
      {importDone && importStats && (
        <div className="existing-stages-card">
          <FileSpreadsheet size={20} />
          <div>
            <strong>{importStats.created} créés, {importStats.updated} mis à jour</strong>
            <span>Import terminé avec succès</span>
          </div>
        </div>
      )}

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
        {processing ? (
          <>
            <div className="loading-spinner small" />
            <h3>Analyse en cours...</h3>
          </>
        ) : (
          <>
            <Upload size={40} />
            <h3>{existingStages.length > 0 || importDone ? 'Importer un autre fichier' : 'Glissez votre fichier ici'}</h3>
            <p>ou cliquez pour sélectionner</p>
            <span className="format-hint">CSV, Excel (.xlsx, .xls)</span>
            <span className="format-hint">Colonnes attendues : nom, prénom, classe, entreprise, adresse</span>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="import-summary">
        <Briefcase size={24} />
        <span className="summary-count">{existingStages.length}</span>
        <span className="summary-label">stages au total</span>
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button
          className="btn btn-primary btn-large"
          onClick={onNext}
          disabled={!canContinue}
        >
          {existingStages.length > 0 && !importDone
            ? 'Continuer avec les stages existants'
            : 'Continuer'
          }
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
