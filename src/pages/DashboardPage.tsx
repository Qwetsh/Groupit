import React, { useEffect, useState, useCallback } from 'react';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useAffectationStore } from '../stores/affectationStore';
import { useScenarioStore } from '../stores/scenarioStore';
import { useScenarioArchiveStore } from '../stores/scenarioArchiveStore';
import { ValidatedAssignmentCard, ValidatedAssignmentDrawer } from '../components/dashboard';
import { mapArchiveToExportData, downloadExportPdf, downloadExportCsv } from '../infrastructure/export';
import type { ScenarioArchive } from '../domain/models';
import {
  Users,
  GraduationCap,
  Link2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Archive,
  ClipboardList
} from 'lucide-react';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const affectations = useAffectationStore(state => state.affectations);
  const activeScenario = useScenarioStore(state => state.getActiveScenario());

  // Archives state
  const archives = useScenarioArchiveStore(state => state.archives);
  const loadArchives = useScenarioArchiveStore(state => state.loadArchives);
  const isLoadingArchives = useScenarioArchiveStore(state => state.isLoading);

  // Drawer state
  const [selectedArchive, setSelectedArchive] = useState<ScenarioArchive | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load archives on mount
  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  // Count by score threshold
  const highScoreCount = affectations.filter(a => (a.scoreTotal || 0) >= 70).length;
  const lowScoreCount = affectations.filter(a => (a.scoreTotal || 0) < 40).length;
  const mediumScoreCount = affectations.length - highScoreCount - lowScoreCount;
  const averageScore = affectations.length > 0
    ? Math.round(affectations.reduce((sum, a) => sum + (a.scoreTotal || 0), 0) / affectations.length)
    : 0;

  // Group eleves by class
  const classeStats = eleves.reduce((acc, e) => {
    const key = e.classe || 'Non défini';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Handlers for archive actions
  const handleViewDetail = useCallback((archive: ScenarioArchive) => {
    setSelectedArchive(archive);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedArchive(null);
  }, []);

  // Export handlers
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

  // Sort archives by date (most recent first)
  const sortedArchives = [...archives].sort((a, b) =>
    new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Tableau de bord</h1>
        <p>Vue d'ensemble de vos données et affectations</p>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon eleves">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{eleves.length}</span>
            <span className="stat-label">Élèves</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon enseignants">
            <GraduationCap size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{enseignants.length}</span>
            <span className="stat-label">Enseignants</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon affectations">
            <Link2 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{affectations.length}</span>
            <span className="stat-label">Affectations</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon validated">
            <Archive size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{archives.length}</span>
            <span className="stat-label">Validées</span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Validated Assignments Section - NEW */}
        <div className="dashboard-card full-width">
          <div className="card-header-with-count">
            <h2>
              <CheckCircle size={20} />
              Affectations validées
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

        {/* Affectation status */}
        <div className="dashboard-card">
          <h2>État des affectations en cours</h2>
          <div className="affectation-status">
            <div className="status-item success">
              <CheckCircle size={20} />
              <span className="status-count">{highScoreCount}</span>
              <span className="status-label">Score élevé (≥70)</span>
            </div>
            <div className="status-item warning">
              <AlertTriangle size={20} />
              <span className="status-count">{mediumScoreCount}</span>
              <span className="status-label">Score moyen (40-69)</span>
            </div>
            <div className="status-item info">
              <Users size={20} />
              <span className="status-count">{lowScoreCount}</span>
              <span className="status-label">Score faible (&lt;40)</span>
            </div>
          </div>

          {affectations.length > 0 && (
            <div className="score-summary">
              <TrendingUp size={18} />
              <span>Score moyen: <strong>{averageScore}/100</strong></span>
            </div>
          )}
        </div>

        {/* Classes breakdown */}
        <div className="dashboard-card">
          <h2>Élèves par classe</h2>
          <div className="classes-list">
            {Object.entries(classeStats)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([classe, count]) => (
                <div key={classe} className="class-item">
                  <span className="class-name">{classe}</span>
                  <div className="class-bar">
                    <div
                      className="class-bar-fill"
                      style={{ width: `${(count / eleves.length) * 100}%` }}
                    />
                  </div>
                  <span className="class-count">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Active scenario */}
        <div className="dashboard-card">
          <h2>Scénario actif</h2>
          {activeScenario ? (
            <div className="active-scenario">
              <h3>{activeScenario.nom}</h3>
              {activeScenario.description && (
                <p>{activeScenario.description}</p>
              )}
              <div className="scenario-params">
                <h4>Critères configurés:</h4>
                <ul>
                  {activeScenario.parametres.criteres.map((c, i) => (
                    <li key={i}>
                      <span className="param-name">{c.nom}</span>
                      <span className="param-weight">×{c.poids}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="no-scenario">
              <p>Aucun scénario actif</p>
              <span>Créez ou sélectionnez un scénario pour commencer les affectations</span>
            </div>
          )}
        </div>
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
