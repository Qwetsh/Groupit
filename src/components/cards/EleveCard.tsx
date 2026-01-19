// ============================================================
// COMPONENT - ELEVE CARD
// ============================================================

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { User, GripVertical, Edit2, Trash2, Link, Link2Off } from 'lucide-react';
import type { Eleve } from '../../domain/models';
import './EleveCard.css';

interface EleveCardProps {
  eleve: Eleve;
  isAssigned?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  score?: number;
  onEdit?: (eleve: Eleve) => void;
  onDelete?: (eleve: Eleve) => void;
  onClick?: () => void;
  compact?: boolean;
}

export function EleveCard({
  eleve,
  isAssigned = false,
  isDragging = false,
  isSelected = false,
  score,
  onEdit,
  onDelete,
  onClick,
  compact = false,
}: EleveCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `eleve:${eleve.id}`,
    data: { type: 'eleve', eleve },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'eleve-card',
        isAssigned && 'assigned',
        isDragging && 'dragging',
        isSelected && 'selected',
        compact && 'compact'
      )}
      onClick={onClick}
    >
      <div className="eleve-card-drag" {...listeners} {...attributes}>
        <GripVertical size={16} />
      </div>
      
      <div className="eleve-card-content">
        <div className="eleve-card-header">
          <div className="eleve-card-avatar">
            <User size={18} />
          </div>
          <div className="eleve-card-name">
            <span className="nom">{eleve.nom}</span>
            <span className="prenom">{eleve.prenom}</span>
          </div>
          {score !== undefined && (
            <div className={clsx('eleve-card-score', score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low')}>
              {score}
            </div>
          )}
        </div>
        
        {!compact && (
          <div className="eleve-card-details">
            <span className="eleve-card-classe">{eleve.classe}</span>
            
            {eleve.options.length > 0 && (
              <div className="eleve-card-options">
                {eleve.options.map((opt, i) => (
                  <span key={i} className="option-tag">{opt}</span>
                ))}
              </div>
            )}
            
            {eleve.tags.length > 0 && (
              <div className="eleve-card-tags">
                {eleve.tags.map((tag, i) => (
                  <span key={i} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="eleve-card-status">
          {isAssigned ? (
            <span className="status assigned"><Link size={12} /> Affecté</span>
          ) : (
            <span className="status unassigned"><Link2Off size={12} /> Non affecté</span>
          )}
        </div>
      </div>
      
      {(onEdit || onDelete) && (
        <div className="eleve-card-actions">
          {onEdit && (
            <button 
              className="action-btn" 
              onClick={(e) => { e.stopPropagation(); onEdit(eleve); }}
              title="Modifier"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button 
              className="action-btn delete" 
              onClick={(e) => { e.stopPropagation(); onDelete(eleve); }}
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
