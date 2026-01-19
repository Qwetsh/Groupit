import React from 'react';
import { Settings, SlidersHorizontal, Eye, Database, Trash2 } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import './InfoPage.css';

export const ParametresPage: React.FC = () => {
  const expertMode = useUIStore(state => state.expertMode);
  const setExpertMode = useUIStore(state => state.setExpertMode);

  const handleClearData = () => {
    if (window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer toutes les données locales ? Cette action est irréversible.')) {
      // Clear IndexedDB
      indexedDB.deleteDatabase('GroupitDB');
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="info-page">
      <h1>Paramètres</h1>
      <p className="lead">Configurez l'application et les préférences d'affectation.</p>

      {/* Mode Expert */}
      <div className="info-card settings-card">
        <div className="card-title">
          <Eye size={18} />
          <span>Mode expert</span>
        </div>
        <p className="info-note">
          Active l'affichage des critères système (forcés) dans l'éditeur de scénario.
          Ces critères sont appliqués automatiquement mais normalement masqués.
        </p>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={expertMode}
            onChange={(e) => setExpertMode(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">
            {expertMode ? 'Activé' : 'Désactivé'}
          </span>
        </label>
      </div>

      <div className="info-card">
        <div className="card-title">
          <Settings size={18} />
          <span>Fonctionnalités prévues</span>
        </div>
        <ul>
          <li>Préférences globales (capacités par défaut, matières, filtres)</li>
          <li>Gestion des sauvegardes locales et réinitialisation</li>
          <li>Personnalisation de l'interface (thème, densité)</li>
        </ul>
        <span className="info-badge">Bientôt disponible</span>
      </div>

      <div className="info-card">
        <div className="card-title">
          <SlidersHorizontal size={18} />
          <span>Scénarios</span>
        </div>
        <p className="info-note">Les paramètres par scénario se règlent aujourd'hui dans la page Scénarios.</p>
      </div>

      <div className="info-card">
        <div className="card-title">
          <Database size={18} />
          <span>Données locales</span>
        </div>
        <p className="info-note">Vos données sont stockées localement (IndexedDB).</p>
        <button className="btn-danger" onClick={handleClearData}>
          <Trash2 size={16} />
          Supprimer toutes les données
        </button>
      </div>
    </div>
  );
};
