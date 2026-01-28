import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAffectationChipProps } from '../types';

/**
 * Retourne la classe CSS de couleur selon la distance
 */
function getDistanceColorClass(distanceKm: number | undefined): string {
  if (distanceKm === undefined) return '';
  if (distanceKm <= 5) return 'distance-close';      // Vert
  if (distanceKm <= 15) return 'distance-medium';    // Jaune
  if (distanceKm <= 30) return 'distance-far';       // Orange
  return 'distance-very-far';                         // Rouge
}

/**
 * Chip draggable représentant un élève déjà affecté à un enseignant
 */
export const DraggableAffectationChip: React.FC<DraggableAffectationChipProps> = ({
  affectation,
  eleve,
  enseignant,
  onContextMenu,
  distanceFromEnseignantKm,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `affectation:${affectation.id}`,
    data: { type: 'affectation', affectationId: affectation.id, eleveId: eleve.id, eleve },
  });

  const distanceClass = getDistanceColorClass(distanceFromEnseignantKm);
  const showDistanceBadge = distanceFromEnseignantKm !== undefined;

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, eleve, affectation, enseignant);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mini-eleve ${isDragging ? 'dragging' : ''} ${distanceClass}`}
      title={`${eleve.prenom} ${eleve.nom} (${eleve.classe})${showDistanceBadge ? ` - ${Math.round(distanceFromEnseignantKm!)} km` : ''} - Clic droit pour le menu`}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <span className="mini-name">{eleve.prenom} {eleve.nom.charAt(0)}.</span>
      <span className="mini-classe">{eleve.classe}</span>
      {showDistanceBadge && (
        <span className={`mini-distance ${distanceClass}`}>
          {distanceFromEnseignantKm! < 1 ? '<1' : Math.round(distanceFromEnseignantKm!)}km
        </span>
      )}
    </div>
  );
};
