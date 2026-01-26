import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MapPin } from 'lucide-react';
import { DraggableAffectationChip } from './DraggableAffectationChip';
import type { DroppableEnseignantTileProps } from '../types';

/**
 * Tuile enseignant droppable pour recevoir des élèves
 */
export const DroppableEnseignantTile: React.FC<DroppableEnseignantTileProps> = ({
  enseignant,
  affectations,
  eleves,
  capacity,
  onContextMenu,
  onClick,
  isStageScenario,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `enseignant:${enseignant.id}`,
    data: { type: 'enseignant', enseignantId: enseignant.id },
  });

  const handleTileClick = (e: React.MouseEvent) => {
    // Ne pas déclencher si on clique sur un élève ou si c'est un drag
    if ((e.target as HTMLElement).closest('.mini-eleve')) return;
    if (onClick && isStageScenario) {
      onClick(enseignant);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`enseignant-tile ${affectations.length > 0 ? 'has-eleves' : ''} ${isOver ? 'drop-highlight' : ''} ${isStageScenario && onClick ? 'clickable' : ''}`}
      onClick={handleTileClick}
      style={isStageScenario && onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="tile-header">
        <div className="tile-info">
          <span className="tile-name">{enseignant.prenom} {enseignant.nom}</span>
          <span className="tile-matiere">{enseignant.matierePrincipale}</span>
          {enseignant.estProfPrincipal && enseignant.classePP && (
            <span className="tile-pp">PP {enseignant.classePP}</span>
          )}
        </div>
        <div className="tile-count">
          <span className={affectations.length >= capacity ? 'full' : ''}>
            {affectations.length}/{capacity}
          </span>
          {isStageScenario && affectations.length > 0 && (
            <span title="Cliquez pour voir la carte des trajets">
              <MapPin size={14} className="stage-map-icon" />
            </span>
          )}
        </div>
      </div>
      <div className="tile-eleves">
        {affectations.map(aff => {
          const eleve = eleves.find(e => e.id === aff.eleveId);
          if (!eleve) return null;
          return (
            <DraggableAffectationChip
              key={aff.id}
              affectation={aff}
              eleve={eleve}
              enseignant={enseignant}
              onContextMenu={onContextMenu}
            />
          );
        })}
        {affectations.length === 0 && (
          <div className="tile-empty">Déposez des élèves ici</div>
        )}
      </div>
    </div>
  );
};
