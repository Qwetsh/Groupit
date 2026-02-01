// ============================================================
// ENSEIGNANT PROFILE DRAWER
// Panneau latéral avec profil complet et historique
// ============================================================

import { useEffect, useState } from 'react';
import {
  X,
  Edit2,
  Trash2,
  MapPin,
  BookOpen,
  Users,
  Award,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Loader
} from 'lucide-react';
import { useScenarioArchiveStore } from '../../stores/scenarioArchiveStore';
import type { Enseignant } from '../../domain/models';
import type { EnseignantHistoryEntry } from '../../infrastructure/repositories/scenarioArchiveRepository';
import './EnseignantProfileDrawer.css';

// Palette de couleurs par matière (cohérent avec EnseignantsPage)
const MATIERE_COLORS: Record<string, { gradient: string; light: string }> = {
  'Français': { gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', light: '#dbeafe' },
  'Mathématiques': { gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', light: '#ede9fe' },
  'Histoire-Géographie': { gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', light: '#fef3c7' },
  'Histoire-Géo': { gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', light: '#fef3c7' },
  'Anglais': { gradient: 'linear-gradient(135deg, #ec4899, #be185d)', light: '#fce7f3' },
  'Espagnol': { gradient: 'linear-gradient(135deg, #f97316, #ea580c)', light: '#ffedd5' },
  'Allemand': { gradient: 'linear-gradient(135deg, #64748b, #475569)', light: '#f1f5f9' },
  'SVT': { gradient: 'linear-gradient(135deg, #22c55e, #16a34a)', light: '#dcfce7' },
  'Physique-Chimie': { gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', light: '#cffafe' },
  'Technologie': { gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)', light: '#e0e7ff' },
  'EPS': { gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', light: '#fee2e2' },
  'Arts Plastiques': { gradient: 'linear-gradient(135deg, #a855f7, #9333ea)', light: '#f3e8ff' },
  'Éducation Musicale': { gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)', light: '#ccfbf1' },
  'Latin': { gradient: 'linear-gradient(135deg, #78716c, #57534e)', light: '#f5f5f4' },
  'Grec': { gradient: 'linear-gradient(135deg, #78716c, #57534e)', light: '#f5f5f4' },
};

const DEFAULT_MATIERE_COLOR = { gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)', light: '#e0e7ff' };
const NOT_GEOCODED_COLOR = { gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', light: '#fee2e2' };

function getMatiereColor(matiere: string | undefined) {
  if (!matiere) return DEFAULT_MATIERE_COLOR;
  return MATIERE_COLORS[matiere] || DEFAULT_MATIERE_COLOR;
}

// ============================================================
// TYPES
// ============================================================

interface EnseignantProfileDrawerProps {
  enseignant: Enseignant;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// ============================================================
// HISTORY TIMELINE COMPONENT
// ============================================================

interface HistoryTimelineProps {
  enseignantId: string;
}

function HistoryTimeline({ enseignantId }: HistoryTimelineProps) {
  const [history, setHistory] = useState<EnseignantHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getEnseignantHistory = useScenarioArchiveStore(s => s.getEnseignantHistory);

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getEnseignantHistory(enseignantId);
        setHistory(data);
      } catch (err) {
        setError('Impossible de charger l\'historique');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [enseignantId, getEnseignantHistory]);

  if (loading) {
    return (
      <div className="history-loading">
        <Loader className="spin" size={20} />
        <span>Chargement de l'historique...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-error">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="history-empty">
        <Clock size={32} />
        <p>Aucun historique</p>
        <span>L'enseignant n'a pas encore participé à des scénarios archivés.</span>
      </div>
    );
  }

  return (
    <div className="history-timeline">
      {history.map((entry, index) => {
        const date = new Date(entry.archivedAt);
        
        return (
          <div key={entry.archiveId} className="timeline-item">
            <div className="timeline-connector">
              <div className="timeline-dot" />
              {index < history.length - 1 && <div className="timeline-line" />}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="scenario-name">{entry.scenarioNom}</span>
                <span className={`scenario-type type-${entry.scenarioType}`}>
                  {entry.scenarioType === 'suivi_stage' ? 'Suivi Stage' :
                   entry.scenarioType === 'oral_dnb' ? 'Oral DNB' :
                   'Personnalisé'}
                </span>
              </div>
              <div className="timeline-date">
                <Calendar size={12} />
                {date.toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
              {entry.roleLabel && (
                <div className="timeline-role">
                  Rôle : <strong>{entry.roleLabel}</strong>
                </div>
              )}
              {entry.eleves && entry.eleves.length > 0 && (
                <div className="timeline-eleves-section">
                  <div className="timeline-eleves-header">
                    <Users size={12} />
                    {entry.eleves.length} élève(s)
                  </div>
                  <div className="timeline-eleves-list">
                    {entry.eleves.map((eleve, i) => (
                      <span key={i} className="eleve-name-chip">
                        {eleve.elevePrenom} {eleve.eleveNom}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN DRAWER COMPONENT
// ============================================================

export function EnseignantProfileDrawer({
  enseignant,
  isOpen,
  onClose,
  onEdit,
  onDelete
}: EnseignantProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<'infos' | 'historique'>('infos');

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const fullName = `${enseignant.prenom || ''} ${enseignant.nom}`.trim();

  // Couleurs basées sur la matière et l'état de géocodage
  const isNotGeocoded = !enseignant.adresse || !enseignant.lat || !enseignant.lon;
  const matiereColor = getMatiereColor(enseignant.matierePrincipale);
  const avatarColor = isNotGeocoded ? NOT_GEOCODED_COLOR : matiereColor;

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className={`profile-drawer ${isOpen ? 'open' : ''}`}>
        {/* Header avec couleur matière */}
        <div className="drawer-header" style={{ background: matiereColor.gradient }}>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>

          <div className="profile-hero">
            <div className="avatar-large" style={{ background: avatarColor.gradient }}>
              {enseignant.prenom?.[0]}{enseignant.nom[0]}
            </div>
            <div className="hero-info">
              <h2>{fullName}</h2>
              {enseignant.matierePrincipale && (
                <span className="hero-matiere">
                  <BookOpen size={14} />
                  {enseignant.matierePrincipale}
                </span>
              )}
            </div>
          </div>

          <div className="drawer-actions">
            <button className="btn-edit" onClick={onEdit}>
              <Edit2 size={16} />
              Modifier
            </button>
            <button className="btn-delete" onClick={onDelete}>
              <Trash2 size={16} />
              Supprimer
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="drawer-tabs">
          <button 
            className={`tab ${activeTab === 'infos' ? 'active' : ''}`}
            onClick={() => setActiveTab('infos')}
          >
            Informations
          </button>
          <button 
            className={`tab ${activeTab === 'historique' ? 'active' : ''}`}
            onClick={() => setActiveTab('historique')}
          >
            Historique
          </button>
        </div>

        {/* Content */}
        <div className="drawer-content">
          {activeTab === 'infos' ? (
            <div className="tab-infos">
              {/* Section Classes */}
              {enseignant.classesEnCharge && enseignant.classesEnCharge.length > 0 && (
                <section className="info-section">
                  <h3>
                    <Users size={16} />
                    Classes en charge
                  </h3>
                  <div className="classes-grid">
                    {enseignant.classesEnCharge.map((classe, i) => (
                      <span key={i} className="class-badge">{classe}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* Section PP */}
              {enseignant.estProfPrincipal && (
                <section className="info-section pp-section">
                  <div className="pp-badge">
                    <Award size={18} />
                    <span>Professeur Principal</span>
                  </div>
                  {enseignant.classePP && (
                    <span className="pp-classe-info">Classe : {enseignant.classePP}</span>
                  )}
                </section>
              )}

              {/* Section Adresse */}
              <section className="info-section">
                <h3>
                  <MapPin size={16} />
                  Adresse
                </h3>
                <div className="address-block">
                  {enseignant.adresse ? (
                    <>
                      <p>{enseignant.adresse}</p>
                      {enseignant.commune && (
                        <p>{enseignant.commune}</p>
                      )}
                      <div className="geo-status">
                        {enseignant.geoStatus === 'ok' && (
                          <>
                            <CheckCircle size={14} className="geo-ok" />
                            <span>Adresse géocodée</span>
                          </>
                        )}
                        {enseignant.geoStatus === 'error' && (
                          <>
                            <AlertCircle size={14} className="geo-error" />
                            <span>Géocodage échoué</span>
                          </>
                        )}
                        {enseignant.geoStatus === 'pending' && (
                          <>
                            <Clock size={14} className="geo-pending" />
                            <span>En attente de géocodage</span>
                          </>
                        )}
                      </div>
                      {enseignant.lat && enseignant.lon && (
                        <p className="coords">
                          Coordonnées : {enseignant.lat.toFixed(4)}, {enseignant.lon.toFixed(4)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="no-data">Aucune adresse renseignée</p>
                  )}
                </div>
              </section>

              {/* Section Heures */}
              {(enseignant.heuresParNiveau && Object.keys(enseignant.heuresParNiveau).length > 0) || enseignant.heures3eReelles ? (
                <section className="info-section">
                  <h3>
                    <Clock size={16} />
                    Heures
                  </h3>
                  {enseignant.heures3eReelles !== undefined && (
                    <div className="heures-reelles-info">
                      <span className="heures-label">Heures 3e réelles</span>
                      <span className="heures-value highlight">{enseignant.heures3eReelles}h</span>
                      <span className="heures-hint">(saisie manuelle)</span>
                    </div>
                  )}
                  {enseignant.heuresParNiveau && Object.keys(enseignant.heuresParNiveau).length > 0 && (
                    <div className="heures-grid">
                      {Object.entries(enseignant.heuresParNiveau).map(([niveau, heures]) => (
                        <div key={niveau} className="heure-item">
                          <span className="niveau-label">{niveau}</span>
                          <span className="heures-value">{heures}h</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {/* Section Tags */}
              {enseignant.tags && enseignant.tags.length > 0 && (
                <section className="info-section">
                  <h3>Tags</h3>
                  <div className="tags-list">
                    {enseignant.tags.map((tag, i) => (
                      <span key={i} className="tag-item">{tag}</span>
                    ))}
                  </div>
                </section>
              )}

              {/* Métadonnées */}
              <section className="info-section metadata">
                <div className="meta-item">
                  <span className="meta-label">Créé le</span>
                  <span className="meta-value">
                    {enseignant.createdAt ? new Date(enseignant.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Modifié le</span>
                  <span className="meta-value">
                    {enseignant.updatedAt ? new Date(enseignant.updatedAt).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </div>
              </section>
            </div>
          ) : (
            <div className="tab-historique">
              <HistoryTimeline enseignantId={enseignant.id!} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
