import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useScenarioStore } from '../stores/scenarioStore';
import { useScenarioArchiveStore } from '../stores/scenarioArchiveStore';
import { useStageStore } from '../stores/stageStore';
import { useAffectationStore } from '../stores/affectationStore';
import { useUIStore } from '../stores/uiStore';
import { ValidatedAssignmentCard, ValidatedAssignmentDrawer } from '../components/dashboard';
import { mapArchiveToExportData, downloadExportPdf, downloadExportCsv } from '../infrastructure/export';
import { ImportSessionModal } from '../components/board/ImportSessionModal';
import { importAffectationSession, type SessionExportData, type ImportReport } from '../services/affectationSessionService';
import type { ScenarioArchive } from '../domain/models';
import {
  CheckCircle,
  Mic,
  Briefcase,
  Sliders,
  MousePointerClick,
  Users,
  GraduationCap,
  Lock,
  FolderOpen,
  ClipboardList,
} from 'lucide-react';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const scenarios = useScenarioStore(state => state.scenarios);
  const stages = useStageStore(state => state.stages);
  const loadStages = useStageStore(state => state.loadStages);
  const { setGuidedScenarioType, setGuidedModeActive, setGuidedStep } = useUIStore();
  const addNotification = useUIStore(state => state.addNotification);

  // Archives
  const archives = useScenarioArchiveStore(state => state.archives);
  const loadArchives = useScenarioArchiveStore(state => state.loadArchives);
  const isLoadingArchives = useScenarioArchiveStore(state => state.loading);

  // Drawer state
  const [selectedArchive, setSelectedArchive] = useState<ScenarioArchive | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Import session modal
  const [showImportSessionModal, setShowImportSessionModal] = useState(false);

  useEffect(() => {
    loadArchives();
    loadStages();
  }, [loadArchives, loadStages]);

  // Launch a guided wizard
  const handleLaunchMode = useCallback((type: 'oral_dnb' | 'suivi_stage') => {
    setGuidedScenarioType(type);
    setGuidedModeActive(true);
    setGuidedStep('eleves'); // Skip scenario choice since type is already set
  }, [setGuidedScenarioType, setGuidedModeActive, setGuidedStep]);

  // Archive handlers
  const handleViewDetail = useCallback((archive: ScenarioArchive) => {
    setSelectedArchive(archive);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedArchive(null);
  }, []);

  const handleExportPdf = useCallback(async (archive: ScenarioArchive) => {
    try {
      const exportData = mapArchiveToExportData(archive);
      const filename = `${archive.scenarioNom.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(archive.archivedAt).toISOString().split('T')[0]}.pdf`;
      await downloadExportPdf(exportData, filename);
      addNotification({ type: 'success', message: 'Export PDF termine' });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      addNotification({ type: 'error', message: "Erreur lors de l'export PDF" });
    }
  }, [addNotification]);

  const handleExportCsv = useCallback((archive: ScenarioArchive) => {
    try {
      const exportData = mapArchiveToExportData(archive);
      const filename = `${archive.scenarioNom.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(archive.archivedAt).toISOString().split('T')[0]}`;
      downloadExportCsv(exportData, filename);
      addNotification({ type: 'success', message: 'Export CSV termine' });
    } catch (error) {
      console.error('Erreur export CSV:', error);
      addNotification({ type: 'error', message: "Erreur lors de l'export CSV" });
    }
  }, [addNotification]);

  // Import session
  const handleImportSession = useCallback(async (data: SessionExportData): Promise<ImportReport> => {
    const scenariosState = useScenarioStore.getState().scenarios;
    const upsertStage = useStageStore.getState().upsertStageForEleve;
    const addAffectation = useAffectationStore.getState().addAffectation;
    const deleteAffectationsByScenario = useAffectationStore.getState().deleteAffectationsByScenario;
    const updateScenarioParametres = useScenarioStore.getState().updateParametres;
    const setActiveScenarioId = useScenarioStore.getState().setCurrentScenario;
    const updateEnseignant = useEnseignantStore.getState().updateEnseignant;

    const report = await importAffectationSession(data, {
      eleves,
      enseignants,
      stages,
      scenarios: scenariosState,
      upsertStage,
      addAffectation,
      deleteAffectationsByScenario,
      updateScenarioParametres,
      setActiveScenarioId,
      updateEnseignantGeo: (id, geo) => updateEnseignant(id, geo),
    });

    if (report.success && report.affectationsImported > 0) {
      setTimeout(() => navigate('/board'), 500);
    }

    return report;
  }, [eleves, enseignants, stages, navigate]);

  // Sort archives
  const sortedArchives = useMemo(() =>
    [...archives].sort((a, b) =>
      new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
    ),
    [archives]
  );

  return (
    <div className="dashboard-page">
      {/* Hero section */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <h1>
            <span className="hero-logo">G</span>
            Groupit
          </h1>
          <p>Organisez vos affectations en quelques clics</p>
        </div>
      </div>

      {/* Mode selection grid */}
      <div className="mode-grid">
        <button className="mode-card active" onClick={() => handleLaunchMode('oral_dnb')}>
          <div className="mode-icon oral">
            <Mic size={32} />
          </div>
          <h3>Oral DNB</h3>
          <p>Constituez les jurys et repartissez les eleves pour l'oral du brevet.</p>
        </button>

        <button className="mode-card active" onClick={() => handleLaunchMode('suivi_stage')}>
          <div className="mode-icon stage">
            <Briefcase size={32} />
          </div>
          <h3>Stages 3eme</h3>
          <p>Affectez les enseignants tuteurs aux stages de vos eleves.</p>
        </button>

        <div className="mode-card disabled" title="Disponible dans une prochaine version">
          <div className="mode-icon custom">
            <Sliders size={32} />
          </div>
          <h3>Mode Personnalise</h3>
          <p>Criteres d'affectation automatique personnalisables.</p>
          <span className="mode-badge">
            <Lock size={12} />
            Bientot
          </span>
        </div>

        <button className="mode-card active" onClick={() => navigate('/libre')}>
          <div className="mode-icon libre">
            <MousePointerClick size={32} />
          </div>
          <h3>Mode Libre</h3>
          <p>Glisser-deposer manuel et configuration libre des groupes.</p>
        </button>
      </div>

      {/* Data summary + quick actions */}
      <div className="dashboard-summary">
        <div className="summary-stats">
          <div className="summary-stat">
            <Users size={18} />
            <span className="stat-value">{eleves.length}</span>
            <span className="stat-label">eleves</span>
          </div>
          <div className="summary-stat">
            <GraduationCap size={18} />
            <span className="stat-value">{enseignants.length}</span>
            <span className="stat-label">enseignants</span>
          </div>
          <div className="summary-stat">
            <ClipboardList size={18} />
            <span className="stat-value">{scenarios.length}</span>
            <span className="stat-label">configurations</span>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => setShowImportSessionModal(true)}>
          <FolderOpen size={18} />
          Reprendre une session
        </button>
      </div>

      {/* Archives / history */}
      {archives.length > 0 && (
        <div className="dashboard-history">
          <h2>
            <CheckCircle size={20} />
            Historique des affectations
          </h2>
          {isLoadingArchives ? (
            <div className="loading-state">Chargement...</div>
          ) : (
            <div className="validated-assignments-grid">
              {sortedArchives.slice(0, 6).map(archive => (
                <ValidatedAssignmentCard
                  key={archive.id}
                  archive={archive}
                  onViewDetail={() => handleViewDetail(archive)}
                  onExportPdf={() => handleExportPdf(archive)}
                  onExportCsv={() => handleExportCsv(archive)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drawers / Modals */}
      {selectedArchive && (
        <ValidatedAssignmentDrawer
          archive={selectedArchive}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onExportPdf={() => handleExportPdf(selectedArchive)}
          onExportCsv={() => handleExportCsv(selectedArchive)}
        />
      )}

      <ImportSessionModal
        isOpen={showImportSessionModal}
        onClose={() => setShowImportSessionModal(false)}
        onImport={handleImportSession}
      />
    </div>
  );
};
