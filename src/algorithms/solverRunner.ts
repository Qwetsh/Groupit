// ============================================================
// LANCEMENT DES SOLVEURS
// ============================================================
//
// Lance un solveur dans un worker (l'interface ne fige pas pendant le calcul).
// Sans worker disponible (tests, navigateur ancien) ou si le worker échoue au
// démarrage, le calcul se fait directement : le résultat est le même.

import type { SolverResultDNB } from '../domain/models';
import { solveOralDnbComplete } from './solverDnb';
import { solveCustom, type CustomSolverResult } from './solverCustom';

export type SolverRequest =
  | { id: number; kind: 'oral_dnb'; args: Parameters<typeof solveOralDnbComplete> }
  | { id: number; kind: 'custom'; args: Parameters<typeof solveCustom> };

export type SolverResponse =
  | { id: number; ok: true; result: SolverResultDNB | CustomSolverResult }
  | { id: number; ok: false; error: string };

type Kind = SolverRequest['kind'];
type ArgsOf<K extends Kind> = Extract<SolverRequest, { kind: K }>['args'];
type ResultOf<K extends Kind> = K extends 'oral_dnb' ? SolverResultDNB : CustomSolverResult;

let nextId = 1;

function runDirectly<K extends Kind>(kind: K, args: ArgsOf<K>): ResultOf<K> {
  return (kind === 'oral_dnb'
    ? solveOralDnbComplete(...(args as ArgsOf<'oral_dnb'>))
    : solveCustom(...(args as ArgsOf<'custom'>))) as ResultOf<K>;
}

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
}

function run<K extends Kind>(kind: K, args: ArgsOf<K>): Promise<ResultOf<K>> {
  const worker = createWorker();
  if (!worker) return Promise.resolve().then(() => runDirectly(kind, args));

  const id = nextId++;
  return new Promise<ResultOf<K>>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      settled = true;
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<SolverResponse>) => {
      if (event.data.id !== id || settled) return;
      finish();
      if (event.data.ok) resolve(event.data.result as ResultOf<K>);
      else reject(new Error(event.data.error));
    };

    // Le worker n'a pas pu démarrer ou a planté hors du solveur : calcul direct.
    worker.onerror = (event) => {
      if (settled) return;
      event.preventDefault();
      finish();
      console.warn('[solverRunner] Worker indisponible, calcul direct :', event.message);
      try {
        resolve(runDirectly(kind, args));
      } catch (error) {
        reject(error);
      }
    };

    worker.postMessage({ id, kind, args } as SolverRequest);
  });
}

/** Répartition de l'oral du DNB, sans figer l'interface. */
export function runOralDnbSolver(...args: Parameters<typeof solveOralDnbComplete>): Promise<SolverResultDNB> {
  return run('oral_dnb', args);
}

/** Répartition du mode personnalisé, sans figer l'interface. */
export function runCustomSolver(...args: Parameters<typeof solveCustom>): Promise<CustomSolverResult> {
  return run('custom', args);
}
