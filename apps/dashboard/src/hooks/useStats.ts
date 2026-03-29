import { useMemo } from 'react';
import { computeMaxTotal, computeMaxByCategory } from '@groupit/shared';
import type { FinalScoreRow, CriteriaConfig } from '@groupit/shared';
import type { JuryWithEleves } from './useSessionData';

export interface DureeStats {
  moyenne: number;
  min: number;
  max: number;
  count: number;
  nbDepassement: number;
}

export interface GlobalStats {
  totalEleves: number;
  totalEvalues: number;
  totalAbsents: number;
  totalEnAttente: number;
  pourcentageEvalue: number;
  moyenne: number;
  mediane: number;
  ecartType: number;
  noteMin: number;
  noteMax: number;
  nbSousMoyenne: number;
  nbMoyenne: number;
  nbBien: number;
  nbTresBien: number;
  pourcentageSousMoyenne: number;
  moyenneParCategorie: Record<string, number>;
  // Backward compat
  moyenneOral: number;
  moyenneSujet: number;
  duree: DureeStats;
}

export interface JuryStats {
  juryName: string;
  salle: string | null;
  totalEleves: number;
  evalues: number;
  moyenne: number;
  connected: boolean;
}

export interface ParcoursStats {
  parcours: string;
  count: number;
  moyenne: number;
  nbSousMoyenne: number;
}

export interface CritereStats {
  id: string;
  label: string;
  category: string;
  max: number;
  moyenne: number;
  pourcentageMoyen: number;
}

export interface DistributionBucket {
  range: string;
  count: number;
}

export interface DureeDistributionBucket {
  range: string;
  count: number;
}

export interface DureeNotePoint {
  displayName: string;
  duree: number;
  dureeMin: string;
  note: number;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stdDev(arr: number[], avg: number): number {
  if (arr.length === 0) return 0;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// Mapping legacy colonnes pour fallback
const LEGACY_SCORE_KEYS: Record<string, keyof FinalScoreRow> = {
  expression: 'score_expression',
  diaporama: 'score_diaporama',
  reactivite: 'score_reactivite',
  contenu: 'score_contenu',
  structure: 'score_structure',
  engagement: 'score_engagement',
};

/** Extrait la valeur d'un critere depuis un FinalScoreRow (JSONB prioritaire, fallback legacy) */
function getScoreValue(fs: FinalScoreRow, criterionId: string): number | null {
  // JSONB d'abord
  if (fs.scores && typeof fs.scores === 'object' && criterionId in fs.scores) {
    return (fs.scores as Record<string, number>)[criterionId]!;
  }
  // Fallback colonnes legacy
  const legacyKey = LEGACY_SCORE_KEYS[criterionId];
  if (legacyKey) {
    const val = fs[legacyKey];
    return typeof val === 'number' ? val : null;
  }
  return null;
}

/** Extrait le total d'une categorie depuis un FinalScoreRow */
function getCategoryTotal(fs: FinalScoreRow, categoryId: string, config: CriteriaConfig): number {
  const catCriteria = config.criteria.filter(c => c.categoryId === categoryId);
  return catCriteria.reduce((sum, c) => {
    const v = getScoreValue(fs, c.id);
    return sum + (v ?? 0);
  }, 0);
}

export function useStats(jurys: JuryWithEleves[], allFinalScores: FinalScoreRow[], criteriaConfig: CriteriaConfig) {
  const maxTotal = computeMaxTotal(criteriaConfig);
  const maxByCategory = computeMaxByCategory(criteriaConfig);

  const globalStats = useMemo((): GlobalStats => {
    const allEleves = jurys.flatMap(j => j.eleves);
    const totalEleves = allEleves.length;
    const totalAbsents = allEleves.filter(e => e.status === 'absent').length;
    const scores = allFinalScores.map(f => f.total);
    const totalEvalues = scores.length;
    const totalEnAttente = totalEleves - totalEvalues - totalAbsents;

    const durations = allEleves
      .map(e => e.duree_passage)
      .filter((d): d is number => d != null && d > 0);
    const TIMER_DEFAULT = 300;
    const dureeStats: DureeStats = durations.length > 0
      ? {
          moyenne: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          min: Math.min(...durations),
          max: Math.max(...durations),
          count: durations.length,
          nbDepassement: durations.filter(d => d > TIMER_DEFAULT).length,
        }
      : { moyenne: 0, min: 0, max: 0, count: 0, nbDepassement: 0 };
    const pourcentageEvalue = totalEleves > 0 ? Math.round((totalEvalues / totalEleves) * 100) : 0;

    if (scores.length === 0) {
      return {
        totalEleves, totalEvalues, totalAbsents, totalEnAttente, pourcentageEvalue,
        moyenne: 0, mediane: 0, ecartType: 0, noteMin: 0, noteMax: 0,
        nbSousMoyenne: 0, nbMoyenne: 0, nbBien: 0, nbTresBien: 0,
        pourcentageSousMoyenne: 0,
        moyenneParCategorie: {},
        moyenneOral: 0, moyenneSujet: 0,
        duree: dureeStats,
      };
    }

    const moyenne = scores.reduce((a, b) => a + b, 0) / scores.length;
    const med = median(scores);
    const sd = stdDev(scores, moyenne);
    const noteMin = Math.min(...scores);
    const noteMax = Math.max(...scores);

    // Seuils dynamiques basés sur maxTotal
    const halfMax = maxTotal / 2;
    const pctBien = maxTotal * 0.7;
    const pctTB = maxTotal * 0.8;

    const nbSousMoyenne = scores.filter(s => s < halfMax).length;
    const nbMoyenne = scores.filter(s => s >= halfMax && s < pctBien).length;
    const nbBien = scores.filter(s => s >= pctBien && s < pctTB).length;
    const nbTresBien = scores.filter(s => s >= pctTB).length;

    // Moyennes par categorie
    const moyenneParCategorie: Record<string, number> = {};
    for (const cat of criteriaConfig.categories) {
      const catTotals = allFinalScores.map(fs => getCategoryTotal(fs, cat.id, criteriaConfig));
      moyenneParCategorie[cat.id] = catTotals.length > 0
        ? Math.round((catTotals.reduce((a, b) => a + b, 0) / catTotals.length) * 100) / 100
        : 0;
    }

    return {
      totalEleves, totalEvalues, totalAbsents, totalEnAttente, pourcentageEvalue,
      moyenne: Math.round(moyenne * 100) / 100,
      mediane: Math.round(med * 100) / 100,
      ecartType: Math.round(sd * 100) / 100,
      noteMin, noteMax,
      nbSousMoyenne, nbMoyenne, nbBien, nbTresBien,
      pourcentageSousMoyenne: totalEvalues > 0 ? Math.round((nbSousMoyenne / totalEvalues) * 100) : 0,
      moyenneParCategorie,
      moyenneOral: moyenneParCategorie['oral'] ?? 0,
      moyenneSujet: moyenneParCategorie['sujet'] ?? 0,
      duree: dureeStats,
    };
  }, [jurys, allFinalScores, criteriaConfig, maxTotal]);

  const juryStats = useMemo((): JuryStats[] => {
    return jurys.map(j => {
      const scores = Array.from(j.finalScores.values()).map(f => f.total);
      const moyenne = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        juryName: j.jury_name,
        salle: j.salle,
        totalEleves: j.eleves.length,
        evalues: scores.length,
        moyenne: Math.round(moyenne * 100) / 100,
        connected: j.connected,
      };
    });
  }, [jurys]);

  const parcoursStats = useMemo((): ParcoursStats[] => {
    const halfMax = maxTotal / 2;
    const map = new Map<string, { scores: number[]; count: number }>();

    for (const jury of jurys) {
      for (const eleve of jury.eleves) {
        const parcours = eleve.parcours || 'Non d\u00e9fini';
        if (!map.has(parcours)) map.set(parcours, { scores: [], count: 0 });
        const entry = map.get(parcours)!;
        entry.count++;

        const fs = jury.finalScores.get(eleve.id);
        if (fs) entry.scores.push(fs.total);
      }
    }

    return Array.from(map.entries()).map(([parcours, data]) => ({
      parcours,
      count: data.count,
      moyenne: data.scores.length > 0
        ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100
        : 0,
      nbSousMoyenne: data.scores.filter(s => s < halfMax).length,
    })).sort((a, b) => b.count - a.count);
  }, [jurys, maxTotal]);

  const critereStats = useMemo((): CritereStats[] => {
    if (allFinalScores.length === 0) return [];

    return criteriaConfig.criteria.map(c => {
      const values = allFinalScores
        .map(fs => getScoreValue(fs, c.id))
        .filter((v): v is number => v !== null);
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return {
        id: c.id,
        label: c.label,
        category: c.categoryId,
        max: c.max,
        moyenne: Math.round(avg * 100) / 100,
        pourcentageMoyen: c.max > 0 ? Math.round((avg / c.max) * 100) : 0,
      };
    });
  }, [allFinalScores, criteriaConfig]);

  const distribution = useMemo((): DistributionBucket[] => {
    // Construire des buckets dynamiques en fonction du maxTotal
    const step = Math.max(1, Math.round(maxTotal / 8));
    const buckets: { range: string; min: number; max: number; count: number }[] = [];
    for (let i = 0; i < maxTotal; i += step) {
      const end = Math.min(i + step - 1, maxTotal);
      buckets.push({ range: i === end ? `${i}` : `${i}-${end}`, min: i, max: end, count: 0 });
    }

    for (const fs of allFinalScores) {
      const bucket = buckets.find(b => fs.total >= b.min && fs.total <= b.max);
      if (bucket) bucket.count++;
    }

    return buckets.map(b => ({ range: b.range, count: b.count }));
  }, [allFinalScores, maxTotal]);

  const dureeDistribution = useMemo((): DureeDistributionBucket[] => {
    const allEleves = jurys.flatMap(j => j.eleves);
    const durations = allEleves
      .map(e => e.duree_passage)
      .filter((d): d is number => d != null && d > 0);

    if (durations.length === 0) return [];

    const buckets = [
      { range: '< 3 min', min: 0, max: 179, count: 0 },
      { range: '3-4 min', min: 180, max: 239, count: 0 },
      { range: '4-5 min', min: 240, max: 299, count: 0 },
      { range: '5-6 min', min: 300, max: 359, count: 0 },
      { range: '6-7 min', min: 360, max: 419, count: 0 },
      { range: '7-8 min', min: 420, max: 479, count: 0 },
      { range: '> 8 min', min: 480, max: Infinity, count: 0 },
    ];

    for (const d of durations) {
      const bucket = buckets.find(b => d >= b.min && d <= b.max);
      if (bucket) bucket.count++;
    }

    return buckets.map(b => ({ range: b.range, count: b.count }));
  }, [jurys]);

  const dureeNoteData = useMemo((): DureeNotePoint[] => {
    const points: DureeNotePoint[] = [];
    for (const jury of jurys) {
      for (const eleve of jury.eleves) {
        const d = eleve.duree_passage;
        const fs = jury.finalScores.get(eleve.id);
        if (d != null && d > 0 && fs) {
          const m = Math.floor(d / 60);
          const s = d % 60;
          points.push({
            displayName: eleve.display_name,
            duree: d,
            dureeMin: `${m}:${String(s).padStart(2, '0')}`,
            note: fs.total,
          });
        }
      }
    }
    return points;
  }, [jurys]);

  return { globalStats, juryStats, parcoursStats, critereStats, distribution, dureeDistribution, dureeNoteData, maxTotal, maxByCategory };
}
