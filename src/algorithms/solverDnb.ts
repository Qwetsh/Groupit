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

// ============ TYPES ============

interface JuryContext {
  jury: Jury;
  enseignants: Enseignant[];
  matieres: string[]; // Matières couvertes par les enseignants du jury
  capaciteRestante: number;
  chargeActuelle: number;
  poidsPedagogiqueMoyen: number; // Moyenne pondérée des heures hebdo des matières
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
function getJuryMatieres(jury: Jury, enseignants: Enseignant[]): string[] {
  const matieres = new Set<string>();
  
  jury.enseignantIds.forEach(ensId => {
    const ens = enseignants.find(e => e.id === ensId);
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
  
  jurys.forEach(jury => {
    const juryEnseignants = enseignants.filter(e => jury.enseignantIds.includes(e.id!));
    const matieres = getJuryMatieres(jury, enseignants);
    
    contexts.set(jury.id!, {
      jury,
      enseignants: juryEnseignants,
      matieres,
      capaciteRestante: jury.capaciteMax,
      chargeActuelle: 0,
      poidsPedagogiqueMoyen: getJuryPoidsPedagogique(matieres),
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
  
  // Normaliser les poids pour avoir un total de 100
  const poidsElevesEnCours = opts.poidsElevesEnCours ?? 0;
  const totalPoids = opts.poidsMatiereMatch + opts.poidsEquilibrage + opts.poidsMixite + opts.poidsCapacite + poidsElevesEnCours;
  const norm = totalPoids > 0 ? 100 / totalPoids : 1;

  const wMatiere = opts.poidsMatiereMatch * norm / 100;
  const wEquilibrage = opts.poidsEquilibrage * norm / 100;
  const wMixite = opts.poidsMixite * norm / 100;
  const wCapacite = opts.poidsCapacite * norm / 100;
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
    // Note: Nécessiterait de tracker le ratio actuel - simplifié ici
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

  // 6. Score final pondéré
  const scoreFinal = Math.round(
    scoreMatiereBase * wMatiere +
    scoreEquilibrage * wEquilibrage +
    scoreMixite * wMixite +
    scoreCapacite * wCapacite +
    scoreElevesEnCours * wElevesEnCours
  );
  
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
  
  // Phase 1: Affecter les élèves avec correspondance matière
  const elevesRestants: Eleve[] = [];
  
  for (const eleve of elevesOrdered) {
    let bestMatch: { juryId: string; score: ScoreEleveJury } | null = null;
    
    // Chercher d'abord un jury avec correspondance matière
    for (const [juryId, ctx] of juryContexts) {
      if (ctx.capaciteRestante <= 0) continue;
      
      const scoreResult = scoreEleveJury(eleve, ctx, scenario, scoringOptions);
      
      if (scoreResult.matiereMatch) {
        if (!bestMatch || scoreResult.score > bestMatch.score.score) {
          bestMatch = { juryId, score: scoreResult };
        }
      }
    }
    
    if (bestMatch) {
      // Affectation avec correspondance matière
      const ctx = juryContexts.get(bestMatch.juryId)!;
      
      affectations.push({
        eleveId: eleve.id!,
        juryId: bestMatch.juryId,
        matiereEleve: bestMatch.score.matiereEleve,
        matieresJury: ctx.matieres,
        matiereMatch: true,
        score: bestMatch.score.score,
        scoreDetail: bestMatch.score.scoreDetail,
        explication: generateExplication(eleve, ctx, bestMatch.score),
      });
      
      // Mettre à jour la capacité
      ctx.capaciteRestante--;
      ctx.chargeActuelle++;
    } else {
      // Garder pour la phase 2
      elevesRestants.push(eleve);
    }
  }
  
  // Phase 2: Affecter les élèves restants (sans correspondance matière)
  for (const eleve of elevesRestants) {
    let bestMatch: { juryId: string; score: ScoreEleveJury } | null = null;
    
    for (const [juryId, ctx] of juryContexts) {
      if (ctx.capaciteRestante <= 0) continue;
      
      const scoreResult = scoreEleveJury(eleve, ctx, scenario, scoringOptions);
      
      if (!bestMatch || scoreResult.score > bestMatch.score.score) {
        bestMatch = { juryId, score: scoreResult };
      }
    }
    
    if (bestMatch) {
      const ctx = juryContexts.get(bestMatch.juryId)!;
      
      affectations.push({
        eleveId: eleve.id!,
        juryId: bestMatch.juryId,
        matiereEleve: bestMatch.score.matiereEleve,
        matieresJury: ctx.matieres,
        matiereMatch: bestMatch.score.matiereMatch,
        score: bestMatch.score.score,
        scoreDetail: bestMatch.score.scoreDetail,
        explication: generateExplication(eleve, ctx, bestMatch.score),
      });
      
      ctx.capaciteRestante--;
      ctx.chargeActuelle++;
      
      if (!bestMatch.score.matiereMatch && eleve.matieresOral?.length) {
        sansMatchMatiere.push(eleve.id!);
      }
    } else {
      nonAffectes.push(eleve.id!);
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
  let currentResult = { ...initialResult };
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
    
    for (const affSansMatch of currentResult.affectations.filter(a => !a.matiereMatch)) {
      const eleve = eleves.find(e => e.id === affSansMatch.eleveId);
      if (!eleve?.matieresOral?.length) continue;
      
      // Chercher un jury qui a la matière de l'élève
      for (const [juryId, ctx] of juryContexts) {
        if (juryId === affSansMatch.juryId) continue;
        
        // Ce jury a-t-il la matière?
        const hasMatiere = eleve.matieresOral.some(m => ctx.matieres.includes(m));
        if (!hasMatiere) continue;
        
        // Peut-on faire un échange?
        // Trouver un élève dans ce jury qui n'a pas besoin de cette matière
        const eleveAEchanger = currentResult.affectations.find(a => 
          a.juryId === juryId && 
          !a.matiereMatch &&
          a.eleveId !== affSansMatch.eleveId
        );
        
        if (eleveAEchanger) {
          // Faire l'échange
          const idx1 = currentResult.affectations.findIndex(a => a.eleveId === affSansMatch.eleveId);
          const idx2 = currentResult.affectations.findIndex(a => a.eleveId === eleveAEchanger.eleveId);
          
          // Recalculer les scores
          const eleve1 = eleves.find(e => e.id === affSansMatch.eleveId)!;
          const eleve2 = eleves.find(e => e.id === eleveAEchanger.eleveId)!;
          
          const newCtx1 = juryContexts.get(juryId)!;
          const newCtx2 = juryContexts.get(affSansMatch.juryId)!;
          
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
