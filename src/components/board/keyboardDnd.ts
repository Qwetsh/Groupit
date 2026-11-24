// ============================================================
// GLISSER-DÉPOSER AU CLAVIER
// ============================================================
//
// Sur le tableau, un élève se déplace aussi sans souris :
//   Tab jusqu'à l'élève, Espace ou Entrée pour le saisir,
//   flèches pour passer d'une zone de dépôt à la voisine,
//   Espace ou Entrée pour déposer, Échap pour annuler.
// Un lecteur d'écran annonce chaque étape en français.

import {
  closestCenter,
  pointerWithin,
  KeyboardCode,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core';

const DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  [KeyboardCode.Right]: { dx: 1, dy: 0 },
  [KeyboardCode.Left]: { dx: -1, dy: 0 },
  [KeyboardCode.Down]: { dx: 0, dy: 1 },
  [KeyboardCode.Up]: { dx: 0, dy: -1 },
};

/**
 * Les flèches sautent d'une zone de dépôt à la plus proche dans la direction
 * demandée (au lieu de déplacer l'élément de quelques pixels).
 */
export const coordonneesClavier: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const direction = DIRECTIONS[event.code];
  if (!direction) return undefined;
  event.preventDefault();

  const { collisionRect, droppableRects, droppableContainers, active, over } = context;
  if (!collisionRect) return currentCoordinates;

  // On part du centre de la zone survolée (sinon de l'élément lui-même) :
  // les flèches passent ainsi d'une zone à l'autre, jamais à l'intérieur d'une zone.
  const centreElementX = collisionRect.left + collisionRect.width / 2;
  const centreElementY = collisionRect.top + collisionRect.height / 2;
  const zoneActuelle = over ? droppableRects.get(over.id) : undefined;
  const centreX = zoneActuelle ? zoneActuelle.left + zoneActuelle.width / 2 : centreElementX;
  const centreY = zoneActuelle ? zoneActuelle.top + zoneActuelle.height / 2 : centreElementY;

  let meilleur: { x: number; y: number } | null = null;
  let meilleureDistance = Infinity;

  for (const conteneur of droppableContainers.getEnabled()) {
    if (conteneur.id === active?.id || conteneur.id === over?.id) continue;
    const rect = droppableRects.get(conteneur.id);
    if (!rect) continue;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - centreX;
    const dy = y - centreY;
    // Seulement les zones situées dans la direction demandée
    const avance = dx * direction.dx + dy * direction.dy;
    if (avance <= 1) continue;
    // Distance pénalisée par l'écart latéral, pour rester « dans l'axe »
    const ecart = Math.abs(direction.dx ? dy : dx);
    const distance = avance + 2 * ecart;
    if (distance < meilleureDistance) {
      meilleureDistance = distance;
      meilleur = { x, y };
    }
  }

  if (!meilleur) return currentCoordinates;
  // Place le centre de l'élément déplacé sur le centre de la zone choisie.
  return {
    x: currentCoordinates.x + (meilleur.x - centreElementX),
    y: currentCoordinates.y + (meilleur.y - centreElementY),
  };
};

/**
 * À la souris, la zone sous le pointeur ; au clavier (pas de pointeur), la
 * zone dont le centre est le plus proche de l'élément déplacé.
 */
export const detectionCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

export const instructionsLecteurEcran: ScreenReaderInstructions = {
  draggable:
    'Pour le déplacer, appuyez sur Espace ou Entrée. '
    + 'Utilisez les flèches pour choisir une destination, '
    + 'puis Espace ou Entrée pour déposer, ou Échap pour annuler.',
};

/** Annonces en français ; `nomDe` donne le libellé d'un élément ou d'une zone. */
export function annoncesFrancaises(nomDe: (id: UniqueIdentifier) => string): Announcements {
  return {
    onDragStart: ({ active }) => `${nomDe(active.id)} saisi.`,
    onDragOver: ({ active, over }) =>
      over ? `${nomDe(active.id)} au-dessus de : ${nomDe(over.id)}.` : `${nomDe(active.id)} hors d'une zone de dépôt.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nomDe(active.id)} déposé dans : ${nomDe(over.id)}.` : `${nomDe(active.id)} reposé à sa place.`,
    onDragCancel: ({ active }) => `Déplacement de ${nomDe(active.id)} annulé.`,
  };
}
