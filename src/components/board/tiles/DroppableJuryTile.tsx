import React, { useState, useMemo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Users, CheckCircle, ShieldCheck, Clock, X } from 'lucide-react';
import type { Eleve, Affectation, Jury, MetadataOralDNB } from '../../../domain/models';
import type { DroppableJuryTileProps, JuryAffectationDisplay } from '../types';

// ============================================================
// DRAGGABLE JURY AFFECTATION CHIP (interne)
// ============================================================

interface DraggableJuryAffectationChipProps {
  display: JuryAffectationDisplay;
  jury: Jury;
  affectation: Affectation;
  onContextMenu: (e: React.MouseEvent, eleve: Eleve, affectation: Affectation, jury: Jury) => void;
  showGenderColor?: boolean;
  sameClassAsDragged?: boolean;
}

const DraggableJuryAffectationChip: React.FC<DraggableJuryAffectationChipProps> = ({
  display,
  jury,
  affectation,
  onContextMenu,
  showGenderColor,
  sameClassAsDragged,
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

  const metadata = affectation.metadata as MetadataOralDNB | undefined;
  const heureCreneau = metadata?.heureCreneau;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mini-eleve jury-eleve ${display.matiereMatch ? 'matiere-match' : 'no-matiere-match'} ${isDragging ? 'dragging' : ''} ${showGenderColor ? `gender-${(display.eleve.sexe || '').toLowerCase()}` : ''} ${sameClassAsDragged ? 'same-class-highlight' : ''}`}
      title={`${display.eleve.prenom} ${display.eleve.nom} - ${display.matiereEleve || 'Matière non renseignée'}${display.matiereMatch ? ' ✓' : ''}${heureCreneau ? ` - ${heureCreneau}` : ''}`}
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
// SCHEDULE MODAL (planning des passages)
// ============================================================

interface ScheduleModalProps {
  jury: Jury;
  affectationsDisplay: JuryAffectationDisplay[];
  scenarioAffectations: Affectation[];
  onClose: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  jury,
  affectationsDisplay,
  scenarioAffectations,
  onClose,
}) => {
  // Build schedule: eleve + heure + demiJournee, sorted by time
  const schedule = useMemo(() => {
    const items: { eleve: Eleve; heure: string; demiJournee: string; matiereEleve: string | null; matiereMatch: boolean }[] = [];

    for (const display of affectationsDisplay) {
      const aff = scenarioAffectations.find(a => a.eleveId === display.eleveId);
      if (!aff) continue;
      const meta = aff.metadata as MetadataOralDNB | undefined;
      items.push({
        eleve: display.eleve,
        heure: meta?.heureCreneau || '',
        demiJournee: meta?.dateCreneau || '',
        matiereEleve: display.matiereEleve,
        matiereMatch: display.matiereMatch,
      });
    }

    // Sort by demiJournee then heure
    items.sort((a, b) => {
      const djCmp = a.demiJournee.localeCompare(b.demiJournee, 'fr');
      if (djCmp !== 0) return djCmp;
      return a.heure.localeCompare(b.heure);
    });

    return items;
  }, [affectationsDisplay, scenarioAffectations]);

  // Group by demiJournee
  const grouped = useMemo(() => {
    const map = new Map<string, typeof schedule>();
    for (const item of schedule) {
      const key = item.demiJournee || 'Non planifié';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [schedule]);

  return (
    <div className="schedule-modal-overlay" onClick={onClose}>
      <div className="schedule-modal" onClick={e => e.stopPropagation()}>
        <div className="schedule-modal-header">
          <div className="schedule-modal-title">
            <Clock size={18} />
            <h3>Planning — {jury.nom}</h3>
          </div>
          <button className="schedule-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="schedule-modal-body">
          {schedule.length === 0 ? (
            <p className="schedule-empty">Aucun créneau attribué.</p>
          ) : (
            [...grouped.entries()].map(([dj, items]) => (
              <div key={dj} className="schedule-group">
                <div className="schedule-group-label">{dj}</div>
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>Heure</th>
                      <th>Élève</th>
                      <th>Classe</th>
                      <th>Matière</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className={item.matiereMatch ? 'matiere-match-row' : ''}>
                        <td className="schedule-heure">{item.heure || '—'}</td>
                        <td>{item.eleve.nom} {item.eleve.prenom}</td>
                        <td>{item.eleve.classe}</td>
                        <td>
                          {item.matiereEleve || '—'}
                          {item.matiereMatch && <CheckCircle size={12} className="inline-match-icon" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
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
  showGenderColor,
  draggedEleveClasse,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `jury:${jury.id}`,
    data: { type: 'jury', juryId: jury.id },
  });

  const [showSchedule, setShowSchedule] = useState(false);

  // Get jury enseignants (titulaires + suppléants)
  const juryEnseignants = enseignants.filter(e => jury.enseignantIds.includes(e.id!));
  const jurySuppleants = enseignants.filter(e => jury.suppleantsIds?.includes(e.id!));
  const juryMatieres = [...new Set(juryEnseignants.map(e => e.matierePrincipale))];

  // Check if any affectation has a time slot
  const hasTimeSlots = scenarioAffectations.some(a => {
    if (a.juryId !== jury.id) return false;
    const meta = a.metadata as MetadataOralDNB | undefined;
    return !!meta?.heureCreneau;
  });

  // Stats
  const nbMatchMatiere = affectationsDisplay.filter(a => a.matiereMatch).length;
  const tauxRemplissage = Math.round((affectationsDisplay.length / jury.capaciteMax) * 100);

  return (
    <div
      ref={setNodeRef}
      className={`jury-tile ${affectationsDisplay.length > 0 ? 'has-eleves' : ''} ${isOver ? 'drop-highlight' : ''}`}
    >
      <div
        className={`tile-header jury-header ${hasTimeSlots ? 'clickable-header' : ''}`}
        onClick={hasTimeSlots ? () => setShowSchedule(true) : undefined}
      >
        <div className="tile-info">
          <span className="tile-name jury-name">
            <Users size={14} />
            {jury.nom}
            {jury.salle && <span className="jury-salle-badge">Salle {jury.salle}</span>}
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
          {jurySuppleants.length > 0 && (
            <div className="jury-suppleants-list">
              <ShieldCheck size={12} className="suppleant-icon" />
              {jurySuppleants.map((e) => (
                <span key={e.id} className="ens-suppleant-name" title={`Suppléant - ${e.matierePrincipale}`}>
                  {e.prenom} {e.nom}
                </span>
              ))}
            </div>
          )}
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
          {hasTimeSlots && (
            <span className="schedule-hint" title="Cliquer pour voir le planning">
              <Clock size={12} />
            </span>
          )}
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
              showGenderColor={showGenderColor}
              sameClassAsDragged={!!draggedEleveClasse && display.eleve.classe === draggedEleveClasse}
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

      {showSchedule && (
        <ScheduleModal
          jury={jury}
          affectationsDisplay={affectationsDisplay}
          scenarioAffectations={scenarioAffectations}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </div>
  );
};
