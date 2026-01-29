import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { DraggableEleveProps } from '../types';

/** Icône selon le type de problème */
const problemIcons: Record<string, string> = {
  'no-stage': '📭',
  'no-address': '🏢',
  'no-geo': '📍',
  'too-far': '🚗',
  'capacity': '👥',
  'unknown': '❓',
};

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
 * Composant élève draggable depuis la colonne "non affectés"
 */
export const DraggableEleve: React.FC<DraggableEleveProps> = ({ eleve, onContextMenu, nonAffectationInfo, distanceFromEnseignantKm }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `eleve:${eleve.id}`,
    data: { type: 'eleve', eleveId: eleve.id, eleve },
  });

  const distanceClass = getDistanceColorClass(distanceFromEnseignantKm);
  const showDistanceBadge = distanceFromEnseignantKm !== undefined;

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, eleve);
  };

  const problemType = nonAffectationInfo?.problemType || 'unknown';
  const hasTooltip = nonAffectationInfo && nonAffectationInfo.raisons.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-eleve ${isDragging ? 'dragging' : ''} ${hasTooltip ? `problem-${problemType}` : ''} ${distanceClass}`}
      onContextMenu={handleContextMenu}
      title={hasTooltip ? nonAffectationInfo.raisons.join('\n') : undefined}
      {...listeners}
      {...attributes}
    >
      {hasTooltip && (
        <span className="problem-indicator">{problemIcons[problemType]}</span>
      )}
      <GripVertical size={14} className="drag-handle" />
      <span className="eleve-nom">{eleve.nom}</span>
      <span className="eleve-prenom">{eleve.prenom}</span>
      <span className="eleve-classe">{eleve.classe}</span>
      {showDistanceBadge && (
        <span className={`eleve-distance-badge ${distanceClass}`}>
          {distanceFromEnseignantKm! < 1 ? '<1' : Math.round(distanceFromEnseignantKm!)} km
        </span>
      )}
      {hasTooltip && (
        <div className="eleve-tooltip">
          <div className="tooltip-header">Raison de non-affectation</div>
          <ul className="tooltip-reasons">
            {nonAffectationInfo.raisons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
