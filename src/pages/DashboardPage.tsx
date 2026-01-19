import React from 'react';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useAffectationStore } from '../stores/affectationStore';
import { useScenarioStore } from '../stores/scenarioStore';
import { 
  Users, 
  GraduationCap, 
  Link2, 
  FileSpreadsheet,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const affectations = useAffectationStore(state => state.affectations);
  const scenarios = useScenarioStore(state => state.scenarios);
  const activeScenario = useScenarioStore(state => state.getActiveScenario());

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
          <div className="stat-icon scenarios">
            <FileSpreadsheet size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{scenarios.length}</span>
            <span className="stat-label">Scénarios</span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Affectation status */}
        <div className="dashboard-card">
          <h2>État des affectations</h2>
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
    </div>
  );
};
