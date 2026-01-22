// ============================================================
// TOOLTIP COMPONENT - Infobulles contextuelles
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HelpCircle } from 'lucide-react';
import './Tooltip.css';

// ============================================================
// TYPES
// ============================================================

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  maxWidth?: number;
  className?: string;
}

interface HelpTooltipProps {
  content: React.ReactNode;
  position?: TooltipPosition;
  size?: number;
  maxWidth?: number;
}

// ============================================================
// TOOLTIP COMPONENT
// ============================================================

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  maxWidth = 280,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Ajuster la position si le tooltip dépasse de l'écran
  const adjustPosition = useCallback(() => {
    if (!tooltipRef.current || !triggerRef.current) return;

    const tooltip = tooltipRef.current.getBoundingClientRect();
    const trigger = triggerRef.current.getBoundingClientRect();
    const padding = 10;

    let newPosition = position;

    // Vérifier les dépassements
    if (position === 'top' && trigger.top - tooltip.height - padding < 0) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && trigger.bottom + tooltip.height + padding > window.innerHeight) {
      newPosition = 'top';
    } else if (position === 'left' && trigger.left - tooltip.width - padding < 0) {
      newPosition = 'right';
    } else if (position === 'right' && trigger.right + tooltip.width + padding > window.innerWidth) {
      newPosition = 'left';
    }

    setActualPosition(newPosition);
  }, [position]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Ajuster après que le tooltip soit visible
      setTimeout(adjustPosition, 0);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`tooltip-wrapper ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={triggerRef}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${actualPosition}`}
          style={{ maxWidth }}
          role="tooltip"
        >
          <div className="tooltip-content">{content}</div>
          <div className="tooltip-arrow" />
        </div>
      )}
    </div>
  );
};

// ============================================================
// HELP TOOLTIP - Icône ? avec tooltip
// ============================================================

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  position = 'top',
  size = 16,
  maxWidth = 280,
}) => {
  return (
    <Tooltip content={content} position={position} maxWidth={maxWidth}>
      <span className="help-tooltip-icon">
        <HelpCircle size={size} />
      </span>
    </Tooltip>
  );
};

// ============================================================
// HELP TEXTS - Textes d'aide centralisés
// ============================================================

export const HELP_TEXTS = {
  // Dashboard
  dashboard: {
    checklist: "Cette liste vous guide étape par étape pour préparer vos affectations. Complétez chaque étape pour débloquer le matching.",
    alerts: "Les alertes signalent les problèmes potentiels qui pourraient affecter la qualité des affectations.",
    stagesMap: "Visualisez la répartition géographique des stages par rapport au collège. Les couleurs indiquent la distance.",
    history: "Retrouvez ici l'historique de vos affectations validées. Vous pouvez les consulter ou les exporter à tout moment.",
    launchMatching: "Lance l'algorithme d'affectation automatique selon les critères du scénario actif.",
  },

  // Board (Matching)
  board: {
    dragDrop: "Glissez-déposez les élèves vers les enseignants pour créer ou modifier une affectation manuellement.",
    autoMatch: "L'algorithme calcule la meilleure affectation possible en respectant les critères configurés.",
    score: "Le score reflète la qualité de l'affectation (100 = parfait). Il combine plusieurs critères pondérés.",
    validate: "Valider fige les affectations et les archive dans l'historique. Cette action est irréversible.",
    capacity: "Nombre d'élèves que cet enseignant peut encadrer. Basé sur sa capacité configurée.",
  },

  // Scénarios
  scenarios: {
    type: "Le type détermine les critères disponibles : Oral DNB (jurys, matières) ou Suivi Stage (distance, trajets).",
    criteria: "Les critères définissent comment l'algorithme évalue chaque affectation. Plus le poids est élevé, plus le critère est important.",
    hardConstraint: "Une contrainte dure doit être respectée à 100%. Si impossible, l'élève ne sera pas affecté.",
    capacity: "Capacité par défaut appliquée aux enseignants sans capacité personnalisée.",
    equilibrage: "L'équilibrage répartit les élèves équitablement entre les enseignants disponibles.",
  },

  // Import
  import: {
    csvFormat: "Format attendu : CSV avec séparateur point-virgule (;) ou virgule (,). Encodage UTF-8 recommandé.",
    mapping: "Associez chaque colonne de votre fichier au champ correspondant. Les colonnes non mappées seront ignorées.",
    duplicates: "Les doublons (même nom + prénom + classe) sont automatiquement détectés et ignorés.",
  },

  // Stages
  stages: {
    geocoding: "Le géocodage convertit les adresses en coordonnées GPS pour calculer les distances.",
    fallback: "Si l'adresse exacte n'est pas trouvée, le système utilise le centre-ville ou la mairie comme approximation.",
    distance: "Distance à vol d'oiseau multipliée par 1.3 pour estimer la distance routière réelle.",
  },

  // Jurys (Oral DNB)
  jurys: {
    composition: "Un jury est composé de 2 enseignants minimum. Les matières enseignées déterminent les élèves compatibles.",
    matiereMatch: "L'algorithme privilégie les jurys dont un enseignant enseigne la matière choisie par l'élève.",
  },
};

export default Tooltip;
