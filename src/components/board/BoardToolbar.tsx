import React from 'react';
import { Wand2, RefreshCw, RotateCcw, Save, Loader2, Download, Upload } from 'lucide-react';
import { HelpTooltip, HELP_TEXTS } from '../ui/Tooltip';
import type { BoardToolbarProps } from './types';

/**
 * Barre d'outils du Board avec boutons d'action
 */
export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  activeScenario,
  isJuryMode,
  isStageScenario,
  isRunning,
  isValidating,
  scenarioInfo,
  affectationsCount,
  runButtonDisabled,
  runButtonTitle,
  onRunMatching,
  onResetAffectations,
  onValidateClick,
  onExportSession,
  onImportSession,
}) => {
  return (
    <div className="board-toolbar">
      <div className="toolbar-left">
        <h1>Affectations</h1>
        {activeScenario && <span className="scenario-badge">{activeScenario.nom}</span>}
        {isJuryMode && <span className="mode-badge jury">Mode Jury DNB</span>}
        {isStageScenario && <span className="mode-badge stage">Mode Suivi Stage</span>}
        <span className="scenario-info">{scenarioInfo}</span>
      </div>
      <div className="toolbar-right">
        {/* Import/Export buttons - only for stage scenarios */}
        {isStageScenario && (
          <div className="toolbar-session-buttons">
            <button
              className="btn-icon"
              title="Importer une session"
              onClick={onImportSession}
              disabled={!activeScenario || isRunning}
            >
              <Upload size={18} />
            </button>
            <button
              className="btn-icon"
              title="Exporter la session"
              onClick={onExportSession}
              disabled={!activeScenario || isRunning}
            >
              <Download size={18} />
            </button>
          </div>
        )}
        <button
          className="btn-icon"
          title="Réinitialiser les affectations"
          onClick={onResetAffectations}
          disabled={!activeScenario || isRunning}
        >
          <RotateCcw size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-action"
            onClick={onRunMatching}
            disabled={runButtonDisabled}
            title={runButtonTitle}
          >
            {isRunning ? (
              <>
                <RefreshCw size={18} className="spinning" />
                En cours...
              </>
            ) : (
              <>
                <Wand2 size={18} />
                Lancer le matching
              </>
            )}
          </button>
          <HelpTooltip content={HELP_TEXTS.board.autoMatch} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-action validate"
            onClick={onValidateClick}
            disabled={!activeScenario || isRunning || isValidating || affectationsCount === 0}
            title={affectationsCount === 0 ? 'Lancez d\'abord le matching' : 'Valider et archiver les affectations'}
          >
            {isValidating ? (
              <>
                <Loader2 size={18} className="spinning" />
                Validation...
              </>
            ) : (
              <>
                <Save size={18} />
                Valider
              </>
            )}
          </button>
          <HelpTooltip content={HELP_TEXTS.board.validate} />
        </div>
      </div>
    </div>
  );
};
