// ============================================================
// EXPORT BUTTONS - Boutons compacts pour exporter les résultats
// ============================================================

import React, { useState, useMemo, useCallback, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
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
  type CsvExportOptions,
  type PdfExportOptions,
  type ExportResultData,
  DEFAULT_CSV_OPTIONS,
  DEFAULT_PDF_OPTIONS,
} from '../../infrastructure/export/types';
import { mapToExportData } from '../../infrastructure/export/dataMapper';
import { downloadExportCsv } from '../../infrastructure/export/exportCsv';
// Stage export
import {
  DEFAULT_STAGE_CSV_OPTIONS,
  DEFAULT_STAGE_PDF_OPTIONS,
  type StageExportResultData,
} from '../../infrastructure/export/stageTypes';
import { mapToStageExportData } from '../../infrastructure/export/stageDataMapper';
import { exportAndDownloadStageCsv } from '../../infrastructure/export/exportStageCsv';
// PDF et Excel : modules lourds, chargés à la demande
import { loadExcelExport, loadPdfExport, loadStagePdfExport } from '../../lazyModules';
import { checkSessionHasScores, getDirectionCode } from '../../infrastructure/export/supabaseUpload';
import type { OnlineSessionResult } from '../../infrastructure/export/supabaseUpload';
import {
  SESSION_CODE_MIN_LENGTH,
  formatCodeForDisplay,
  generateSessionCode,
  sanitizeSessionCode,
} from '../../infrastructure/export/sessionCode';
import { useDialog } from '../../hooks/useDialog';
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
  
  const isOralDnb = scenario.type === 'oral_dnb';

  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>(() => ({
    ...DEFAULT_PDF_OPTIONS,
    headerYear: String(new Date().getFullYear()),
    // Auto-enable schedule columns for oral DNB
    includeScheduleColumns: scenario.type === 'oral_dnb',
  }));

  const [dateOral, setDateOral] = useState('');
  const [typeOral, setTypeOral] = useState<'dnb' | 'oral_blanc'>('dnb');
  const [sessionCode, setSessionCode] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Notation en ligne : résultat de la mise en ligne, et recherche du code direction
  const [onlineResult, setOnlineResult] = useState<(OnlineSessionResult & { sessionCode: string }) | null>(null);
  const [directionLookup, setDirectionLookup] = useState<
    { status: 'idle' | 'loading' | 'none' | 'error' } | { status: 'found'; code: string }
  >({ status: 'idle' });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const changeSessionCode = useCallback((value: string) => {
    setSessionCode(sanitizeSessionCode(value));
    setDirectionLookup({ status: 'idle' });
  }, []);

  const handleFindDirectionCode = useCallback(async () => {
    setDirectionLookup({ status: 'loading' });
    try {
      const code = await getDirectionCode(sessionCode);
      setDirectionLookup(code ? { status: 'found', code } : { status: 'none' });
    } catch {
      setDirectionLookup({ status: 'error' });
    }
  }, [sessionCode]);

  const handleCopyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
    } catch {
      setCopiedCode(null); // presse-papiers indisponible : le code reste affiché
    }
  }, []);

  // Sections PDF à inclure
  const [sectionConvocEleve, setSectionConvocEleve] = useState(true);
  const [sectionConvocProf, setSectionConvocProf] = useState(true);
  const [sectionEmargement, setSectionEmargement] = useState(true);
  const [sectionFeuillesPorte, setSectionFeuillesPorte] = useState(true);
  const [sectionRecapJurys, setSectionRecapJurys] = useState(true);

  // Options stage (séparées)
  const [stageCsvOptions] = useState(() => ({ ...DEFAULT_STAGE_CSV_OPTIONS }));
  const [stagePdfOptions] = useState(() => ({
    ...DEFAULT_STAGE_PDF_OPTIONS,
    headerYear: String(new Date().getFullYear())
  }));

  // Ref pour positionner le menu via portal
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  // Refs pour les setTimeout (cleanup on unmount)
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const addTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  // Calculer la position du menu quand il s'ouvre
  useEffect(() => {
    if (showMenu && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showMenu]);

  // Click-outside handler pour fermer le menu portal
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        toggleRef.current && !toggleRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

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
    const data = exportData as ExportResultData;
    return (data.stats.totalAffectes > 0 || data.stats.totalNonAffectes > 0);
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
      addTimeout(() => setCsvStatus('idle'), 2000);
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
      const { downloadStageExportExcel, downloadExportExcel } = await loadExcelExport();
      if (stageMode) {
        downloadStageExportExcel(exportData as StageExportResultData, baseFilename);
      } else {
        downloadExportExcel(exportData as ExportResultData, baseFilename);
      }
      setExcelStatus('success');
      addTimeout(() => setExcelStatus('idle'), 2000);
    } catch (error) {
      console.error('[ExportButtons] Erreur Excel:', error);
      setExcelStatus('error');
      setErrorMessage('Erreur Excel');
    }
  }, [exportData, baseFilename, hasData, stageMode]);

  const doExportPdf = useCallback(async () => {
    if (!hasData) return;

    // D. Protection : vérifier si des notes existent déjà avant ré-export
    if (sessionCode) {
      try {
        const { hasScores, count } = await checkSessionHasScores(sessionCode);
        if (hasScores) {
          const confirmed = window.confirm(
            `${count} note(s) déjà enregistrée(s) pour la session "${sessionCode.toUpperCase()}". ` +
            `Le PDF sera généré, mais la session en ligne et ses notes ne seront pas modifiées. Continuer ?`
          );
          if (!confirmed) return;
        }
      } catch { /* ignore, proceed with export */ }
    }

    setShowPdfModal(false);
    setPdfStatus('loading');
    setErrorMessage(null);
    try {
      if (stageMode) {
        const { exportStagePdf } = await loadStagePdfExport();
        await exportStagePdf(exportData as StageExportResultData, {
          ...stagePdfOptions,
          showLogoAcademie: pdfOptions.showLogoAcademie,
          showLogoEducationNationale: pdfOptions.showLogoEducationNationale,
          collegeName: pdfOptions.headerSchoolName,
          headerYear: pdfOptions.headerYear,
        });
      } else {
        const pdfData = exportData as ExportResultData;
        const { downloadExportPdf } = await loadPdfExport();
        const online = await downloadExportPdf(pdfData, `${baseFilename}.pdf`, {
          ...pdfOptions,
          headerScenarioName: scenario.nom,
          dateOral: dateOral || undefined,
          typeOral,
          sessionCode: sessionCode || undefined,
          includeSectionConvocEleve: sectionConvocEleve,
          includeSectionConvocProf: sectionConvocProf,
          includeSectionEmargement: sectionEmargement,
          includeSectionFeuillesPorte: sectionFeuillesPorte,
          includeSectionRecapJurys: sectionRecapJurys,
        });
        if (online && sessionCode) {
          setCopiedCode(null);
          setOnlineResult({ ...online, sessionCode });
        }
      }
      setPdfStatus('success');
      addTimeout(() => setPdfStatus('idle'), 2000);
    } catch (error) {
      console.error('[ExportButtons] Erreur PDF:', error);
      setPdfStatus('error');
      setErrorMessage('Erreur PDF');
    }
  }, [exportData, baseFilename, pdfOptions, scenario.nom, hasData, stageMode, stagePdfOptions, dateOral, typeOral, sessionCode, sectionConvocEleve, sectionConvocProf, sectionEmargement, sectionFeuillesPorte, sectionRecapJurys]);

  const handlePdfClick = useCallback(() => {
    if (!hasData) return;
    if (isOralDnb) {
      setShowPdfModal(true);
    } else {
      doExportPdf();
    }
  }, [hasData, isOralDnb, doExportPdf]);

  const pdfModalTitreId = useId();
  const onlineResultTitreId = useId();
  const pdfModalRef = useDialog<HTMLDivElement>(showPdfModal, () => setShowPdfModal(false));
  const onlineResultRef = useDialog<HTMLDivElement>(onlineResult !== null, () => setOnlineResult(null));

  if (!hasData) return null;

  return (
    <div className="export-buttons-compact" role="group" aria-label="Exporter les résultats">
      <span className="export-titre">Exporter</span>
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
        onClick={handlePdfClick}
        disabled={pdfStatus === 'loading'}
        title={isOralDnb ? "Convocations en PDF, et mise en ligne pour les jurys" : "Exporter en PDF"}
      >
        {pdfStatus === 'loading' ? (
          <ProgressIndicator status="loading" variant="inline" size="sm" indeterminate />
        ) : pdfStatus === 'success' ? (
          <Check size={14} className="success-icon" />
        ) : (
          <FileText size={14} />
        )}
        <span className="btn-label">{isOralDnb ? "PDF et jurys" : "PDF"}</span>
      </button>

      <div className="export-menu-wrapper">
        <button
          ref={toggleRef}
          className="export-menu-toggle"
          onClick={() => setShowMenu(!showMenu)}
          title="Options d'export"
          aria-label="Options d'export"
          aria-expanded={showMenu}
        >
          <ChevronDown size={14} />
        </button>

        {showMenu && menuPosition && createPortal(
          <div
            ref={menuRef}
            className="export-menu export-menu-portal"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              right: menuPosition.right,
            }}
          >
            <div className="menu-section">
              <span className="menu-label">Export rapide</span>
              <div className="menu-stats">
                {stageMode
                  ? `${(exportData as StageExportResultData).enseignants?.length ?? 0} enseignants • ${(exportData as StageExportResultData).unassigned?.length ?? 0} non-affectés`
                  : `${(exportData as ExportResultData).stats.totalAffectes} affectés • ${(exportData as ExportResultData).stats.totalNonAffectes} non-affectés`
                }
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
                    checked={pdfOptions.showLogoAcademie}
                    onChange={() => togglePdfOption('showLogoAcademie')}
                  />
                  Logo Académie Grand Est
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={pdfOptions.showLogoEducationNationale}
                    onChange={() => togglePdfOption('showLogoEducationNationale')}
                  />
                  Logo Éducation Nationale
                </label>
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
          </div>,
          document.body
        )}
      </div>

      {/* Modale pré-export PDF pour oral DNB */}
      {showPdfModal && createPortal(
        <div className="pdf-modal-overlay" onClick={() => setShowPdfModal(false)}>
          <div
            ref={pdfModalRef}
            className="pdf-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={pdfModalTitreId}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="pdf-modal-title" id={pdfModalTitreId}>Export PDF</h3>

            <div className="pdf-modal-field">
              <label className="pdf-modal-label">Type d'oral</label>
              <div className="pdf-modal-radios">
                <label className={`pdf-modal-radio ${typeOral === 'dnb' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="typeOral"
                    checked={typeOral === 'dnb'}
                    onChange={() => setTypeOral('dnb')}
                  />
                  Oral du DNB
                </label>
                <label className={`pdf-modal-radio ${typeOral === 'oral_blanc' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="typeOral"
                    checked={typeOral === 'oral_blanc'}
                    onChange={() => setTypeOral('oral_blanc')}
                  />
                  Oral blanc
                </label>
              </div>
            </div>

            <div className="pdf-modal-field">
              <label className="pdf-modal-label">Date de l'oral</label>
              <input
                type="date"
                className="pdf-modal-date"
                value={dateOral}
                onChange={e => setDateOral(e.target.value)}
              />
            </div>

            <div className="pdf-modal-field">
              <label className="pdf-modal-label">Sections à inclure</label>
              <div className="pdf-modal-sections">
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={sectionConvocEleve}
                    onChange={() => setSectionConvocEleve(v => !v)}
                  />
                  Convocations élèves
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={sectionConvocProf}
                    onChange={() => setSectionConvocProf(v => !v)}
                  />
                  Convocations enseignants
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={sectionEmargement}
                    onChange={() => setSectionEmargement(v => !v)}
                  />
                  Feuilles d'émargement
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={sectionRecapJurys}
                    onChange={() => setSectionRecapJurys(v => !v)}
                  />
                  Récapitulatif des jurys
                </label>
                <label className="option-checkbox">
                  <input
                    type="checkbox"
                    checked={sectionFeuillesPorte}
                    onChange={() => setSectionFeuillesPorte(v => !v)}
                  />
                  Feuilles de porte
                </label>
              </div>
            </div>

            <div className="pdf-modal-field">
              <label className="pdf-modal-label">QR Code — Notation en ligne (optionnel)</label>
              <div className="pdf-modal-code-row">
                <input
                  type="text"
                  className="pdf-modal-date"
                  value={sessionCode}
                  placeholder="Code de session"
                  maxLength={8}
                  aria-label="Code de session"
                  onChange={e => changeSessionCode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => changeSessionCode(generateSessionCode())}
                >
                  Générer
                </button>
              </div>
              <span className="pdf-modal-hint">
                {sessionCode
                  ? 'Un QR code sera ajouté sur chaque convocation enseignant : les jurys n\'ont pas à saisir le code.'
                  : 'Laissez vide pour un PDF sans notation en ligne. Un code généré est plus sûr qu\'un code choisi à la main.'}
              </span>
              {sessionCode.length > 0 && sessionCode.length < SESSION_CODE_MIN_LENGTH && (
                <span className="pdf-modal-hint pdf-modal-hint-warning">
                  Le code doit comporter au moins {SESSION_CODE_MIN_LENGTH} caractères.
                </span>
              )}
              {sessionCode.length >= SESSION_CODE_MIN_LENGTH && (
                <div className="pdf-modal-hint" role="status">
                  {directionLookup.status === 'found' ? (
                    <>Code direction de cette session : <strong className="pdf-modal-code-inline">{formatCodeForDisplay(directionLookup.code)}</strong></>
                  ) : directionLookup.status === 'none' ? (
                    'Aucune session en ligne n\'a été créée depuis ce navigateur avec ce code.'
                  ) : directionLookup.status === 'error' ? (
                    'Recherche impossible. Vérifiez votre connexion.'
                  ) : (
                    <button
                      type="button"
                      className="pdf-modal-link"
                      onClick={handleFindDirectionCode}
                      disabled={directionLookup.status === 'loading'}
                    >
                      {directionLookup.status === 'loading' ? 'Recherche…' : 'Retrouver le code direction de cette session'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="pdf-modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowPdfModal(false)}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={doExportPdf}
                disabled={
                  (!sectionConvocEleve && !sectionConvocProf && !sectionEmargement && !sectionFeuillesPorte && !sectionRecapJurys)
                  || (sessionCode.length > 0 && sessionCode.length < SESSION_CODE_MIN_LENGTH)
                }
              >
                Générer le PDF
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Résultat de la mise en ligne de la session */}
      {onlineResult && createPortal(
        <div className="pdf-modal-overlay" onClick={() => setOnlineResult(null)}>
          <div
            ref={onlineResultRef}
            className="pdf-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={onlineResultTitreId}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="pdf-modal-title" id={onlineResultTitreId}>Notation en ligne</h3>

            {onlineResult.success ? (
              <>
                <p className="pdf-modal-text">
                  Le PDF est téléchargé et la session en ligne est prête.
                </p>

                <div className="pdf-modal-field">
                  <span className="pdf-modal-label">Code de session — pour les jurys</span>
                  <div className="pdf-modal-code">{onlineResult.sessionCode}</div>
                  <span className="pdf-modal-hint">
                    Déjà dans les QR codes des convocations enseignants.
                  </span>
                </div>

                {onlineResult.directionCode && (
                  <div className="pdf-modal-field">
                    <span className="pdf-modal-label">Code direction — pour le tableau de bord</span>
                    <div className="pdf-modal-code-row">
                      <div className="pdf-modal-code">{formatCodeForDisplay(onlineResult.directionCode)}</div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleCopyCode(onlineResult.directionCode!)}
                      >
                        {copiedCode === onlineResult.directionCode ? 'Copié' : 'Copier'}
                      </button>
                    </div>
                    <span className="pdf-modal-hint">
                      Il donne accès à toutes les notes et au verrouillage de la session : ne le
                      transmettez qu'à la direction. Il n'est pas imprimé dans le PDF. Sur ce poste,
                      le tableau de bord s'ouvre sans lui, et vous pouvez le retrouver depuis cette
                      fenêtre d'export.
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="pdf-modal-text">
                  Le PDF est téléchargé, mais la session en ligne n'a pas été créée :
                  les QR codes de ce PDF ne fonctionneront pas.
                </p>
                <div className="menu-error" role="alert">
                  <AlertCircle size={12} />
                  {onlineResult.error ?? 'Erreur inconnue.'}
                </div>
              </>
            )}

            <div className="pdf-modal-actions">
              <button className="btn btn-primary" onClick={() => setOnlineResult(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
