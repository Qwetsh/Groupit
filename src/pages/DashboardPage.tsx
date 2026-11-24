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
  Mic,
  Briefcase,
  Sliders,
  MousePointerClick,
  FolderOpen,
  Play,
  RotateCcw,
} from 'lucide-react';
import { etapeDeDepart } from '../components/guided/guidedFlow';
import './DashboardPage.css';
import './Accueil.css';

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

  const nbJurysDe = (id?: string) => jurys.filter(j => j.scenarioId === id).length;
  const nbAffectationsDe = (id?: string) => affectations.filter(a => a.scenarioId === id).length;
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

  const taches = [
    {
      id: "oral", icone: "oral", symbole: <Mic size={28} />, titre: "Oral du DNB",
      description: "Constituez les jurys et répartissez les élèves pour l’oral du brevet.",
      enCours: !!inProgressOralDnb,
      etat: inProgressOralDnb ? `${pluriel(nbJurysDe(inProgressOralDnb.id), "jury")}, ${pluriel(nbAffectationsDe(inProgressOralDnb.id), "élève")} répartis` : "",
      libelleCommencer: "Commencer",
      commencer: () => handleLaunchMode("oral_dnb"),
      reprendre: () => inProgressOralDnb && handleResumeScenario(inProgressOralDnb.id!),
      recommencer: () => handleLaunchMode("oral_dnb"),
    },
    {
      id: "stages", icone: "stage", symbole: <Briefcase size={28} />, titre: "Stages de 3e",
      description: "Attribuez un enseignant tuteur à chaque stage, au plus près.",
      enCours: !!inProgressStage,
      etat: inProgressStage ? `${pluriel(nbAffectationsDe(inProgressStage.id), "stage")} attribués` : "",
      libelleCommencer: "Commencer",
      commencer: () => handleLaunchMode("suivi_stage"),
      reprendre: () => inProgressStage && handleResumeScenario(inProgressStage.id!),
      recommencer: () => handleLaunchMode("suivi_stage"),
    },
    {
      id: "perso", icone: "custom", symbole: <Sliders size={28} />, titre: "Mode personnalisé",
      description: "Formez des groupes selon vos propres critères.",
      enCours: !!inProgressCustom,
      etat: inProgressCustom ? `${pluriel(nbJurysDe(inProgressCustom.id), "groupe")}, ${pluriel(nbAffectationsDe(inProgressCustom.id), "élève")} répartis` : "",
      libelleCommencer: "Commencer",
      commencer: () => handleLaunchMode("personnalise"),
      reprendre: () => inProgressCustom && handleResumeScenario(inProgressCustom.id!),
      recommencer: () => handleLaunchMode("personnalise"),
    },
    {
      id: "libre", icone: "libre", symbole: <MousePointerClick size={28} />, titre: "Mode libre",
      description: "Composez les groupes vous-même, par glisser-déposer.",
      enCours: false, etat: "",
      libelleCommencer: "Ouvrir",
      commencer: () => navigate("/libre"),
      reprendre: () => navigate("/libre"),
      recommencer: undefined,
    },
  ];

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

      {/* Une carte par tâche, avec son état : commencer, ou reprendre / recommencer */}
      <div className="taches-grid">
        {taches.map(t => (
          <article key={t.id} className={`tache-card ${t.enCours ? "en-cours" : ""}`} aria-labelledby={`tache-${t.id}`}>
            <div className={`mode-icon ${t.icone}`} aria-hidden="true">{t.symbole}</div>
            <div className="tache-texte">
              <h3 id={`tache-${t.id}`}>{t.titre}</h3>
              <p className="tache-etat">
                {t.enCours ? <><span className="tache-badge"><Play size={12} /> En cours</span> {t.etat}</> : t.description}
              </p>
            </div>
            <div className="tache-actions">
              {t.enCours ? (
                <>
                  <button className="tache-btn primaire" onClick={t.reprendre}>Reprendre</button>
                  {t.recommencer && (
                    <button className="tache-btn" onClick={t.recommencer}>
                      <RotateCcw size={14} /> Recommencer
                    </button>
                  )}
                </>
              ) : (
                <button className="tache-btn primaire" onClick={t.commencer}>{t.libelleCommencer}</button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="accueil-secondaire">
        <button className="btn-lien" onClick={() => setShowImportSessionModal(true)}>
          <FolderOpen size={16} />
          Reprendre une session sauvegardée (fichier)
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
