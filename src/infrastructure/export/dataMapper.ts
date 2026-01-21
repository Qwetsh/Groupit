// ============================================================
// DATA MAPPER - Convertit les données internes vers le format export
// ============================================================

import type {
  Eleve,
  Enseignant,
  Jury,
  Affectation,
  Scenario,
  ScenarioArchive,
} from '../../domain/models';
import type {
  ExportResultData,
  ExportJuryData,
  ExportEleveData,
  ExportEnseignantData,
  ExportUnassignedData,
} from './types';

/**
 * Convertit un enseignant vers le format export
 */
function mapEnseignant(enseignant: Enseignant): ExportEnseignantData {
  return {
    enseignantId: enseignant.id!,
    nom: enseignant.nom,
    prenom: enseignant.prenom,
    matierePrincipale: enseignant.matierePrincipale || 'Non définie',
  };
}

/**
 * Détermine la matière qui a justifié l'affectation d'un élève à un jury
 */
function getMatiereAffectee(
  eleve: Eleve,
  juryEnseignants: Enseignant[]
): string | null {
  const matieresEleve = eleve.matieresOral || [];
  const matieresJury = juryEnseignants.map(e => e.matierePrincipale?.toLowerCase());
  
  for (const matiere of matieresEleve) {
    if (matieresJury.some(m => m && m.includes(matiere.toLowerCase()))) {
      return matiere;
    }
  }
  
  // Si pas de match, retourner la première matière de l'élève
  return matieresEleve[0] || null;
}

/**
 * Convertit un élève affecté vers le format export
 */
function mapEleveAffecte(
  eleve: Eleve,
  affectation: Affectation,
  juryEnseignants: Enseignant[]
): ExportEleveData {
  const metadata = affectation.metadata as any;
  
  return {
    eleveId: eleve.id!,
    nom: eleve.nom,
    prenom: eleve.prenom,
    classe: eleve.classe,
    matieresOral: eleve.matieresOral || [],
    matiereAffectee: getMatiereAffectee(eleve, juryEnseignants),
    
    // Champs futurs depuis metadata si disponibles
    datePassage: metadata?.dateCreneau,
    heurePassage: metadata?.heureCreneau,
    salle: metadata?.salle,
    sujetIntitule: metadata?.theme,
  };
}

/**
 * Convertit un élève non affecté vers le format export
 */
function mapEleveNonAffecte(
  eleve: Eleve,
  raisons: string[]
): ExportUnassignedData {
  return {
    eleveId: eleve.id!,
    nom: eleve.nom,
    prenom: eleve.prenom,
    classe: eleve.classe,
    matieresOral: eleve.matieresOral || [],
    raisons: raisons.length > 0 ? raisons : ['Aucune place disponible'],
  };
}

/**
 * Convertit un jury avec ses affectations vers le format export
 */
function mapJury(
  jury: Jury,
  allEnseignants: Enseignant[],
  allEleves: Eleve[],
  juryAffectations: Affectation[]
): ExportJuryData {
  // Récupérer les enseignants du jury
  const juryEnseignants = allEnseignants.filter(e => 
    jury.enseignantIds.includes(e.id!)
  );
  
  // Mapper les élèves affectés
  const elevesAffectes: ExportEleveData[] = [];
  let nbMatchMatiere = 0;
  
  for (const aff of juryAffectations) {
    const eleve = allEleves.find(e => e.id === aff.eleveId);
    if (eleve) {
      const exportEleve = mapEleveAffecte(eleve, aff, juryEnseignants);
      elevesAffectes.push(exportEleve);
      
      // Vérifier si la matière match
      if (exportEleve.matiereAffectee) {
        const matieresJury = juryEnseignants.map(e => e.matierePrincipale?.toLowerCase());
        if (matieresJury.some(m => m && exportEleve.matiereAffectee!.toLowerCase().includes(m))) {
          nbMatchMatiere++;
        }
      }
    }
  }
  
  // Trier par classe puis nom
  elevesAffectes.sort((a, b) => {
    const classeCompare = a.classe.localeCompare(b.classe);
    if (classeCompare !== 0) return classeCompare;
    return a.nom.localeCompare(b.nom);
  });
  
  const nbAffectes = elevesAffectes.length;
  const tauxRemplissage = jury.capaciteMax > 0 
    ? Math.round((nbAffectes / jury.capaciteMax) * 100) 
    : 0;
  
  return {
    juryId: jury.id!,
    juryName: jury.nom,
    salle: jury.salle,
    horaire: jury.horaire,
    
    enseignants: juryEnseignants.map(mapEnseignant),
    eleves: elevesAffectes,
    
    capaciteMax: jury.capaciteMax,
    nbAffectes,
    tauxRemplissage,
    nbMatchMatiere,
  };
}

/**
 * Interface pour les raisons de non-affectation par élève
 */
export interface UnassignedReasons {
  [eleveId: string]: string[];
}

/**
 * Fonction principale: convertit toutes les données internes vers le format export
 */
export function mapToExportData(
  scenario: Scenario,
  jurys: Jury[],
  affectations: Affectation[],
  allEnseignants: Enseignant[],
  allEleves: Eleve[],
  filteredEleveIds: string[],
  unassignedReasons?: UnassignedReasons
): ExportResultData {
  // Filtrer les jurys du scénario
  const scenarioJurys = jurys.filter(j => j.scenarioId === scenario.id);
  
  // Filtrer les affectations du scénario
  const scenarioAffectations = affectations.filter(a => a.scenarioId === scenario.id);
  
  // Créer un Set des élèves affectés
  const affectedEleveIds = new Set(scenarioAffectations.map(a => a.eleveId));
  
  // Mapper chaque jury
  const exportJurys: ExportJuryData[] = scenarioJurys.map(jury => {
    const juryAffectations = scenarioAffectations.filter(a => a.juryId === jury.id);
    return mapJury(jury, allEnseignants, allEleves, juryAffectations);
  });
  
  // Trier les jurys par nom
  exportJurys.sort((a, b) => a.juryName.localeCompare(b.juryName, 'fr', { numeric: true }));
  
  // Trouver les élèves non affectés
  const unassignedEleves: ExportUnassignedData[] = [];
  for (const eleveId of filteredEleveIds) {
    if (!affectedEleveIds.has(eleveId)) {
      const eleve = allEleves.find(e => e.id === eleveId);
      if (eleve) {
        const raisons = unassignedReasons?.[eleveId] || [];
        unassignedEleves.push(mapEleveNonAffecte(eleve, raisons));
      }
    }
  }
  
  // Trier les non-affectés par classe puis nom
  unassignedEleves.sort((a, b) => {
    const classeCompare = a.classe.localeCompare(b.classe);
    if (classeCompare !== 0) return classeCompare;
    return a.nom.localeCompare(b.nom);
  });
  
  // Calculer les stats globales
  const totalAffectes = scenarioAffectations.length;
  const totalNonAffectes = unassignedEleves.length;
  const totalEleves = totalAffectes + totalNonAffectes;
  const totalMatchMatiere = exportJurys.reduce((sum, j) => sum + j.nbMatchMatiere, 0);
  
  // Collecter tous les enseignants uniques dans les jurys
  const enseignantIds = new Set<string>();
  scenarioJurys.forEach(j => j.enseignantIds.forEach(id => enseignantIds.add(id)));
  
  return {
    scenarioId: scenario.id!,
    scenarioName: scenario.nom,
    scenarioType: scenario.type || 'oral_dnb',
    dateExport: new Date().toISOString(),

    jurys: exportJurys,
    unassigned: unassignedEleves,

    stats: {
      totalEleves,
      totalAffectes,
      totalNonAffectes,
      tauxAffectation: totalEleves > 0 ? Math.round((totalAffectes / totalEleves) * 100) : 0,
      tauxMatchMatiere: totalAffectes > 0 ? Math.round((totalMatchMatiere / totalAffectes) * 100) : 0,
      nbJurys: exportJurys.length,
      nbEnseignants: enseignantIds.size,
    },
  };
}

// ============================================================
// ARCHIVE TO EXPORT DATA - Pour exporter depuis une archive validée
// ============================================================

/**
 * Convertit une archive validée vers le format ExportResultData
 * Utilisé pour exporter PDF/CSV depuis le tableau de bord
 */
export function mapArchiveToExportData(archive: ScenarioArchive): ExportResultData {
  // Pour les scénarios de type oral_dnb avec jurys
  if (archive.scenarioType === 'oral_dnb' && archive.metadata?.jurys) {
    return mapOralDnbArchiveToExport(archive);
  }

  // Pour suivi_stage et autres types (export par enseignant)
  return mapStandardArchiveToExport(archive);
}

/**
 * Convertit une archive Oral DNB (avec jurys) vers ExportResultData
 */
function mapOralDnbArchiveToExport(archive: ScenarioArchive): ExportResultData {
  const jurys = archive.metadata?.jurys || [];

  // Créer un map des participants pour lookup rapide
  const participantMap = new Map(
    archive.participants.map(p => [p.enseignantId, p])
  );

  // Créer un map des affectations par juryId
  const affectationsByJury = new Map<string, typeof archive.affectations[0]>();
  archive.affectations.forEach(aff => {
    if (aff.juryId && !affectationsByJury.has(aff.juryId)) {
      affectationsByJury.set(aff.juryId, aff);
    }
  });

  // Mapper les jurys vers ExportJuryData
  const exportJurys: ExportJuryData[] = jurys.map(jury => {
    const aff = affectationsByJury.get(jury.id);
    const eleves = aff?.eleves || [];

    // Mapper les enseignants du jury
    const enseignants: ExportEnseignantData[] = jury.enseignantIds.map(ensId => {
      const participant = participantMap.get(ensId);
      return {
        enseignantId: ensId,
        nom: participant?.enseignantNom || 'Inconnu',
        prenom: participant?.enseignantPrenom || '',
        matierePrincipale: participant?.roleLabel || 'Non définie',
      };
    });

    // Mapper les élèves
    const exportEleves: ExportEleveData[] = eleves.map(eleve => ({
      eleveId: eleve.eleveId,
      nom: eleve.eleveNom,
      prenom: eleve.elevePrenom,
      classe: eleve.eleveClasse,
      matieresOral: eleve.matiereOral ? [eleve.matiereOral] : [],
      matiereAffectee: eleve.matiereOral || null,
    }));

    return {
      juryId: jury.id,
      juryName: jury.nom,
      enseignants,
      eleves: exportEleves,
      capaciteMax: eleves.length,
      nbAffectes: eleves.length,
      tauxRemplissage: 100,
      nbMatchMatiere: eleves.filter(e => e.matiereOral).length,
    };
  });

  // Trier par nom
  exportJurys.sort((a, b) => a.juryName.localeCompare(b.juryName, 'fr', { numeric: true }));

  const totalAffectes = archive.stats.nbAffectations;
  const totalEleves = archive.stats.nbEleves;

  return {
    scenarioId: archive.scenarioId,
    scenarioName: archive.scenarioNom,
    scenarioType: archive.scenarioType,
    dateExport: archive.archivedAt instanceof Date
      ? archive.archivedAt.toISOString()
      : new Date(archive.archivedAt).toISOString(),

    jurys: exportJurys,
    unassigned: [], // Pas d'info sur les non-affectés dans l'archive

    stats: {
      totalEleves,
      totalAffectes,
      totalNonAffectes: 0,
      tauxAffectation: archive.stats.tauxAffectation || 100,
      tauxMatchMatiere: 0, // Non calculé dans l'archive
      nbJurys: exportJurys.length,
      nbEnseignants: archive.stats.nbEnseignants,
    },
  };
}

/**
 * Convertit une archive standard (suivi_stage ou autre) vers ExportResultData
 * Crée un "pseudo-jury" par enseignant
 */
function mapStandardArchiveToExport(archive: ScenarioArchive): ExportResultData {
  // Créer un map des participants
  const participantMap = new Map(
    archive.participants.map(p => [p.enseignantId, p])
  );

  // Mapper chaque affectation comme un "jury" (un par enseignant)
  const exportJurys: ExportJuryData[] = archive.affectations.map(aff => {
    const participant = participantMap.get(aff.enseignantId);

    const enseignant: ExportEnseignantData = {
      enseignantId: aff.enseignantId,
      nom: participant?.enseignantNom || 'Inconnu',
      prenom: participant?.enseignantPrenom || '',
      matierePrincipale: participant?.roleLabel || 'Référent',
    };

    // Mapper les élèves
    const exportEleves: ExportEleveData[] = aff.eleves.map(eleve => ({
      eleveId: eleve.eleveId,
      nom: eleve.eleveNom,
      prenom: eleve.elevePrenom,
      classe: eleve.eleveClasse,
      matieresOral: eleve.matiereOral ? [eleve.matiereOral] : [],
      matiereAffectee: eleve.matiereOral || null,
      // Pour suivi_stage, on pourrait ajouter des champs supplémentaires
    }));

    const juryName = participant
      ? `${participant.enseignantPrenom} ${participant.enseignantNom}`
      : aff.juryNom || 'Enseignant';

    return {
      juryId: aff.enseignantId,
      juryName,
      enseignants: [enseignant],
      eleves: exportEleves,
      capaciteMax: aff.eleves.length,
      nbAffectes: aff.eleves.length,
      tauxRemplissage: 100,
      nbMatchMatiere: 0,
    };
  });

  // Trier par nom
  exportJurys.sort((a, b) => a.juryName.localeCompare(b.juryName, 'fr'));

  const totalAffectes = archive.stats.nbAffectations;
  const totalEleves = archive.stats.nbEleves;

  return {
    scenarioId: archive.scenarioId,
    scenarioName: archive.scenarioNom,
    scenarioType: archive.scenarioType,
    dateExport: archive.archivedAt instanceof Date
      ? archive.archivedAt.toISOString()
      : new Date(archive.archivedAt).toISOString(),

    jurys: exportJurys,
    unassigned: [],

    stats: {
      totalEleves,
      totalAffectes,
      totalNonAffectes: 0,
      tauxAffectation: archive.stats.tauxAffectation || 100,
      tauxMatchMatiere: 0,
      nbJurys: exportJurys.length,
      nbEnseignants: archive.stats.nbEnseignants,
    },
  };
}
