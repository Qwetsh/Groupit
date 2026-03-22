import React from 'react';
import { Settings, SlidersHorizontal, Database, Trash2, Compass } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import './InfoPage.css';

export const ParametresPage: React.FC = () => {
  const resetGuidedMode = useUIStore(state => state.resetGuidedMode);

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

      {/* Lancer un assistant */}
      <div className="info-card settings-card">
        <div className="card-title">
          <Compass size={18} />
          <span>Lancer un assistant</span>
        </div>
        <p className="info-note">
          Relancez l'assistant pas-à-pas pour configurer une nouvelle affectation.
        </p>
        <div className="button-group">
          <button className="btn-primary" onClick={resetGuidedMode}>
            <Compass size={16} />
            Lancer l'assistant
          </button>
        </div>
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
