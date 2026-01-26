import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { DraggableAffectationChipProps } from '../types';

/**
 * Chip draggable représentant un élève déjà affecté à un enseignant
 */
export const DraggableAffectationChip: React.FC<DraggableAffectationChipProps> = ({
  affectation,
  eleve,
  enseignant,
  onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `affectation:${affectation.id}`,
    data: { type: 'affectation', affectationId: affectation.id, eleveId: eleve.id, eleve },
  });

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
      className={`mini-eleve ${isDragging ? 'dragging' : ''}`}
      title={`${eleve.prenom} ${eleve.nom} (${eleve.classe}) - Clic droit pour le menu`}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <span className="mini-name">{eleve.prenom} {eleve.nom.charAt(0)}.</span>
      <span className="mini-classe">{eleve.classe}</span>
    </div>
  );
};
