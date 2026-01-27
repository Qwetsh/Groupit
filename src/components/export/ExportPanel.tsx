// ============================================================
// EXPORT BUTTONS - Boutons compacts pour exporter les résultats
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  FileSpreadsheet,
  ChevronDown,
  AlertCircle,
  Check
} from 'lucide-react';
import { ProgressIndicator } from '../ui/ProgressIndicator';
import { useEleveStore } from '../../stores/eleveStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useAffectationStore } from '../../stores/affectationStore';
import { useStageStore } from '../../stores/stageStore';
import { useJuryStore } from '../../stores/juryStore';
import type { Scenario } from '../../domain/models';
import {
  mapToExportData,
  downloadExportCsv,
  downloadExportPdf,
  downloadExportExcel,
  downloadStageExportExcel,
  type CsvExportOptions,
  type PdfExportOptions,
  type ExportResultData,
  DEFAULT_CSV_OPTIONS,
  DEFAULT_PDF_OPTIONS,
  // Stage export
  mapToStageExportData,
  exportAndDownloadStageCsv,
  exportStagePdf,
  DEFAULT_STAGE_CSV_OPTIONS,
  DEFAULT_STAGE_PDF_OPTIONS,
  type StageExportResultData,
} from '../../infrastructure/export';
import './ExportPanel.css';

interface ExportButtonsProps {
  scenario: Scenario;
  filteredEleveIds: string[];
}

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

// Détection du mode stage
function isStageScenario(scenario: Scenario): boolean {
  return scenario.type === 'suivi_stage';
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ scenario, filteredEleveIds }) => {
  // Stores
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const affectations = useAffectationStore(state => state.affectations);
  const jurys = useJuryStore(state => state.jurys);
  const stages = useStageStore(state => state.stages);

  // State
  const [csvStatus, setCsvStatus] = useState<ExportStatus>('idle');
  const [excelStatus, setExcelStatus] = useState<ExportStatus>('idle');
  const [pdfStatus, setPdfStatus] = useState<ExportStatus>('idle');
  const [showMenu, setShowMenu] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mode stage ?
  const stageMode = isStageScenario(scenario);

  // Options dynamiques selon mode
  const [csvOptions, setCsvOptions] = useState<CsvExportOptions>(() => ({
    ...DEFAULT_CSV_OPTIONS,
  }));
  
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>(() => ({
    ...DEFAULT_PDF_OPTIONS,
    headerYear: String(new Date().getFullYear()),
  }));

  // Options stage (séparées)
  const [stageCsvOptions] = useState(() => ({ ...DEFAULT_STAGE_CSV_OPTIONS }));
  const [stagePdfOptions] = useState(() => ({ 
    ...DEFAULT_STAGE_PDF_OPTIONS, 
    headerYear: String(new Date().getFullYear()) 
  }));

  // Préparer les données d'export
  const exportData = useMemo(() => {
    if (stageMode) {
      // Pour les stages, filtrer par eleveId (stages globaux liés aux élèves du scénario)
      const scenarioEleveIds = new Set(filteredEleveIds);
      const scenarioStages = stages.filter(s => s.eleveId && scenarioEleveIds.has(s.eleveId));

      return mapToStageExportData({
        scenario,
        stages: scenarioStages,
        eleves,
        enseignants,
        affectations: affectations.filter(a => a.scenarioId === scenario.id),
        etablissementName: pdfOptions.headerSchoolName,
        anneeScolaire: pdfOptions.headerYear,
      });
    }
    return mapToExportData(
      scenario,
      jurys,
      affectations,
      enseignants,
      eleves,
      filteredEleveIds
    );
  }, [stageMode, scenario, jurys, affectations, enseignants, eleves, filteredEleveIds, pdfOptions.headerSchoolName, pdfOptions.headerYear, stages]);

  // Stats rapides
  const hasData = useMemo(() => {
    if (stageMode) {
      const stageData = exportData as StageExportResultData;
      return (stageData.enseignants?.length > 0 || stageData.unassigned?.length > 0);
    }
    return (exportData.stats.totalAffectes > 0 || exportData.stats.totalNonAffectes > 0);
  }, [stageMode, exportData]);

  // Nom de fichier
  const baseFilename = useMemo(() => {
    const date = new Date().toISOString().split('T')[0];
    const cleanName = scenario.nom.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿç\s-]/g, '').replace(/\s+/g, '_');
    return `${cleanName}_${date}`;
  }, [scenario.nom]);

  // Option handlers
  const toggleCsvOption = useCallback((key: keyof CsvExportOptions) => {
    setCsvOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const togglePdfOption = useCallback((key: keyof PdfExportOptions) => {
    setPdfOptions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handlePdfHeaderChange = useCallback((key: 'headerSchoolName' | 'headerYear', value: string) => {
    setPdfOptions(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Handlers
  const handleExportCsv = useCallback(async () => {
    if (!hasData) return;
    setCsvStatus('loading');
    setErrorMessage(null);
    try {
      if (stageMode) {
        exportAndDownloadStageCsv(exportData as StageExportResultData, stageCsvOptions);
      } else {
        downloadExportCsv(exportData as ExportResultData, baseFilename, csvOptions);
      }
      setCsvStatus('success');
      setTimeout(() => setCsvStatus('idle'), 2000);
    } catch (error) {
      console.error('[ExportButtons] Erreur CSV:', error);
      setCsvStatus('error');
      setErrorMessage('Erreur CSV');
    }
  }, [exportData, baseFilename, csvOptions, hasData, stageMode, stageCsvOptions]);

  const handleExportExcel = useCallback(async () => {
    if (!hasData) return;
    setExcelStatus('loading');
    setErrorMessage(null);
    try {
      if (stageMode) {
        downloadStageExportExcel(exportData as StageExportResultData, baseFilename);
      } else {
        downloadExportExcel(exportData as ExportResultData, baseFilename);
      }
      setExcelStatus('success');
      setTimeout(() => setExcelStatus('idle'), 2000);
    } catch (error) {
      console.error('[ExportButtons] Erreur Excel:', error);
      setExcelStatus('error');
      setErrorMessage('Erreur Excel');
    }
  }, [exportData, baseFilename, hasData, stageMode]);

  const handleExportPdf = useCallback(async () => {
    if (!hasData) return;
    setPdfStatus('loading');
    setErrorMessage(null);
    try {
      if (stageMode) {
        await exportStagePdf(exportData as StageExportResultData, stagePdfOptions);
      } else {
        await downloadExportPdf(exportData as ExportResultData, `${baseFilename}.pdf`, {
          ...pdfOptions,
          headerScenarioName: scenario.nom,
        });
      }
      setPdfStatus('success');
      setTimeout(() => setPdfStatus('idle'), 2000);
    } catch (error) {
      console.error('[ExportButtons] Erreur PDF:', error);
      setPdfStatus('error');
      setErrorMessage('Erreur PDF');
    }
  }, [exportData, baseFilename, pdfOptions, scenario.nom, hasData, stageMode, stagePdfOptions]);

  if (!hasData) return null;

  return (
    <div className="export-buttons-compact">
      <button
        className={`export-btn csv-btn ${csvStatus}`}
        onClick={handleExportCsv}
        disabled={csvStatus === 'loading'}
        title="Exporter en CSV"
      >
        {csvStatus === 'loading' ? (
          <ProgressIndicator status="loading" variant="inline" size="sm" indeterminate />
        ) : csvStatus === 'success' ? (
          <Check size={14} className="success-icon" />
        ) : (
          <FileSpreadsheet size={14} />
        )}
        <span className="btn-label">CSV</span>
      </button>

      <button
        className={`export-btn excel-btn ${excelStatus}`}
        onClick={handleExportExcel}
        disabled={excelStatus === 'loading'}
        title="Exporter en Excel (.xlsx)"
      >
        {excelStatus === 'loading' ? (
          <ProgressIndicator status="loading" variant="inline" size="sm" indeterminate />
        ) : excelStatus === 'success' ? (
          <Check size={14} className="success-icon" />
        ) : (
          <FileSpreadsheet size={14} />
        )}
        <span className="btn-label">Excel</span>
      </button>

      <button
        className={`export-btn pdf-btn ${pdfStatus}`}
        onClick={handleExportPdf}
        disabled={pdfStatus === 'loading'}
        title="Exporter en PDF"
      >
        {pdfStatus === 'loading' ? (
          <ProgressIndicator status="loading" variant="inline" size="sm" indeterminate />
        ) : pdfStatus === 'success' ? (
          <Check size={14} className="success-icon" />
        ) : (
          <FileText size={14} />
        )}
        <span className="btn-label">PDF</span>
      </button>

      <div className="export-menu-wrapper">
        <button
          className="export-menu-toggle"
          onClick={() => setShowMenu(!showMenu)}
          title="Plus d'options"
        >
          <ChevronDown size={14} />
        </button>

        {showMenu && (
          <div className="export-menu">
            <div className="menu-section">
              <span className="menu-label">Export rapide</span>
              <div className="menu-stats">
                {exportData.stats.totalAffectes} affectés • {exportData.stats.totalNonAffectes} non-affectés
              </div>
            </div>

            <div className="menu-divider" />

            <div className="menu-section">
              <span className="menu-label">CSV</span>
              <div className="menu-options">
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={csvOptions.includeScheduleColumns}
                    onChange={() => toggleCsvOption('includeScheduleColumns')}
                  />
                  Inclure créneaux horaires
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={csvOptions.includeTopicTitle}
                    onChange={() => toggleCsvOption('includeTopicTitle')}
                  />
                  Ajouter l'intitulé du sujet
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={csvOptions.includeSalle}
                    onChange={() => toggleCsvOption('includeSalle')}
                  />
                  Afficher la salle
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={csvOptions.includeHeaders}
                    onChange={() => toggleCsvOption('includeHeaders')}
                  />
                  Inclure les en-têtes
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={csvOptions.includeUnassignedSheet}
                    onChange={() => toggleCsvOption('includeUnassignedSheet')}
                  />
                  Ajouter l'onglet non-affectés
                </label>
                <div className="option-select">
                  <label>Séparateur</label>
                  <select
                    value={csvOptions.separator}
                    onChange={event =>
                      setCsvOptions(prev => ({
                        ...prev,
                        separator: event.target.value as CsvExportOptions['separator'],
                      }))
                    }
                  >
                    <option value=";">Point-virgule (;)</option>
                    <option value=",">Virgule (,)</option>
                    <option value="\t">Tabulation</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="menu-divider" />

            <div className="menu-section">
              <span className="menu-label">PDF</span>
              <div className="menu-options">
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeScheduleColumns}
                    onChange={() => togglePdfOption('includeScheduleColumns')}
                  />
                  Inclure créneaux horaires
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeTopicTitle}
                    onChange={() => togglePdfOption('includeTopicTitle')}
                  />
                  Ajouter l'intitulé du sujet
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeSalle}
                    onChange={() => togglePdfOption('includeSalle')}
                  />
                  Afficher la salle
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeLetterText}
                    onChange={() => togglePdfOption('includeLetterText')}
                  />
                  Inclure le texte d'introduction
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeUnassignedPage}
                    onChange={() => togglePdfOption('includeUnassignedPage')}
                  />
                  Ajouter la page des non-affectés
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeStatsPage}
                    onChange={() => togglePdfOption('includeStatsPage')}
                  />
                  Ajouter un récapitulatif des stats
                </label>
                <div className="option-select">
                  <label>Orientation</label>
                  <select
                    value={pdfOptions.orientation}
                    onChange={event =>
                      setPdfOptions(prev => ({
                        ...prev,
                        orientation: event.target.value as PdfExportOptions['orientation'],
                      }))
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Paysage</option>
                  </select>
                </div>
                <div className="option-select">
                  <label>Format</label>
                  <select
                    value={pdfOptions.pageSize}
                    onChange={event =>
                      setPdfOptions(prev => ({
                        ...prev,
                        pageSize: event.target.value as PdfExportOptions['pageSize'],
                      }))
                    }
                  >
                    <option value="A4">A4</option>
                    <option value="LETTER">US Letter</option>
                  </select>
                </div>
                <div className="option-select">
                  <label>Taille de police</label>
                  <select
                    value={pdfOptions.fontSize}
                    onChange={event =>
                      setPdfOptions(prev => ({
                        ...prev,
                        fontSize: event.target.value as PdfExportOptions['fontSize'],
                      }))
                    }
                  >
                    <option value="small">Petite</option>
                    <option value="medium">Standard</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
                <div className="option-input">
                  <label>Établissement</label>
                  <input
                    type="text"
                    value={pdfOptions.headerSchoolName ?? ''}
                    placeholder="Collège ..."
                    onChange={event => handlePdfHeaderChange('headerSchoolName', event.target.value)}
                  />
                </div>
                <div className="option-input">
                  <label>Année scolaire</label>
                  <input
                    type="text"
                    value={pdfOptions.headerYear ?? ''}
                    placeholder="2025-2026"
                    onChange={event => handlePdfHeaderChange('headerYear', event.target.value)}
                  />
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="menu-error">
                <AlertCircle size={12} />
                {errorMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
