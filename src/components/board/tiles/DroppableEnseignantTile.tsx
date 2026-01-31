import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MapPin } from 'lucide-react';
import { DraggableAffectationChip } from './DraggableAffectationChip';
import type { DroppableEnseignantTileProps } from '../types';

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
 * Retourne la classe CSS de couleur selon le ratio de charge
 * ratio = nbEleves / heures3e
 * ≤100% = vert, 101-150% = orange, >150% = rouge
 */
function getChargeColorClass(nbEleves: number, heures3e: number | undefined): string {
  if (heures3e === undefined || heures3e === 0) return '';
  const ratio = nbEleves / heures3e;
  if (ratio <= 1) return 'charge-ok';           // Vert
  if (ratio <= 1.5) return 'charge-warning';    // Orange
  return 'charge-overload';                      // Rouge
}

/**
 * Tuile enseignant droppable pour recevoir des élèves
 */
export const DroppableEnseignantTile: React.FC<DroppableEnseignantTileProps> = ({
  enseignant,
  affectations,
  eleves,
  capacity,
  onContextMenu,
  onTileContextMenu,
  onClick,
  isStageScenario,
  dragDistanceKm,
  isDistanceActive,
  distancesByEleve,
  hasEleveInClass,
  heures3e,
  hasMatchingRun,
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

  const handleTileContextMenu = (e: React.MouseEvent) => {
    // Ne pas déclencher si on clique droit sur un élève
    if ((e.target as HTMLElement).closest('.mini-eleve')) return;
    if (onTileContextMenu && isStageScenario) {
      onTileContextMenu(e, enseignant);
    }
  };

  const distanceClass = getDistanceColorClass(dragDistanceKm);
  const showDistanceBadge = dragDistanceKm !== undefined;

  // Filtrer les classes de 3ème
  const classes3e = enseignant.classesEnCharge
    ?.filter(c => c.startsWith('3'))
    .sort() ?? [];

  return (
    <div
      ref={setNodeRef}
      className={`enseignant-tile ${affectations.length > 0 ? 'has-eleves' : ''} ${isOver ? 'drop-highlight' : ''} ${isStageScenario && onClick ? 'clickable' : ''} ${distanceClass} ${isDistanceActive ? 'distance-active' : ''} ${hasEleveInClass ? 'has-eleve-class' : ''}`}
      onClick={handleTileClick}
      onContextMenu={handleTileContextMenu}
      style={isStageScenario && onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="tile-header">
        <div className="tile-info">
          <span className="tile-name">{enseignant.prenom} {enseignant.nom}</span>
          <span className="tile-matiere">{enseignant.matierePrincipale}</span>
          {classes3e.length > 0 && (
            <span className="tile-classes-3e">{classes3e.join(', ')}</span>
          )}
          {enseignant.estProfPrincipal && enseignant.classePP && (
            <span className="tile-pp">PP {enseignant.classePP}</span>
          )}
        </div>
        <div className="tile-count">
          {showDistanceBadge && (
            <span className={`distance-badge ${distanceClass}`}>
              {dragDistanceKm! < 1 ? '<1' : Math.round(dragDistanceKm!)} km
            </span>
          )}
          {/* Badge de charge : affiché seulement en mode stage après matching */}
          {isStageScenario && hasMatchingRun && heures3e !== undefined && heures3e > 0 && (
            <span
              className={`charge-badge ${getChargeColorClass(affectations.length, heures3e)}`}
              title={`Charge : ${affectations.length} élève${affectations.length > 1 ? 's' : ''} pour ${heures3e}h de 3e (ratio ${Math.round((affectations.length / heures3e) * 100)}%)`}
            >
              {affectations.length}/{Math.round(heures3e)}h
            </span>
          )}
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
              distanceFromEnseignantKm={distancesByEleve?.get(eleve.id!)}
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
