// ============================================================
// DATA MAPPER - EXPORT SUIVI DE STAGE
// ============================================================

import type { 
  Stage, 
  Eleve, 
  Enseignant, 
  Affectation, 
  Scenario 
} from '../../domain/models';
import { parseAddress } from '../geo/addressParser';
import type { 
  StageExportResultData, 
  StageExportEnseignantData, 
  StageExportEleveData,
  StageExportUnassignedData 
} from './stageTypes';

// ============================================================
// HELPERS
// ============================================================

/**
 * Formate une distance en km (1 décimale)
 */
function formatDistance(distanceKm: number | undefined): number | undefined {
  if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm)) {
    return undefined;
  }
  return Math.round(distanceKm * 10) / 10;
}

/**
 * Estime la durée de trajet en voiture (en minutes)
 * Approximation : 35 km/h en moyenne (urbain + périurbain)
 */
function estimateDuree(distanceKm: number | undefined): number | undefined {
  if (distanceKm === undefined || distanceKm === null) return undefined;
  return Math.round((distanceKm / 35) * 60);
}

/**
 * Construit une adresse complète à partir d'un stage
 */
function buildAdresseComplete(stage: Stage): string {
  const parts: string[] = [];
  if (stage.adresse) parts.push(stage.adresse);
  if (stage.codePostal) parts.push(stage.codePostal);
  if (stage.ville) parts.push(stage.ville);
  return parts.join(', ') || 'Adresse non renseignée';
}

/**
 * Vérifie si la distance est approximative (basée sur ville ou mairie)
 */
function isDistanceApproximate(stage: Stage): boolean {
  return stage.geoPrecision === 'CITY' || stage.geoPrecision === 'TOWNHALL';
}

/**
 * Extrait la ville d'un stage (depuis le champ ville ou depuis l'adresse)
 */
function extractVille(stage: Stage): string {
  // Si ville déjà définie, l'utiliser
  if (stage.ville && stage.ville.trim()) {
    return stage.ville.trim();
  }
  
  // Essayer d'extraire depuis geoQueryUsed d'abord si c'est "Mairie de X"
  // Car c'est souvent plus fiable que l'adresse brute
  if (stage.geoQueryUsed) {
    // Pattern "Mairie de Ville" ou "Mairie de Ville, CP"
    const mairieMatch = stage.geoQueryUsed.match(/Mairie de\s+([A-Za-zÀ-ÿ\-'\s]+?)(?:,|\s+\d{5}|$)/i);
    if (mairieMatch) {
      return mairieMatch[1].trim();
    }
    // Pattern "CP Ville" - geoQueryUsed peut être "57530 Courcelles-Chaussy"
    const cpVilleMatch = stage.geoQueryUsed.match(/^\d{5}\s+(.+)$/);
    if (cpVilleMatch) {
      return cpVilleMatch[1].trim();
    }
  }
  
  // Sinon, essayer d'extraire depuis l'adresse
  if (stage.adresse) {
    const parsed = parseAddress(stage.adresse);
    if (parsed.ville) {
      return parsed.ville;
    }
  }
  
  return '';
}

/**
 * Formate une date ISO en format français jj/mm/aaaa
 */
function formatDateFr(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('fr-FR');
  } catch {
    return dateStr;
  }
}

// ============================================================
// MAPPER PRINCIPAL
// ============================================================

export interface MapToStageExportDataOptions {
  scenario: Scenario;
  stages: Stage[];
  eleves: Eleve[];
  enseignants: Enseignant[];
  affectations: Affectation[];
  etablissementName?: string;
  anneeScolaire?: string;
}

/**
 * Transforme les données brutes en structure prête pour l'export
 */
export function mapToStageExportData(
  options: MapToStageExportDataOptions
): StageExportResultData {
  const { 
    scenario, 
    stages, 
    eleves, 
    enseignants, 
    affectations,
    etablissementName,
    anneeScolaire 
  } = options;

  // Créer des maps pour lookups rapides
  const eleveMap = new Map(eleves.map(e => [e.id, e]));
  const stageMap = new Map(stages.map(s => [s.eleveId, s]));
  const enseignantMap = new Map(enseignants.map(e => [e.id, e]));
  
  // Affectations par enseignant
  const affectationsByEnseignant = new Map<string, Affectation[]>();
  for (const aff of affectations) {
    if (!aff.enseignantId) continue;
    if (!affectationsByEnseignant.has(aff.enseignantId)) {
      affectationsByEnseignant.set(aff.enseignantId, []);
    }
    affectationsByEnseignant.get(aff.enseignantId)!.push(aff);
  }

  // Élèves affectés (pour calculer les non-affectés)
  const elevesAffectes = new Set(affectations.map(a => a.eleveId));

  // ========== ENSEIGNANTS AVEC ÉLÈVES ==========
  const exportEnseignants: StageExportEnseignantData[] = [];
  
  let distanceTotaleGlobale = 0;
  let nbDistancesApproxTotal = 0;

  for (const [enseignantId, enseignantAffectations] of affectationsByEnseignant) {
    const enseignant = enseignantMap.get(enseignantId);
    if (!enseignant) continue;

    const exportEleves: StageExportEleveData[] = [];
    let distanceTotaleEnseignant = 0;
    let nbDistancesApproxEnseignant = 0;

    for (const aff of enseignantAffectations) {
      const eleve = eleveMap.get(aff.eleveId);
      const stage = stageMap.get(aff.eleveId);

      if (!eleve) continue;

      // Extraire la distance depuis les métadonnées ou scoreDetail
      let distanceKm: number | undefined;
      if (aff.scoreDetail?.distance !== undefined) {
        // Si on a un score distance (0-100), on essaie de retrouver la vraie distance
        // Sinon on utilise les métadonnées
      }
      if (aff.metadata && 'distanceKm' in aff.metadata) {
        distanceKm = (aff.metadata as { distanceKm?: number }).distanceKm;
      } else if (stage && enseignant.lat && enseignant.lon && stage.lat && stage.lon) {
        // Recalculer la distance Haversine
        distanceKm = calculateHaversineDistance(
          enseignant.lat, enseignant.lon,
          stage.lat, stage.lon
        );
      }

      const isApprox = stage ? isDistanceApproximate(stage) : false;
      if (isApprox) {
        nbDistancesApproxEnseignant++;
        nbDistancesApproxTotal++;
      }

      if (distanceKm !== undefined) {
        distanceTotaleEnseignant += distanceKm;
        distanceTotaleGlobale += distanceKm;
      }

      const exportEleve: StageExportEleveData = {
        eleveId: eleve.id,
        nom: eleve.nom,
        prenom: eleve.prenom,
        classe: eleve.classe,
        
        stageId: stage?.id,
        entreprise: stage?.nomEntreprise || 'Non renseigné',
        adresseComplete: stage ? buildAdresseComplete(stage) : 'Adresse non disponible',
        ville: stage ? extractVille(stage) : '',
        codePostal: stage?.codePostal,
        tuteur: stage?.tuteur,
        tuteurEmail: stage?.tuteurEmail,
        tuteurTel: stage?.tuteurTel,
        secteurActivite: stage?.secteurActivite,
        
        dateDebut: formatDateFr(stage?.dateDebut),
        dateFin: formatDateFr(stage?.dateFin),
        
        // Coordonnées pour la carte
        lat: stage?.lat,
        lon: stage?.lon,
        
        distanceKm: formatDistance(distanceKm),
        dureeEstimeeMin: estimateDuree(distanceKm),
        isDistanceApprox: isApprox,
        geoPrecision: stage?.geoPrecision,
      };

      exportEleves.push(exportEleve);
    }

    // Trier les élèves par classe puis nom
    exportEleves.sort((a, b) => {
      if (a.classe !== b.classe) return a.classe.localeCompare(b.classe);
      return a.nom.localeCompare(b.nom);
    });

    const exportEnseignant: StageExportEnseignantData = {
      enseignantId: enseignant.id,
      nom: enseignant.nom,
      prenom: enseignant.prenom,
      matierePrincipale: enseignant.matierePrincipale,
      email: enseignant.customFields?.email as string | undefined,
      
      adresse: enseignant.adresse,
      commune: enseignant.commune,
      lat: enseignant.lat,
      lon: enseignant.lon,
      
      eleves: exportEleves,
      
      nbEleves: exportEleves.length,
      distanceTotaleKm: formatDistance(distanceTotaleEnseignant) ?? 0,
      distanceMoyenneKm: exportEleves.length > 0 
        ? formatDistance(distanceTotaleEnseignant / exportEleves.length) ?? 0 
        : 0,
      nbDistancesApprox: nbDistancesApproxEnseignant,
    };

    exportEnseignants.push(exportEnseignant);
  }

  // Trier les enseignants par nom
  exportEnseignants.sort((a, b) => a.nom.localeCompare(b.nom));

  // ========== ÉLÈVES NON AFFECTÉS ==========
  // Filtrer seulement les élèves de 3ème pour le suivi de stage
  const unassigned: StageExportUnassignedData[] = [];

  for (const eleve of eleves) {
    // Ne prendre que les 3èmes pour le suivi de stage
    if (!eleve.classe.startsWith('3')) continue;
    if (elevesAffectes.has(eleve.id)) continue;

    const stage = stageMap.get(eleve.id);
    const raisons: string[] = [];

    // Déterminer pourquoi l'élève n'est pas affecté
    if (!stage) {
      raisons.push('Pas de stage associé');
    } else if (!stage.lat || !stage.lon) {
      raisons.push('Stage non géolocalisé');
    } else {
      raisons.push('Aucun enseignant disponible');
    }

    unassigned.push({
      eleveId: eleve.id,
      nom: eleve.nom,
      prenom: eleve.prenom,
      classe: eleve.classe,
      entreprise: stage?.nomEntreprise,
      adresse: stage ? buildAdresseComplete(stage) : undefined,
      ville: stage?.ville,
      raisons,
    });
  }

  // Trier par classe puis nom
  unassigned.sort((a, b) => {
    if (a.classe !== b.classe) return a.classe.localeCompare(b.classe);
    return a.nom.localeCompare(b.nom);
  });

  // ========== STATS GLOBALES ==========
  const totalStages = stages.length;
  const totalAffectes = affectations.length;
  const totalNonAffectes = unassigned.length;
  const tauxAffectation = totalStages > 0 
    ? Math.round((totalAffectes / totalStages) * 100) 
    : 0;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.nom,
    dateExport: new Date().toISOString(),
    anneeScolaire,
    etablissement: etablissementName,
    
    enseignants: exportEnseignants,
    unassigned,
    
    stats: {
      totalStages,
      totalAffectes,
      totalNonAffectes,
      tauxAffectation,
      nbEnseignants: exportEnseignants.length,
      distanceTotaleGlobaleKm: formatDistance(distanceTotaleGlobale) ?? 0,
      distanceMoyenneGlobaleKm: totalAffectes > 0 
        ? formatDistance(distanceTotaleGlobale / totalAffectes) ?? 0 
        : 0,
      nbDistancesApprox: nbDistancesApproxTotal,
    },
  };
}

// ============================================================
// HAVERSINE DISTANCE (copié de distance.ts pour autonomie)
// ============================================================

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS_KM * c;
}

// ============================================================
// HELPERS POUR FLATMAP CSV
// ============================================================

export interface FlatStageRow {
  enseignantNom: string;
  enseignantPrenom: string;
  enseignantMatiere: string;
  enseignantCommune: string;
  
  eleveNom: string;
  elevePrenom: string;
  eleveClasse: string;
  
  entreprise: string;
  adresse: string;
  ville: string;
  
  distanceKm: string;
  dureeMin: string;
  precisionGeo: string;
  isDistanceApprox: string;
  
  dateDebut: string;
  dateFin: string;
  tuteur: string;
  tuteurEmail: string;
  tuteurTel: string;
  secteur: string;
}

/**
 * Aplatit les données hiérarchiques en lignes CSV
 */
export function flattenStageDataForCsv(data: StageExportResultData): FlatStageRow[] {
  const rows: FlatStageRow[] = [];

  for (const ens of data.enseignants) {
    for (const eleve of ens.eleves) {
      rows.push({
        enseignantNom: ens.nom,
        enseignantPrenom: ens.prenom,
        enseignantMatiere: ens.matierePrincipale,
        enseignantCommune: ens.commune || '',
        
        eleveNom: eleve.nom,
        elevePrenom: eleve.prenom,
        eleveClasse: eleve.classe,
        
        entreprise: eleve.entreprise,
        adresse: eleve.adresseComplete,
        ville: eleve.ville,
        
        distanceKm: eleve.distanceKm?.toString() || '',
        dureeMin: eleve.dureeEstimeeMin?.toString() || '',
        precisionGeo: eleve.geoPrecision || '',
        isDistanceApprox: eleve.isDistanceApprox ? 'Oui' : 'Non',
        
        dateDebut: eleve.dateDebut || '',
        dateFin: eleve.dateFin || '',
        tuteur: eleve.tuteur || '',
        tuteurEmail: eleve.tuteurEmail || '',
        tuteurTel: eleve.tuteurTel || '',
        secteur: eleve.secteurActivite || '',
      });
    }
  }

  return rows;
}

/**
 * Crée les lignes pour les élèves non affectés
 */
export function flattenUnassignedForCsv(
  data: StageExportResultData
): Array<{
  nom: string;
  prenom: string;
  classe: string;
  entreprise: string;
  adresse: string;
  ville: string;
  raisons: string;
}> {
  return data.unassigned.map(u => ({
    nom: u.nom,
    prenom: u.prenom,
    classe: u.classe,
    entreprise: u.entreprise || '',
    adresse: u.adresse || '',
    ville: u.ville || '',
    raisons: u.raisons.join('; '),
  }));
}
