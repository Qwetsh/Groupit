// ============================================================
// TESTS - IMPORT ÉLÈVES : langues vivantes et options
// ============================================================
//
// Données fictives, même forme qu'un export Pronote :
// « Élèves » (NOM Prénom), « Option 1 » = LV1, « Option 2 » = LV2,
// « Option 3 » et « Autres options » = options.

import { describe, it, expect } from 'vitest';
import { generateAutoMapping, importElevesFromCSV, normaliserLangue, type ParsedCSVData } from './csvParser';

const headers = ['Élèves', 'Né(e) le', 'Sexe', 'Option 1', 'Option 2', 'Option 3', 'Autres options', 'Régime'];
const rows: Record<string, string>[] = [
  { 'Élèves': 'FICTIF Alice', 'Né(e) le': '01/02/2012', 'Sexe': 'Féminin', 'Option 1': 'ANGLAIS LV1', 'Option 2': 'ALLEMAND LV2', 'Option 3': 'LCA LATIN', 'Autres options': 'LLC ALLEMAND', 'Régime': 'EXTERNE LIBRE' },
  { 'Élèves': 'TEST Bruno', 'Né(e) le': '03/04/2012', 'Sexe': 'Masculin', 'Option 1': 'ANGLAIS LV1', 'Option 2': 'ESPAGNOL LV2', 'Option 3': '', 'Autres options': '', 'Régime': 'EXTERNE LIBRE' },
  { 'Élèves': 'EXEMPLE Chloé', 'Né(e) le': '05/06/2012', 'Sexe': 'Féminin', 'Option 1': 'ANGLAIS LV1', 'Option 2': 'ESPAGNOL LV2', 'Option 3': 'Section Sportive: ATHLETISME', 'Autres options': '', 'Régime': 'DEMI-PENSIONNAIRE' },
];
const data: ParsedCSVData = { headers, rows, separator: ';', encoding: 'utf-8' };

describe('Import élèves — langues vivantes', () => {
  it('reconnaît les colonnes LV1, LV2 et options d\'après leur contenu', () => {
    const mapping = Object.fromEntries(generateAutoMapping(headers, rows).map(m => [m.csvHeader, m.targetField]));
    expect(mapping['Option 1']).toBe('lv1');
    expect(mapping['Option 2']).toBe('lv2');
    expect(mapping['Option 3']).toBe('options');
    expect(mapping['Autres options']).toBe('options');
  });

  it('range la langue dans LV1/LV2 et garde toutes les options', () => {
    const r = importElevesFromCSV(data, generateAutoMapping(headers, rows), '3A');
    const alice = r.eleves.find(e => e.prenom === 'Alice')!;
    expect(alice.lv1).toBe('Anglais');
    expect(alice.lv2).toBe('Allemand');
    expect(alice.options).toEqual(['ANGLAIS LV1', 'ALLEMAND LV2', 'LCA LATIN', 'LLC ALLEMAND']);
    expect(r.eleves.find(e => e.prenom === 'Bruno')!.lv2).toBe('Espagnol');
  });

  it('ignore vraiment une colonne réglée sur « Ignorer »', () => {
    const mappings = generateAutoMapping(headers, rows).map(m =>
      m.csvHeader === 'Option 3' ? { ...m, targetField: null, isIgnored: true } : m);
    const alice = importElevesFromCSV(data, mappings, '3A').eleves.find(e => e.prenom === 'Alice')!;
    expect(alice.options).not.toContain('LCA LATIN');
  });

  it('sans colonne d\'options choisie (anciens réglages), reprend toutes les colonnes « Option »', () => {
    const mappings = generateAutoMapping(headers, rows).map(m =>
      ['lv1', 'lv2', 'options'].includes(String(m.targetField)) ? { ...m, targetField: null } : m);
    const alice = importElevesFromCSV(data, mappings, '3A').eleves.find(e => e.prenom === 'Alice')!;
    expect(alice.options).toEqual(['ANGLAIS LV1', 'ALLEMAND LV2', 'LCA LATIN']);
    expect(alice.lv1).toBeUndefined();
  });

  it.each([
    ['ANGLAIS LV1', 'Anglais'],
    ['ALLEMAND LV2', 'Allemand'],
    ['LV2 Espagnol', 'Espagnol'],
    ['ITALIEN LVB', 'Italien'],
    ['PORTUGAIS LV2', 'Portugais'],
  ])('« %s » → %s', (valeur, attendu) => {
    expect(normaliserLangue(valeur)).toBe(attendu);
  });
});
