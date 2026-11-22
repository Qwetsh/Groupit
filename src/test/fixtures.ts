// ============================================================
// DONNÉES DE TEST — entièrement fictives
// ============================================================
//
// Ne jamais mettre ici de vraies données d'élèves ou d'enseignants.

import { db } from '../infrastructure/database/db';
import type { Eleve, Enseignant } from '../domain/models';

type NewEleve = Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>;
type NewEnseignant = Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>;

const PRENOMS = ['Alba', 'Bruno', 'Chloé', 'Dorian', 'Elsa', 'Farid', 'Gaëlle', 'Hugo'];
const MATIERES = ['Mathématiques', 'Français', 'SVT', 'Histoire-Géographie'];

export function fakeEleve(index: number, overrides: Partial<NewEleve> = {}): NewEleve {
  return {
    nom: `TEST${index}`,
    prenom: PRENOMS[index % PRENOMS.length],
    classe: index % 2 === 0 ? '3A' : '3B',
    options: [],
    tags: [],
    contraintes: [],
    ...overrides,
  };
}

export function fakeEnseignant(index: number, overrides: Partial<NewEnseignant> = {}): NewEnseignant {
  return {
    nom: `PROF${index}`,
    prenom: 'Fictif',
    matierePrincipale: MATIERES[index % MATIERES.length],
    classesEnCharge: ['3A'],
    estProfPrincipal: false,
    tags: [],
    ...overrides,
  };
}

/** Vide toutes les tables : à appeler avant chaque test. */
export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}

/** Un `Storage` minimal en mémoire, pour simuler localStorage. */
export class MemoryStorage {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  keys(): string[] {
    return [...this.items.keys()];
  }
}
