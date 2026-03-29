import { useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase,
  TIMER_INDIVIDUEL,
  TIMER_COLLECTIF,
  computeTotals,
  computeMaxTotal,
  computeMaxByCategory,
  allCriteriaScored,
  toCriterion,
} from '@groupit/shared';
import type { SessionEleveRow } from '@groupit/shared';
import { Timer } from '../components/Timer';
import { CriterionRow } from '../components/CriterionRow';
import { useCriteriaConfig } from '../context/CriteriaContext';

interface EvaluateScreenProps {
  eleve: SessionEleveRow;
  juryId: string;
  onDone: () => void;
  onBack: () => void;
}

// Retry avec backoff exponentiel (1s, 2s, 4s)
async function withRetry(
  fn: () => PromiseLike<{ error: unknown }>,
  maxRetries = 3
): Promise<{ error: unknown }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fn();
    if (!result.error) return result;
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    } else {
      return result;
    }
  }
  return fn();
}

const STORAGE_KEY = (id: string) => `jury-scores-${id}`;
const TIMER_KEY = (id: string) => `jury-timer-${id}`;

// Mapping legacy colonnes -> criterion id
const LEGACY_SCORE_KEYS: Record<string, string> = {
  expression: 'score_expression',
  diaporama: 'score_diaporama',
  reactivite: 'score_reactivite',
  contenu: 'score_contenu',
  structure: 'score_structure',
  engagement: 'score_engagement',
};

/** Extrait les scores depuis un FinalScoreRow (JSONB ou colonnes legacy) */
function extractScores(fs: Record<string, unknown>): Record<string, number | undefined> {
  // Priorité au JSONB
  if (fs.scores && typeof fs.scores === 'object') {
    const result: Record<string, number | undefined> = {};
    for (const [k, v] of Object.entries(fs.scores as Record<string, number>)) {
      result[k] = v;
    }
    return result;
  }
  // Fallback colonnes legacy
  const result: Record<string, number | undefined> = {};
  for (const [criterionId, colName] of Object.entries(LEGACY_SCORE_KEYS)) {
    const val = fs[colName];
    if (val != null) result[criterionId] = val as number;
  }
  return result;
}

// Couleurs par catégorie (rotatives)
const CATEGORY_STYLES = [
  { bg: '#ebf4ff', border: '#bee3f8', titleColor: '#2b6cb0' },
  { bg: '#f0fff4', border: '#c6f6d5', titleColor: '#276749' },
  { bg: '#faf5ff', border: '#e9d8fd', titleColor: '#6b46c1' },
  { bg: '#fffaf0', border: '#feebc8', titleColor: '#c05621' },
];

export function EvaluateScreen({ eleve, juryId: _juryId, onDone, onBack }: EvaluateScreenProps) {
  void _juryId;
  const config = useCriteriaConfig();
  const maxTotal = computeMaxTotal(config);
  const maxByCategory = computeMaxByCategory(config);

  const [scores, setScores] = useState<Record<string, number | undefined>>({});
  const [pointsForts, setPointsForts] = useState('');
  const [axesAmelioration, setAxesAmelioration] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRevisit, setIsRevisit] = useState(false);
  const [savedElapsed, setSavedElapsed] = useState<number | undefined>(undefined);
  const [markingAbsent, setMarkingAbsent] = useState(false);

  const mountedRef = useRef(true);
  const restoredRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Charger les scores existants
  useEffect(() => {
    async function restore() {
      if (eleve.status === 'validated') {
        const { data: fs } = await supabase
          .from('final_scores')
          .select('*')
          .eq('eleve_id', eleve.id)
          .single();

        if (fs) {
          setScores(extractScores(fs as unknown as Record<string, unknown>));
          setPointsForts(fs.points_forts || '');
          setAxesAmelioration(fs.axes_amelioration || '');
          setIsRevisit(true);

          try {
            const savedTime = localStorage.getItem(TIMER_KEY(eleve.id));
            if (savedTime) setSavedElapsed(parseInt(savedTime, 10));
          } catch { /* ignore */ }

          restoredRef.current = true;
          return;
        }
      }

      // Fallback : localStorage
      try {
        const saved = localStorage.getItem(STORAGE_KEY(eleve.id));
        if (saved) {
          const data = JSON.parse(saved);
          if (data.scores) setScores(data.scores);
          if (data.pointsForts) setPointsForts(data.pointsForts);
          if (data.axesAmelioration) setAxesAmelioration(data.axesAmelioration);
        }
      } catch { /* ignore */ }

      try {
        const savedTime = localStorage.getItem(TIMER_KEY(eleve.id));
        if (savedTime) setSavedElapsed(parseInt(savedTime, 10));
      } catch { /* ignore */ }

      restoredRef.current = true;
    }
    restore();
  }, [eleve.id, eleve.status]);

  // Sauvegarder dans localStorage
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY(eleve.id), JSON.stringify({
        scores, pointsForts, axesAmelioration,
      }));
    } catch { /* quota exceeded, ignore */ }
  }, [scores, pointsForts, axesAmelioration, eleve.id]);

  // Mettre le status en in_progress
  useEffect(() => {
    if (eleve.status !== 'validated') {
      supabase.from('session_eleves').update({ status: 'in_progress' }).eq('id', eleve.id);
    }
  }, [eleve.id, eleve.status]);

  const handleTimerTick = useCallback((elapsed: number) => {
    try { localStorage.setItem(TIMER_KEY(eleve.id), String(elapsed)); } catch { /* ignore */ }
  }, [eleve.id]);

  const isCollectif = eleve.binome_id !== null;
  const timerDuration = isCollectif ? TIMER_COLLECTIF : TIMER_INDIVIDUEL;
  const totals = computeTotals(scores, config);
  const allScored = allCriteriaScored(scores, config);

  const handleAbsent = useCallback(async () => {
    if (markingAbsent) return;
    const isCurrentlyAbsent = eleve.status === 'absent';
    const msg = isCurrentlyAbsent
      ? 'Remettre cet \u00e9l\u00e8ve comme "\u00c0 passer" ?'
      : 'Marquer cet \u00e9l\u00e8ve comme absent ?';
    if (!window.confirm(msg)) return;

    setMarkingAbsent(true);
    const newStatus = isCurrentlyAbsent ? 'pending' : 'absent';
    await withRetry(() => supabase.from('session_eleves').update({ status: newStatus }).eq('id', eleve.id));
    setMarkingAbsent(false);
    if (mountedRef.current) onBack();
  }, [eleve.id, eleve.status, markingAbsent, onBack]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    if (isRevisit) {
      const confirmed = window.confirm(
        'Cet \u00e9l\u00e8ve a d\u00e9j\u00e0 \u00e9t\u00e9 not\u00e9. Voulez-vous \u00e9craser la note pr\u00e9c\u00e9dente ?'
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const { total, categoryTotals } = computeTotals(scores, config);

    // Construire le JSONB scores
    const scoresJsonb: Record<string, number> = {};
    for (const c of config.criteria) {
      if (scores[c.id] !== undefined) scoresJsonb[c.id] = scores[c.id]!;
    }

    // Backward-compat legacy columns (si critères par défaut)
    const legacyEval: Record<string, unknown> = {};
    const legacyFinal: Record<string, unknown> = {};
    for (const [criterionId, colName] of Object.entries(LEGACY_SCORE_KEYS)) {
      if (scores[criterionId] !== undefined) {
        legacyEval[colName] = scores[criterionId];
        legacyFinal[colName] = scores[criterionId]!;
      }
    }

    const totalOral = categoryTotals['oral'] ?? 0;
    const totalSujet = categoryTotals['sujet'] ?? 0;

    const { error: evalErr } = await withRetry(() => supabase.from('evaluations').upsert({
      eleve_id: eleve.id,
      juror_slot: 'A',
      ...legacyEval,
      total_oral: totalOral,
      total_sujet: totalSujet,
      total,
      scores: scoresJsonb,
      points_forts: pointsForts || null,
      axes_amelioration: axesAmelioration || null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'eleve_id,juror_slot' }));

    if (evalErr) {
      setSubmitError('Erreur persistante. V\u00e9rifiez votre connexion et r\u00e9essayez.');
      console.error('[EvaluateScreen] upsert evaluation:', evalErr);
      setSubmitting(false);
      return;
    }

    const { error: fsErr } = await withRetry(() => supabase.from('final_scores').upsert({
      eleve_id: eleve.id,
      ...legacyFinal,
      total_oral: totalOral,
      total_sujet: totalSujet,
      total,
      scores: scoresJsonb,
      points_forts: pointsForts || null,
      axes_amelioration: axesAmelioration || null,
    }, { onConflict: 'eleve_id' }));

    if (fsErr) {
      setSubmitError('Erreur persistante. V\u00e9rifiez votre connexion et r\u00e9essayez.');
      console.error('[EvaluateScreen] upsert final_scores:', fsErr);
      setSubmitting(false);
      return;
    }

    let dureePassage: number | null = null;
    try {
      const t = localStorage.getItem(TIMER_KEY(eleve.id));
      if (t) dureePassage = parseInt(t, 10);
    } catch { /* ignore */ }
    await withRetry(() => supabase.from('session_eleves').update({
      status: 'validated',
      ...(dureePassage != null ? { duree_passage: dureePassage } : {}),
    }).eq('id', eleve.id));

    try { localStorage.removeItem(STORAGE_KEY(eleve.id)); } catch { /* ignore */ }

    if (mountedRef.current) onDone();
  }, [scores, pointsForts, axesAmelioration, eleve.id, onDone, submitting, isRevisit, config]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} disabled={submitting} style={{
            ...styles.backBtn,
            opacity: submitting ? 0.4 : 1,
          }}>\u2190 Retour</button>
          <button
            onClick={handleAbsent}
            disabled={submitting || markingAbsent}
            style={{
              ...styles.backBtn,
              fontSize: 12,
              opacity: (submitting || markingAbsent) ? 0.4 : 0.7,
            }}
          >
            {eleve.status === 'absent' ? 'Remettre pr\u00e9sent' : 'Absent'}
          </button>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: 22,
            fontWeight: 800,
          }}>
            {totals.total}<span style={{ fontSize: 14, opacity: 0.7 }}>/{maxTotal}</span>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>{eleve.display_name}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {eleve.classe}
          {eleve.parcours && ` \u00b7 ${eleve.parcours}`}
          {eleve.sujet && ` \u00b7 ${eleve.sujet}`}
          {isCollectif && ' \u00b7 Collectif'}
        </div>
        {isRevisit && (
          <div style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: 700,
            color: '#fefcbf',
            background: 'rgba(255,255,255,0.15)',
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 8,
          }}>
            Modification
          </div>
        )}
      </div>

      {/* Timer */}
      <div style={{ padding: '12px 16px 0' }}>
        {isRevisit ? (
          <Timer duration={timerDuration} elapsedSeconds={savedElapsed ?? 0} />
        ) : (
          <Timer duration={timerDuration} initialElapsed={savedElapsed} onTick={handleTimerTick} />
        )}
      </div>

      {/* Sections par catégorie (dynamique) */}
      {config.categories.map((cat, catIdx) => {
        const catCriteria = config.criteria.filter(c => c.categoryId === cat.id);
        if (catCriteria.length === 0) return null;
        const catStyle = CATEGORY_STYLES[catIdx % CATEGORY_STYLES.length]!;
        const catTotal = totals.categoryTotals[cat.id] ?? 0;
        const catMax = maxByCategory[cat.id] ?? 0;

        return (
          <div key={cat.id} style={{ margin: '12px 16px 0' }}>
            <div style={{
              background: catStyle.bg,
              borderRadius: 12,
              padding: '10px 14px 4px',
              border: `1px solid ${catStyle.border}`,
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 800,
                color: catStyle.titleColor,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {cat.emoji && <span>{cat.emoji}</span>}
                {cat.label.toUpperCase()}
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
                  {catTotal}/{catMax}
                </span>
              </div>
              {catCriteria.map(c => (
                <CriterionRow
                  key={c.id}
                  criterion={toCriterion(c)}
                  selected={scores[c.id]}
                  onSelect={(val) => setScores({ ...scores, [c.id]: val })}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Commentaires */}
      <div style={styles.card}>
        <label style={styles.label}>Points forts</label>
        <textarea
          style={styles.textarea}
          placeholder="Optionnel..."
          value={pointsForts}
          onChange={(e) => setPointsForts(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <label style={styles.label}>Axes d'am\u00e9lioration</label>
          <textarea
            style={styles.textarea}
            placeholder="Optionnel..."
            value={axesAmelioration}
            onChange={(e) => setAxesAmelioration(e.target.value)}
          />
        </div>
      </div>

      {/* Erreur soumission */}
      {submitError && (
        <div style={{ margin: '0 16px', padding: '10px 14px', background: '#fed7d7', color: '#9b2c2c', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {submitError}
        </div>
      )}

      {/* Valider */}
      <div style={{ padding: '4px 16px 24px' }}>
        <button
          onClick={handleSubmit}
          disabled={!allScored || submitting}
          style={{
            ...styles.btnValidate,
            opacity: (allScored && !submitting) ? 1 : 0.45,
            background: allScored
              ? isRevisit
                ? 'linear-gradient(135deg, #c05621 0%, #9c4221 100%)'
                : 'linear-gradient(135deg, #276749 0%, #22543d 100%)'
              : 'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)',
          }}
        >
          {submitting
            ? 'Enregistrement...'
            : allScored
              ? isRevisit
                ? `Modifier la note \u2014 ${totals.total}/${maxTotal}`
                : `\u2713 Termin\u00e9 \u2014 ${totals.total}/${maxTotal}`
              : `Crit\u00e8res restants : ${config.criteria.filter(c => scores[c.id] === undefined).length}`}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
    background: '#f0f4f8',
    paddingBottom: 32,
  },
  header: {
    background: 'linear-gradient(135deg, #1a365d 0%, #2c5282 100%)',
    color: '#fff',
    padding: '16px 20px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 12px rgba(26,54,93,0.15)',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  card: {
    background: '#ffffff',
    borderRadius: 14,
    padding: 18,
    margin: '12px 16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #d2dce6',
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: '#4a5568',
    marginBottom: 6,
    display: 'block',
  },
  textarea: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #d2dce6',
    fontSize: 15,
    color: '#1a202c',
    background: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box' as const,
    height: 56,
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  },
  btnValidate: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 12,
    border: 'none',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(43,108,176,0.3)',
  },
};
