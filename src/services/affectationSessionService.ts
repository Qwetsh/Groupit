// ============================================================
// SERVICE - EXPORT/IMPORT SESSION D'AFFECTATION
// Permet de sauvegarder et restaurer l'état d'une session de matching
// ============================================================

import type { Affectation, Eleve, Enseignant, Stage, Scenario, ScenarioParametres } from '../domain/models';

// ============================================================
// TYPES
// ============================================================

export interface SessionExportData {
  version: string;
  exportedAt: string;
  scenario: {
    id: string;
    nom: string;
    type: string;
    parametres: Record<string, unknown>;
  };
  affectations: AffectationExportItem[];
  nonAffectes: NonAffecteExportItem[];
  /** Coordonnées géolocalisées des enseignants (pour éviter de regéocoder) */
  enseignantsGeo: EnseignantGeoExportItem[];
}

export interface AffectationExportItem {
  // Identification élève (pour matching)
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  eleveClasse: string;
  // Identification enseignant
  enseignantId: string;
  enseignantNom: string;
  enseignantPrenom: string;
  enseignantMatiere: string;
  // Données du stage
  stage: StageExportData | null;
  // Métadonnées affectation
  scoreTotal?: number;
  scoreDetail?: Record<string, number>;
}

export interface NonAffecteExportItem {
  eleveId: string;
  eleveNom: string;
  elevePrenom: string;
  eleveClasse: string;
  stage: StageExportData | null;
}

export interface StageExportData {
  nomEntreprise?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  lat?: number;
  lon?: number;
  geoStatus?: string;
  geoPrecision?: string;
  tuteur?: string;
  tuteurTel?: string;
  tuteurEmail?: string;
  secteurActivite?: string;
  dateDebut?: string;
  dateFin?: string;
}

export interface EnseignantGeoExportItem {
  enseignantId: string;
  enseignantNom: string;
  enseignantPrenom: string;
  adresse?: string;
  commune?: string;
  lat?: number;
  lon?: number;
  geoStatus?: string;
}

// Rapport d'import
export interface ImportReport {
  success: boolean;
  scenarioMatched: boolean;
  scenarioName: string;
  scenarioActivated: boolean;
  parametresRestored: boolean;
  affectationsImported: number;
  affectationsSkipped: number;
  stagesUpdated: number;
  enseignantsGeoUpdated: number;
  elevesMatched: number;
  elevesNotFound: Array<{ nom: string; prenom: string; classe: string }>;
  enseignantsMatched: number;
  enseignantsNotFound: Array<{ nom: string; prenom: string }>;
  warnings: string[];
  errors: string[];
}

// ============================================================
// EXPORT FUNCTION
// ============================================================

export function exportAffectationSession(
  scenario: Scenario,
  affectations: Affectation[],
  eleves: Eleve[],
  enseignants: Enseignant[],
  stages: Stage[]
): SessionExportData {
  const elevesById = new Map(eleves.map(e => [e.id, e]));
  const enseignantsById = new Map(enseignants.map(e => [e.id, e]));
  const stagesByEleveId = new Map(stages.map(s => [s.eleveId, s]));

  // Filtrer les affectations du scénario
  const scenarioAffectations = affectations.filter(a => a.scenarioId === scenario.id);
  const affectedEleveIds = new Set(scenarioAffectations.map(a => a.eleveId));

  // Élèves du scénario (filtrés selon les paramètres)
  const scenarioEleves = getScenarioEleves(eleves, scenario);

  // Exporter les affectations
  const exportedAffectations: AffectationExportItem[] = scenarioAffectations.map(aff => {
    const eleve = elevesById.get(aff.eleveId);
    const enseignant = enseignantsById.get(aff.enseignantId);
    const stage = stagesByEleveId.get(aff.eleveId);

    return {
      eleveId: aff.eleveId,
      eleveNom: eleve?.nom || '',
      elevePrenom: eleve?.prenom || '',
      eleveClasse: eleve?.classe || '',
      enseignantId: aff.enseignantId,
      enseignantNom: enseignant?.nom || '',
      enseignantPrenom: enseignant?.prenom || '',
      enseignantMatiere: enseignant?.matierePrincipale || '',
      stage: stage ? exportStage(stage) : null,
      scoreTotal: aff.scoreTotal,
      scoreDetail: aff.scoreDetail,
    };
  });

  // Exporter les élèves non affectés
  const nonAffectes: NonAffecteExportItem[] = scenarioEleves
    .filter(e => !affectedEleveIds.has(e.id!))
    .map(eleve => {
      const stage = stagesByEleveId.get(eleve.id!);
      return {
        eleveId: eleve.id!,
        eleveNom: eleve.nom,
        elevePrenom: eleve.prenom,
        eleveClasse: eleve.classe,
        stage: stage ? exportStage(stage) : null,
      };
    });

  // Exporter les coordonnées des enseignants utilisés dans les affectations
  const usedEnseignantIds = new Set(scenarioAffectations.map(a => a.enseignantId));
  const enseignantsGeo: EnseignantGeoExportItem[] = enseignants
    .filter(e => usedEnseignantIds.has(e.id!))
    .map(ens => ({
      enseignantId: ens.id!,
      enseignantNom: ens.nom,
      enseignantPrenom: ens.prenom,
      adresse: ens.adresse,
      commune: ens.commune,
      lat: ens.lat,
      lon: ens.lon,
      geoStatus: ens.geoStatus,
    }));

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    scenario: {
      id: scenario.id!,
      nom: scenario.nom,
      type: scenario.type,
      parametres: scenario.parametres as unknown as Record<string, unknown>,
    },
    affectations: exportedAffectations,
    nonAffectes,
    enseignantsGeo,
  };
}

function exportStage(stage: Stage): StageExportData {
  return {
    nomEntreprise: stage.nomEntreprise,
    adresse: stage.adresse,
    codePostal: stage.codePostal,
    ville: stage.ville,
    lat: stage.lat,
    lon: stage.lon,
    geoStatus: stage.geoStatus,
    geoPrecision: stage.geoPrecision,
    tuteur: stage.tuteur,
    tuteurTel: stage.tuteurTel,
    tuteurEmail: stage.tuteurEmail,
    secteurActivite: stage.secteurActivite,
    dateDebut: stage.dateDebut,
    dateFin: stage.dateFin,
  };
}

function getScenarioEleves(eleves: Eleve[], scenario: Scenario): Eleve[] {
  const filtres = scenario.parametres.filtresEleves;
  if (!filtres) return eleves;

  return eleves.filter(e => {
    // Filtre par niveau
    if (filtres.niveaux && filtres.niveaux.length > 0) {
      const niveau = e.classe?.match(/^(\d)/)?.[1] + 'e';
      if (!filtres.niveaux.includes(niveau as never)) return false;
    }
    // Filtre par classe
    if (filtres.classes && filtres.classes.length > 0) {
      if (!filtres.classes.includes(e.classe)) return false;
    }
    return true;
  });
}

// ============================================================
// DOWNLOAD HELPER
// ============================================================

export function downloadSessionAsJson(data: SessionExportData, filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `affectation-${data.scenario.nom}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// IMPORT FUNCTION
// ============================================================

export interface ImportContext {
  eleves: Eleve[];
  enseignants: Enseignant[];
  stages: Stage[];
  scenarios: Scenario[];
  // Callbacks pour créer/mettre à jour les données
  upsertStage: (eleveId: string, stageData: Partial<Stage>) => Promise<Stage>;
  addAffectation: (affectation: Omit<Affectation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Affectation>;
  deleteAffectationsByScenario: (scenarioId: string) => Promise<void>;
  // Callbacks pour restaurer le scénario
  updateScenarioParametres: (id: string, parametres: Partial<ScenarioParametres>) => Promise<void>;
  setActiveScenarioId: (id: string) => void;
  // Callback pour restaurer les coordonnées des enseignants
  updateEnseignantGeo: (id: string, geo: { lat?: number; lon?: number; geoStatus?: Enseignant['geoStatus'] }) => Promise<void>;
}

export async function importAffectationSession(
  data: SessionExportData,
  context: ImportContext
): Promise<ImportReport> {
  const report: ImportReport = {
    success: false,
    scenarioMatched: false,
    scenarioName: data.scenario.nom,
    scenarioActivated: false,
    parametresRestored: false,
    affectationsImported: 0,
    affectationsSkipped: 0,
    stagesUpdated: 0,
    enseignantsGeoUpdated: 0,
    elevesMatched: 0,
    elevesNotFound: [],
    enseignantsMatched: 0,
    enseignantsNotFound: [],
    warnings: [],
    errors: [],
  };

  try {
    // Vérifier la version
    if (data.version !== '1.0') {
      report.errors.push(`Version non supportée: ${data.version}`);
      return report;
    }

    // Trouver le scénario correspondant
    const scenario = context.scenarios.find(s =>
      s.id === data.scenario.id ||
      (s.nom === data.scenario.nom && s.type === data.scenario.type)
    );

    if (!scenario) {
      report.errors.push(`Scénario "${data.scenario.nom}" non trouvé. Créez d'abord un scénario de type "${data.scenario.type}".`);
      return report;
    }

    report.scenarioMatched = true;

    // Restaurer les paramètres du scénario (filtres, critères, etc.)
    if (data.scenario.parametres) {
      try {
        await context.updateScenarioParametres(scenario.id!, data.scenario.parametres as Partial<ScenarioParametres>);
        report.parametresRestored = true;
      } catch (err) {
        report.warnings.push(`Erreur lors de la restauration des paramètres du scénario: ${err}`);
      }
    }

    // Activer le scénario
    try {
      context.setActiveScenarioId(scenario.id!);
      report.scenarioActivated = true;
    } catch (err) {
      report.warnings.push(`Erreur lors de l'activation du scénario: ${err}`);
    }

    // Restaurer les coordonnées des enseignants
    if (data.enseignantsGeo && data.enseignantsGeo.length > 0) {
      for (const ensGeo of data.enseignantsGeo) {
        // Trouver l'enseignant par ID ou nom/prénom
        let enseignant = context.enseignants.find(e => e.id === ensGeo.enseignantId);
        if (!enseignant) {
          const key = normalizeKey(`${ensGeo.enseignantNom}|${ensGeo.enseignantPrenom}`);
          enseignant = context.enseignants.find(e =>
            normalizeKey(`${e.nom}|${e.prenom}`) === key
          );
        }

        if (enseignant && ensGeo.lat && ensGeo.lon && ensGeo.geoStatus === 'ok') {
          try {
            await context.updateEnseignantGeo(enseignant.id!, {
              lat: ensGeo.lat,
              lon: ensGeo.lon,
              geoStatus: ensGeo.geoStatus as Enseignant['geoStatus'],
            });
            report.enseignantsGeoUpdated++;
          } catch (err) {
            report.warnings.push(`Erreur mise à jour géo enseignant ${ensGeo.enseignantPrenom} ${ensGeo.enseignantNom}: ${err}`);
          }
        }
      }
    }

    // Créer les maps pour le matching
    const elevesById = new Map(context.eleves.map(e => [e.id, e]));
    const enseignantsById = new Map(context.enseignants.map(e => [e.id, e]));

    // Index pour matching par nom
    const elevesByNomPrenomClasse = new Map<string, Eleve>();
    for (const e of context.eleves) {
      const key = normalizeKey(`${e.nom}|${e.prenom}|${e.classe}`);
      elevesByNomPrenomClasse.set(key, e);
    }

    const enseignantsByNomPrenom = new Map<string, Enseignant>();
    for (const e of context.enseignants) {
      const key = normalizeKey(`${e.nom}|${e.prenom}`);
      enseignantsByNomPrenom.set(key, e);
    }

    // Supprimer les affectations existantes du scénario
    await context.deleteAffectationsByScenario(scenario.id!);

    // Traiter les affectations
    for (const affItem of data.affectations) {
      // Matcher l'élève
      let eleve = elevesById.get(affItem.eleveId);
      if (!eleve) {
        const key = normalizeKey(`${affItem.eleveNom}|${affItem.elevePrenom}|${affItem.eleveClasse}`);
        eleve = elevesByNomPrenomClasse.get(key);
      }

      if (!eleve) {
        report.elevesNotFound.push({
          nom: affItem.eleveNom,
          prenom: affItem.elevePrenom,
          classe: affItem.eleveClasse,
        });
        report.affectationsSkipped++;
        continue;
      }

      // Matcher l'enseignant
      let enseignant = enseignantsById.get(affItem.enseignantId);
      if (!enseignant) {
        const key = normalizeKey(`${affItem.enseignantNom}|${affItem.enseignantPrenom}`);
        enseignant = enseignantsByNomPrenom.get(key);
      }

      if (!enseignant) {
        report.enseignantsNotFound.push({
          nom: affItem.enseignantNom,
          prenom: affItem.enseignantPrenom,
        });
        report.affectationsSkipped++;
        continue;
      }

      report.elevesMatched++;
      if (!report.enseignantsNotFound.some(e => e.nom === affItem.enseignantNom && e.prenom === affItem.enseignantPrenom)) {
        report.enseignantsMatched++;
      }

      // Mettre à jour le stage si présent
      if (affItem.stage) {
        try {
          await context.upsertStage(eleve.id!, {
            eleveId: eleve.id,
            eleveNom: eleve.nom,
            elevePrenom: eleve.prenom,
            eleveClasse: eleve.classe,
            ...affItem.stage,
            geoStatus: affItem.stage.geoStatus as Stage['geoStatus'],
            geoPrecision: affItem.stage.geoPrecision as Stage['geoPrecision'],
          });
          report.stagesUpdated++;
        } catch (err) {
          report.warnings.push(`Erreur mise à jour stage pour ${eleve.prenom} ${eleve.nom}: ${err}`);
        }
      }

      // Créer l'affectation
      try {
        await context.addAffectation({
          eleveId: eleve.id!,
          enseignantId: enseignant.id!,
          scenarioId: scenario.id!,
          type: 'suivi_stage',
          metadata: {},
          scoreTotal: affItem.scoreTotal,
          scoreDetail: affItem.scoreDetail,
        });
        report.affectationsImported++;
      } catch (err) {
        report.errors.push(`Erreur création affectation pour ${eleve.prenom} ${eleve.nom}: ${err}`);
        report.affectationsSkipped++;
      }
    }

    // Traiter les élèves non affectés (mettre à jour leurs stages)
    for (const nonAff of data.nonAffectes) {
      let eleve = elevesById.get(nonAff.eleveId);
      if (!eleve) {
        const key = normalizeKey(`${nonAff.eleveNom}|${nonAff.elevePrenom}|${nonAff.eleveClasse}`);
        eleve = elevesByNomPrenomClasse.get(key);
      }

      if (!eleve) {
        // Pas grave si on ne trouve pas un élève non affecté
        continue;
      }

      if (nonAff.stage) {
        try {
          await context.upsertStage(eleve.id!, {
            eleveId: eleve.id,
            eleveNom: eleve.nom,
            elevePrenom: eleve.prenom,
            eleveClasse: eleve.classe,
            ...nonAff.stage,
            geoStatus: nonAff.stage.geoStatus as Stage['geoStatus'],
            geoPrecision: nonAff.stage.geoPrecision as Stage['geoPrecision'],
          });
          report.stagesUpdated++;
        } catch (err) {
          report.warnings.push(`Erreur mise à jour stage pour ${eleve.prenom} ${eleve.nom}: ${err}`);
        }
      }
    }

    report.success = report.errors.length === 0;

  } catch (err) {
    report.errors.push(`Erreur générale: ${err}`);
  }

  return report;
}

// ============================================================
// HELPERS
// ============================================================

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// FILE PARSING
// ============================================================

export async function parseSessionFile(file: File): Promise<SessionExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as SessionExportData;

        // Validation basique
        if (!data.version || !data.scenario || !data.affectations) {
          throw new Error('Format de fichier invalide');
        }

        resolve(data);
      } catch (err) {
        reject(new Error(`Erreur de parsing: ${err}`));
      }
    };

    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
}
