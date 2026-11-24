// ============================================================
// FLOT À COÛT MINIMUM
// ============================================================
//
// Envoie le plus de flot possible d'une source à un puits, au coût total le
// plus bas. C'est l'outil exact pour les affectations « chacun va à un seul
// endroit, chaque endroit a une capacité » : contrairement à un placement
// élève par élève, il sait déplacer un élève déjà placé pour libérer la place
// dont un autre a absolument besoin.
//
// Méthode : plus courts chemins successifs (Dijkstra avec potentiels).
// Les coûts initiaux doivent être positifs ou nuls. Le résultat ne dépend que
// de l'ordre d'ajout des arcs : à entrée identique, sortie identique.

interface Arc {
  to: number;
  rev: number; // indice de l'arc inverse dans adj[to]
  cap: number;
  cost: number;
}

export class MinCostFlow {
  readonly nodeCount: number;
  private readonly adj: Arc[][];

  constructor(nodeCount: number) {
    this.nodeCount = nodeCount;
    this.adj = Array.from({ length: nodeCount }, () => []);
  }

  /** Ajoute un arc et renvoie un identifiant pour lire son flot ensuite. */
  addEdge(from: number, to: number, cap: number, cost: number): { from: number; index: number } {
    if (cost < 0) throw new Error('MinCostFlow : les coûts doivent être positifs ou nuls.');
    const a = this.adj[from];
    const b = this.adj[to];
    a.push({ to, rev: b.length, cap, cost });
    b.push({ to: from, rev: a.length - 1, cap: 0, cost: -cost });
    return { from, index: a.length - 1 };
  }

  /** Flot passé par un arc renvoyé par `addEdge`. */
  flowOf(edge: { from: number; index: number }): number {
    const arc = this.adj[edge.from][edge.index];
    return this.adj[arc.to][arc.rev].cap;
  }

  /** Envoie jusqu'à `maxFlow` unités ; renvoie le flot envoyé et son coût. */
  run(source: number, sink: number, maxFlow = Infinity): { flow: number; cost: number } {
    const n = this.nodeCount;
    const potential = new Array<number>(n).fill(0);
    const dist = new Array<number>(n);
    const prevNode = new Array<number>(n);
    const prevArc = new Array<number>(n);
    let flow = 0;
    let cost = 0;

    while (flow < maxFlow) {
      dist.fill(Infinity);
      dist[source] = 0;
      const heap = new MinHeap();
      heap.push(0, source);

      while (heap.size > 0) {
        const [d, u] = heap.pop();
        if (d > dist[u]) continue;
        const arcs = this.adj[u];
        for (let i = 0; i < arcs.length; i++) {
          const e = arcs[i];
          if (e.cap <= 0) continue;
          const nd = d + e.cost + potential[u] - potential[e.to];
          if (nd < dist[e.to] - 1e-9) {
            dist[e.to] = nd;
            prevNode[e.to] = u;
            prevArc[e.to] = i;
            heap.push(nd, e.to);
          }
        }
      }

      if (dist[sink] === Infinity) break;
      for (let v = 0; v < n; v++) {
        if (dist[v] < Infinity) potential[v] += dist[v];
      }

      let push = maxFlow - flow;
      for (let v = sink; v !== source; v = prevNode[v]) {
        push = Math.min(push, this.adj[prevNode[v]][prevArc[v]].cap);
      }
      for (let v = sink; v !== source; v = prevNode[v]) {
        const e = this.adj[prevNode[v]][prevArc[v]];
        e.cap -= push;
        this.adj[v][e.rev].cap += push;
        cost += push * e.cost;
      }
      flow += push;
    }

    return { flow, cost };
  }
}

/** Tas binaire (distance, nœud) ; à distance égale, le plus petit nœud sort d'abord. */
class MinHeap {
  private readonly keys: number[] = [];
  private readonly nodes: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, node: number): void {
    this.keys.push(key);
    this.nodes.push(node);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): [number, number] {
    const top: [number, number] = [this.keys[0], this.nodes[0]];
    const lastKey = this.keys.pop()!;
    const lastNode = this.nodes.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.nodes[0] = lastNode;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.keys.length && this.less(l, smallest)) smallest = l;
        if (r < this.keys.length && this.less(r, smallest)) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private less(a: number, b: number): boolean {
    return this.keys[a] < this.keys[b] || (this.keys[a] === this.keys[b] && this.nodes[a] < this.nodes[b]);
  }

  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
  }
}
