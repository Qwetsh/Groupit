import React from 'react';
import { Settings, SlidersHorizontal, Eye, Database, Trash2 } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import './InfoPage.css';

export const ParametresPage: React.FC = () => {
  const expertMode = useUIStore(state => state.expertMode);
  const setExpertMode = useUIStore(state => state.setExpertMode);

  // Confirm modal
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const handleClearData = async () => {
    const confirmed = await confirm({
      title: 'Supprimer toutes les données',
      message: 'Êtes-vous sûr de vouloir supprimer toutes les données locales ?\n\nCette action est irréversible.',
      variant: 'danger',
      confirmLabel: 'Tout supprimer',
    });
    if (confirmed) {
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
          Active l'affichage des critères système (forcés) dans l'éditeur de configuration.
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
          <span>Configurations</span>
        </div>
        <p className="info-note">Les paramètres par configuration se règlent aujourd'hui dans la page Configurations.</p>
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

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};
