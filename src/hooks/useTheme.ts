// ============================================================
// THÈME CLAIR / SOMBRE
// ============================================================
//
// Le thème est posé par l'attribut data-theme de <html>. Un script de
// index.html l'applique avant le premier affichage (pas de flash) ; ce module
// le modifie ensuite et mémorise le choix dans le navigateur.
// Sans choix enregistré, l'application suit le réglage de l'ordinateur.

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

/** Clé partagée avec le script de index.html. */
export const THEME_STORAGE_KEY = 'locanda-theme';

const listeners = new Set<() => void>();

function readStoredPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

let preference: ThemePreference = readStoredPreference();

function apply() {
  const theme = preference === 'system' ? systemTheme() : preference;
  document.documentElement.setAttribute('data-theme', theme);
  listeners.forEach(listener => listener());
}

if (typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (preference === 'system') apply();
  });
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour cette visite
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getTheme = (): Theme =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light' as Theme);
  const currentPreference = useSyncExternalStore(subscribe, () => preference, () => 'system' as ThemePreference);
  return {
    theme,
    preference: currentPreference,
    setPreference: setThemePreference,
    toggle: () => setThemePreference(theme === 'dark' ? 'light' : 'dark'),
  };
}
