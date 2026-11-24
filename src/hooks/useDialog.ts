// ============================================================
// HOOK - Comportement clavier commun aux fenêtres (dialogues)
// ============================================================
//
// À l'ouverture : le focus entre dans la fenêtre (sauf si un champ l'a déjà).
// Pendant : Tab et Maj+Tab restent dans la fenêtre ; Échap la ferme.
// À la fermeture : le focus revient là où il était.
// Plusieurs fenêtres empilées : seule celle du dessus réagit au clavier.
//
// Usage : const ref = useDialog<HTMLDivElement>(isOpen, onClose);
//         <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="…">

import { useEffect, useRef } from 'react';

const FOCUSABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Fenêtres ouvertes, la dernière est au-dessus. */
const pile: HTMLElement[] = [];

/**
 * Derniers éléments ayant reçu le focus, du plus ancien au plus récent.
 * Sert à retrouver l'élément d'origine quand un `autoFocus` (ou l'effet d'un enfant,
 * exécuté avant celui du hook) a déjà placé le focus dans la fenêtre à l'ouverture.
 */
const historiqueFocus: HTMLElement[] = [];
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', e => {
    if (!(e.target instanceof HTMLElement)) return;
    historiqueFocus.push(e.target);
    if (historiqueFocus.length > 20) historiqueFocus.shift();
  }, true);
}

function elementDOrigine(fenetre: HTMLElement): HTMLElement | null {
  const actif = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (actif && !fenetre.contains(actif)) return actif;
  for (let i = historiqueFocus.length - 1; i >= 0; i--) {
    const el = historiqueFocus[i];
    if (!fenetre.contains(el) && document.contains(el)) return el;
  }
  return null;
}

function focusables(conteneur: HTMLElement): HTMLElement[] {
  return [...conteneur.querySelectorAll<HTMLElement>(FOCUSABLES)]
    .filter(el => el.offsetParent !== null || el === document.activeElement);
}

export interface DialogOptions {
  /** Échap ferme la fenêtre (vrai par défaut). Faux pendant un enregistrement, par exemple. */
  fermerAvecEchap?: boolean;
}

export function useDialog<T extends HTMLElement>(
  ouvert: boolean,
  onClose: () => void,
  { fermerAvecEchap = true }: DialogOptions = {}
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const echapRef = useRef(fermerAvecEchap);

  useEffect(() => {
    onCloseRef.current = onClose;
    echapRef.current = fermerAvecEchap;
  });

  useEffect(() => {
    if (!ouvert) return;
    const fenetre = ref.current;
    if (!fenetre) return;

    const precedent = elementDOrigine(fenetre);
    pile.push(fenetre);

    if (!fenetre.hasAttribute('tabindex')) fenetre.setAttribute('tabindex', '-1');
    if (!fenetre.contains(document.activeElement)) {
      (focusables(fenetre)[0] ?? fenetre).focus({ preventScroll: true });
    }

    const auClavier = (e: KeyboardEvent) => {
      if (pile[pile.length - 1] !== fenetre) return;

      if (e.key === 'Escape') {
        if (!echapRef.current) return;
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const elements = focusables(fenetre);
        if (elements.length === 0) {
          e.preventDefault();
          fenetre.focus();
          return;
        }
        const premier = elements[0];
        const dernier = elements[elements.length - 1];
        const actif = document.activeElement;
        if (e.shiftKey && (actif === premier || !fenetre.contains(actif))) {
          e.preventDefault();
          dernier.focus();
        } else if (!e.shiftKey && (actif === dernier || !fenetre.contains(actif))) {
          e.preventDefault();
          premier.focus();
        }
      }
    };

    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('keydown', auClavier);
      const i = pile.lastIndexOf(fenetre);
      if (i >= 0) pile.splice(i, 1);
      if (precedent && document.contains(precedent)) precedent.focus({ preventScroll: true });
    };
  }, [ouvert]);

  return ref;
}
