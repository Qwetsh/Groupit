// ============================================================
// MODAL - IMPORT SESSION D'AFFECTATION
// ============================================================

import { useState, useCallback } from 'react';
import { X, Upload, FileJson, CheckCircle, AlertTriangle, XCircle, Loader, Users, UserCheck, FileWarning } from 'lucide-react';
import type { ImportReport, SessionExportData } from '../../services/affectationSessionService';
import { parseSessionFile } from '../../services/affectationSessionService';
import '../modals/Modal.css';
import './ImportSessionModal.css';

interface ImportSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: SessionExportData) => Promise<ImportReport>;
}

type Step = 'select' | 'preview' | 'importing' | 'report';

export function ImportSessionModal({ isOpen, onClose, onImport }: ImportSessionModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<SessionExportData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);

    try {
      const data = await parseSessionFile(selectedFile);
      setParsedData(data);
      setStep('preview');
    } catch (err) {
      setParseError(String(err));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.json')) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(async () => {
    if (!parsedData) return;

    setStep('importing');

    try {
      const importReport = await onImport(parsedData);
      setReport(importReport);
      setStep('report');
    } catch (err) {
      setReport({
        success: false,
        scenarioMatched: false,
        scenarioName: parsedData.scenario.nom,
        affectationsImported: 0,
        affectationsSkipped: 0,
        stagesUpdated: 0,
        elevesMatched: 0,
        elevesNotFound: [],
        enseignantsMatched: 0,
        enseignantsNotFound: [],
        warnings: [],
        errors: [String(err)],
      });
      setStep('report');
    }
  }, [parsedData, onImport]);

  const handleClose = useCallback(() => {
    setStep('select');
    setFile(null);
    setParsedData(null);
    setParseError(null);
    setReport(null);
    onClose();
  }, [onClose]);

  const handleReset = useCallback(() => {
    setStep('select');
    setFile(null);
    setParsedData(null);
    setParseError(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content import-session-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileJson size={20} />
            <h2>Importer une session</h2>
          </div>
          <button className="modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Step: Select File */}
          {step === 'select' && (
            <div className="import-step select-step">
              <div
                className={`drop-zone ${parseError ? 'error' : ''}`}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <Upload size={48} className="drop-icon" />
                <p className="drop-text">
                  Glissez-déposez un fichier JSON<br />
                  ou cliquez pour sélectionner
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleInputChange}
                  className="file-input"
                />
              </div>

              {parseError && (
                <div className="parse-error">
                  <AlertTriangle size={16} />
                  {parseError}
                </div>
              )}

              <p className="help-text">
                Sélectionnez un fichier d'export de session (.json) précédemment généré.
              </p>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && parsedData && (
            <div className="import-step preview-step">
              <div className="preview-header">
                <CheckCircle size={24} className="success-icon" />
                <h3>Fichier valide</h3>
              </div>

              <div className="preview-info">
                <div className="info-card">
                  <div className="info-label">Scénario</div>
                  <div className="info-value">{parsedData.scenario.nom}</div>
                  <div className="info-sublabel">{parsedData.scenario.type}</div>
                </div>

                <div className="info-card">
                  <div className="info-label">Affectations</div>
                  <div className="info-value">{parsedData.affectations.length}</div>
                  <div className="info-sublabel">élèves assignés</div>
                </div>

                <div className="info-card">
                  <div className="info-label">Non affectés</div>
                  <div className="info-value">{parsedData.nonAffectes.length}</div>
                  <div className="info-sublabel">élèves restants</div>
                </div>

                <div className="info-card">
                  <div className="info-label">Exporté le</div>
                  <div className="info-value">
                    {new Date(parsedData.exportedAt).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="info-sublabel">
                    {new Date(parsedData.exportedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div className="preview-warning">
                <AlertTriangle size={18} />
                <div>
                  <strong>Attention :</strong> L'import va remplacer toutes les affectations existantes
                  pour ce scénario. Les stages seront mis à jour avec les données du fichier.
                </div>
              </div>

              <div className="preview-actions">
                <button className="btn-secondary" onClick={handleReset}>
                  Choisir un autre fichier
                </button>
                <button className="btn-primary" onClick={handleImport}>
                  <Upload size={18} />
                  Importer
                </button>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="import-step importing-step">
              <Loader size={48} className="spinner" />
              <h3>Import en cours...</h3>
              <p>Matching des élèves et enseignants, mise à jour des stages...</p>
            </div>
          )}

          {/* Step: Report */}
          {step === 'report' && report && (
            <div className="import-step report-step">
              <div className={`report-header ${report.success ? 'success' : 'error'}`}>
                {report.success ? (
                  <>
                    <CheckCircle size={32} />
                    <h3>Import réussi</h3>
                  </>
                ) : (
                  <>
                    <XCircle size={32} />
                    <h3>Import terminé avec des erreurs</h3>
                  </>
                )}
              </div>

              <div className="report-stats">
                <div className="stat-item success">
                  <UserCheck size={20} />
                  <span className="stat-value">{report.affectationsImported}</span>
                  <span className="stat-label">affectations importées</span>
                </div>

                <div className="stat-item">
                  <Users size={20} />
                  <span className="stat-value">{report.stagesUpdated}</span>
                  <span className="stat-label">stages mis à jour</span>
                </div>

                {report.affectationsSkipped > 0 && (
                  <div className="stat-item warning">
                    <FileWarning size={20} />
                    <span className="stat-value">{report.affectationsSkipped}</span>
                    <span className="stat-label">affectations ignorées</span>
                  </div>
                )}
              </div>

              {/* Élèves non trouvés */}
              {report.elevesNotFound.length > 0 && (
                <div className="report-section warning">
                  <h4>
                    <AlertTriangle size={16} />
                    Élèves non trouvés ({report.elevesNotFound.length})
                  </h4>
                  <ul className="not-found-list">
                    {report.elevesNotFound.slice(0, 10).map((e, i) => (
                      <li key={i}>{e.prenom} {e.nom} ({e.classe})</li>
                    ))}
                    {report.elevesNotFound.length > 10 && (
                      <li className="more">... et {report.elevesNotFound.length - 10} autres</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Enseignants non trouvés */}
              {report.enseignantsNotFound.length > 0 && (
                <div className="report-section warning">
                  <h4>
                    <AlertTriangle size={16} />
                    Enseignants non trouvés ({report.enseignantsNotFound.length})
                  </h4>
                  <ul className="not-found-list">
                    {report.enseignantsNotFound.slice(0, 10).map((e, i) => (
                      <li key={i}>{e.prenom} {e.nom}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Erreurs */}
              {report.errors.length > 0 && (
                <div className="report-section error">
                  <h4>
                    <XCircle size={16} />
                    Erreurs ({report.errors.length})
                  </h4>
                  <ul className="error-list">
                    {report.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {report.warnings.length > 0 && (
                <div className="report-section warning">
                  <h4>
                    <AlertTriangle size={16} />
                    Avertissements ({report.warnings.length})
                  </h4>
                  <ul className="warning-list">
                    {report.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {report.warnings.length > 5 && (
                      <li className="more">... et {report.warnings.length - 5} autres</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'report' ? (
            <button className="btn-primary" onClick={handleClose}>
              Fermer
            </button>
          ) : (
            <button className="btn-secondary" onClick={handleClose}>
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
