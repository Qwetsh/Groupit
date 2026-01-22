// ============================================================
// KEYBOARD SHORTCUTS HOOK
// ============================================================

import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../stores/uiStore';

// ============================================================
// TYPES
// ============================================================

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category: 'navigation' | 'actions' | 'global';
  action: () => void;
}

// ============================================================
// SHORTCUT DEFINITIONS
// ============================================================

export const SHORTCUT_CATEGORIES = {
  navigation: 'Navigation',
  actions: 'Actions',
  global: 'Global',
} as const;

// ============================================================
// HOOK
// ============================================================

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  // useLocation available for future route-aware shortcuts
  void useLocation();
  const openModal = useUIStore(state => state.openModal);
  const toggleShortcutsHelp = useUIStore(state => state.toggleShortcutsHelp);

  // Define all shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts (Alt + number)
    {
      key: '1',
      alt: true,
      description: 'Tableau de bord',
      category: 'navigation',
      action: () => navigate('/'),
    },
    {
      key: '2',
      alt: true,
      description: 'Affectations',
      category: 'navigation',
      action: () => navigate('/board'),
    },
    {
      key: '3',
      alt: true,
      description: 'Élèves',
      category: 'navigation',
      action: () => navigate('/eleves'),
    },
    {
      key: '4',
      alt: true,
      description: 'Enseignants',
      category: 'navigation',
      action: () => navigate('/enseignants'),
    },
    {
      key: '5',
      alt: true,
      description: 'Scénarios',
      category: 'navigation',
      action: () => navigate('/scenarios'),
    },
    {
      key: '6',
      alt: true,
      description: 'Données',
      category: 'navigation',
      action: () => navigate('/donnees'),
    },

    // Action shortcuts (Ctrl + key)
    {
      key: 'i',
      ctrl: true,
      description: 'Importer des données',
      category: 'actions',
      action: () => openModal('import'),
    },
    {
      key: 'n',
      ctrl: true,
      description: 'Nouveau scénario',
      category: 'actions',
      action: () => openModal('editScenario'),
    },
    {
      key: 'm',
      ctrl: true,
      description: 'Aller au matching',
      category: 'actions',
      action: () => navigate('/board'),
    },

    // Global shortcuts
    {
      key: '?',
      shift: true,
      description: 'Afficher les raccourcis',
      category: 'global',
      action: () => toggleShortcutsHelp(),
    },
    {
      key: 'Escape',
      description: 'Fermer les panneaux',
      category: 'global',
      action: () => {
        // Close shortcuts help if open
        const state = useUIStore.getState();
        if (state.showShortcutsHelp) {
          state.toggleShortcutsHelp();
        }
      },
    },
  ];

  // Check if a shortcut matches the event
  const matchesShortcut = useCallback((e: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       e.key === shortcut.key;
    const ctrlMatches = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
    const shiftMatches = !!shortcut.shift === e.shiftKey;
    const altMatches = !!shortcut.alt === e.altKey;

    return keyMatches && ctrlMatches && shiftMatches && altMatches;
  }, []);

  // Handle keydown events
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Allow Escape in inputs
      if (e.key !== 'Escape') {
        return;
      }
    }

    // Find matching shortcut
    for (const shortcut of shortcuts) {
      if (matchesShortcut(e, shortcut)) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, matchesShortcut]);

  // Register event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}

// ============================================================
// HELPER - Format shortcut key for display
// ============================================================

export function formatShortcutKey(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Maj');

  // Format the key nicely
  let keyDisplay = shortcut.key;
  if (keyDisplay === 'Escape') keyDisplay = 'Échap';
  if (keyDisplay === '?') keyDisplay = '?';
  if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();

  parts.push(keyDisplay);

  return parts.join(' + ');
}
