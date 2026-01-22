// ============================================================
// KEYBOARD SHORTCUTS HELP PANEL
// ============================================================

import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import {
  useKeyboardShortcuts,
  formatShortcutKey,
  SHORTCUT_CATEGORIES,
  type KeyboardShortcut
} from '../../hooks/useKeyboardShortcuts';
import './KeyboardShortcutsHelp.css';

// ============================================================
// COMPONENT
// ============================================================

export const KeyboardShortcutsHelp: React.FC = () => {
  const showShortcutsHelp = useUIStore(state => state.showShortcutsHelp);
  const setShowShortcutsHelp = useUIStore(state => state.setShowShortcutsHelp);
  const { shortcuts } = useKeyboardShortcuts();

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showShortcutsHelp) {
        setShowShortcutsHelp(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showShortcutsHelp, setShowShortcutsHelp]);

  if (!showShortcutsHelp) return null;

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div className="shortcuts-overlay" onClick={() => setShowShortcutsHelp(false)}>
      <div className="shortcuts-panel" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="shortcuts-title">
            <Keyboard size={20} />
            <h2>Raccourcis clavier</h2>
          </div>
          <button
            className="shortcuts-close"
            onClick={() => setShowShortcutsHelp(false)}
            title="Fermer (Échap)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="shortcuts-content">
          {Object.entries(SHORTCUT_CATEGORIES).map(([categoryKey, categoryLabel]) => {
            const categoryShortcuts = groupedShortcuts[categoryKey];
            if (!categoryShortcuts || categoryShortcuts.length === 0) return null;

            return (
              <div key={categoryKey} className="shortcuts-category">
                <h3>{categoryLabel}</h3>
                <div className="shortcuts-list">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div key={index} className="shortcut-item">
                      <span className="shortcut-description">{shortcut.description}</span>
                      <kbd className="shortcut-key">{formatShortcutKey(shortcut)}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shortcuts-footer">
          <span>Appuyez sur <kbd>Maj + ?</kbd> pour afficher/masquer ce panneau</span>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
