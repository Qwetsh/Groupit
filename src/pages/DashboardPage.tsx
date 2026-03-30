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
import { useJuryStore } from '../stores/juryStore';
import {
  CheckCircle,
  Mic,
  Briefcase,
  Sliders,
  MousePointerClick,
  Lock,
  FolderOpen,
  Play,
  RotateCcw,
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

  // Detect in-progress scenarios
  const affectations = useAffectationStore(state => state.affectations);
  const jurys = useJuryStore(state => state.jurys);
  const setCurrentScenario = useScenarioStore(state => state.setCurrentScenario);

  const inProgressOralDnb = useMemo(() => {
    const oralScenarios = scenarios.filter(s => s.type === 'oral_dnb');
    for (const s of oralScenarios) {
      const hasJurys = jurys.some(j => j.scenarioId === s.id);
      const hasAffectations = affectations.some(a => a.scenarioId === s.id);
      if (hasJurys || hasAffectations) return s;
    }
    return null;
  }, [scenarios, jurys, affectations]);

  const inProgressStage = useMemo(() => {
    const stageScenarios = scenarios.filter(s => s.type === 'suivi_stage');
    for (const s of stageScenarios) {
      const hasAffectations = affectations.some(a => a.scenarioId === s.id);
      if (hasAffectations) return s;
    }
    return null;
  }, [scenarios, affectations]);

  const handleResumeScenario = useCallback((scenarioId: string) => {
    setCurrentScenario(scenarioId);
    navigate('/board');
  }, [setCurrentScenario, navigate]);

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
            <span className="hero-logo">L</span>
            Locanda
          </h1>
          <p>Organisez vos affectations en quelques clics</p>
        </div>
      </div>

      {/* Mode selection grid */}
      <div className="mode-grid">
        <div className="mode-card-wrapper">
          <button
            className={`mode-card active ${inProgressOralDnb ? 'has-session' : ''}`}
            onClick={() => inProgressOralDnb ? handleResumeScenario(inProgressOralDnb.id!) : handleLaunchMode('oral_dnb')}
          >
            <div className="mode-icon oral">
              <Mic size={32} />
            </div>
            <h3>{inProgressOralDnb ? 'Reprendre l\'affectation' : 'Oral DNB'}</h3>
            <p>
              {inProgressOralDnb
                ? `${inProgressOralDnb.nom} — ${jurys.filter(j => j.scenarioId === inProgressOralDnb.id).length} jury(s), ${affectations.filter(a => a.scenarioId === inProgressOralDnb.id).length} affectation(s)`
                : 'Constituez les jurys et repartissez les eleves pour l\'oral du brevet.'
              }
            </p>
            {inProgressOralDnb && (
              <span className="mode-resume-badge"><Play size={12} /> En cours</span>
            )}
          </button>
          {inProgressOralDnb && (
            <button className="mode-new-link" onClick={() => handleLaunchMode('oral_dnb')}>
              <RotateCcw size={11} />
              Nouvelle constitution
            </button>
          )}
        </div>

        <div className="mode-card-wrapper">
          <button
            className={`mode-card active ${inProgressStage ? 'has-session' : ''}`}
            onClick={() => inProgressStage ? handleResumeScenario(inProgressStage.id!) : handleLaunchMode('suivi_stage')}
          >
            <div className="mode-icon stage">
              <Briefcase size={32} />
            </div>
            <h3>{inProgressStage ? 'Reprendre l\'affectation' : 'Stages 3eme'}</h3>
            <p>
              {inProgressStage
                ? `${inProgressStage.nom} — ${affectations.filter(a => a.scenarioId === inProgressStage.id).length} affectation(s)`
                : 'Affectez les enseignants tuteurs aux stages de vos eleves.'
              }
            </p>
            {inProgressStage && (
              <span className="mode-resume-badge"><Play size={12} /> En cours</span>
            )}
          </button>
          {inProgressStage && (
            <button className="mode-new-link" onClick={() => handleLaunchMode('suivi_stage')}>
              <RotateCcw size={11} />
              Nouvelle constitution
            </button>
          )}
        </div>

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

        <button className="mode-card active" onClick={() => setShowImportSessionModal(true)}>
          <div className="mode-icon import">
            <FolderOpen size={32} />
          </div>
          <h3>Reprendre une session</h3>
          <p>Importez une session sauvegardee pour reprendre le travail.</p>
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
