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

export default Tooltip;
