import { describe, it, expect } from 'vitest';
import { reconcileRows, byIds } from './dbSync';

interface Row {
  id: string;
  v: number;
  scenarioId?: string;
}

const row = (id: string, v = 0, scenarioId?: string): Row => ({ id, v, scenarioId });

describe('reconcileRows', () => {
  it('remplace sur place les lignes relues, sans changer l’ordre', () => {
    const current = [row('a'), row('b'), row('c')];
    const next = reconcileRows(current, [row('b', 1)], byIds(['b']));
    expect(next).toEqual([row('a'), row('b', 1), row('c')]);
  });

  it('garde l’identité des lignes hors périmètre', () => {
    const current = [row('a'), row('b')];
    const next = reconcileRows(current, [row('b', 1)], byIds(['b']));
    expect(next[0]).toBe(current[0]);
    expect(next[1]).not.toBe(current[1]);
  });

  it('ajoute les nouvelles lignes à la fin, dans l’ordre relu', () => {
    const next = reconcileRows([row('a')], [row('c'), row('b')], byIds(['b', 'c']));
    expect(next.map(r => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('retire une ligne du périmètre absente de la base', () => {
    const next = reconcileRows([row('a'), row('b'), row('c')], [], byIds(['b']));
    expect(next.map(r => r.id)).toEqual(['a', 'c']);
  });

  it('sans périmètre, la base fait foi pour toute la vue', () => {
    const next = reconcileRows([row('a'), row('b')], [row('b', 2), row('z')]);
    expect(next).toEqual([row('b', 2), row('z')]);
  });

  it('accepte un périmètre par prédicat (toutes les lignes d’un scénario)', () => {
    const current = [row('a', 0, 's1'), row('b', 0, 's2'), row('c', 0, 's1')];
    const next = reconcileRows(current, [row('c', 5, 's1')], r => r.scenarioId === 's1');
    expect(next).toEqual([row('b', 0, 's2'), row('c', 5, 's1')]);
  });

  it('ne duplique pas une ligne relue deux fois', () => {
    const next = reconcileRows([], [row('a'), row('a', 1)], byIds(['a']));
    expect(next).toHaveLength(1);
  });
});
