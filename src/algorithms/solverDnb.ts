// ============================================================
// ALGORITHME - SOLVEUR ORAL DNB AVEC JURYS
// ============================================================

import type {
  Eleve,
  Enseignant,
  Scenario,
  Jury,
  MatchingResultDNB,
  SolverResultDNB,
  AffectationExplication,
  JuryStats,
} from '../domain/models';
import { getPoidsPedagogiqueNormalise } from '../domain/models';
import { getEffectiveCriteres, criteresToOralDnbOptions, type OralDnbOptions } from '../domain/criteriaConfig';
import { calculateDistance } from './distance';

// Coordonnées du collège (partagées avec StageAssignmentMapDrawer)
const COLLEGE_LAT = 49.15680;
const COLLEGE_LON = 6.13754;

// ============ TYPES ============

interface JuryContext {
  jury: Jury;
  enseignants: Enseignant[];
  matieres: string[]; // Matières couvertes par les enseignants du jury
  capaciteRestante: number;
  chargeActuelle: number;
  poidsPedagogiqueMoyen: number; // Moyenne pondérée des heures hebdo des matières
  nbF: number; // Nombre de filles affectées
  nbM: number; // Nombre de garçons affectés
  nbTiersTemps: number; // Nombre d'élèves tiers temps affectés
  distanceCollegeMin: number; // Distance min (km) d'un enseignant du jury au collège
  matieresElevesCounts: Record<string, number>; // Compteur des matières des élèves affectés
}

interface SolverDnbConfig {
  maxIterations: number;
  verbose: boolean;
}

const DEFAULT_CONFIG: SolverDnbConfig = {
  maxIterations: 5000,
  verbose: false,
};

/**
 * Extrait les options de scoring depuis le scénario
 * Utilise criteresV2 si disponible, sinon fallback sur l'ancien système
 */
function getOptionsFromScenario(scenario: Scenario): OralDnbOptions {
  // Priorité aux critères V2
  if (scenario.parametres.criteresV2?.length) {
    const effectiveCriteres = getEffectiveCriteres('oral_dnb', scenario.parametres.criteresV2);
    return criteresToOralDnbOptions(effectiveCriteres);
  }
  
  // Fallback sur l'ancien système oralDnb
  const oralConfig = scenario.parametres.oralDnb;
  if (!oralConfig) {
    // Valeurs par défaut
    return {
      poidsMatiereMatch: 70,
      poidsEquilibrage: 20,
      poidsMixite: 10,
      poidsPedagogique: 0,
      poidsCapacite: 0,
      poidsElevesEnCours: 0, // Désactivé par défaut
      equilibrageWeightByHours: false, // Désactivé par défaut dans l'ancien système
    };
  }

  // Convertir l'ancien format vers le nouveau
  const hasCritere = (c: string) => oralConfig.criteresSecondaires?.includes(c as 'equilibrage' | 'parite' | 'capacite');
  const nbCriteres = oralConfig.criteresSecondaires?.length || 1;
  const poidsSecondaire = (100 - oralConfig.poidsMatiere) / nbCriteres;

  return {
    poidsMatiereMatch: oralConfig.poidsMatiere,
    poidsEquilibrage: hasCritere('equilibrage') ? poidsSecondaire : 0,
    poidsMixite: hasCritere('parite') ? poidsSecondaire : 0,
    poidsPedagogique: 0, // Pas dans l'ancien système
    poidsCapacite: hasCritere('capacite') ? poidsSecondaire : 0,
    poidsElevesEnCours: 0, // Pas dans l'ancien système
    equilibrageWeightByHours: false, // Pas dans l'ancien système
  };
}

// ============ UTILITAIRES ============

/**
 * Vérifie si l'élève est dans les classes d'un des enseignants du jury
 */
function isEleveEnCoursForJury(eleveClasse: string | undefined, juryEnseignants: Enseignant[]): boolean {
  if (!eleveClasse || juryEnseignants.length === 0) {
    return false;
  }
  return juryEnseignants.some(e => e.classesEnCharge?.includes(eleveClasse));
}

/**
 * Calcule les matières couvertes par un jury
 */
function getJuryMatieres(jury: Jury, enseignantMap: Map<string, Enseignant>): string[] {
  const matieres = new Set<string>();

  jury.enseignantIds.forEach(ensId => {
    const ens = enseignantMap.get(ensId);
    if (ens?.matierePrincipale) {
      matieres.add(ens.matierePrincipale);
    }
  });

  return Array.from(matieres);
}

/**
 * Calcule le poids pédagogique moyen d'un jury (basé sur les heures hebdo)
 */
function getJuryPoidsPedagogique(matieres: string[]): number {
  if (matieres.length === 0) return 0.5;
  
  const total = matieres.reduce((sum, m) => sum + getPoidsPedagogiqueNormalise(m), 0);
  return total / matieres.length;
}

/**
 * Initialise le contexte pour chaque jury
 */
function initializeJuryContexts(
  jurys: Jury[],
  enseignants: Enseignant[]
): Map<string, JuryContext> {
  const contexts = new Map<string, JuryContext>();
  // Pré-indexer les enseignants pour éviter N+1 .find()
  const enseignantMap = new Map(enseignants.map(e => [e.id!, e]));

  jurys.forEach(jury => {
    const juryEnseignants = jury.enseignantIds
      .map(id => enseignantMap.get(id))
      .filter((e): e is Enseignant => !!e);
    const matieres = getJuryMatieres(jury, enseignantMap);
    
    // Distance min d'un enseignant du jury au collège
    let distanceCollegeMin = Infinity;
    for (const ens of juryEnseignants) {
      if (ens.lat && ens.lon) {
        const d = calculateDistance(ens.lat, ens.lon, COLLEGE_LAT, COLLEGE_LON);
        if (d < distanceCollegeMin) distanceCollegeMin = d;
      }
    }
    if (!isFinite(distanceCollegeMin)) distanceCollegeMin = 10; // Défaut si aucune géoloc

    contexts.set(jury.id!, {
      jury,
      enseignants: juryEnseignants,
      matieres,
      capaciteRestante: jury.capaciteMax,
      chargeActuelle: 0,
      poidsPedagogiqueMoyen: getJuryPoidsPedagogique(matieres),
      nbF: 0,
      nbM: 0,
      nbTiersTemps: 0,
      distanceCollegeMin,
      matieresElevesCounts: {},
    });
  });
  
  return contexts;
}

// ============ SCORING ============

interface ScoreEleveJury {
  score: number;
  matiereMatch: boolean;
  matiereEleve: string | null;
  matchingMatiere: string | null;
  scoreDetail: Record<string, number>;
  raisons: string[];
}

/**
 * Calcule le score d'appariement élève-jury
 * Utilise les critères V2 si disponibles, sinon fallback sur l'ancien système
 */
function scoreEleveJury(
  eleve: Eleve,
  juryContext: JuryContext,
  scenario: Scenario,
  options?: OralDnbOptions
): ScoreEleveJury {
  // Récupérer les options depuis criteresV2 ou fallback sur l'ancien système
  const opts: OralDnbOptions = options || getOptionsFromScenario(scenario);
  
  const scoreDetail: Record<string, number> = {};
  const raisons: string[] = [];
  
  // 1. Score matière (prioritaire si actif)
  let matiereMatch = false;
  let matchingMatiere: string | null = null;
  let matiereEleve: string | null = null;
  let scoreMatiereBase = 0;
  
  // Récupérer les matières de l'élève
  const matieresEleve = eleve.matieresOral || [];
  
  if (matieresEleve.length > 0) {
    matiereEleve = matieresEleve[0]; // Matière principale de l'élève
    
    // Chercher une correspondance avec les matières du jury
    for (const matEleve of matieresEleve) {
      if (juryContext.matieres.includes(matEleve)) {
        matiereMatch = true;
        matchingMatiere = matEleve;
        scoreMatiereBase = 100;
        raisons.push(`Correspondance matière: ${matEleve}`);
        break;
      }
    }
    
    if (!matiereMatch) {
      scoreMatiereBase = 30; // Pas de correspondance
      raisons.push(`Pas de correspondance matière (élève: ${matieresEleve.join(', ')}, jury: ${juryContext.matieres.join(', ')})`);
    }
  } else {
    // L'élève n'a pas de matière renseignée
    scoreMatiereBase = 50; // Score neutre
    raisons.push('Matière élève non renseignée');
  }

  // Score langue étrangère
  let scoreLangue = 0;
  if (eleve.langueEtrangere) {
    const hasLangueTeacher = juryContext.matieres.includes(eleve.langueEtrangere);
    scoreLangue = hasLangueTeacher ? 100 : 0;
    if (hasLangueTeacher) {
      raisons.push(`Correspondance langue: ${eleve.langueEtrangere}`);
    } else {
      raisons.push(`Pas de prof de ${eleve.langueEtrangere} dans ce jury`);
    }
  }
  scoreDetail['langue'] = scoreLangue;

  // Normaliser les poids pour avoir un total de 100
  const poidsElevesEnCours = opts.poidsElevesEnCours ?? 0;
  const poidsPedagogique = opts.poidsPedagogique ?? 0;
  const totalPoids = opts.poidsMatiereMatch + opts.poidsEquilibrage + opts.poidsMixite + opts.poidsCapacite + poidsElevesEnCours + poidsPedagogique;
  const norm = totalPoids > 0 ? 100 / totalPoids : 1;

  const wMatiere = opts.poidsMatiereMatch * norm / 100;
  const wEquilibrage = opts.poidsEquilibrage * norm / 100;
  const wMixite = opts.poidsMixite * norm / 100;
  const wCapacite = opts.poidsCapacite * norm / 100;
  const wPedagogique = poidsPedagogique * norm / 100;
  const wElevesEnCours = poidsElevesEnCours * norm / 100;
  
  scoreDetail['matiere'] = scoreMatiereBase;
  
  // 2. Score équilibrage
  // Si weightByHours est activé, on utilise une charge relative pondérée
  // sinon on utilise le taux de remplissage simple
  let scoreEquilibrage = 50;
  if (opts.poidsEquilibrage > 0) {
    if (opts.equilibrageWeightByHours) {
      // ÉQUILIBRAGE PONDÉRÉ PAR CHARGE HORAIRE
      // On utilise le poids pédagogique moyen du jury (basé sur les matières)
      // Un jury avec des matières à gros volume (Français, Maths) a une "capacité théorique" plus grande
      // 
      // Formule: chargeRelative = chargeActuelle / (capaciteMax * poidsPedagogique)
      // Plus le poids pédagogique est élevé, plus on peut accepter d'élèves avant pénalité
      const poidsJury = Math.max(0.3, juryContext.poidsPedagogiqueMoyen); // Min 0.3 pour éviter division par 0
      const capaciteEffective = juryContext.jury.capaciteMax * poidsJury;
      const chargeRelative = capaciteEffective > 0 
        ? juryContext.chargeActuelle / capaciteEffective 
        : juryContext.chargeActuelle;
      
      if (chargeRelative < 0.5) {
        scoreEquilibrage = 100;
        raisons.push('Jury peu chargé (capacité pondérée)');
      } else if (chargeRelative < 0.8) {
        scoreEquilibrage = 75;
        raisons.push('Jury moyennement chargé (capacité pondérée)');
      } else if (chargeRelative < 1.0) {
        scoreEquilibrage = 50;
        raisons.push('Jury bien rempli (capacité pondérée)');
      } else {
        scoreEquilibrage = Math.max(0, 50 - (chargeRelative - 1.0) * 50);
        raisons.push('Jury surchargé (capacité pondérée)');
      }
    } else {
      // ÉQUILIBRAGE SIMPLE (comportement original)
      const tauxRemplissage = juryContext.chargeActuelle / juryContext.jury.capaciteMax;
      if (tauxRemplissage < 0.3) {
        scoreEquilibrage = 100;
        raisons.push('Jury peu chargé (prioritaire)');
      } else if (tauxRemplissage < 0.6) {
        scoreEquilibrage = 75;
        raisons.push('Jury moyennement chargé');
      } else if (tauxRemplissage < 0.9) {
        scoreEquilibrage = 50;
        raisons.push('Jury bien rempli');
      } else {
        scoreEquilibrage = 20;
        raisons.push('Jury presque complet');
      }
    }
    scoreDetail['equilibrage'] = scoreEquilibrage;
  }
  
  // 3. Score mixité (parité filles/garçons)
  let scoreMixite = 60;
  if (opts.poidsMixite > 0) {
    const total = juryContext.nbF + juryContext.nbM;
    if (total === 0) {
      scoreMixite = 70; // Jury vide, score neutre
    } else {
      // Ratio actuel : 0.5 = parfait, 0 ou 1 = déséquilibré
      const ratioF = juryContext.nbF / total;
      // Simuler l'ajout de cet élève
      const newNbF = juryContext.nbF + (eleve.sexe === 'F' ? 1 : 0);
      const newNbM = juryContext.nbM + (eleve.sexe === 'M' ? 1 : 0);
      const newTotal = newNbF + newNbM;
      const newRatioF = newTotal > 0 ? newNbF / newTotal : 0.5;
      // Score : plus le ratio est proche de 0.5, mieux c'est
      const ecart = Math.abs(newRatioF - 0.5); // 0 = parfait, 0.5 = pire
      scoreMixite = Math.round(100 - ecart * 200); // 100 si 50/50, 0 si 100/0
    }
    if (!eleve.sexe) scoreMixite = 60; // Sexe non renseigné → neutre
    scoreDetail['mixite'] = scoreMixite;
  }
  
  // 4. Score capacité
  let scoreCapacite = 50;
  if (opts.poidsCapacite > 0) {
    if (juryContext.capaciteRestante > 5) {
      scoreCapacite = 100;
    } else if (juryContext.capaciteRestante > 2) {
      scoreCapacite = 70;
    } else if (juryContext.capaciteRestante > 0) {
      scoreCapacite = 40;
    } else {
      scoreCapacite = 0;
    }
    scoreDetail['capacite'] = scoreCapacite;
  }

  // 5. Score "élèves en cours" (bonus si l'élève est dans une des classes d'un enseignant du jury)
  let scoreElevesEnCours = 50;
  if (poidsElevesEnCours > 0) {
    const isEnCours = isEleveEnCoursForJury(eleve.classe, juryContext.enseignants);
    if (isEnCours) {
      scoreElevesEnCours = 100;
      raisons.push('Élève dans une classe du jury');
    } else {
      scoreElevesEnCours = 30;
      raisons.push('Élève pas dans les classes du jury');
    }
    scoreDetail['elevesEnCours'] = scoreElevesEnCours;
  }

  // 6. Score pédagogique (basé sur le poids horaire des matières du jury)
  let scorePedagogique = 50;
  if (poidsPedagogique > 0) {
    scorePedagogique = Math.round(juryContext.poidsPedagogiqueMoyen * 100);
    scoreDetail['pedagogique'] = scorePedagogique;
  }

  // 7. Critères tiers temps (appliqués automatiquement si l'élève a le tiers temps)
  let scoreTiersTemps = 50; // neutre par défaut
  if (eleve.tiersTemps) {
    // Équilibrage: favoriser les jurys avec le moins de tiers temps
    const avgTT = juryContext.chargeActuelle > 0
      ? juryContext.nbTiersTemps / juryContext.chargeActuelle
      : 0;
    // Si le jury a déjà beaucoup de tiers temps proportionnellement, score bas
    const equilibrageTT = Math.round(100 - avgTT * 150); // 100 si 0 TT, ~25 si 50% TT

    // Proximité collège: favoriser les jurys dont les profs habitent proche
    let proximiteTT = 50;
    if (juryContext.distanceCollegeMin <= 5) proximiteTT = 100;
    else if (juryContext.distanceCollegeMin <= 15) proximiteTT = 75;
    else if (juryContext.distanceCollegeMin <= 30) proximiteTT = 40;
    else proximiteTT = 20;

    scoreTiersTemps = Math.round(equilibrageTT * 0.6 + proximiteTT * 0.4);
    scoreDetail['tiersTemps'] = scoreTiersTemps;
    raisons.push(`Tiers temps — ${juryContext.nbTiersTemps} déjà dans ce jury, profs à ${Math.round(juryContext.distanceCollegeMin)}km du collège`);
  }

  // 8. Diversité des sujets (pénalise la concentration d'une même matière dans un jury)
  let scoreDiversite = 100; // neutre si pas de matière ou jury vide
  if (matieresEleve.length > 0 && juryContext.chargeActuelle >= 2) {
    const matiereElv = matieresEleve[0];
    const countCetteMatiere = juryContext.matieresElevesCounts[matiereElv] || 0;
    const total = juryContext.chargeActuelle;
    const concentration = countCetteMatiere / total; // 0 = aucun, 1 = tous la même matière

    // Score: 100 si 0 concentration, décroît linéairement
    // Seuil à 30%: au-delà, on commence à pénaliser fortement
    if (concentration <= 0.3) {
      scoreDiversite = 100;
    } else {
      scoreDiversite = Math.max(0, Math.round(100 - (concentration - 0.3) * 140));
    }
    scoreDetail['diversite'] = scoreDiversite;
    if (concentration > 0.3) {
      raisons.push(`Concentration ${matiereElv}: ${countCetteMatiere}/${total} élèves (${Math.round(concentration * 100)}%)`);
    }
  }

  // 9. Score final pondéré
  let scoreFinal = Math.round(
    scoreMatiereBase * wMatiere +
    scoreEquilibrage * wEquilibrage +
    scoreMixite * wMixite +
    scoreCapacite * wCapacite +
    scorePedagogique * wPedagogique +
    scoreElevesEnCours * wElevesEnCours
  );

  // Malus diversité (additif, pénalise la monotonie des sujets dans un jury)
  // Jusqu'à -35 points quand un sujet est surreprésenté
  if (scoreDiversite < 100 && matieresEleve.length > 0) {
    scoreFinal += Math.round((scoreDiversite - 100) * 0.35); // -35 points max
    raisons.push(`Malus diversité: ${Math.round((scoreDiversite - 100) * 0.35)} pts`);
  }

  // Bonus tiers temps (additif pour influencer le placement)
  if (eleve.tiersTemps) {
    scoreFinal += Math.round((scoreTiersTemps - 50) * 0.3); // ±15 points max
  }

  // Bonus langue étrangère (priorité haute, additif)
  if (eleve.langueEtrangere && scoreLangue > 0) {
    scoreFinal += 50; // Gros bonus pour jury avec prof de la langue
  }
  
  return {
    score: scoreFinal,
    matiereMatch,
    matiereEleve,
    matchingMatiere,
    scoreDetail,
    raisons,
  };
}

/**
 * Génère l'explication d'une affectation
 */
function generateExplication(
  eleve: Eleve,
  _juryContext: JuryContext,
  scoreResult: ScoreEleveJury
): AffectationExplication {
  let raisonPrincipale: string;
  
  if (scoreResult.matiereMatch) {
    raisonPrincipale = `Correspondance matière: ${scoreResult.matchingMatiere}`;
  } else if (!eleve.matieresOral || eleve.matieresOral.length === 0) {
    raisonPrincipale = 'Matière non renseignée - Affecté par équilibrage';
  } else {
    raisonPrincipale = `Pas de jury avec matière ${eleve.matieresOral.join('/')} - Fallback sur critères secondaires`;
  }

  if (eleve.langueEtrangere) {
    raisonPrincipale += ` | Langue: ${eleve.langueEtrangere}`;
  }

  return {
    raisonPrincipale,
    criteresUtilises: Object.keys(scoreResult.scoreDetail),
    matiereRespectee: scoreResult.matiereMatch,
    score: scoreResult.score,
    detailScores: scoreResult.scoreDetail,
  };
}

// ============ SOLVEUR PRINCIPAL ============

/**
 * Algorithme de matching Oral DNB avec jurys
 * 
 * Stratégie:
 * 1. Trier les élèves par "difficulté" (ceux avec matières rares en premier)
 * 2. Pour chaque élève, évaluer tous les jurys disponibles
 * 3. Priorité absolue: correspondance matière
 * 4. Si pas de match matière, utiliser les critères secondaires
 * 5. Générer une explication pour chaque affectation
 */
export function solveOralDnb(
  eleves: Eleve[],
  enseignants: Enseignant[],
  jurys: Jury[],
  scenario: Scenario,
  config: Partial<SolverDnbConfig> = {}
): SolverResultDNB {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Pré-calculer les options depuis les critères du scénario
  const scoringOptions = getOptionsFromScenario(scenario);
  if (cfg.verbose) {
    console.log('[SolverDNB] Options de scoring:', scoringOptions);
  }
  
  // Filtrer les jurys du scénario
  const scenarioJurys = jurys.filter(j => j.scenarioId === scenario.id);
  
  if (scenarioJurys.length === 0) {
    return {
      affectations: [],
      nonAffectes: eleves.map(e => e.id!),
      sansMatchMatiere: [],
      statsParJury: {},
      scoreGlobal: 0,
      tauxMatchMatiere: 0,
      tempsCalculMs: Math.round(performance.now() - startTime),
    };
  }
  
  // Initialiser les contextes jury
  const juryContexts = initializeJuryContexts(scenarioJurys, enseignants);
  
  // Calculer la "rareté" de chaque matière (combien de jurys la couvrent)
  const matiereRarete = new Map<string, number>();
  juryContexts.forEach(ctx => {
    ctx.matieres.forEach(m => {
      matiereRarete.set(m, (matiereRarete.get(m) || 0) + 1);
    });
  });
  
  // Trier les élèves: ceux avec matières rares en premier, puis ceux sans matière
  const elevesOrdered = [...eleves].sort((a, b) => {
    const matA = a.matieresOral?.[0];
    const matB = b.matieresOral?.[0];
    
    // Élèves sans matière en dernier
    if (!matA && !matB) return 0;
    if (!matA) return 1;
    if (!matB) return -1;
    
    // Matière rare (moins de jurys) en premier
    const rareteA = matiereRarete.get(matA) || 0;
    const rareteB = matiereRarete.get(matB) || 0;
    return rareteA - rareteB;
  });
  
  // Résultats
  const affectations: MatchingResultDNB[] = [];
  const nonAffectes: string[] = [];
  const sansMatchMatiere: string[] = [];

  // Pré-indexer les groupes oraux pour éviter O(n²)
  const groupeIndex = new Map<string, Eleve[]>();
  for (const e of eleves) {
    if (e.groupeOralId) {
      const list = groupeIndex.get(e.groupeOralId) || [];
      list.push(e);
      groupeIndex.set(e.groupeOralId, list);
    }
  }

  // Identifier les groupes (élèves liés par groupeOralId)
  const alreadyAssigned = new Set<string>();

  /**
   * Affecte un élève (et son groupe éventuel) à un jury.
   * Retourne true si l'affectation a réussi.
   */
  function affectEleve(eleve: Eleve, juryId: string, score: ScoreEleveJury, ctx: JuryContext): boolean {
    // Find group members via pre-built index
    const groupMembers = eleve.groupeOralId
      ? (groupeIndex.get(eleve.groupeOralId) || []).filter(e => !alreadyAssigned.has(e.id!))
      : [];
    const slotsNeeded = groupMembers.length > 0 ? groupMembers.length : 1;

    if (ctx.capaciteRestante < slotsNeeded) return false;

    // Affecter l'élève principal
    affectations.push({
      eleveId: eleve.id!,
      juryId,
      matiereEleve: score.matiereEleve,
      matieresJury: ctx.matieres,
      matiereMatch: score.matiereMatch,
      score: score.score,
      scoreDetail: score.scoreDetail,
      explication: generateExplication(eleve, ctx, score),
    });
    ctx.capaciteRestante--;
    ctx.chargeActuelle++;
    if (eleve.sexe === 'F') ctx.nbF++;
    else if (eleve.sexe === 'M') ctx.nbM++;
    if (eleve.tiersTemps) ctx.nbTiersTemps++;
    if (eleve.matieresOral?.[0]) {
      ctx.matieresElevesCounts[eleve.matieresOral[0]] = (ctx.matieresElevesCounts[eleve.matieresOral[0]] || 0) + 1;
    }
    alreadyAssigned.add(eleve.id!);

    // Affecter les membres du groupe au même jury
    const otherMembers = groupMembers.filter(m => m.id !== eleve.id && !alreadyAssigned.has(m.id!));
    const groupLabel = otherMembers.length === 1 ? 'Binôme' : otherMembers.length === 2 ? 'Trinôme' : 'Groupe';

    for (const member of otherMembers) {
      const memberScore = scoreEleveJury(member, ctx, scenario, scoringOptions);
      affectations.push({
        eleveId: member.id!,
        juryId,
        matiereEleve: memberScore.matiereEleve,
        matieresJury: ctx.matieres,
        matiereMatch: memberScore.matiereMatch,
        score: memberScore.score,
        scoreDetail: memberScore.scoreDetail,
        explication: {
          ...generateExplication(member, ctx, memberScore),
          raisonPrincipale: `${groupLabel} avec ${[eleve, ...otherMembers.filter(m => m.id !== member.id)].map(m => `${m.prenom} ${m.nom}`).join(', ')} — ${generateExplication(member, ctx, memberScore).raisonPrincipale}`,
        },
      });
      ctx.capaciteRestante--;
      ctx.chargeActuelle++;
      if (member.sexe === 'F') ctx.nbF++;
      else if (member.sexe === 'M') ctx.nbM++;
      if (member.tiersTemps) ctx.nbTiersTemps++;
      if (member.matieresOral?.[0]) {
        ctx.matieresElevesCounts[member.matieresOral[0]] = (ctx.matieresElevesCounts[member.matieresOral[0]] || 0) + 1;
      }
      alreadyAssigned.add(member.id!);

      if (!memberScore.matiereMatch && member.matieresOral?.length) {
        sansMatchMatiere.push(member.id!);
      }
    }

    return true;
  }

  // Phase 1: Affecter les élèves avec correspondance matière
  const elevesRestants: Eleve[] = [];

  for (const eleve of elevesOrdered) {
    if (alreadyAssigned.has(eleve.id!)) continue; // Déjà affecté comme binôme

    let bestMatch: { juryId: string; score: ScoreEleveJury } | null = null;
    const groupMembers = eleve.groupeOralId
      ? (groupeIndex.get(eleve.groupeOralId) || []).filter(e => !alreadyAssigned.has(e.id!))
      : [];
    const slotsNeeded = groupMembers.length > 0 ? groupMembers.length : 1;

    // Chercher d'abord un jury avec correspondance matière
    for (const [juryId, ctx] of juryContexts) {
      if (ctx.capaciteRestante < slotsNeeded) continue;

      const scoreResult = scoreEleveJury(eleve, ctx, scenario, scoringOptions);

      if (scoreResult.matiereMatch) {
        if (!bestMatch || scoreResult.score > bestMatch.score.score) {
          bestMatch = { juryId, score: scoreResult };
        }
      }
    }

    if (bestMatch) {
      const ctx = juryContexts.get(bestMatch.juryId)!;
      affectEleve(eleve, bestMatch.juryId, bestMatch.score, ctx);

      if (!bestMatch.score.matiereMatch && eleve.matieresOral?.length) {
        // ne devrait pas arriver en phase 1, mais par sécurité
      }
    } else {
      // Garder pour la phase 2
      elevesRestants.push(eleve);
    }
  }

  // Phase 2: Affecter les élèves restants (sans correspondance matière)
  for (const eleve of elevesRestants) {
    if (alreadyAssigned.has(eleve.id!)) continue;

    let bestMatch: { juryId: string; score: ScoreEleveJury } | null = null;
    const groupMembers = eleve.groupeOralId
      ? (groupeIndex.get(eleve.groupeOralId) || []).filter(e => !alreadyAssigned.has(e.id!))
      : [];
    const slotsNeeded = groupMembers.length > 0 ? groupMembers.length : 1;

    for (const [juryId, ctx] of juryContexts) {
      if (ctx.capaciteRestante < slotsNeeded) continue;

      const scoreResult = scoreEleveJury(eleve, ctx, scenario, scoringOptions);

      if (!bestMatch || scoreResult.score > bestMatch.score.score) {
        bestMatch = { juryId, score: scoreResult };
      }
    }

    if (bestMatch) {
      const ctx = juryContexts.get(bestMatch.juryId)!;
      affectEleve(eleve, bestMatch.juryId, bestMatch.score, ctx);

      if (!bestMatch.score.matiereMatch && eleve.matieresOral?.length) {
        sansMatchMatiere.push(eleve.id!);
      }
    } else {
      nonAffectes.push(eleve.id!);
      alreadyAssigned.add(eleve.id!);
      // Si l'élève a un groupe non encore affecté, marquer tous les membres
      for (const member of groupMembers) {
        if (!alreadyAssigned.has(member.id!)) {
          nonAffectes.push(member.id!);
          alreadyAssigned.add(member.id!);
        }
      }
    }
  }
  
  // Calculer les statistiques par jury
  const statsParJury: Record<string, JuryStats> = {};
  
  juryContexts.forEach((ctx, juryId) => {
    const juryAffectations = affectations.filter(a => a.juryId === juryId);
    const repartitionMatieres: Record<string, number> = {};
    
    juryAffectations.forEach(a => {
      if (a.matiereEleve) {
        repartitionMatieres[a.matiereEleve] = (repartitionMatieres[a.matiereEleve] || 0) + 1;
      }
    });
    
    statsParJury[juryId] = {
      nbElevesAffectes: ctx.chargeActuelle,
      repartitionMatieres,
      tauxRemplissage: Math.round((ctx.chargeActuelle / ctx.jury.capaciteMax) * 100),
      matieresEnseignants: ctx.matieres,
    };
  });
  
  // Scores globaux
  const scoreGlobal = affectations.length > 0
    ? Math.round(affectations.reduce((sum, a) => sum + a.score, 0) / affectations.length)
    : 0;
  
  const nbAvecMatiere = affectations.filter(a => a.matiereMatch).length;
  const tauxMatchMatiere = affectations.length > 0
    ? Math.round((nbAvecMatiere / affectations.length) * 100)
    : 0;
  
  const endTime = performance.now();
  
  if (cfg.verbose) {
    console.log('=== Résultat Oral DNB ===');
    console.log(`Affectations: ${affectations.length}`);
    console.log(`Non affectés: ${nonAffectes.length}`);
    console.log(`Sans match matière: ${sansMatchMatiere.length}`);
    console.log(`Taux match matière: ${tauxMatchMatiere}%`);
    console.log(`Score global: ${scoreGlobal}`);
  }
  
  return {
    affectations,
    nonAffectes,
    sansMatchMatiere,
    statsParJury,
    scoreGlobal,
    tauxMatchMatiere,
    tempsCalculMs: Math.round(endTime - startTime),
  };
}

// ============ AMÉLIORATION LOCALE ============

/**
 * Tente d'améliorer les affectations par échanges entre jurys
 * Objectif: maximiser le nombre de correspondances matière
 */
export function improveOralDnbWithSwaps(
  initialResult: SolverResultDNB,
  eleves: Eleve[],
  enseignants: Enseignant[],
  jurys: Jury[],
  scenario: Scenario,
  maxIterations: number = 100
): SolverResultDNB {
  let currentResult = { ...initialResult, affectations: [...initialResult.affectations] };
  let improved = true;
  let iterations = 0;
  
  // Pré-calculer les options de scoring
  const scoringOptions = getOptionsFromScenario(scenario);
  
  // Reconstruire les contextes
  const juryContexts = initializeJuryContexts(jurys, enseignants);
  
  // Mettre à jour les charges depuis les affectations actuelles
  currentResult.affectations.forEach(aff => {
    const ctx = juryContexts.get(aff.juryId);
    if (ctx) {
      ctx.chargeActuelle++;
      ctx.capaciteRestante--;
    }
  });
  
  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    
    // Chercher des échanges bénéfiques
    // Priorité: transformer un "sans match" en "avec match"
    
    // Pré-indexer les élèves pour éviter N+1 .find()
    const eleveMap = new Map(eleves.map(e => [e.id!, e]));

    for (const affSansMatch of currentResult.affectations.filter(a => !a.matiereMatch)) {
      const eleve = eleveMap.get(affSansMatch.eleveId);
      if (!eleve?.matieresOral?.length) continue;

      // Ne pas swapper les élèves qui font partie d'un groupe (binôme/trinôme)
      // car cela casserait l'affectation groupée au même jury
      if (eleve.groupeOralId) continue;

      // Chercher un jury qui a la matière de l'élève
      for (const [juryId, ctx] of juryContexts) {
        if (juryId === affSansMatch.juryId) continue;

        // Ce jury a-t-il la matière?
        const hasMatiere = eleve.matieresOral.some(m => ctx.matieres.includes(m));
        if (!hasMatiere) continue;

        // Peut-on faire un échange?
        // Trouver un élève SOLO dans ce jury qui n'a pas besoin de cette matière
        const eleveAEchanger = currentResult.affectations.find(a => {
          if (a.juryId !== juryId || a.matiereMatch || a.eleveId === affSansMatch.eleveId) return false;
          // Exclure les membres de groupes du swap
          const candidat = eleveMap.get(a.eleveId);
          return !candidat?.groupeOralId;
        });
        
        if (eleveAEchanger) {
          // Faire l'échange
          const idx1 = currentResult.affectations.findIndex(a => a.eleveId === affSansMatch.eleveId);
          const idx2 = currentResult.affectations.findIndex(a => a.eleveId === eleveAEchanger.eleveId);
          
          // Recalculer les scores
          const eleve1 = eleveMap.get(affSansMatch.eleveId);
          const eleve2 = eleveMap.get(eleveAEchanger.eleveId);
          if (!eleve1 || !eleve2) continue;

          const newCtx1 = juryContexts.get(juryId);
          const newCtx2 = juryContexts.get(affSansMatch.juryId);
          if (!newCtx1 || !newCtx2) continue;
          
          const newScore1 = scoreEleveJury(eleve1, newCtx1, scenario, scoringOptions);
          const newScore2 = scoreEleveJury(eleve2, newCtx2, scenario, scoringOptions);
          
          // L'échange est bénéfique si on gagne au moins un match matière
          const oldMatchCount = (affSansMatch.matiereMatch ? 1 : 0) + (eleveAEchanger.matiereMatch ? 1 : 0);
          const newMatchCount = (newScore1.matiereMatch ? 1 : 0) + (newScore2.matiereMatch ? 1 : 0);
          
          if (newMatchCount > oldMatchCount) {
            // Appliquer l'échange
            currentResult.affectations[idx1] = {
              eleveId: eleve1.id!,
              juryId: juryId,
              matiereEleve: newScore1.matiereEleve,
              matieresJury: newCtx1.matieres,
              matiereMatch: newScore1.matiereMatch,
              score: newScore1.score,
              scoreDetail: newScore1.scoreDetail,
              explication: generateExplication(eleve1, newCtx1, newScore1),
            };
            
            currentResult.affectations[idx2] = {
              eleveId: eleve2.id!,
              juryId: affSansMatch.juryId,
              matiereEleve: newScore2.matiereEleve,
              matieresJury: newCtx2.matieres,
              matiereMatch: newScore2.matiereMatch,
              score: newScore2.score,
              scoreDetail: newScore2.scoreDetail,
              explication: generateExplication(eleve2, newCtx2, newScore2),
            };
            
            improved = true;
            break;
          }
        }
      }
      
      if (improved) break;
    }
  }
  
  // Recalculer les stats
  const nbAvecMatiere = currentResult.affectations.filter(a => a.matiereMatch).length;
  currentResult.tauxMatchMatiere = currentResult.affectations.length > 0
    ? Math.round((nbAvecMatiere / currentResult.affectations.length) * 100)
    : 0;
  
  currentResult.sansMatchMatiere = currentResult.affectations
    .filter(a => !a.matiereMatch)
    .map(a => a.eleveId);
  
  currentResult.scoreGlobal = currentResult.affectations.length > 0
    ? Math.round(currentResult.affectations.reduce((sum, a) => sum + a.score, 0) / currentResult.affectations.length)
    : 0;
  
  return currentResult;
}

// ============ EXPORT PRINCIPAL ============

/**
 * Résout le matching Oral DNB complet avec amélioration
 */
export function solveOralDnbComplete(
  eleves: Eleve[],
  enseignants: Enseignant[],
  jurys: Jury[],
  scenario: Scenario,
  config: Partial<SolverDnbConfig> = {}
): SolverResultDNB {
  // Phase 1: Greedy
  const initialResult = solveOralDnb(eleves, enseignants, jurys, scenario, config);
  
  // Phase 2: Amélioration par échanges
  const improvedResult = improveOralDnbWithSwaps(
    initialResult,
    eleves,
    enseignants,
    jurys,
    scenario,
    100
  );
  
  return improvedResult;
}
