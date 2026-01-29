// ============================================================
// TOOLTIP COMPONENT - Infobulles contextuelles (Portal)
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

interface CalculatedPosition {
  top: number;
  left: number;
  actualPosition: TooltipPosition;
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
  const [calculatedPos, setCalculatedPos] = useState<CalculatedPosition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Calculer la position du tooltip
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const padding = 12;
    const tooltipHeight = 80; // Estimation
    const tooltipWidth = Math.min(maxWidth, 280);

    let top: number;
    let left: number;
    let actualPosition = position;

    // Calculer position initiale
    switch (position) {
      case 'top':
        top = trigger.top - tooltipHeight - padding;
        left = trigger.left + trigger.width / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = trigger.bottom + padding;
        left = trigger.left + trigger.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = trigger.top + trigger.height / 2 - tooltipHeight / 2;
        left = trigger.left - tooltipWidth - padding;
        break;
      case 'right':
        top = trigger.top + trigger.height / 2 - tooltipHeight / 2;
        left = trigger.right + padding;
        break;
    }

    // Ajuster si dépasse en haut
    if (top < padding) {
      if (position === 'top') {
        actualPosition = 'bottom';
        top = trigger.bottom + padding;
      } else {
        top = padding;
      }
    }

    // Ajuster si dépasse en bas
    if (top + tooltipHeight > window.innerHeight - padding) {
      if (position === 'bottom') {
        actualPosition = 'top';
        top = trigger.top - tooltipHeight - padding;
      } else {
        top = window.innerHeight - tooltipHeight - padding;
      }
    }

    // Ajuster si dépasse à gauche
    if (left < padding) {
      left = padding;
    }

    // Ajuster si dépasse à droite
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

    setCalculatedPos({ top, left, actualPosition });
  }, [position, maxWidth]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setCalculatedPos(null);
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
      {isVisible && calculatedPos && createPortal(
        <div
          className={`tooltip tooltip-portal tooltip-${calculatedPos.actualPosition}`}
          style={{
            top: calculatedPos.top,
            left: calculatedPos.left,
            maxWidth,
          }}
          role="tooltip"
        >
          <div className="tooltip-content">{content}</div>
        </div>,
        document.body
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
