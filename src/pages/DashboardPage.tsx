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
import { mapArchiveToExportData } from '../infrastructure/export/dataMapper';
import { downloadExportCsv } from '../infrastructure/export/exportCsv';
import { loadPdfExport } from '../lazyModules';
import { ImportSessionModal } from '../components/board/ImportSessionModal';
import { importAffectationSession, type SessionExportData, type ImportReport } from '../services/affectationSessionService';
import type { ScenarioArchive } from '../domain/models';
import { useJuryStore } from '../stores/juryStore';
import {
  CheckCircle,
} from 'lucide-react';
import { etapeDeDepart } from '../components/guided/guidedFlow';
import './DashboardPage.css';
import './Accueil.css';
import { AccueilPreparation, type ActionsAccueil } from '../components/accueil/AccueilPreparation';
import { lireDateStage, type EtatPreparation, type ActionAccueil } from '../services/accueilService';

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
  const handleLaunchMode = useCallback((type: 'oral_dnb' | 'suivi_stage' | 'personnalise') => {
    setGuidedScenarioType(type);
    setGuidedModeActive(true);
    setGuidedStep(etapeDeDepart(type, useEleveStore.getState().eleves.length));
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
      const { downloadExportPdf } = await loadPdfExport();
      await downloadExportPdf(exportData, filename);
      addNotification({ type: 'success', message: 'Export PDF terminé' });
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
      addNotification({ type: 'success', message: 'Export CSV terminé' });
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

  const inProgressCustom = useMemo(() => {
    const customScenarios = scenarios.filter(s => s.type === 'custom');
    for (const s of customScenarios) {
      const hasJurys = jurys.some(j => j.scenarioId === s.id);
      const hasAffectations = affectations.some(a => a.scenarioId === s.id);
      if (hasJurys || hasAffectations) return s;
    }
    return null;
  }, [scenarios, jurys, affectations]);

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

  // État de la préparation : uniquement des comptes, aucun nom
  const openModal = useUIStore(state => state.openModal);
  const etatPreparation = useMemo<EtatPreparation>(() => {
    const eleves3e = eleves.filter(e => e.classe?.startsWith("3"));
    const ids3e = new Set(eleves3e.map(e => e.id));
    const stages3e = stages.filter(st => st.eleveId && ids3e.has(st.eleveId));
    const debuts = stages3e.map(st => lireDateStage(st.dateDebut)).filter((d): d is Date => d !== null);
    const aujourdhui = new Date();
    const aVenir = debuts.filter(d => d.getTime() >= aujourdhui.getTime() - 86_400_000).sort((x, y) => x.getTime() - y.getTime());
    return {
      nbEleves: eleves3e.length,
      nbClasses: new Set(eleves3e.map(e => e.classe)).size,
      nbEnseignants: enseignants.length,
      nbEnseignantsSansAdresse: enseignants.filter(e => !e.adresse?.trim()).length,
      nbStages: new Set(stages3e.map(st => st.eleveId)).size,
      debutStages: aVenir[0] ?? debuts.sort((x, y) => x.getTime() - y.getTime())[0] ?? null,
      nbSujetsRenseignes: eleves3e.filter(e => e.sujetOral?.trim() || e.parcoursOral?.trim()).length,
      oral: {
        enCours: !!inProgressOralDnb,
        nbJurys: inProgressOralDnb ? jurys.filter(j => j.scenarioId === inProgressOralDnb.id).length : 0,
        nbRepartis: inProgressOralDnb ? affectations.filter(af => af.scenarioId === inProgressOralDnb.id).length : 0,
      },
      stages: {
        enCours: !!inProgressStage,
        nbAttribues: inProgressStage ? affectations.filter(af => af.scenarioId === inProgressStage.id).length : 0,
      },
      aujourdhui,
    };
  }, [eleves, enseignants, stages, jurys, affectations, inProgressOralDnb, inProgressStage]);

  const actionsAccueil: ActionsAccueil = {
    lancer: (action: ActionAccueil) => {
      switch (action) {
        case "importer-eleves": openModal("import"); break;
        case "importer-enseignants": navigate("/parametres"); break;
        case "importer-stages":
        case "attribuer-tuteurs": handleLaunchMode("suivi_stage"); break;
        case "reprendre-stages": if (inProgressStage) handleResumeScenario(inProgressStage.id!); break;
        case "preparer-oral": handleLaunchMode("oral_dnb"); break;
        case "reprendre-oral": if (inProgressOralDnb) handleResumeScenario(inProgressOralDnb.id!); break;
      }
    },
    ouvrir: (chemin: string) => {
      if (chemin === "personnalise") {
        if (inProgressCustom) handleResumeScenario(inProgressCustom.id!);
        else handleLaunchMode("personnalise");
      } else {
        navigate(chemin);
      }
    },
    recommencerOral: () => handleLaunchMode("oral_dnb"),
    recommencerStages: () => handleLaunchMode("suivi_stage"),
    reprendreStages: () => { if (inProgressStage) handleResumeScenario(inProgressStage.id!); },
    reprendreSession: () => setShowImportSessionModal(true),
  };

  return (
    <div className="dashboard-page">
      <AccueilPreparation etat={etatPreparation} actions={actionsAccueil} />

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
