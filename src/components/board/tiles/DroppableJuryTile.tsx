import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Users, CheckCircle } from 'lucide-react';
import type { Eleve, Affectation, Jury } from '../../../domain/models';
import type { DroppableJuryTileProps, JuryAffectationDisplay } from '../types';

// ============================================================
// DRAGGABLE JURY AFFECTATION CHIP (interne)
// ============================================================

interface DraggableJuryAffectationChipProps {
  display: JuryAffectationDisplay;
  jury: Jury;
  affectation: Affectation;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, jury: Jury) => void;
}

const DraggableJuryAffectationChip: React.FC<DraggableJuryAffectationChipProps> = ({
  display,
  jury,
  affectation,
  onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `jury-aff:${affectation.id}`,
    data: { type: 'jury-affectation', affectationId: affectation.id, eleveId: display.eleveId, eleve: display.eleve },
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, display.eleve, affectation, jury);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mini-eleve jury-eleve ${display.matiereMatch ? 'matiere-match' : 'no-matiere-match'} ${isDragging ? 'dragging' : ''}`}
      title={`${display.eleve.prenom} ${display.eleve.nom} - ${display.matiereEleve || 'Matière non renseignée'}${display.matiereMatch ? ' ✓' : ''}`}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <span className="mini-name">{display.eleve.prenom} {display.eleve.nom.charAt(0)}.</span>
      {display.matiereEleve && (
        <span className={`mini-matiere ${display.matiereMatch ? 'match' : ''}`}>
          {display.matiereEleve.substring(0, 3)}
          {display.matiereMatch && <CheckCircle size={10} />}
        </span>
      )}
    </div>
  );
};

// ============================================================
// DROPPABLE JURY TILE
// ============================================================

/**
 * Tuile jury droppable pour l'Oral DNB
 */
export const DroppableJuryTile: React.FC<DroppableJuryTileProps> = ({
  jury,
  enseignants,
  affectationsDisplay,
  scenarioAffectations,
  onContextMenu,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `jury:${jury.id}`,
    data: { type: 'jury', juryId: jury.id },
  });

  // Get jury enseignants
  const juryEnseignants = enseignants.filter(e => jury.enseignantIds.includes(e.id!));
  const juryMatieres = [...new Set(juryEnseignants.map(e => e.matierePrincipale))];

  // Stats
  const nbMatchMatiere = affectationsDisplay.filter(a => a.matiereMatch).length;
  const tauxRemplissage = Math.round((affectationsDisplay.length / jury.capaciteMax) * 100);

  return (
    <div
      ref={setNodeRef}
      className={`jury-tile ${affectationsDisplay.length > 0 ? 'has-eleves' : ''} ${isOver ? 'drop-highlight' : ''}`}
    >
      <div className="tile-header jury-header">
        <div className="tile-info">
          <span className="tile-name jury-name">
            <Users size={14} />
            {jury.nom}
          </span>
          <div className="jury-enseignants-list">
            {juryEnseignants.length > 0 ? (
              juryEnseignants.map((e) => (
                <span key={e.id} className="ens-full-name" title={e.matierePrincipale}>
                  {e.prenom} {e.nom}
                </span>
              ))
            ) : (
              <span className="no-enseignants">Aucun enseignant</span>
            )}
          </div>
          <div className="jury-matieres">
            {juryMatieres.map((m, idx) => (
              <span key={idx} className="jury-matiere-tag">{m}</span>
            ))}
          </div>
        </div>
        <div className="tile-count jury-count">
          <span className={affectationsDisplay.length >= jury.capaciteMax ? 'full' : ''}>
            {affectationsDisplay.length}/{jury.capaciteMax}
          </span>
          {affectationsDisplay.length > 0 && (
            <span className="matiere-match-count" title="Correspondances matière">
              <CheckCircle size={12} />
              {nbMatchMatiere}
            </span>
          )}
        </div>
      </div>
      <div className="tile-eleves jury-eleves">
        {affectationsDisplay.map((display) => {
          const aff = scenarioAffectations.find(a => a.eleveId === display.eleveId);
          if (!aff) return null;
          return (
            <DraggableJuryAffectationChip
              key={display.eleveId}
              display={display}
              jury={jury}
              affectation={aff}
              onContextMenu={onContextMenu}
            />
          );
        })}
        {affectationsDisplay.length === 0 && (
          <div className="tile-empty">Déposez des élèves ici</div>
        )}
      </div>
      {tauxRemplissage > 0 && (
        <div className="jury-progress">
          <div
            className={`progress-fill ${tauxRemplissage >= 100 ? 'full' : tauxRemplissage >= 80 ? 'warning' : ''}`}
            style={{ width: `${Math.min(tauxRemplissage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
