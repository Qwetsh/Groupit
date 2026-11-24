import React, { useRef, useState } from 'react';
import { Settings, SlidersHorizontal, Database, Trash2, Compass, Users, Download, Upload } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import {
  parseEnseignantsFile,
  serializeEnseignants,
  planifierImportEnseignants,
} from '../services/enseignantFileService';
import { extractErrorMessage } from '../utils/errorUtils';
import './InfoPage.css';

type FileFeedback = { kind: 'success' | 'error'; text: string };

const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n > 1 ? pluralForm : singular}`;

export const ParametresPage: React.FC = () => {
  const resetGuidedMode = useUIStore(state => state.resetGuidedMode);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const addEnseignants = useEnseignantStore(state => state.addEnseignants);
  const updateEnseignant = useEnseignantStore(state => state.updateEnseignant);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<FileFeedback | null>(null);

  // Confirm modal
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  const handleExportEnseignants = () => {
    const blob = new Blob([serializeEnseignants(enseignants)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enseignants-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback({
      kind: 'success',
      text: `${plural(enseignants.length, 'enseignant exporté', 'enseignants exportés')}. Gardez ce fichier dans un endroit privé.`,
    });
  };

  const handleImportEnseignants = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // permet de réimporter le même fichier
    if (!file) return;

    setImporting(true);
    setFeedback(null);
    try {
      const records = parseEnseignantsFile(await file.text());
      const { toAdd, toUpdate, unchanged } = planifierImportEnseignants(records, enseignants);
      if (toAdd.length > 0) {
        await addEnseignants(toAdd);
      }
      // Fiches existantes complétées une par une (une nouvelle adresse est géocodée)
      for (const { id, changes } of toUpdate) {
        await updateEnseignant(id, changes);
      }
      const parts = [
        plural(toAdd.length, 'enseignant ajouté', 'enseignants ajoutés'),
        toUpdate.length > 0 ? plural(toUpdate.length, 'fiche complétée', 'fiches complétées') : '',
        unchanged > 0 ? plural(unchanged, 'déjà à jour', 'déjà à jour') : '',
      ].filter(Boolean);
      setFeedback({ kind: 'success', text: `${parts.join(', ')}.` });
    } catch (error) {
      setFeedback({ kind: 'error', text: `Import impossible. ${extractErrorMessage(error)}` });
    } finally {
      setImporting(false);
    }
  };

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

      {/* Liste des enseignants : fichier privé */}
      <div className="info-card settings-card">
        <div className="card-title">
          <Users size={18} />
          <span>Liste des enseignants</span>
        </div>
        <p className="info-note">
          {enseignants.length > 0
            ? `${plural(enseignants.length, 'enseignant enregistré', 'enseignants enregistrés')} dans ce navigateur.`
            : 'Aucun enseignant dans ce navigateur.'}{' '}
          Exportez la liste complète (adresses, classes, indisponibilités) dans un fichier,
          puis importez-le sur un autre poste. L'import ajoute les nouveaux enseignants et
          met à jour l'adresse des enseignants déjà présents, sans écraser ce que vous avez saisi
          (matière, classes, indisponibilités). Ce fichier contient des données personnelles :
          conservez-le dans un espace privé.
        </p>
        <div className="button-group">
          <button
            className="btn-secondary"
            onClick={handleExportEnseignants}
            disabled={enseignants.length === 0}
          >
            <Download size={16} />
            Exporter la liste
          </button>
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload size={16} />
            {importing ? 'Import en cours…' : 'Importer un fichier'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportEnseignants}
            aria-label="Fichier d'enseignants à importer"
            hidden
          />
        </div>
        <p
          className="info-note"
          role="status"
          style={{ marginTop: 12, color: feedback?.kind === 'error' ? '#f87171' : '#34d399' }}
        >
          {feedback?.text}
        </p>
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
