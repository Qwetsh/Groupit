// ============================================================
// COMPONENT - ENSEIGNANT CARD
// ============================================================

import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import { UserCog, Edit2, Trash2, Award, MapPin, Users } from 'lucide-react';
import type { Enseignant, CapaciteConfig } from '../../domain/models';
import { calculateEnseignantCapacity } from '../../algorithms';
import './EnseignantCard.css';

interface EnseignantCardProps {
  enseignant: Enseignant;
  chargeActuelle?: number;
  affectationCount?: number;
  capaciteConfig?: CapaciteConfig;
  isDragging?: boolean;
  isSelected?: boolean;
  onEdit?: (enseignant: Enseignant) => void;
  onDelete?: (enseignant: Enseignant) => void;
  onClick?: () => void;
  compact?: boolean;
}

const defaultCapaciteConfig: CapaciteConfig = {
  capaciteBaseDefaut: 2,
  coefficients: { '6e': 0, '5e': 0, '4e': 0.5, '3e': 1 },
};

export function EnseignantCard({
  enseignant,
  chargeActuelle = 0,
  affectationCount = 0,
  capaciteConfig = defaultCapaciteConfig,
  isDragging = false,
  isSelected = false,
  onEdit,
  onDelete,
  onClick,
  compact = false,
}: EnseignantCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `enseignant:${enseignant.id}`,
    data: { type: 'enseignant', enseignant },
  });

  const capacite = calculateEnseignantCapacity(enseignant, capaciteConfig);
  const actualCharge = affectationCount || chargeActuelle;
  const tauxCharge = capacite > 0 ? (actualCharge / capacite) * 100 : 0;

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'enseignant-card',
        isDragging && 'dragging',
        isSelected && 'selected',
        isOver && 'drop-target',
        tauxCharge >= 100 && 'full',
        compact && 'compact'
      )}
      onClick={onClick}
    >
      <div className="enseignant-card-content">
        <div className="enseignant-card-header">
          <div className="enseignant-card-avatar">
            <UserCog size={18} />
          </div>
          <div className="enseignant-card-name">
            <span className="nom">{enseignant.nom}</span>
            <span className="prenom">{enseignant.prenom}</span>
          </div>
          {enseignant.estProfPrincipal && (
            <div className="pp-badge" title="Professeur Principal">
              <Award size={14} />
              PP
            </div>
          )}
        </div>
        
        <div className="enseignant-card-matiere">
          {enseignant.matierePrincipale}
        </div>
        
        {!compact && (
          <>
            {enseignant.classePP && (
              <div className="enseignant-card-info">
                <Users size={12} />
                <span>PP de {enseignant.classePP}</span>
              </div>
            )}
            
            {enseignant.classesEnCharge.length > 0 && (
              <div className="enseignant-card-classes">
                {enseignant.classesEnCharge.map((c, i) => (
                  <span key={i} className="classe-tag">{c}</span>
                ))}
              </div>
            )}
            
            {enseignant.commune && (
              <div className="enseignant-card-info">
                <MapPin size={12} />
                <span>{enseignant.commune}</span>
              </div>
            )}
          </>
        )}
        
        <div className="enseignant-card-capacite">
          <div className="capacite-label">
            <span>Charge</span>
            <span className="capacite-value">{chargeActuelle} / {capacite}</span>
          </div>
          <div className="capacite-bar">
            <div 
              className={clsx(
                'capacite-fill',
                tauxCharge >= 100 ? 'full' : tauxCharge >= 80 ? 'high' : tauxCharge >= 50 ? 'medium' : 'low'
              )}
              style={{ width: `${Math.min(100, tauxCharge)}%` }}
            />
          </div>
        </div>
      </div>
      
      {(onEdit || onDelete) && (
        <div className="enseignant-card-actions">
          {onEdit && (
            <button 
              className="action-btn" 
              onClick={(e) => { e.stopPropagation(); onEdit(enseignant); }}
              title="Modifier"
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button 
              className="action-btn delete" 
              onClick={(e) => { e.stopPropagation(); onDelete(enseignant); }}
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
