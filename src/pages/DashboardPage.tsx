import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useScenarioStore } from '../stores/scenarioStore';
import { useScenarioArchiveStore } from '../stores/scenarioArchiveStore';
import { useStageStore } from '../stores/stageStore';
import { useUIStore } from '../stores/uiStore';
import { ValidatedAssignmentCard, ValidatedAssignmentDrawer, StagesMapCard } from '../components/dashboard';
import { HelpTooltip, HELP_TEXTS } from '../components/ui/Tooltip';
import { mapArchiveToExportData, downloadExportPdf, downloadExportCsv } from '../infrastructure/export';
import type { ScenarioArchive } from '../domain/models';
import type { GeoPoint } from '../infrastructure/geo/types';
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  Play,
  Upload,
  Plus,
  ClipboardList,
  MapPin,
  ArrowRight,
  Sparkles,
  Settings,
  X,
  Eye,
  EyeOff
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
  const stages = useStageStore(state => state.stages);
  const loadStages = useStageStore(state => state.loadStages);
  const openModal = useUIStore(state => state.openModal);

  // Dashboard preferences
  const dashboardPrefs = useUIStore(state => state.dashboardPrefs);
  const toggleDashboardPref = useUIStore(state => state.toggleDashboardPref);

  // Config panel state
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Archives state
  const archives = useScenarioArchiveStore(state => state.archives);
  const loadArchives = useScenarioArchiveStore(state => state.loadArchives);
  const isLoadingArchives = useScenarioArchiveStore(state => state.isLoading);

  // Drawer state
  const [selectedArchive, setSelectedArchive] = useState<ScenarioArchive | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadArchives();
    loadStages();
  }, [loadArchives, loadStages]);

  // Checklist items
  const checklist = useMemo(() => {
    const hasEleves = eleves.length > 0;
    const hasEnseignants = enseignants.length > 0;
    const hasScenario = scenarios.length > 0;
    const hasActiveScenario = !!activeScenario;

    // Pour suivi_stage, vérifier aussi les stages
    const isStageScenario = activeScenario?.type === 'suivi_stage';
    const hasStages = stages.length > 0;

    const allReady = hasEleves && hasEnseignants && hasScenario && hasActiveScenario && (!isStageScenario || hasStages);

    return {
      hasEleves,
      hasEnseignants,
      hasScenario,
      hasActiveScenario,
      isStageScenario,
      hasStages,
      allReady
    };
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
            onClick: () => navigate('/donnees')
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

  const handleExportPdf = useCallback(async (archive: ScenarioArchive) => {
    try {
      const exportData = mapArchiveToExportData(archive);
      const filename = `${archive.scenarioNom.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(archive.archivedAt).toISOString().split('T')[0]}.pdf`;
      await downloadExportPdf(exportData, filename);
    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Erreur lors de l\'export PDF');
    }
  }, []);

  const handleExportCsv = useCallback((archive: ScenarioArchive) => {
    try {
      const exportData = mapArchiveToExportData(archive);
      const filename = `${archive.scenarioNom.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date(archive.archivedAt).toISOString().split('T')[0]}`;
      downloadExportCsv(exportData, filename);
    } catch (error) {
      console.error('Erreur export CSV:', error);
      alert('Erreur lors de l\'export CSV');
    }
  }, []);

  // Quick actions
  const handleImport = () => openModal('import');
  const handleCreateScenario = () => openModal('editScenario');
  const handleLaunchMatching = () => navigate('/board');

  // Sort archives by date (most recent first)
  const sortedArchives = [...archives].sort((a, b) =>
    new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
  );

  // Check if map should be shown (only for suivi_stage with stages)
  const showMapCard = dashboardPrefs.showStagesMap && stages.length > 0;

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
              label="Checklist de préparation"
              enabled={dashboardPrefs.showChecklist}
              onToggle={() => toggleDashboardPref('showChecklist')}
            />
            <ConfigToggle
              label="Alertes et problèmes"
              enabled={dashboardPrefs.showAlerts}
              onToggle={() => toggleDashboardPref('showAlerts')}
            />
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

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action-btn" onClick={handleImport}>
          <Upload size={20} />
          <span>Importer des données</span>
        </button>
        <button className="quick-action-btn" onClick={handleCreateScenario}>
          <Plus size={20} />
          <span>Créer un scénario</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className={`quick-action-btn primary ${!checklist.allReady ? 'disabled' : ''}`}
            onClick={handleLaunchMatching}
            disabled={!checklist.allReady}
          >
            <Play size={20} />
            <span>Lancer le matching</span>
          </button>
          <HelpTooltip content={HELP_TEXTS.dashboard.launchMatching} position="right" />
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Checklist de démarrage */}
        {dashboardPrefs.showChecklist && (
          <div className="dashboard-card checklist-card">
            <div className="card-header-with-icon">
              <Sparkles size={20} />
              <h2>Préparation</h2>
              <HelpTooltip content={HELP_TEXTS.dashboard.checklist} />
            </div>

            <div className="checklist">
              <ChecklistItem
                done={checklist.hasEleves}
                label="Importer des élèves"
                count={eleves.length}
                action={!checklist.hasEleves ? { label: 'Importer', onClick: handleImport } : undefined}
              />
              <ChecklistItem
                done={checklist.hasEnseignants}
                label="Importer des enseignants"
                count={enseignants.length}
                action={!checklist.hasEnseignants ? { label: 'Importer', onClick: handleImport } : undefined}
              />
              <ChecklistItem
                done={checklist.hasScenario}
                label="Créer un scénario"
                count={scenarios.length}
                action={!checklist.hasScenario ? { label: 'Créer', onClick: handleCreateScenario } : undefined}
              />
              {checklist.isStageScenario && (
                <ChecklistItem
                  done={checklist.hasStages}
                  label="Importer les stages"
                  count={stages.length}
                  action={!checklist.hasStages ? { label: 'Importer', onClick: () => navigate('/donnees') } : undefined}
                />
              )}
              <ChecklistItem
                done={checklist.hasActiveScenario}
                label="Activer un scénario"
                subtitle={activeScenario?.nom}
                action={!checklist.hasActiveScenario && checklist.hasScenario ? { label: 'Choisir', onClick: () => navigate('/scenarios') } : undefined}
              />
            </div>

            {checklist.allReady && (
              <div className="checklist-ready">
                <CheckCircle size={18} />
                <span>Prêt à lancer les affectations</span>
                <button className="btn-go" onClick={handleLaunchMatching}>
                  Lancer <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Alertes et problèmes */}
        {dashboardPrefs.showAlerts && (
          <div className="dashboard-card alerts-card">
            <div className="card-header-with-icon">
              <AlertTriangle size={20} />
              <h2>Alertes</h2>
              <HelpTooltip content={HELP_TEXTS.dashboard.alerts} />
              {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}
            </div>

            {alerts.length > 0 ? (
              <div className="alerts-list">
                {alerts.map(alert => (
                  <div key={alert.id} className={`alert-item ${alert.type}`}>
                    <div className="alert-icon">
                      {alert.type === 'warning' && <AlertTriangle size={16} />}
                      {alert.type === 'error' && <AlertTriangle size={16} />}
                      {alert.type === 'info' && <MapPin size={16} />}
                    </div>
                    <span className="alert-message">{alert.message}</span>
                    {alert.action && (
                      <button className="alert-action" onClick={alert.action.onClick}>
                        {alert.action.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="alerts-empty">
                <CheckCircle size={32} />
                <p>Aucun problème détecté</p>
              </div>
            )}
          </div>
        )}

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
                  Lancez un matching puis cliquez sur "Valider" pour créer un historique.
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
    </div>
  );
};

// Composant ChecklistItem
interface ChecklistItemProps {
  done: boolean;
  label: string;
  count?: number;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ done, label, count, subtitle, action }) => (
  <div className={`checklist-item ${done ? 'done' : ''}`}>
    <div className="checklist-icon">
      {done ? <CheckCircle size={18} /> : <Circle size={18} />}
    </div>
    <div className="checklist-content">
      <span className="checklist-label">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="checklist-count">{count}</span>
      )}
      {subtitle && <span className="checklist-subtitle">{subtitle}</span>}
    </div>
    {action && !done && (
      <button className="checklist-action" onClick={action.onClick}>
        {action.label}
      </button>
    )}
  </div>
);

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
