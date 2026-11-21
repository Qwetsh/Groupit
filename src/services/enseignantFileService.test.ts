import { describe, it, expect } from 'vitest';
import type { Enseignant } from '../domain/models';
import {
  parseEnseignantsFile,
  serializeEnseignants,
  splitNewEnseignants,
} from './enseignantFileService';

const enseignant = (overrides: Partial<Enseignant> = {}): Enseignant => ({
  id: 'id-1',
  nom: 'Durand',
  prenom: 'Alice',
  matierePrincipale: 'SVT',
  classesEnCharge: ['3A'],
  estProfPrincipal: true,
  classePP: '3A',
  adresse: '1 rue des Tests',
  commune: 'Testville',
  lat: 48.1,
  lon: 6.2,
  geoStatus: 'ok',
  indisponibilites: ['lundi_matin'],
  tags: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  ...overrides,
});

describe('Fichier d\'enseignants', () => {
  it('exporte puis réimporte sans perte, sans identifiant ni date', () => {
    const text = serializeEnseignants([enseignant()], new Date('2026-11-21T10:00:00Z'));
    const [record] = parseEnseignantsFile(text);

    expect(record).toEqual({
      nom: 'Durand',
      prenom: 'Alice',
      matierePrincipale: 'SVT',
      classesEnCharge: ['3A'],
      estProfPrincipal: true,
      classePP: '3A',
      adresse: '1 rue des Tests',
      commune: 'Testville',
      lat: 48.1,
      lon: 6.2,
      geoStatus: 'ok',
      indisponibilites: ['lundi_matin'],
      tags: [],
    });
    expect(text).not.toContain('id-1');
    expect(text).not.toContain('createdAt');
  });

  it('accepte un simple tableau d\'enseignants', () => {
    const records = parseEnseignantsFile(JSON.stringify([{ nom: 'Martin', prenom: 'Bob' }]));
    expect(records).toEqual([
      { nom: 'Martin', prenom: 'Bob', matierePrincipale: '', classesEnCharge: [], estProfPrincipal: false, tags: [] },
    ]);
  });

  it('ignore les champs inconnus ou mal typés', () => {
    const [record] = parseEnseignantsFile(
      JSON.stringify([{ nom: 'Martin', prenom: 'Bob', lat: 'nord', geoStatus: 'bizarre', id: 'x', pirate: true }])
    );
    expect(record).not.toHaveProperty('lat');
    expect(record).not.toHaveProperty('geoStatus');
    expect(record).not.toHaveProperty('id');
    expect(record).not.toHaveProperty('pirate');
  });

  it('refuse un fichier inexploitable avec un message clair', () => {
    expect(() => parseEnseignantsFile('pas du json')).toThrow(/JSON valide/);
    expect(() => parseEnseignantsFile('{"eleves": []}')).toThrow(/liste d'enseignants/);
    expect(() => parseEnseignantsFile('[]')).toThrow(/aucun enseignant/);
    expect(() => parseEnseignantsFile('[{"nom": "Martin"}]')).toThrow(/Ligne 1/);
  });

  it('n\'ajoute pas les enseignants déjà présents ni les doublons du fichier', () => {
    const incoming = parseEnseignantsFile(
      JSON.stringify([
        { nom: 'DURAND', prenom: 'alice' },
        { nom: 'Béranger', prenom: 'Zoé' },
        { nom: 'Beranger', prenom: 'Zoe' },
      ])
    );
    const { toAdd, skipped } = splitNewEnseignants(incoming, [{ nom: 'Durand', prenom: 'Alice' }]);

    expect(toAdd.map(e => e.nom)).toEqual(['Béranger']);
    expect(skipped).toBe(2);
  });
});
