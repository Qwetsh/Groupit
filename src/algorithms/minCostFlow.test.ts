import { describe, it, expect } from 'vitest';
import { MinCostFlow } from './minCostFlow';

/** Affectation de n personnes à m postes de capacité donnée, coût[i][j]. */
function assign(costs: number[][], caps: number[]) {
  const n = costs.length;
  const m = caps.length;
  const source = n + m;
  const sink = source + 1;
  const g = new MinCostFlow(n + m + 2);
  const edges: { i: number; j: number; e: { from: number; index: number } }[] = [];
  for (let i = 0; i < n; i++) g.addEdge(source, i, 1, 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) edges.push({ i, j, e: g.addEdge(i, n + j, 1, costs[i][j]) });
  }
  for (let j = 0; j < m; j++) g.addEdge(n + j, sink, caps[j], 0);
  const { flow, cost } = g.run(source, sink);
  const result = new Array<number>(n).fill(-1);
  for (const { i, j, e } of edges) if (g.flowOf(e) > 0) result[i] = j;
  return { flow, cost, result };
}

describe('Flot à coût minimum', () => {
  it('trouve l\'affectation optimale là où un choix glouton se trompe', () => {
    // La personne 0 coûte 0 au poste 0 et 1 au poste 1 ; la personne 1 ne peut
    // aller qu'au poste 0 (coût 0) ou au poste 1 (coût 100).
    const { cost, result } = assign([[0, 1], [0, 100]], [1, 1]);
    expect(result).toEqual([1, 0]);
    expect(cost).toBe(1);
  });

  it('respecte les capacités', () => {
    const { flow, result } = assign([[0, 5], [0, 5], [0, 5]], [2, 5]);
    expect(flow).toBe(3);
    expect(result.filter(j => j === 0)).toHaveLength(2);
  });

  it('s\'arrête quand le puits n\'est plus atteignable', () => {
    const { flow } = assign([[0], [0], [0]], [2]);
    expect(flow).toBe(2);
  });

  it('égale une recherche exhaustive sur des cas aléatoires', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 50; t++) {
      const n = 4;
      const costs = Array.from({ length: n }, () => Array.from({ length: 3 }, () => Math.floor(rand() * 20)));
      const caps = [2, 1, 2];
      let best = Infinity;
      const rec = (i: number, used: number[], acc: number) => {
        if (i === n) { best = Math.min(best, acc); return; }
        for (let j = 0; j < 3; j++) {
          if (used[j] < caps[j]) { used[j]++; rec(i + 1, used, acc + costs[i][j]); used[j]--; }
        }
      };
      rec(0, [0, 0, 0], 0);
      expect(assign(costs, caps).cost).toBe(best);
    }
  });

  it('refuse un coût négatif', () => {
    expect(() => new MinCostFlow(2).addEdge(0, 1, 1, -1)).toThrow();
  });
});
