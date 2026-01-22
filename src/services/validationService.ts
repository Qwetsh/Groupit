// ============================================================
// VALIDATION SERVICE
// Crée un snapshot immuable des affectations pour l'historisation
// ============================================================

import type {
  Scenario,
  Affectation,
  Eleve,
  Enseignant,
  Jury,
  ScenarioArchive,
  ArchiveParticipant,
  ArchiveAffectation,
  ArchiveEleve,
  Stage,
} from '../domain/models';
import { extractNiveau } from '../domain/models';

// ============================================================
// TYPES
// ============================================================

export interface ValidationInput {
  scenario: Scenario;
  affectations: Affectation[];
  eleves: Eleve[];
  enseignants: Enseignant[];
  jurys?: Jury[];
  stages?: Stage[];
}

export interface ValidationResult {
  archive: Omit<ScenarioArchive, 'id' | 'createdAt'>;
  summary: {
    nbEnseignants: number;
    nbEleves: number;
    nbAffectations: number;
    classes: string[];
    scoreGlobal: number;
    tauxAffectation: number;
  };
}

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Crée un snapshot immuable des affectations actuelles
 * pour les archiver et les rendre consultables ultérieurement.
 */
export function buildArchiveFromCurrentState(input: ValidationInput): ValidationResult {
  const { scenario, affectations, eleves, enseignants, jurys, stages } = input;

  // Filtrer les affectations du scénario actif
  const scenarioAffectations = affectations.filter(a => a.scenarioId === scenario.id);

  if (scenarioAffectations.length === 0) {
    throw new Error('Aucune affectation à valider pour ce scénario');
  }

  // Construire selon le type de scénario
  if (scenario.type === 'oral_dnb' && jurys && jurys.length > 0) {
    return buildOralDnbArchive(scenario, scenarioAffectations, eleves, enseignants, jurys);
  } else if (scenario.type === 'suivi_stage' && stages) {
    return buildStageArchive(scenario, scenarioAffectations, eleves, enseignants, stages);
  } else {
    return buildStandardArchive(scenario, scenarioAffectations, eleves, enseignants);
  }
}

// ============================================================
// ORAL DNB - Mode Jury
// ============================================================

function buildOralDnbArchive(
  scenario: Scenario,
  affectations: Affectation[],
  eleves: Eleve[],
  enseignants: Enseignant[],
  jurys: Jury[]
): ValidationResult {
  const scenarioJurys = jurys.filter(j => j.scenarioId === scenario.id);

  // Map eleves par ID pour lookup rapide
  const eleveMap = new Map(eleves.map(e => [e.id, e]));
  const enseignantMap = new Map(enseignants.map(e => [e.id, e]));

  // Construire les participants (tous les enseignants des jurys)
  const participants: ArchiveParticipant[] = [];
  const participantIds = new Set<string>();

  scenarioJurys.forEach(jury => {
    jury.enseignantIds.forEach(ensId => {
      if (!participantIds.has(ensId)) {
        const ens = enseignantMap.get(ensId);
        if (ens) {
          participants.push({
            enseignantId: ensId,
            enseignantNom: ens.nom,
            enseignantPrenom: ens.prenom || '',
            role: 'membre_jury',
            roleLabel: jury.nom,
          });
          participantIds.add(ensId);
        }
      }
    });
  });

  // Construire les affectations groupées par jury
  const archiveAffectations: ArchiveAffectation[] = [];
  const affectationsByJury = new Map<string, Affectation[]>();

  affectations.forEach(aff => {
    if (aff.juryId) {
      const existing = affectationsByJury.get(aff.juryId) || [];
      existing.push(aff);
      affectationsByJury.set(aff.juryId, existing);
    }
  });

  // Pour chaque jury, créer une entrée d'affectation par enseignant
  scenarioJurys.forEach(jury => {
    const juryAffectations = affectationsByJury.get(jury.id!) || [];

    // Construire la liste des élèves affectés à ce jury
    const archiveEleves: ArchiveEleve[] = juryAffectations.map(aff => {
      const eleve = eleveMap.get(aff.eleveId);
      return {
        eleveId: aff.eleveId,
        eleveNom: eleve?.nom || 'Inconnu',
        elevePrenom: eleve?.prenom || '',
        eleveClasse: eleve?.classe || '',
        matiereOral: eleve?.matieresOral?.[0] || undefined,
      };
    });

    // Créer une affectation d'archive pour chaque enseignant du jury
    jury.enseignantIds.forEach(ensId => {
      archiveAffectations.push({
        enseignantId: ensId,
        eleves: archiveEleves,
        juryId: jury.id,
        juryNom: jury.nom,
        scoreTotal: Math.round(
          juryAffectations.reduce((sum, a) => sum + (a.scoreTotal || 0), 0) /
          Math.max(juryAffectations.length, 1)
        ),
      });
    });
  });

  // Calculer les stats
  const uniqueEleves = new Set(affectations.map(a => a.eleveId));
  const classes = [...new Set(
    affectations
      .map(a => eleveMap.get(a.eleveId)?.classe)
      .filter(Boolean) as string[]
  )].sort();

  const filteredClasses = scenario.parametres.filtresEleves?.classes;
  const totalEleves = eleves.filter(e => {
    // Si pas de filtre de classes ou tableau vide, inclure tous les élèves
    if (!filteredClasses || filteredClasses.length === 0) return true;
    return filteredClasses.includes(e.classe || '');
  }).length;

  const scoreGlobal = Math.round(
    affectations.reduce((sum, a) => sum + (a.scoreTotal || 0), 0) /
    Math.max(affectations.length, 1)
  );

  const summary = {
    nbEnseignants: participants.length,
    nbEleves: uniqueEleves.size,
    nbAffectations: affectations.length,
    classes,
    scoreGlobal,
    tauxAffectation: Math.round((uniqueEleves.size / Math.max(totalEleves, 1)) * 100),
  };

  return {
    archive: {
      scenarioId: scenario.id!,
      scenarioNom: scenario.nom,
      scenarioType: scenario.type,
      archivedAt: new Date(),
      participants,
      affectations: archiveAffectations,
      stats: {
        nbEnseignants: summary.nbEnseignants,
        nbEleves: summary.nbEleves,
        nbAffectations: summary.nbAffectations,
        scoreGlobal: summary.scoreGlobal,
        tauxAffectation: summary.tauxAffectation,
      },
      metadata: {
        jurys: scenarioJurys.map(j => ({
          id: j.id!,
          nom: j.nom,
          enseignantIds: j.enseignantIds,
        })),
      },
    },
    summary,
  };
}

// ============================================================
// SUIVI STAGE
// ============================================================

function buildStageArchive(
  scenario: Scenario,
  affectations: Affectation[],
  eleves: Eleve[],
  enseignants: Enseignant[],
  stages: Stage[]
): ValidationResult {
  const eleveMap = new Map(eleves.map(e => [e.id, e]));
  const enseignantMap = new Map(enseignants.map(e => [e.id, e]));
  const stageMap = new Map(stages.map(s => [s.eleveId, s]));

  // Grouper les affectations par enseignant
  const affectationsByEnseignant = new Map<string, Affectation[]>();
  affectations.forEach(aff => {
    if (aff.enseignantId) {
      const existing = affectationsByEnseignant.get(aff.enseignantId) || [];
      existing.push(aff);
      affectationsByEnseignant.set(aff.enseignantId, existing);
    }
  });

  // Construire les participants
  const participants: ArchiveParticipant[] = [];
  const archiveAffectations: ArchiveAffectation[] = [];

  let totalDistance = 0;
  let totalDuration = 0;
  let distanceCount = 0;

  affectationsByEnseignant.forEach((ensAffectations, enseignantId) => {
    const ens = enseignantMap.get(enseignantId);
    if (!ens) return;

    // Ajouter le participant
    participants.push({
      enseignantId,
      enseignantNom: ens.nom,
      enseignantPrenom: ens.prenom || '',
      role: 'referent_stage',
      roleLabel: 'Référent stage',
    });

    // Construire les élèves avec leurs stages
    const archiveEleves: ArchiveEleve[] = ensAffectations.map(aff => {
      const eleve = eleveMap.get(aff.eleveId);
      const stage = stageMap.get(aff.eleveId);
      const metadata = aff.metadata as { distanceKm?: number; durationMin?: number; entreprise?: string } | undefined;

      if (metadata?.distanceKm) {
        totalDistance += metadata.distanceKm;
        distanceCount++;
      }
      if (metadata?.durationMin) {
        totalDuration += metadata.durationMin;
      }

      return {
        eleveId: aff.eleveId,
        eleveNom: eleve?.nom || 'Inconnu',
        elevePrenom: eleve?.prenom || '',
        eleveClasse: eleve?.classe || '',
        adresseStage: stage?.adresse || undefined,
        entreprise: stage?.nomEntreprise || metadata?.entreprise || undefined,
        distanceKm: metadata?.distanceKm,
        dureeMin: metadata?.durationMin,
      };
    });

    archiveAffectations.push({
      enseignantId,
      eleves: archiveEleves,
      scoreTotal: Math.round(
        ensAffectations.reduce((sum, a) => sum + (a.scoreTotal || 0), 0) /
        Math.max(ensAffectations.length, 1)
      ),
    });
  });

  // Calculer les stats
  const uniqueEleves = new Set(affectations.map(a => a.eleveId));
  const classes = [...new Set(
    affectations
      .map(a => eleveMap.get(a.eleveId)?.classe)
      .filter(Boolean) as string[]
  )].sort();

  // Pour le taux d'affectation, compter les élèves éligibles (3ème par défaut) avec stage géocodé
  const niveauxFiltres = scenario.parametres?.filtresEleves?.niveaux || ['3e'];
  const classesFiltres = scenario.parametres?.filtresEleves?.classes || [];

  const eligibleElevesWithStage = eleves.filter(e => {
    // Filtrer par niveau
    const niveau = e.classe ? extractNiveau(e.classe) : null;
    const matchNiveau = niveau !== null && niveauxFiltres.includes(niveau);
    const matchClasse = classesFiltres.length === 0 || classesFiltres.includes(e.classe || '');
    if (!matchNiveau || !matchClasse) return false;

    // Vérifier que l'élève a un stage géocodé (stages globaux)
    const stage = stageMap.get(e.id);
    return stage && (stage.geoStatus === 'ok' || stage.geoStatus === 'manual') && stage.lat && stage.lon;
  });

  const totalEleves = eligibleElevesWithStage.length;

  const scoreGlobal = Math.round(
    affectations.reduce((sum, a) => sum + (a.scoreTotal || 0), 0) /
    Math.max(affectations.length, 1)
  );

  const summary = {
    nbEnseignants: participants.length,
    nbEleves: uniqueEleves.size,
    nbAffectations: affectations.length,
    classes,
    scoreGlobal,
    tauxAffectation: Math.round((uniqueEleves.size / Math.max(totalEleves, 1)) * 100),
  };

  return {
    archive: {
      scenarioId: scenario.id!,
      scenarioNom: scenario.nom,
      scenarioType: scenario.type,
      archivedAt: new Date(),
      participants,
      affectations: archiveAffectations,
      stats: {
        nbEnseignants: summary.nbEnseignants,
        nbEleves: summary.nbEleves,
        nbAffectations: summary.nbAffectations,
        scoreGlobal: summary.scoreGlobal,
        tauxAffectation: summary.tauxAffectation,
      },
      metadata: {
        distanceMoyenneKm: distanceCount > 0 ? Math.round((totalDistance / distanceCount) * 10) / 10 : undefined,
        dureeMoyenneMin: distanceCount > 0 ? Math.round(totalDuration / distanceCount) : undefined,
      },
    },
    summary,
  };
}

// ============================================================
// STANDARD MODE
// ============================================================

function buildStandardArchive(
  scenario: Scenario,
  affectations: Affectation[],
  eleves: Eleve[],
  enseignants: Enseignant[]
): ValidationResult {
  const eleveMap = new Map(eleves.map(e => [e.id, e]));
  const enseignantMap = new Map(enseignants.map(e => [e.id, e]));

  // Grouper les affectations par enseignant
  const affectationsByEnseignant = new Map<string, Affectation[]>();
  affectations.forEach(aff => {
    if (aff.enseignantId) {
      const existing = affectationsByEnseignant.get(aff.enseignantId) || [];
      existing.push(aff);
      affectationsByEnseignant.set(aff.enseignantId, existing);
    }
  });

  // Construire les participants et affectations
  const participants: ArchiveParticipant[] = [];
  const archiveAffectations: ArchiveAffectation[] = [];

  affectationsByEnseignant.forEach((ensAffectations, enseignantId) => {
    const ens = enseignantMap.get(enseignantId);
    if (!ens) return;

    participants.push({
      enseignantId,
      enseignantNom: ens.nom,
      enseignantPrenom: ens.prenom || '',
      role: 'autre',
      roleLabel: 'Référent',
    });

    const archiveEleves: ArchiveEleve[] = ensAffectations.map(aff => {
      const eleve = eleveMap.get(aff.eleveId);
      return {
        eleveId: aff.eleveId,
        eleveNom: eleve?.nom || 'Inconnu',
        elevePrenom: eleve?.prenom || '',
        eleveClasse: eleve?.classe || '',
      };
    });

    archiveAffectations.push({
      enseignantId,
      eleves: archiveEleves,
      scoreTotal: Math.round(
        ensAffectations.reduce((sum, a) => sum + (a.scoreTotal || 0), 0) /
        Math.max(ensAffectations.length, 1)
      ),
    });
  });

  // Stats
  const uniqueEleves = new Set(affectations.map(a => a.eleveId));
  const classes = [...new Set(
    affectations
      .map(a => eleveMap.get(a.eleveId)?.classe)
      .filter(Boolean) as string[]
  )].sort();

  const filteredClasses = scenario.parametres.filtresEleves?.classes;
  const totalEleves = eleves.filter(e => {
    // Si pas de filtre de classes ou tableau vide, inclure tous les élèves
    if (!filteredClasses || filteredClasses.length === 0) return true;
    return filteredClasses.includes(e.classe || '');
  }).length;

  const scoreGlobal = Math.round(
    affectations.reduce((sum, a) => sum + (a.scoreTotal || 0), 0) /
    Math.max(affectations.length, 1)
  );

  const summary = {
    nbEnseignants: participants.length,
    nbEleves: uniqueEleves.size,
    nbAffectations: affectations.length,
    classes,
    scoreGlobal,
    tauxAffectation: Math.round((uniqueEleves.size / Math.max(totalEleves, 1)) * 100),
  };

  return {
    archive: {
      scenarioId: scenario.id!,
      scenarioNom: scenario.nom,
      scenarioType: scenario.type,
      archivedAt: new Date(),
      participants,
      affectations: archiveAffectations,
      stats: {
        nbEnseignants: summary.nbEnseignants,
        nbEleves: summary.nbEleves,
        nbAffectations: summary.nbAffectations,
        scoreGlobal: summary.scoreGlobal,
        tauxAffectation: summary.tauxAffectation,
      },
    },
    summary,
  };
}

// ============================================================
// UTILITY: Format date for display
// ============================================================

export function formatArchiveDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getScenarioTypeLabel(type: string): string {
  switch (type) {
    case 'oral_dnb': return 'Oral du DNB';
    case 'suivi_stage': return 'Suivi de stage';
    case 'custom': return 'Personnalisé';
    default: return 'Standard';
  }
}
