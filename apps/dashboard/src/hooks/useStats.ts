import { useMemo } from 'react';
import { CRITERIA, MAX_TOTAL } from '@groupit/shared';
import type { FinalScoreRow } from '@groupit/shared';
import type { JuryWithEleves } from './useSessionData';

export interface DureeStats {
  moyenne: number;  // en secondes
  min: number;
  max: number;
  count: number;
  nbDepassement: number;  // élèves ayant dépassé le temps alloué
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
  nbSousMoyenne: number;     // < 10
  nbMoyenne: number;          // 10-13.9
  nbBien: number;             // 14-15.9
  nbTresBien: number;         // 16-20
  pourcentageSousMoyenne: number;
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
  duree: number;     // en secondes
  dureeMin: string;   // formaté "M:SS"
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

export function useStats(jurys: JuryWithEleves[], allFinalScores: FinalScoreRow[]) {
  const globalStats = useMemo((): GlobalStats => {
    const allEleves = jurys.flatMap(j => j.eleves);
    const totalEleves = allEleves.length;
    const totalAbsents = allEleves.filter(e => e.status === 'absent').length;
    const scores = allFinalScores.map(f => f.total);
    const totalEvalues = scores.length;
    const totalEnAttente = totalEleves - totalEvalues - totalAbsents;

    // Stats de durée
    const durations = allEleves
      .map(e => e.duree_passage)
      .filter((d): d is number => d != null && d > 0);
    const TIMER_DEFAULT = 300; // 5min individuel
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
        pourcentageSousMoyenne: 0, moyenneOral: 0, moyenneSujet: 0,
        duree: dureeStats,
      };
    }

    const moyenne = scores.reduce((a, b) => a + b, 0) / scores.length;
    const med = median(scores);
    const sd = stdDev(scores, moyenne);
    const noteMin = Math.min(...scores);
    const noteMax = Math.max(...scores);

    const nbSousMoyenne = scores.filter(s => s < 10).length;
    const nbMoyenne = scores.filter(s => s >= 10 && s < 14).length;
    const nbBien = scores.filter(s => s >= 14 && s < 16).length;
    const nbTresBien = scores.filter(s => s >= 16).length;

    const moyenneOral = allFinalScores.reduce((s, f) => s + f.total_oral, 0) / allFinalScores.length;
    const moyenneSujet = allFinalScores.reduce((s, f) => s + f.total_sujet, 0) / allFinalScores.length;

    return {
      totalEleves, totalEvalues, totalAbsents, totalEnAttente, pourcentageEvalue,
      moyenne: Math.round(moyenne * 100) / 100,
      mediane: Math.round(med * 100) / 100,
      ecartType: Math.round(sd * 100) / 100,
      noteMin, noteMax,
      nbSousMoyenne, nbMoyenne, nbBien, nbTresBien,
      pourcentageSousMoyenne: totalEvalues > 0 ? Math.round((nbSousMoyenne / totalEvalues) * 100) : 0,
      moyenneOral: Math.round(moyenneOral * 100) / 100,
      moyenneSujet: Math.round(moyenneSujet * 100) / 100,
      duree: dureeStats,
    };
  }, [jurys, allFinalScores]);

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
    const map = new Map<string, { scores: number[]; count: number }>();

    for (const jury of jurys) {
      for (const eleve of jury.eleves) {
        const parcours = eleve.parcours || 'Non défini';
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
      nbSousMoyenne: data.scores.filter(s => s < 10).length,
    })).sort((a, b) => b.count - a.count);
  }, [jurys]);

  const critereStats = useMemo((): CritereStats[] => {
    if (allFinalScores.length === 0) return [];

    const scoreKeys: Record<string, keyof FinalScoreRow> = {
      expression: 'score_expression',
      diaporama: 'score_diaporama',
      reactivite: 'score_reactivite',
      contenu: 'score_contenu',
      structure: 'score_structure',
      engagement: 'score_engagement',
    };

    return CRITERIA.map(c => {
      const key = scoreKeys[c.id]!;
      const values = allFinalScores.map(f => f[key] as number);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        id: c.id,
        label: c.label,
        category: c.category,
        max: c.max,
        moyenne: Math.round(avg * 100) / 100,
        pourcentageMoyen: Math.round((avg / c.max) * 100),
      };
    });
  }, [allFinalScores]);

  const distribution = useMemo((): DistributionBucket[] => {
    const buckets = [
      { range: '0-4', min: 0, max: 4, count: 0 },
      { range: '5-7', min: 5, max: 7, count: 0 },
      { range: '8-9', min: 8, max: 9, count: 0 },
      { range: '10-11', min: 10, max: 11, count: 0 },
      { range: '12-13', min: 12, max: 13, count: 0 },
      { range: '14-15', min: 14, max: 15, count: 0 },
      { range: '16-17', min: 16, max: 17, count: 0 },
      { range: '18-20', min: 18, max: MAX_TOTAL, count: 0 },
    ];

    for (const fs of allFinalScores) {
      const bucket = buckets.find(b => fs.total >= b.min && fs.total <= b.max);
      if (bucket) bucket.count++;
    }

    return buckets.map(b => ({ range: b.range, count: b.count }));
  }, [allFinalScores]);

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

  return { globalStats, juryStats, parcoursStats, critereStats, distribution, dureeDistribution, dureeNoteData };
}
