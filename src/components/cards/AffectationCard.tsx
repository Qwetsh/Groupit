// ============================================================
// COMPONENT - AFFECTATION CARD
// ============================================================

import clsx from 'clsx';
import { Link2, Edit2, Trash2, AlertTriangle, CheckCircle, MapPin, BookOpen } from 'lucide-react';
import type { Affectation, Eleve, Enseignant, MetadataSuiviStage, MetadataOralDNB } from '../../domain/models';
import './AffectationCard.css';

interface AffectationCardProps {
  affectation: Affectation;
  eleve: Eleve;
  enseignant: Enseignant;
  onEdit?: (affectation: Affectation) => void;
  onDelete?: (affectation: Affectation) => void;
  onClick?: (affectation: Affectation) => void;
  onShowDetails?: () => void;
}

export function AffectationCard({
  affectation,
  eleve,
  enseignant,
  onEdit,
  onDelete,
  onClick,
  onShowDetails,
}: AffectationCardProps) {
  const scoreTotal = affectation.scoreTotal ?? 0;
  const scoreLevel = scoreTotal >= 70 ? 'high' : scoreTotal >= 40 ? 'medium' : 'low';
  
  // Extraire les top 3 raisons du score
  const scoreDetails = affectation.scoreDetail || {};
  const topReasons = Object.entries(scoreDetails)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const metadata = affectation.metadata as MetadataSuiviStage | MetadataOralDNB | undefined;
  
  return (
    <div 
      className={clsx('affectation-card', scoreLevel)}
      onClick={() => onShowDetails?.() ?? onClick?.(affectation)}
    >
      <div className="affectation-card-header">
        <div className="affectation-link-icon">
          <Link2 size={16} />
        </div>
        
        <div className="affectation-score">
          <span className={clsx('score-value', scoreLevel)}>{scoreTotal}</span>
          <span className="score-label">Score</span>
        </div>
      </div>
      
      <div className="affectation-card-content">
        {/* Élève */}
        <div className="affectation-person eleve">
          <div className="person-label">Élève</div>
          <div className="person-name">{eleve.prenom} {eleve.nom}</div>
          <div className="person-info">{eleve.classe}</div>
        </div>
        
        <div className="affectation-arrow">→</div>
        
        {/* Enseignant */}
        <div className="affectation-person enseignant">
          <div className="person-label">Enseignant</div>
          <div className="person-name">{enseignant.prenom} {enseignant.nom}</div>
          <div className="person-info">{enseignant.matierePrincipale}</div>
        </div>
      </div>
      
      {/* Metadata */}
      {affectation.type === 'suivi_stage' && (metadata as MetadataSuiviStage)?.lieuStageNom && (
        <div className="affectation-metadata">
          <MapPin size={12} />
          <span>{(metadata as MetadataSuiviStage).lieuStageNom}</span>
          {(metadata as MetadataSuiviStage).entreprise && (
            <span className="meta-secondary">({(metadata as MetadataSuiviStage).entreprise})</span>
          )}
        </div>
      )}
      
      {affectation.type === 'oral_dnb' && (metadata as MetadataOralDNB)?.matiereOralChoisieParEleve && (
        <div className="affectation-metadata">
          <BookOpen size={12} />
          <span>Oral: {(metadata as MetadataOralDNB).matiereOralChoisieParEleve}</span>
          {(metadata as MetadataOralDNB).theme && (
            <span className="meta-secondary">- {(metadata as MetadataOralDNB).theme}</span>
          )}
        </div>
      )}
      
      {/* Score Breakdown */}
      {topReasons.length > 0 && (
        <div className="affectation-reasons">
          {topReasons.map(([key, value]) => (
            <div key={key} className="reason-item">
              {value >= 70 ? (
                <CheckCircle size={12} className="icon-success" />
              ) : value >= 40 ? (
                <AlertTriangle size={12} className="icon-warning" />
              ) : (
                <AlertTriangle size={12} className="icon-danger" />
              )}
              <span className="reason-key">{formatReasonKey(key)}</span>
              <span className={clsx('reason-value', value >= 70 ? 'high' : value >= 40 ? 'medium' : 'low')}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="affectation-card-actions">
          {onEdit && (
            <button 
              className="action-btn" 
              onClick={(e) => { e.stopPropagation(); onEdit(affectation); }}
              title="Modifier"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button 
              className="action-btn delete" 
              onClick={(e) => { e.stopPropagation(); onDelete(affectation); }}
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatReasonKey(key: string): string {
  const labels: Record<string, string> = {
    distance: 'Distance',
    capacite: 'Capacité',
    equilibrage: 'Équilibrage',
    matiere: 'Matière',
    contraintes_relationnelles: 'Contraintes',
  };
  return labels[key] || key;
}
