// ============================================================
// WORKER - Calcul des répartitions hors du fil de l'interface
// ============================================================
//
// Les solveurs tournent ici pour que l'interface reste fluide pendant le
// calcul. Voir `solverRunner.ts` pour l'appel côté interface.

import { solveOralDnbComplete } from './solverDnb';
import { solveCustom } from './solverCustom';
import type { SolverRequest, SolverResponse } from './solverRunner';

self.onmessage = (event: MessageEvent<SolverRequest>) => {
  const { id, kind } = event.data;
  try {
    const result = kind === 'oral_dnb'
      ? solveOralDnbComplete(...event.data.args)
      : solveCustom(...event.data.args);
    self.postMessage({ id, ok: true, result } satisfies SolverResponse);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) } satisfies SolverResponse);
  }
};
