// ============================================================
// COMPONENT - SCORE BREAKDOWN
// ============================================================

import clsx from 'clsx';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import './ScoreBreakdown.css';

interface ScoreBreakdownProps {
  scoreDetail: Record<string, number>;
  scoreTotal: number;
  showDetails?: boolean;
}

const CRITERIA_LABELS: Record<string, { label: string; description: string }> = {
  distance: {
    label: 'Distance',
    description: 'Distance entre le domicile de l\'enseignant et le lieu de stage',
  },
  capacite: {
    label: 'Capacité',
    description: 'Disponibilité de l\'enseignant par rapport à sa charge actuelle',
  },
  equilibrage: {
    label: 'Équilibrage',
    description: 'Répartition équitable des élèves entre les enseignants',
  },
  matiere: {
    label: 'Matière',
    description: 'Correspondance entre la matière choisie et celle de l\'enseignant',
  },
  contraintes_relationnelles: {
    label: 'Contraintes',
    description: 'Respect des contraintes relationnelles (doit/ne doit pas être avec)',
  },
};

export function ScoreBreakdown({
  scoreDetail,
  scoreTotal,
  showDetails = true,
}: ScoreBreakdownProps) {
  const entries = Object.entries(scoreDetail).sort(([, a], [, b]) => b - a);
  
  const getScoreIcon = (score: number) => {
    if (score >= 70) return <CheckCircle size={16} className="icon-success" />;
    if (score >= 40) return <AlertTriangle size={16} className="icon-warning" />;
    return <XCircle size={16} className="icon-danger" />;
  };
  
  const getScoreLevel = (score: number) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  return (
    <div className="score-breakdown">
      <div className="score-breakdown-header">
        <div className="score-total">
          <span className={clsx('score-value', getScoreLevel(scoreTotal))}>
            {scoreTotal}
          </span>
          <span className="score-label">Score global</span>
        </div>
        
        <div className="score-gauge">
          <div 
            className={clsx('gauge-fill', getScoreLevel(scoreTotal))}
            style={{ width: `${scoreTotal}%` }}
          />
        </div>
      </div>
      
      {showDetails && entries.length > 0 && (
        <div className="score-breakdown-details">
          <h4 className="details-title">
            <Info size={14} />
            Détail des critères
          </h4>
          
          <div className="criteria-list">
            {entries.map(([key, value]) => {
              const criteria = CRITERIA_LABELS[key] || { label: key, description: '' };
              
              return (
                <div key={key} className="criteria-item">
                  <div className="criteria-header">
                    {getScoreIcon(value)}
                    <span className="criteria-label">{criteria.label}</span>
                    <span className={clsx('criteria-score', getScoreLevel(value))}>
                      {value}/100
                    </span>
                  </div>
                  
                  <div className="criteria-bar">
                    <div 
                      className={clsx('bar-fill', getScoreLevel(value))}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  
                  {criteria.description && (
                    <p className="criteria-description">{criteria.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
