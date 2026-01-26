import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { DraggableEleveProps } from '../types';

/**
 * Composant élève draggable depuis la colonne "non affectés"
 */
export const DraggableEleve: React.FC<DraggableEleveProps> = ({ eleve, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `eleve:${eleve.id}`,
    data: { type: 'eleve', eleveId: eleve.id, eleve },
  });

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-eleve ${isDragging ? 'dragging' : ''}`}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={14} className="drag-handle" />
      <span className="eleve-nom">{eleve.nom}</span>
      <span className="eleve-prenom">{eleve.prenom}</span>
      <span className="eleve-classe">{eleve.classe}</span>
    </div>
  );
};
