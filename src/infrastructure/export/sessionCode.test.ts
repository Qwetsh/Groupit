import { describe, it, expect } from 'vitest';
import {
  SESSION_CODE_ALPHABET,
  formatCodeForDisplay,
  generateSessionCode,
  sanitizeSessionCode,
} from './sessionCode';

describe('Code de session', () => {
  it('génère 8 caractères acceptés par le serveur, sans caractère ambigu', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSessionCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(code).not.toMatch(/[01ILO]/);
      expect([...code].every(c => SESSION_CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('ne génère pas deux fois le même code', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateSessionCode()));
    expect(codes.size).toBe(500);
  });

  it('nettoie une saisie manuelle', () => {
    expect(sanitizeSessionCode(' oral-2026 bis ')).toBe('ORAL2026');
    expect(sanitizeSessionCode('é!?')).toBe('');
  });

  it('affiche un code de 8 caractères en deux groupes', () => {
    expect(formatCodeForDisplay('K7M2QX9D')).toBe('K7M2-QX9D');
    expect(formatCodeForDisplay('ABC12')).toBe('ABC12');
  });
});
