// ============================================================
// ALGORITHME - CONTRAINTES & SCORING
// ============================================================

import type {
  Eleve,
  Enseignant,
  Scenario,
  AffectationMetadata,
  MetadataSuiviStage,
  MetadataOralDNB,
  ConstraintViolation,
  MatchingResult,
} from '../domain/models';
import { calculateDistance, distanceToScore, communeProximityScore } from './distance';
import { calculateChargeScore, hasAvailableCapacity } from './capacity';

// ============ TYPES ============

export interface ScoringContext {
  scenario: Scenario;
  chargesActuelles: Map<string, number>; // enseignantId -> nb élèves actuels
  capacites: Map<string, number>; // enseignantId -> capacité max
}

export interface ValidationResult {
  isValid: boolean;
  violations: ConstraintViolation[];
}

export interface ScoreResult {
  score: number;
  breakdown: Record<string, number>;
  reasons: string[];
}

// ============ VALIDATION DES CONTRAINTES DURES ============

/**
 * Valide les contraintes dures pour une paire élève-enseignant
 */
export function validateHardConstraints(
  eleve: Eleve,
  enseignant: Enseignant,
  context: ScoringContext,
  metadata?: AffectationMetadata
): ValidationResult {
  const violations: ConstraintViolation[] = [];
  const { scenario, chargesActuelles, capacites } = context;
  const criteres = scenario.parametres.criteres;

  // 1. Vérifier capacité
  const critereCapacite = criteres.find(c => c.id === 'capacite');
  if (critereCapacite?.actif && critereCapacite.estContrainteDure) {
    const capacite = capacites.get(enseignant.id) || 0;
    const chargeActuelle = chargesActuelles.get(enseignant.id) || 0;
    
    if (!hasAvailableCapacity(chargeActuelle, capacite)) {
      violations.push({
        type: 'capacite',
        message: `${enseignant.nom} a atteint sa capacité maximale (${chargeActuelle}/${capacite})`,
        severity: 'error',
      });
    }
  }

  // 2. Vérifier compatibilité matière (oral DNB)
  if (scenario.type === 'oral_dnb') {
    const critereMatiere = criteres.find(c => c.id === 'matiere');
    if (critereMatiere?.actif && critereMatiere.estContrainteDure) {
      const matieresOral = scenario.parametres.matieresOralPossibles || [];
      
      if (!matieresOral.includes(enseignant.matierePrincipale)) {
        violations.push({
          type: 'matiere',
          message: `${enseignant.matierePrincipale} n'est pas dans les matières d'oral autorisées`,
          severity: 'error',
        });
      }

      // Vérifier si l'élève a choisi une matière compatible
      // D'abord essayer avec matieresOral de l'élève, puis avec metadata
      const eleveMatieresOral = eleve.matieresOral || [];
      const metadataOral = metadata as MetadataOralDNB | undefined;
      const matiereChoisie = eleveMatieresOral.length > 0 
        ? eleveMatieresOral 
        : (metadataOral?.matiereOralChoisieParEleve ? [metadataOral.matiereOralChoisieParEleve] : []);
      
      if (matiereChoisie.length > 0) {
        // Vérifier si l'enseignant enseigne au moins une des matières choisies
        const matieresProfesseur = [
          enseignant.matierePrincipale,
          ...(enseignant.matiereSecondaire || [])
        ].filter(Boolean);
        
        const hasMatch = matiereChoisie.some(m => matieresProfesseur.includes(m));
        
        if (!hasMatch) {
          violations.push({
            type: 'matiere_eleve',
            message: `L'élève a choisi ${matiereChoisie.join(', ')}, incompatible avec ${enseignant.matierePrincipale}`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 3. Vérifier contraintes relationnelles
  const critereRelationnel = criteres.find(c => c.id === 'contraintes_relationnelles');
  if (critereRelationnel?.actif && critereRelationnel.estContrainteDure) {
    // Contrainte "ne doit pas être avec" cet enseignant
    const contrainteProf = eleve.contraintes.find(
      c => c.type === 'ne_doit_pas_etre_avec' && c.cibleType === 'enseignant' && c.cibleId === enseignant.id
    );
    
    if (contrainteProf) {
      violations.push({
        type: 'contrainte_relationnelle',
        message: `Contrainte : ${eleve.prenom} ne doit pas être avec ${enseignant.prenom} ${enseignant.nom}${contrainteProf.raison ? ` (${contrainteProf.raison})` : ''}`,
        severity: 'error',
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

// ============ CALCUL DE SCORE ============

/**
 * Calcule le score d'une paire élève-enseignant
 */
export function scorePair(
  eleve: Eleve,
  enseignant: Enseignant,
  context: ScoringContext,
  metadata?: AffectationMetadata
): ScoreResult {
  const breakdown: Record<string, number> = {};
  const reasons: string[] = [];
  const { scenario, chargesActuelles, capacites } = context;
  const criteres = scenario.parametres.criteres.filter(c => c.actif && !c.estContrainteDure);
  
  let totalScore = 0;
  let totalPoids = 0;

  criteres.forEach(critere => {
    let score = 0;
    let reason = '';

    switch (critere.id) {
      case 'distance': {
        if (scenario.type === 'suivi_stage') {
          const metadataStage = metadata as MetadataSuiviStage | undefined;
          
          if (enseignant.lat && enseignant.lon && metadataStage?.latStage && metadataStage?.lonStage) {
            const distance = calculateDistance(
              enseignant.lat,
              enseignant.lon,
              metadataStage.latStage,
              metadataStage.lonStage
            );
            const maxDist = scenario.parametres.distanceMaxKm || 50;
            score = distanceToScore(distance, maxDist);
            reason = `Distance: ${distance.toFixed(1)} km`;
          } else if (enseignant.commune && metadataStage?.adresseStage) {
            score = communeProximityScore(enseignant.commune, metadataStage.adresseStage);
            reason = `Proximité commune: ${score}%`;
          } else {
            score = 50; // Score neutre si pas d'info
            reason = 'Pas d\'info de localisation';
          }
        }
        break;
      }

      case 'capacite': {
        const capacite = capacites.get(enseignant.id) || 0;
        const chargeActuelle = chargesActuelles.get(enseignant.id) || 0;
        score = calculateChargeScore(chargeActuelle, capacite);
        reason = `Charge: ${chargeActuelle}/${capacite}`;
        break;
      }

      case 'equilibrage': {
        // Score basé sur si l'enseignant est sous-chargé
        const capacite = capacites.get(enseignant.id) || 0;
        const chargeActuelle = chargesActuelles.get(enseignant.id) || 0;
        const tauxOccupation = capacite > 0 ? chargeActuelle / capacite : 1;
        
        // Favoriser les enseignants sous-chargés
        if (tauxOccupation < 0.5) {
          score = 100;
          reason = 'Enseignant sous-chargé (prioritaire)';
        } else if (tauxOccupation < 0.8) {
          score = 70;
          reason = 'Charge équilibrée';
        } else {
          score = 30;
          reason = 'Enseignant très chargé';
        }
        break;
      }

      case 'matiere': {
        // Pour oral DNB : score bonus si matière correspond
        if (scenario.type === 'oral_dnb') {
          const eleveMatieresOral = eleve.matieresOral || [];
          const metadataOral = metadata as MetadataOralDNB | undefined;
          const matiereChoisie = eleveMatieresOral.length > 0 
            ? eleveMatieresOral 
            : (metadataOral?.matiereOralChoisieParEleve ? [metadataOral.matiereOralChoisieParEleve] : []);
          
          if (matiereChoisie.length === 0) {
            // Pas de matière choisie = score neutre
            score = 50;
            reason = 'Pas de matière oral définie';
          } else {
            // Vérifier si l'enseignant correspond à une des matières
            const matieresProfesseur = [
              enseignant.matierePrincipale,
              ...(enseignant.matiereSecondaire || [])
            ].filter(Boolean);
            
            const hasMatch = matiereChoisie.some(m => matieresProfesseur.includes(m));
            
            if (hasMatch) {
              score = 100;
              reason = `Matière correspondante: ${enseignant.matierePrincipale}`;
            } else {
              score = 20; // Score bas si matière différente
              reason = `Matière différente (élève: ${matiereChoisie.join('/')}, prof: ${enseignant.matierePrincipale})`;
            }
          }
        }
        break;
      }

      case 'contraintes_relationnelles': {
        // Vérifier contrainte "doit être avec"
        const doitEtreAvec = eleve.contraintes.find(
          c => c.type === 'doit_etre_avec' && c.cibleType === 'enseignant' && c.cibleId === enseignant.id
        );
        
        if (doitEtreAvec) {
          score = 100;
          reason = `Contrainte: doit être avec ${enseignant.prenom}`;
        } else {
          score = 50; // Neutre
        }
        break;
      }

      default:
        score = 50; // Score neutre par défaut
    }

    breakdown[critere.id] = score;
    if (reason) reasons.push(reason);
    
    totalScore += score * critere.poids;
    totalPoids += critere.poids;
  });

  // Score final pondéré (0-100)
  const finalScore = totalPoids > 0 ? Math.round(totalScore / totalPoids) : 50;

  return {
    score: finalScore,
    breakdown,
    reasons,
  };
}

// ============ MATCHING COMPLET ============

/**
 * Évalue toutes les paires possibles élève-enseignant
 */
export function evaluateAllPairs(
  eleves: Eleve[],
  enseignants: Enseignant[],
  context: ScoringContext,
  metadataMap?: Map<string, AffectationMetadata>
): MatchingResult[] {
  const results: MatchingResult[] = [];

  eleves.forEach(eleve => {
    enseignants.forEach(enseignant => {
      const metadata = metadataMap?.get(eleve.id);
      
      // Validation des contraintes dures
      const validation = validateHardConstraints(eleve, enseignant, context, metadata);
      
      // Calcul du score
      const scoreResult = scorePair(eleve, enseignant, context, metadata);

      results.push({
        eleveId: eleve.id,
        enseignantId: enseignant.id,
        score: validation.isValid ? scoreResult.score : -1,
        scoreDetail: scoreResult.breakdown,
        violations: validation.violations,
        isValid: validation.isValid,
      });
    });
  });

  return results;
}

/**
 * Trouve les meilleures correspondances pour un élève
 */
export function findBestMatchesForEleve(
  eleveId: string,
  results: MatchingResult[],
  limit: number = 5
): MatchingResult[] {
  return results
    .filter(r => r.eleveId === eleveId && r.isValid)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
