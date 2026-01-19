// ============================================================
// DATA MAPPER - Convertit les données internes vers le format export
// ============================================================

import type {
  Eleve,
  Enseignant,
  Jury,
  Affectation,
  Scenario,
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
