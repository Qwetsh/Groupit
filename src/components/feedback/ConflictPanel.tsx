// ============================================================
// COMPONENT - CONFLICT PANEL
// ============================================================

import clsx from 'clsx';
import { AlertTriangle, XCircle, AlertOctagon, Users, BookOpen, MapPin, UserX } from 'lucide-react';
import type { ConstraintViolation } from '../../domain/models';
import './ConflictPanel.css';

interface ConflictPanelProps {
  conflicts: ConstraintViolation[];
  nonAffectes?: { id: string; nom: string; prenom: string; classe: string }[];
  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const CONFLICT_ICONS: Record<string, React.ReactNode> = {
  capacite: <Users size={16} />,
  matiere: <BookOpen size={16} />,
  matiere_eleve: <BookOpen size={16} />,
  distance: <MapPin size={16} />,
  contrainte_relationnelle: <UserX size={16} />,
};

export function ConflictPanel({
  conflicts,
  nonAffectes = [],
  title = 'Alertes & Conflits',
  collapsible = true,
  defaultCollapsed = false,
}: ConflictPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  
  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');
  
  const hasIssues = errors.length > 0 || warnings.length > 0 || nonAffectes.length > 0;
  
  if (!hasIssues) {
    return (
      <div className="conflict-panel success">
        <div className="conflict-panel-header">
          <CheckCircle size={18} />
          <span>Aucun conflit détecté</span>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('conflict-panel', errors.length > 0 && 'has-errors')}>
      <div 
        className="conflict-panel-header"
        onClick={() => collapsible && setCollapsed(!collapsed)}
      >
        {errors.length > 0 ? (
          <AlertOctagon size={18} className="icon-error" />
        ) : (
          <AlertTriangle size={18} className="icon-warning" />
        )}
        
        <span className="conflict-title">{title}</span>
        
        <div className="conflict-counts">
          {errors.length > 0 && (
            <span className="count error">{errors.length} erreur{errors.length > 1 ? 's' : ''}</span>
          )}
          {warnings.length > 0 && (
            <span className="count warning">{warnings.length} alerte{warnings.length > 1 ? 's' : ''}</span>
          )}
          {nonAffectes.length > 0 && (
            <span className="count info">{nonAffectes.length} non affecté{nonAffectes.length > 1 ? 's' : ''}</span>
          )}
        </div>
        
        {collapsible && (
          <button className="collapse-btn">
            {collapsed ? '▼' : '▲'}
          </button>
        )}
      </div>
      
      {!collapsed && (
        <div className="conflict-panel-content">
          {/* Erreurs */}
          {errors.length > 0 && (
            <div className="conflict-section">
              <h4 className="section-title error">
                <XCircle size={14} />
                Erreurs bloquantes
              </h4>
              <ul className="conflict-list">
                {errors.map((conflict, index) => (
                  <li key={index} className="conflict-item error">
                    <span className="conflict-icon">
                      {CONFLICT_ICONS[conflict.type] || <AlertTriangle size={16} />}
                    </span>
                    <span className="conflict-message">{conflict.message}</span>
                    <span className="conflict-type">{conflict.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Avertissements */}
          {warnings.length > 0 && (
            <div className="conflict-section">
              <h4 className="section-title warning">
                <AlertTriangle size={14} />
                Avertissements
              </h4>
              <ul className="conflict-list">
                {warnings.map((conflict, index) => (
                  <li key={index} className="conflict-item warning">
                    <span className="conflict-icon">
                      {CONFLICT_ICONS[conflict.type] || <AlertTriangle size={16} />}
                    </span>
                    <span className="conflict-message">{conflict.message}</span>
                    <span className="conflict-type">{conflict.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Non affectés */}
          {nonAffectes.length > 0 && (
            <div className="conflict-section">
              <h4 className="section-title info">
                <Users size={14} />
                Élèves non affectés
              </h4>
              <ul className="non-affectes-list">
                {nonAffectes.map((eleve) => (
                  <li key={eleve.id} className="non-affecte-item">
                    <span className="eleve-name">{eleve.prenom} {eleve.nom}</span>
                    <span className="eleve-classe">{eleve.classe}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Import React useState
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
