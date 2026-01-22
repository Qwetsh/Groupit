// ============================================================
// PROGRESS INDICATOR - Indicateurs de progression visuels
// ============================================================

import React, { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import './ProgressIndicator.css';

// ============================================================
// TYPES
// ============================================================

export type ProgressStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ProgressStep {
  id: string;
  label: string;
  status: ProgressStatus;
}

export interface ProgressIndicatorProps {
  /** Current progress value (0-100) */
  value?: number;
  /** Whether progress is indeterminate */
  indeterminate?: boolean;
  /** Current status */
  status?: ProgressStatus;
  /** Label to display */
  label?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Visual variant */
  variant?: 'bar' | 'circular' | 'inline';
  /** Show percentage text */
  showPercentage?: boolean;
  /** Show elapsed time */
  showElapsedTime?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Custom class name */
  className?: string;
}

export interface MultiStepProgressProps {
  steps: ProgressStep[];
  currentStepIndex: number;
  className?: string;
}

// ============================================================
// HELPER HOOKS
// ============================================================

function useElapsedTime(isRunning: boolean): string {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isRunning && !startTime) {
      setStartTime(Date.now());
    } else if (!isRunning) {
      setStartTime(null);
      setElapsed(0);
    }
  }, [isRunning, startTime]);

  useEffect(() => {
    if (!isRunning || !startTime) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  if (elapsed === 0) return '';
  if (elapsed < 60) return `${elapsed}s`;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}m ${seconds}s`;
}

// ============================================================
// PROGRESS BAR COMPONENT
// ============================================================

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  value = 0,
  indeterminate = false,
  status = 'loading',
  label,
  subtitle,
  size = 'md',
  variant = 'bar',
  showPercentage = true,
  showElapsedTime = false,
  animationDuration = 300,
  className = '',
}) => {
  const elapsedTime = useElapsedTime(status === 'loading');
  const displayValue = Math.min(100, Math.max(0, value));

  // Circular variant
  if (variant === 'circular') {
    const circleSize = size === 'sm' ? 40 : size === 'lg' ? 80 : 60;
    const strokeWidth = size === 'sm' ? 3 : size === 'lg' ? 6 : 4;
    const radius = (circleSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (displayValue / 100) * circumference;

    return (
      <div className={`progress-indicator circular ${size} ${status} ${className}`}>
        <div className="circular-container">
          <svg width={circleSize} height={circleSize}>
            {/* Background circle */}
            <circle
              className="progress-bg"
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            {!indeterminate && (
              <circle
                className="progress-fill"
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: `stroke-dashoffset ${animationDuration}ms ease` }}
              />
            )}
            {/* Indeterminate animation */}
            {indeterminate && (
              <circle
                className="progress-fill indeterminate"
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * 0.75}
              />
            )}
          </svg>
          {/* Center content */}
          <div className="circular-center">
            {status === 'success' && <Check size={size === 'sm' ? 16 : size === 'lg' ? 32 : 24} />}
            {status === 'error' && <AlertCircle size={size === 'sm' ? 16 : size === 'lg' ? 32 : 24} />}
            {status === 'loading' && !indeterminate && showPercentage && (
              <span className="percentage">{Math.round(displayValue)}%</span>
            )}
            {status === 'loading' && indeterminate && (
              <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 28 : 20} className="spinning" />
            )}
          </div>
        </div>
        {(label || subtitle) && (
          <div className="progress-text">
            {label && <span className="progress-label">{label}</span>}
            {subtitle && <span className="progress-subtitle">{subtitle}</span>}
            {showElapsedTime && elapsedTime && (
              <span className="elapsed-time">{elapsedTime}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Inline variant (compact)
  if (variant === 'inline') {
    return (
      <div className={`progress-indicator inline ${size} ${status} ${className}`}>
        {status === 'loading' && (
          <>
            <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="spinning" />
            {label && <span className="progress-label">{label}</span>}
            {!indeterminate && showPercentage && (
              <span className="percentage">{Math.round(displayValue)}%</span>
            )}
          </>
        )}
        {status === 'success' && (
          <>
            <Check size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            {label && <span className="progress-label">{label}</span>}
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            {label && <span className="progress-label">{label}</span>}
          </>
        )}
      </div>
    );
  }

  // Bar variant (default)
  return (
    <div className={`progress-indicator bar ${size} ${status} ${className}`}>
      {(label || showPercentage || showElapsedTime) && (
        <div className="progress-header">
          <span className="progress-label">{label}</span>
          <div className="progress-meta">
            {showElapsedTime && elapsedTime && (
              <span className="elapsed-time">{elapsedTime}</span>
            )}
            {!indeterminate && showPercentage && status === 'loading' && (
              <span className="percentage">{Math.round(displayValue)}%</span>
            )}
            {status === 'success' && <Check size={14} className="status-icon success" />}
            {status === 'error' && <AlertCircle size={14} className="status-icon error" />}
          </div>
        </div>
      )}
      <div className="progress-track">
        {indeterminate ? (
          <div className="progress-bar indeterminate" />
        ) : (
          <div
            className="progress-bar"
            style={{
              width: `${displayValue}%`,
              transition: `width ${animationDuration}ms ease`,
            }}
          />
        )}
      </div>
      {subtitle && <span className="progress-subtitle">{subtitle}</span>}
    </div>
  );
};

// ============================================================
// MULTI-STEP PROGRESS COMPONENT
// ============================================================

export const MultiStepProgress: React.FC<MultiStepProgressProps> = ({
  steps,
  currentStepIndex,
  className = '',
}) => {
  return (
    <div className={`multi-step-progress ${className}`}>
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isCompleted = index < currentStepIndex || step.status === 'success';
        const isError = step.status === 'error';

        return (
          <div
            key={step.id}
            className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isError ? 'error' : ''}`}
          >
            <div className="step-indicator">
              {isCompleted && !isError && <Check size={14} />}
              {isError && <AlertCircle size={14} />}
              {!isCompleted && !isError && (
                isActive ? (
                  <Loader2 size={14} className="spinning" />
                ) : (
                  <span className="step-number">{index + 1}</span>
                )
              )}
            </div>
            <span className="step-label">{step.label}</span>
            {index < steps.length - 1 && <div className="step-connector" />}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// OVERLAY PROGRESS COMPONENT
// ============================================================

export interface OverlayProgressProps {
  visible: boolean;
  label?: string;
  subtitle?: string;
  value?: number;
  indeterminate?: boolean;
  showElapsedTime?: boolean;
}

export const OverlayProgress: React.FC<OverlayProgressProps> = ({
  visible,
  label = 'Chargement en cours...',
  subtitle,
  value = 0,
  indeterminate = true,
  showElapsedTime = true,
}) => {
  if (!visible) return null;

  return (
    <div className="overlay-progress">
      <div className="overlay-content">
        <ProgressIndicator
          value={value}
          indeterminate={indeterminate}
          status="loading"
          label={label}
          subtitle={subtitle}
          size="lg"
          variant="circular"
          showElapsedTime={showElapsedTime}
        />
      </div>
    </div>
  );
};

export default ProgressIndicator;
