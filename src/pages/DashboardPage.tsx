import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useScenarioStore } from '../stores/scenarioStore';
import { useScenarioArchiveStore } from '../stores/scenarioArchiveStore';
import { useStageStore } from '../stores/stageStore';
import { useAffectationStore } from '../stores/affectationStore';
import { useJuryStore } from '../stores/juryStore';
import { useUIStore } from '../stores/uiStore';
import { ValidatedAssignmentCard, ValidatedAssignmentDrawer, StagesMapCard } from '../components/dashboard';
import { HelpTooltip, HELP_TEXTS } from '../components/ui/Tooltip';
import { mapArchiveToExportData, downloadExportPdf, downloadExportCsv } from '../infrastructure/export';
import { ImportSessionModal } from '../components/board/ImportSessionModal';
import { importAffectationSession, type SessionExportData, type ImportReport } from '../services/affectationSessionService';
import { JuryManager } from '../components/jury';
import { StageScenarioManager } from '../components/scenario-stage';
import { filterEleves } from '../utils/filteringUtils';
import type { ScenarioArchive } from '../domain/models';
import type { GeoPoint } from '../infrastructure/geo/types';
import {
  CheckCircle,
  AlertTriangle,
  Play,
  Upload,
  Plus,
  ClipboardList,
  ArrowRight,
  Sparkles,
  Settings,
  X,
  Eye,
  EyeOff,
  FolderOpen,
  Mic,
  Briefcase,
  Users,
  MoreVertical,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Route,
  GraduationCap
} from 'lucide-react';
import './DashboardPage.css';

// Coordonnées du collège (référence pour la carte)
const COLLEGE_GEO: GeoPoint = {
  lat: 49.1452,
  lon: 6.1667,
};

// Types pour les alertes
interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const scenarios = useScenarioStore(state => state.scenarios);
  const activeScenario = useScenarioStore(state => state.getActiveScenario());
  const setCurrentScenario = useScenarioStore(state => state.setCurrentScenario);
  const deleteScenario = useScenarioStore(state => state.deleteScenario);
  const stages = useStageStore(state => state.stages);
  const loadStages = useStageStore(state => state.loadStages);
  const jurys = useJuryStore(state => state.jurys);
  const openModal = useUIStore(state => state.openModal);

  // Dashboard preferences
  const dashboardPrefs = useUIStore(state => state.dashboardPrefs);
  const toggleDashboardPref = useUIStore(state => state.toggleDashboardPref);

  // Config panel state
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Expanded config card state
  const [expandedScenarioId, setExpandedScenarioId] = useState<string | null>(null);

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuId && !(e.target as Element).closest('.config-menu')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Archives state
  const archives = useScenarioArchiveStore(state => state.archives);
  const loadArchives = useScenarioArchiveStore(state => state.loadArchives);
  const isLoadingArchives = useScenarioArchiveStore(state => state.loading);

  // Drawer state
  const [selectedArchive, setSelectedArchive] = useState<ScenarioArchive | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Import session modal state
  const [showImportSessionModal, setShowImportSessionModal] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadArchives();
    loadStages();
  }, [loadArchives, loadStages]);

  // Vérifier si tout est prêt pour lancer les affectations
  const allReady = useMemo(() => {
    const hasEleves = eleves.length > 0;
    const hasEnseignants = enseignants.length > 0;
    const hasScenario = scenarios.length > 0;
    const hasActiveScenario = !!activeScenario;
    const isStageScenario = activeScenario?.type === 'suivi_stage';
    const hasStages = stages.length > 0;

    return hasEleves && hasEnseignants && hasScenario && hasActiveScenario && (!isStageScenario || hasStages);
  }, [eleves.length, enseignants.length, scenarios.length, activeScenario, stages.length]);

  // Calcul des alertes
  const alerts = useMemo(() => {
    const result: Alert[] = [];

    // Alertes seulement si on a des données
    if (eleves.length === 0 && enseignants.length === 0) {
      return result;
    }

    // Vérifier si le scénario actif utilise la distance
    const usesDistance = activeScenario?.parametres.criteres.some(
      c => c.actif && (c.id === 'distance' || c.id === 'secteur')
    );

    // Enseignants sans coordonnées (si distance activée)
    if (usesDistance && enseignants.length > 0) {
      const enseignantsSansCoords = enseignants.filter(e => !e.lat || !e.lon);
      if (enseignantsSansCoords.length > 0) {
        result.push({
          id: 'enseignants-no-coords',
          type: 'warning',
          message: `${enseignantsSansCoords.length} enseignant(s) sans coordonnées géographiques`,
          action: {
            label: 'Voir',
            onClick: () => navigate('/enseignants')
          }
        });
      }
    }

    // Stages sans géocodage (pour suivi_stage)
    if (activeScenario?.type === 'suivi_stage' && stages.length > 0) {
      const stagesSansCoords = stages.filter(s => !s.lat || !s.lon);
      if (stagesSansCoords.length > 0) {
        result.push({
          id: 'stages-no-coords',
          type: 'warning',
          message: `${stagesSansCoords.length} stage(s) sans coordonnées (géocodage en attente)`,
          action: {
            label: 'Géocoder',
            onClick: () => navigate('/eleves?tab=stage')
          }
        });
      }
    }

    // Enseignants sans capacité définie
    if (enseignants.length > 0) {
      const sansCapacite = enseignants.filter(e => !e.capaciteBase && !e.capaciteStage);
      if (sansCapacite.length > 0 && sansCapacite.length < enseignants.length) {
        result.push({
          id: 'enseignants-no-capacity',
          type: 'info',
          message: `${sansCapacite.length} enseignant(s) utilisent la capacité par défaut`,
        });
      }
    }

    // Élèves sans matière oral (pour oral_dnb)
    if (activeScenario?.type === 'oral_dnb' && eleves.length > 0) {
      const sansMatiere = eleves.filter(e => !e.matieresOral || e.matieresOral.length === 0);
      if (sansMatiere.length > 0) {
        result.push({
          id: 'eleves-no-matiere-oral',
          type: 'warning',
          message: `${sansMatiere.length} élève(s) sans matière d'oral définie`,
          action: {
            label: 'Importer',
            onClick: () => openModal('importMatiereOral')
          }
        });
      }
    }

    return result;
  }, [eleves, enseignants, stages, activeScenario, navigate, openModal]);

  // Handlers
  const handleViewDetail = useCallback((archive: ScenarioArchive) => {
    setSelectedArchive(archive);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedArchive(null);
  }, []);

  const addNotification = useUIStore(state => state.addNotification);

  const handleExportPdf = useCallback(async (archive: ScenarioArchive) => {
    try {
      const exportData = mapArchiveToExportData(archive);
      const filename = `${archive.scenarioNom.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(archive.archivedAt).toISOString().split('T')[0]}.pdf`;
      await downloadExportPdf(exportData, filename);
      addNotification({ type: 'success', message: 'Export PDF terminé' });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      addNotification({ type: 'error', message: 'Erreur lors de l\'export PDF' });
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
      addNotification({ type: 'error', message: 'Erreur lors de l\'export CSV' });
    }
  }, [addNotification]);

  // Import session handler
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

    // Si l'import a réussi, naviguer vers le board
    if (report.success && report.affectationsImported > 0) {
      setTimeout(() => navigate('/board'), 500);
    }

    return report;
  }, [eleves, enseignants, stages, navigate]);

  // Quick actions
  const handleImport = () => openModal('import');
  const handleCreateScenario = () => openModal('newScenario');
  const handleLaunchMatching = () => navigate('/board');

  // Configuration actions
  const handleActivateScenario = useCallback((scenarioId: string) => {
    setCurrentScenario(scenarioId);
  }, [setCurrentScenario]);

  const handleEditScenario = useCallback((scenarioId: string) => {
    openModal('editScenario', { scenarioId });
  }, [openModal]);

  const handleDeleteScenario = useCallback(async (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    const confirmed = window.confirm(`Supprimer la configuration "${scenario.nom}" ?\n\nCette action est irréversible.`);
    if (confirmed) {
      await deleteScenario(scenarioId);
    }
  }, [scenarios, deleteScenario]);

  const handleLaunchScenario = useCallback((scenarioId: string) => {
    setCurrentScenario(scenarioId);
    navigate('/board');
  }, [setCurrentScenario, navigate]);

  // Toggle expanded config card
  const handleToggleExpand = useCallback((scenarioId: string) => {
    setExpandedScenarioId(prev => prev === scenarioId ? null : scenarioId);
  }, []);

  // Sort archives by date (most recent first)
  const sortedArchives = [...archives].sort((a, b) =>
    new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
  );

  // Check if map should be shown (only for suivi_stage with stages)
  const showMapCard = dashboardPrefs.showStagesMap && stages.length > 0;

  // Détecter si c'est un nouvel utilisateur (pas de données)
  const isNewUser = eleves.length === 0 && enseignants.length === 0 && scenarios.length === 0;

  // Calculer la prochaine étape recommandée
  const nextStep = useMemo(() => {
    if (eleves.length === 0) return { label: 'Importer les élèves', action: handleImport };
    if (enseignants.length === 0) return { label: 'Importer les enseignants', action: handleImport };
    if (scenarios.length === 0) return { label: 'Créer une configuration', action: handleCreateScenario };
    if (!activeScenario) return { label: 'Activer une configuration', action: () => scenarios[0]?.id && handleActivateScenario(scenarios[0].id) };

    // Vérifier si la config active nécessite une action
    if (activeScenario.type === 'oral_dnb') {
      const scenarioJurys = jurys.filter(j => j.scenarioId === activeScenario.id);
      if (scenarioJurys.length === 0) return { label: 'Configurer les jurys', action: () => handleToggleExpand(activeScenario.id!) };
    }
    if (activeScenario.type === 'suivi_stage') {
      const stagesWithCoords = stages.filter(s => s.lat && s.lon);
      if (stagesWithCoords.length === 0 && stages.length > 0) return { label: 'Calculer les trajets', action: () => handleToggleExpand(activeScenario.id!) };
    }

    return { label: 'Lancer la répartition', action: handleLaunchMatching };
  }, [eleves.length, enseignants.length, scenarios, activeScenario, jurys, stages, handleImport, handleCreateScenario, handleActivateScenario, handleToggleExpand, handleLaunchMatching]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Tableau de bord</h1>
          <p>Préparez vos données et lancez les affectations</p>
        </div>
        <button
          className="config-btn"
          onClick={() => setShowConfigPanel(!showConfigPanel)}
          title="Personnaliser le tableau de bord"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Config Panel */}
      {showConfigPanel && (
        <div className="config-panel">
          <div className="config-panel-header">
            <h3>Personnaliser l'affichage</h3>
            <button className="config-close" onClick={() => setShowConfigPanel(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="config-options">
            <ConfigToggle
              label="Carte des stages"
              enabled={dashboardPrefs.showStagesMap}
              onToggle={() => toggleDashboardPref('showStagesMap')}
              disabled={stages.length === 0}
              hint={stages.length === 0 ? 'Importez des stages pour activer' : undefined}
            />
            <ConfigToggle
              label="Historique des affectations"
              enabled={dashboardPrefs.showHistory}
              onToggle={() => toggleDashboardPref('showHistory')}
            />
          </div>
        </div>
      )}

      {/* Bannière Prochaine Étape - visible si pas tout prêt */}
      {!allReady && !isNewUser && (
        <div className="next-step-banner">
          <div className="next-step-content">
            <ArrowRight size={20} />
            <span>Prochaine étape :</span>
            <strong>{nextStep.label}</strong>
          </div>
          <button className="btn-next-step" onClick={nextStep.action}>
            Continuer
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Quick Actions - Plus visible pour nouveaux utilisateurs */}
      <div className={`quick-actions ${isNewUser ? 'prominent' : 'compact'}`}>
        <button
          className={`quick-action-btn ${isNewUser || eleves.length === 0 ? 'primary' : ''}`}
          onClick={handleImport}
        >
          <Upload size={18} />
          <span>Importer des données</span>
        </button>
        <button className="quick-action-btn" onClick={() => setShowImportSessionModal(true)}>
          <FolderOpen size={18} />
          <span>Reprendre une session</span>
        </button>
      </div>

      {/* Alertes - Bannière compacte, uniquement si des alertes existent */}
      {alerts.length > 0 && (
        <div className="alerts-banner">
          {alerts.map(alert => (
            <div key={alert.id} className={`alert-inline ${alert.type}`}>
              <AlertTriangle size={14} />
              <span>{alert.message}</span>
              {alert.action && (
                <button onClick={alert.action.onClick}>{alert.action.label}</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Section Configurations - Hub central */}
      <div className="configurations-hub">
        <div className="hub-header">
          <h2>Vos configurations</h2>
          <button className="btn-create-config" onClick={handleCreateScenario}>
            <Plus size={18} />
            Nouvelle configuration
          </button>
        </div>

        {scenarios.length > 0 ? (
          <div className="configurations-grid">
            {scenarios.map(scenario => {
              const isActive = activeScenario?.id === scenario.id;
              const isStage = scenario.type === 'suivi_stage';
              const isOral = scenario.type === 'oral_dnb';
              const isExpanded = expandedScenarioId === scenario.id;

              // Compter les élèves concernés (selon les filtres du scénario)
              const filteredEleves = filterEleves(
                eleves,
                scenario.parametres?.filtresEleves,
                isStage ? ['3e'] : undefined  // Pour stages, défaut = 3e uniquement
              );
              const eleveCount = filteredEleves.length;

              return (
                <div
                  key={scenario.id}
                  className={`config-card ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}
                >
                  <div className="config-card-header">
                    <div className="config-type-icon">
                      {isOral ? <Mic size={24} /> : <Briefcase size={24} />}
                    </div>
                    <div className="config-menu">
                      <button
                        className="config-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === scenario.id ? null : scenario.id!);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      <div className={`config-dropdown ${openMenuId === scenario.id ? 'show' : ''}`}>
                        <button onClick={() => { handleEditScenario(scenario.id!); setOpenMenuId(null); }}>
                          <Edit3 size={14} /> Modifier
                        </button>
                        <button className="danger" onClick={() => { handleDeleteScenario(scenario.id!); setOpenMenuId(null); }}>
                          <Trash2 size={14} /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="config-card-body">
                    <h3>{scenario.nom}</h3>
                    <span className="config-type-label">
                      {isOral ? 'Oral DNB' : 'Suivi de stage'}
                    </span>
                    {scenario.description && (
                      <p className="config-description">{scenario.description}</p>
                    )}
                  </div>

                  {/* Bandeau d'action contextuel - en haut pour meilleure visibilité */}
                  {(() => {
                    if (isOral) {
                      const scenarioJurys = jurys.filter(j => j.scenarioId === scenario.id);
                      const totalCapacity = scenarioJurys.reduce((sum, j) => sum + j.capaciteMax, 0);
                      const hasJurys = scenarioJurys.length > 0;

                      return (
                        <div className={`config-action-banner ${hasJurys ? 'configured' : 'pending'}`}>
                          <div className="action-banner-status">
                            {hasJurys ? (
                              <>
                                <CheckCircle size={16} />
                                <span>{scenarioJurys.length} jury{scenarioJurys.length > 1 ? 's' : ''} • {totalCapacity} places</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={16} />
                                <span>Jurys non configurés</span>
                              </>
                            )}
                          </div>
                          <button
                            className="btn-configure"
                            onClick={() => handleToggleExpand(scenario.id!)}
                          >
                            <GraduationCap size={16} />
                            {isExpanded ? 'Masquer' : hasJurys ? 'Modifier les jurys' : 'Configurer les jurys'}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      );
                    }

                    if (isStage) {
                      // Filtrer les stages par les élèves du scénario
                      const filteredEleveIds = new Set(filteredEleves.map(e => e.id));
                      const scenarioStages = stages.filter(s => s.eleveId && filteredEleveIds.has(s.eleveId));
                      const stagesWithCoords = scenarioStages.filter(s => (s.geoStatus === 'ok' || s.geoStatus === 'manual') && s.lat && s.lon);
                      const hasStagesReady = stagesWithCoords.length > 0;

                      return (
                        <div className={`config-action-banner ${hasStagesReady ? 'configured' : 'pending'}`}>
                          <div className="action-banner-status">
                            {hasStagesReady ? (
                              <>
                                <CheckCircle size={16} />
                                <span>{stagesWithCoords.length} stage{stagesWithCoords.length > 1 ? 's' : ''} géolocalisé{stagesWithCoords.length > 1 ? 's' : ''}</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle size={16} />
                                <span>Trajets non calculés</span>
                              </>
                            )}
                          </div>
                          <button
                            className="btn-configure"
                            onClick={() => handleToggleExpand(scenario.id!)}
                          >
                            <Route size={16} />
                            {isExpanded ? 'Masquer' : 'Calculer les trajets'}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  <div className="config-card-stats">
                    <div className="config-stat">
                      <Users size={14} />
                      <span>{eleveCount} élèves</span>
                    </div>
                    {isActive && (
                      <span className="config-active-badge">Active</span>
                    )}
                  </div>

                  <div className="config-card-actions">
                    {!isActive && (
                      <button
                        className="btn-activate"
                        onClick={() => handleActivateScenario(scenario.id!)}
                      >
                        Activer
                      </button>
                    )}
                    <button
                      className="btn-launch"
                      onClick={() => handleLaunchScenario(scenario.id!)}
                    >
                      <Play size={16} />
                      Répartir
                    </button>
                  </div>

                  {/* Section extensible avec les outils de gestion */}
                  {isExpanded && (
                    <div className="config-card-expanded">
                      {isOral && <JuryManager scenario={scenario} />}
                      {isStage && <StageScenarioManager scenario={scenario} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="configurations-empty">
            <div className="empty-illustration">
              <Sparkles size={48} />
            </div>
            <h3>Créez votre première configuration</h3>
            <p>
              Une configuration définit les règles de répartition des élèves
              (Oral DNB ou Suivi de stage).
            </p>
            <button className="btn-create-first" onClick={handleCreateScenario}>
              <Plus size={18} />
              Créer une configuration
            </button>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Carte des stages */}
        {showMapCard && (
          <div className="dashboard-card full-width map-card-wrapper">
            <StagesMapCard
              stages={stages}
              eleves={eleves}
              collegeGeo={COLLEGE_GEO}
            />
          </div>
        )}

        {/* Historique des affectations validées */}
        {dashboardPrefs.showHistory && (
          <div className="dashboard-card full-width">
            <div className="card-header-with-count">
              <h2>
                <CheckCircle size={20} />
                Historique des affectations
                <HelpTooltip content={HELP_TEXTS.dashboard.history} />
              </h2>
              <span className="count-badge">{archives.length}</span>
            </div>

            {isLoadingArchives ? (
              <div className="loading-state">Chargement...</div>
            ) : sortedArchives.length > 0 ? (
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
            ) : (
              <div className="validated-empty-state">
                <ClipboardList size={48} />
                <h3>Aucune affectation validée</h3>
                <p>
                  Les affectations validées apparaîtront ici.
                  Lancez une répartition puis cliquez sur "Valider" pour créer un historique.
                </p>
              </div>
            )}

            {sortedArchives.length > 6 && (
              <div className="see-more-link">
                {sortedArchives.length - 6} autres affectations validées...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Validated Assignment Drawer */}
      {selectedArchive && (
        <ValidatedAssignmentDrawer
          archive={selectedArchive}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onExportPdf={() => handleExportPdf(selectedArchive)}
          onExportCsv={() => handleExportCsv(selectedArchive)}
        />
      )}

      {/* Import Session Modal */}
      <ImportSessionModal
        isOpen={showImportSessionModal}
        onClose={() => setShowImportSessionModal(false)}
        onImport={handleImportSession}
      />
    </div>
  );
};

// Composant ConfigToggle
interface ConfigToggleProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  hint?: string;
}

const ConfigToggle: React.FC<ConfigToggleProps> = ({ label, enabled, onToggle, disabled, hint }) => (
  <div className={`config-toggle ${disabled ? 'disabled' : ''}`}>
    <div className="config-toggle-info">
      <span className="config-toggle-label">{label}</span>
      {hint && <span className="config-toggle-hint">{hint}</span>}
    </div>
    <button
      className={`toggle-btn ${enabled ? 'active' : ''}`}
      onClick={onToggle}
      disabled={disabled}
    >
      {enabled ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  </div>
);
