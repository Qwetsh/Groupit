// ============================================================
// MODULES LOURDS — chargés à la demande
// ============================================================
//
// La génération de PDF, les classeurs Excel et la carte pèsent plusieurs
// mégaoctets et ne servent qu'à des moments précis : ils sont sortis du
// fichier de démarrage et chargés quand on en a besoin.
//
// Pour que rien ne change à l'usage (export possible hors connexion une fois
// l'application ouverte, pas d'attente au premier clic), ils sont préchargés
// en arrière-plan juste après l'affichage : voir `preloadHeavyModules`.

/** Traduit un échec de chargement (réseau coupé, version publiée entre-temps). */
async function onDemand<T>(what: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (cause) {
    console.error(`[Chargement] ${what} :`, cause);
    throw new Error(
      `${what} n'a pas pu être chargé. Vérifiez la connexion, rechargez la page, puis réessayez.`
    );
  }
}

/** Export PDF de l'oral (react-pdf, QR codes, mise en ligne de la session). */
export const loadPdfExport = () =>
  onDemand("L'export PDF", () => import('./infrastructure/export/exportPdf'));

/** Export PDF du suivi de stage (react-pdf). */
export const loadStagePdfExport = () =>
  onDemand("L'export PDF", () => import('./infrastructure/export/exportStagePdf'));

/** Export Excel des affectations (xlsx). */
export const loadExcelExport = () =>
  onDemand("L'export Excel", () => import('./infrastructure/export/exportExcel'));

/** Lecture et écriture de classeurs (xlsx). */
export const loadXlsx = () => onDemand('Le lecteur de fichiers Excel', () => import('xlsx'));

/** Classeurs mis en forme (exceljs), pour le modèle de saisie des sujets. */
export const loadExcelJs = () =>
  onDemand('Le générateur de fichiers Excel', async () => (await import('exceljs')).default);

/** Tiroir de carte des trajets de stage (Leaflet). */
export const importStageMapDrawer = () => import('./components/board/StageAssignmentMapDrawer');

/**
 * Précharge les modules lourds quand le navigateur est disponible, après le
 * premier affichage. Un échec est sans conséquence : le chargement sera
 * retenté au moment où le module sera vraiment demandé.
 */
export function preloadHeavyModules(): void {
  const preload = () => {
    const loaders: Array<() => Promise<unknown>> = [
      () => import('./infrastructure/export/exportPdf'),
      () => import('./infrastructure/export/exportStagePdf'),
      () => import('./infrastructure/export/exportExcel'),
      () => import('xlsx'),
      () => import('exceljs'),
      importStageMapDrawer,
    ];
    // L'un après l'autre, pour ne pas disputer le réseau aux premières actions.
    void loaders.reduce<Promise<unknown>>(
      (previous, load) => previous.then(load).catch(() => undefined),
      Promise.resolve()
    );
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(preload, { timeout: 5000 });
  } else {
    setTimeout(preload, 2000);
  }
}
