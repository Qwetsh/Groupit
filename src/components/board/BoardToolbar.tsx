import React from 'react';
import { Download, Upload } from 'lucide-react';
import type { BoardToolbarProps } from './types';

/**
 * Barre d'outils du Board avec boutons d'action
 */
export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  activeScenario,
  isJuryMode,
  isStageScenario,
  isRunning,
  scenarioInfo,
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
      </div>
    </div>
  );
};
