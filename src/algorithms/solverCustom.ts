// ============================================================
// ALGORITHME - SOLVEUR MODE PERSONNALISE
// Crée des groupes d'��lèves avec critères configurables
// Réutilise scoring.ts et balancing.ts
// ============================================================

import type { Eleve, Enseignant, Scenario, Jury } from '../domain/models';
import type { CustomModeConfig } from '../stores/uiStore';

// ============ TYPES ============

export interface CustomGroup {
  id: string;
  nom: string;
  eleveIds: string[];
  enseignantIds: string[];
  capaciteMax: number;
}

export interface CustomSolverResult {
  groups: CustomGroup[];
  affectations: CustomAffectation[];
  nonAffectes: string[];
  scoreGlobal: number;
  tempsCalculMs: number;
}

export interface CustomAffectation {
  eleveId: string;
  juryId: string;
  enseignantId: string;
  score: number;
  scoreDetail: Record<string, number>;
  explication: string;
}

// ============ SCORING HELPERS ============

function extractNiveau(classe: string): string {
  return classe.replace(/[^0-9]/g, '')[0] + 'e';
}

function getEleveSexe(eleve: Eleve): 'M' | 'F' | null {
  if (eleve.sexe === 'M' || eleve.sexe === 'F') return eleve.sexe;
  return null;
}

function getEleveOptions(eleve: Eleve): string[] {
  return eleve.options || [];
}

/** Score de parité pour un groupe */
function scoreParity(group: Eleve[], priority: string): number {
  if (priority === 'off') return 0;
  const males = group.filter(e => getEleveSexe(e) === 'M').length;
  const females = group.filter(e => getEleveSexe(e) === 'F').length;
  const total = males + females;
  if (total === 0) return 100;
  const ratio = Math.min(males, females) / total;
  // Ratio parfait = 0.5, score = 100
  const rawScore = ratio * 200; // 0 to 100
  const weight = priority === 'low' ? 0.3 : priority === 'normal' ? 0.6 : priority === 'high' ? 0.9 : 1.0;
  return rawScore * weight;
}

/** Score enseignant a l'élève en classe */
function scoreEnseignantAEleve(
  group: Eleve[],
  enseignants: Enseignant[],
  mode: 'off' | 'prefer' | 'avoid'
): number {
  if (mode === 'off' || enseignants.length === 0) return 0;
  let matches = 0;
  let total = 0;
  for (const eleve of group) {
    for (const ens of enseignants) {
      total++;
      if (ens.classesEnCharge.includes(eleve.classe)) {
        matches++;
      }
    }
  }
  if (total === 0) return 50;
  const ratio = matches / total;
  if (mode === 'prefer') return ratio * 100;
  if (mode === 'avoid') return (1 - ratio) * 100;
  return 50;
}

/** Score même classe dans le groupe */
function scoreMemeClasse(
  group: Eleve[],
  mode: 'off' | 'prefer' | 'avoid'
): number {
  if (mode === 'off' || group.length <= 1) return 0;
  // Count class diversity
  const classes = new Set(group.map(e => e.classe));
  const diversityRatio = classes.size / group.length; // 1/n to 1
  if (mode === 'prefer') {
    // Low diversity = good (same class)
    return (1 - diversityRatio) * 100;
  }
  // avoid = high diversity is good
  return diversityRatio * 100;
}

/** Score LV (based on options containing "Allemand", "Espagnol", etc.) */
function scoreLV(
  group: Eleve[],
  mode: 'off' | 'same' | 'mixed'
): number {
  if (mode === 'off' || group.length <= 1) return 0;
  const lvKeywords = ['Allemand', 'Anglais', 'Espagnol', 'Italien', 'Chinois', 'Arabe', 'Portugais', 'Russe'];
  const lvSets = group.map(e => {
    const options = getEleveOptions(e);
    return options.filter(o => lvKeywords.some(kw => o.toLowerCase().includes(kw.toLowerCase())));
  });
  // Find most common LV pattern
  const lvCounts = new Map<string, number>();
  for (const lvs of lvSets) {
    const key = lvs.sort().join('|');
    lvCounts.set(key, (lvCounts.get(key) || 0) + 1);
  }
  const maxCount = Math.max(...lvCounts.values(), 1);
  const homogeneity = maxCount / group.length;
  if (mode === 'same') return homogeneity * 100;
  return (1 - homogeneity) * 100;
}

/** Score un groupe complet */
function scoreGroup(
  groupEleves: Eleve[],
  groupEnseignants: Enseignant[],
  config: CustomModeConfig
): { score: number; detail: Record<string, number> } {
  const detail: Record<string, number> = {};
  let totalWeight = 0;
  let weightedSum = 0;

  // Parite
  if (config.critereParity !== 'off') {
    const s = scoreParity(groupEleves, config.critereParity);
    detail.parite = Math.round(s);
    const w = config.critereParity === 'required' ? 3 : config.critereParity === 'high' ? 2 : config.critereParity === 'normal' ? 1.5 : 1;
    weightedSum += s * w;
    totalWeight += w;
  }

  // Enseignant a l'eleve
  if (config.critereEnseignantAEleve !== 'off' && config.useAdultes) {
    const s = scoreEnseignantAEleve(groupEleves, groupEnseignants, config.critereEnseignantAEleve);
    detail.enseignantEleve = Math.round(s);
    weightedSum += s * 1.5;
    totalWeight += 1.5;
  }

  // Meme classe
  if (config.critereMemeClasse !== 'off') {
    const s = scoreMemeClasse(groupEleves, config.critereMemeClasse);
    detail.memeClasse = Math.round(s);
    weightedSum += s * 1;
    totalWeight += 1;
  }

  // LV
  if (config.critereLV !== 'off') {
    const s = scoreLV(groupEleves, config.critereLV);
    detail.lv = Math.round(s);
    weightedSum += s * 1;
    totalWeight += 1;
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  return { score, detail };
}

// ============ SOLVEUR PRINCIPAL ============

/**
 * Crée les groupes et affecte les élèves + enseignants
 */
export function solveCustom(
  eleves: Eleve[],
  enseignants: Enseignant[],
  scenario: Scenario,
  config: CustomModeConfig
): CustomSolverResult {
  const startTime = performance.now();

  // Filter to selected eleves/enseignants
  const selectedEleves = eleves.filter(e => config.selectedEleveIds.includes(e.id));
  const selectedEnseignants = config.useAdultes
    ? enseignants.filter(e => config.selectedEnseignantIds.includes(e.id!))
    : [];

  const nbEleves = selectedEleves.length;
  if (nbEleves === 0) {
    return { groups: [], affectations: [], nonAffectes: [], scoreGlobal: 0, tempsCalculMs: 0 };
  }

  // Calculate number of groups
  const targetSize = config.tailleGroupeFixe
    ? config.tailleGroupeMin
    : Math.round((config.tailleGroupeMin + config.tailleGroupeMax) / 2);
  const nbGroupes = Math.max(1, Math.round(nbEleves / targetSize));
  const baseSize = Math.floor(nbEleves / nbGroupes);
  const remainder = nbEleves - baseSize * nbGroupes;

  // Create empty groups
  const groups: CustomGroup[] = [];
  for (let i = 0; i < nbGroupes; i++) {
    groups.push({
      id: `custom-g-${i + 1}`,
      nom: `Groupe ${i + 1}`,
      eleveIds: [],
      enseignantIds: [],
      capaciteMax: i < remainder ? baseSize + 1 : baseSize,
    });
  }

  // === Phase 1: Distribute enseignants across groups ===
  if (selectedEnseignants.length > 0) {
    // Volume horaire weighting
    if (config.critereVolumeHoraire) {
      // Sort enseignants by total hours desc, assign to groups round-robin
      const sorted = [...selectedEnseignants].sort((a, b) => {
        const hoursA = a.heuresParNiveau ? Object.values(a.heuresParNiveau).reduce((s, v) => s + v, 0) : 0;
        const hoursB = b.heuresParNiveau ? Object.values(b.heuresParNiveau).reduce((s, v) => s + v, 0) : 0;
        return hoursB - hoursA;
      });
      for (let i = 0; i < sorted.length; i++) {
        groups[i % nbGroupes].enseignantIds.push(sorted[i].id!);
      }
    } else {
      // Simple round-robin
      for (let i = 0; i < selectedEnseignants.length; i++) {
        groups[i % nbGroupes].enseignantIds.push(selectedEnseignants[i].id!);
      }
    }
  }

  // === Phase 2: Sort eleves by difficulty (most constrained first) ===
  // Shuffle first for randomness, then sort by constraints
  const shuffled = [...selectedEleves].sort(() => Math.random() - 0.5);

  // Pre-index enseignants by group
  const enseignantMap = new Map(enseignants.map(e => [e.id, e]));
  const groupEnseignants = groups.map(g =>
    g.enseignantIds.map(id => enseignantMap.get(id)).filter(Boolean) as Enseignant[]
  );

  // === Phase 3: Greedy assignment ===
  // For each student, find the best group
  for (const eleve of shuffled) {
    let bestGroupIdx = 0;
    let bestScore = -Infinity;

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      // Check capacity
      if (g.eleveIds.length >= g.capaciteMax) continue;

      // Score this placement
      const testEleves = [...g.eleveIds.map(id => selectedEleves.find(e => e.id === id)!), eleve];
      const { score } = scoreGroup(testEleves, groupEnseignants[gi], config);

      // Bonus for groups with fewer students (balance)
      const balanceBonus = (g.capaciteMax - g.eleveIds.length) * 2;
      const totalScore = score + balanceBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestGroupIdx = gi;
      }
    }

    groups[bestGroupIdx].eleveIds.push(eleve.id);
  }

  // === Phase 4: Local improvement (swap pairs between groups) ===
  const MAX_SWAPS = 200;
  let swapCount = 0;
  let improved = true;

  while (improved && swapCount < MAX_SWAPS) {
    improved = false;
    for (let gi = 0; gi < groups.length && !improved; gi++) {
      for (let gj = gi + 1; gj < groups.length && !improved; gj++) {
        const gA = groups[gi];
        const gB = groups[gj];

        for (let ai = 0; ai < gA.eleveIds.length && !improved; ai++) {
          for (let bi = 0; bi < gB.eleveIds.length && !improved; bi++) {
            // Try swapping eleve ai from group gi with eleve bi from group gj
            const eleveA = selectedEleves.find(e => e.id === gA.eleveIds[ai])!;
            const eleveB = selectedEleves.find(e => e.id === gB.eleveIds[bi])!;

            // Current scores
            const currElevesA = gA.eleveIds.map(id => selectedEleves.find(e => e.id === id)!);
            const currElevesB = gB.eleveIds.map(id => selectedEleves.find(e => e.id === id)!);
            const currScoreA = scoreGroup(currElevesA, groupEnseignants[gi], config).score;
            const currScoreB = scoreGroup(currElevesB, groupEnseignants[gj], config).score;

            // Swap
            const newElevesA = currElevesA.map(e => e.id === eleveA.id ? eleveB : e);
            const newElevesB = currElevesB.map(e => e.id === eleveB.id ? eleveA : e);
            const newScoreA = scoreGroup(newElevesA, groupEnseignants[gi], config).score;
            const newScoreB = scoreGroup(newElevesB, groupEnseignants[gj], config).score;

            if (newScoreA + newScoreB > currScoreA + currScoreB + 1) {
              // Apply swap
              gA.eleveIds[ai] = eleveB.id;
              gB.eleveIds[bi] = eleveA.id;
              improved = true;
              swapCount++;
            }
          }
        }
      }
    }
  }

  // === Phase 5: Generate affectations ===
  const affectations: CustomAffectation[] = [];
  for (const g of groups) {
    const gEleves = g.eleveIds.map(id => selectedEleves.find(e => e.id === id)!);
    const gEns = g.enseignantIds.map(id => enseignantMap.get(id)).filter(Boolean) as Enseignant[];
    const { score, detail } = scoreGroup(gEleves, gEns, config);

    for (const eleveId of g.eleveIds) {
      affectations.push({
        eleveId,
        juryId: g.id,
        enseignantId: g.enseignantIds[0] || '',
        score,
        scoreDetail: detail,
        explication: `Affecte au ${g.nom} (score: ${score})`,
      });
    }
  }

  const nonAffectes = selectedEleves
    .filter(e => !groups.some(g => g.eleveIds.includes(e.id)))
    .map(e => e.id);

  const scoreGlobal = affectations.length > 0
    ? Math.round(affectations.reduce((s, a) => s + a.score, 0) / affectations.length)
    : 0;

  return {
    groups,
    affectations,
    nonAffectes,
    scoreGlobal,
    tempsCalculMs: Math.round(performance.now() - startTime),
  };
}
