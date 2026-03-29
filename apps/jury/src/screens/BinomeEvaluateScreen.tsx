import { useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase,
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

interface BinomeEvaluateScreenProps {
  eleves: [SessionEleveRow, SessionEleveRow];
  juryId: string;
  onDone: () => void;
  onBack: () => void;
}

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
const TIMER_KEY = (id: string) => `jury-timer-binome-${id}`;

function sharedTimerKey(a: string, b: string) {
  return TIMER_KEY(a < b ? a : b);
}

const LEGACY_SCORE_KEYS: Record<string, string> = {
  expression: 'score_expression',
  diaporama: 'score_diaporama',
  reactivite: 'score_reactivite',
  contenu: 'score_contenu',
  structure: 'score_structure',
  engagement: 'score_engagement',
};

function extractScores(fs: Record<string, unknown>): Record<string, number | undefined> {
  if (fs.scores && typeof fs.scores === 'object') {
    const result: Record<string, number | undefined> = {};
    for (const [k, v] of Object.entries(fs.scores as Record<string, number>)) {
      result[k] = v;
    }
    return result;
  }
  const result: Record<string, number | undefined> = {};
  for (const [criterionId, colName] of Object.entries(LEGACY_SCORE_KEYS)) {
    const val = fs[colName];
    if (val != null) result[criterionId] = val as number;
  }
  return result;
}

const CATEGORY_STYLES = [
  { bg: '#ebf4ff', border: '#bee3f8', titleColor: '#2b6cb0' },
  { bg: '#f0fff4', border: '#c6f6d5', titleColor: '#276749' },
  { bg: '#faf5ff', border: '#e9d8fd', titleColor: '#6b46c1' },
  { bg: '#fffaf0', border: '#feebc8', titleColor: '#c05621' },
];

export function BinomeEvaluateScreen({ eleves, juryId: _juryId, onDone, onBack }: BinomeEvaluateScreenProps) {
  void _juryId;
  const config = useCriteriaConfig();
  const maxTotal = computeMaxTotal(config);
  const maxByCategory = computeMaxByCategory(config);

  const [activeIdx, setActiveIdx] = useState(0);
  const activeEleve = eleves[activeIdx]!;

  const [scoresA, setScoresA] = useState<Record<string, number | undefined>>({});
  const [scoresB, setScoresB] = useState<Record<string, number | undefined>>({});
  const [pointsFortsA, setPointsFortsA] = useState('');
  const [pointsFortsB, setPointsFortsB] = useState('');
  const [axesA, setAxesA] = useState('');
  const [axesB, setAxesB] = useState('');

  const [isRevisitA, setIsRevisitA] = useState(false);
  const [isRevisitB, setIsRevisitB] = useState(false);
  const [savedElapsed, setSavedElapsed] = useState<number | undefined>(undefined);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mountedRef = useRef(true);
  const restoredRef = useRef(false);

  const scores = activeIdx === 0 ? scoresA : scoresB;
  const setScores = activeIdx === 0 ? setScoresA : setScoresB;
  const pointsForts = activeIdx === 0 ? pointsFortsA : pointsFortsB;
  const setPointsForts = activeIdx === 0 ? setPointsFortsA : setPointsFortsB;
  const axesAmelioration = activeIdx === 0 ? axesA : axesB;
  const setAxesAmelioration = activeIdx === 0 ? setAxesA : setAxesB;
  const timerKey = sharedTimerKey(eleves[0].id, eleves[1].id);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Restaurer scores des deux
  useEffect(() => {
    async function restore() {
      for (let i = 0; i < 2; i++) {
        const eleve = eleves[i]!;
        const setSc = i === 0 ? setScoresA : setScoresB;
        const setPF = i === 0 ? setPointsFortsA : setPointsFortsB;
        const setAx = i === 0 ? setAxesA : setAxesB;
        const setRev = i === 0 ? setIsRevisitA : setIsRevisitB;

        if (eleve.status === 'validated') {
          const { data: fs } = await supabase
            .from('final_scores')
            .select('*')
            .eq('eleve_id', eleve.id)
            .single();

          if (fs) {
            setSc(extractScores(fs as unknown as Record<string, unknown>));
            setPF(fs.points_forts || '');
            setAx(fs.axes_amelioration || '');
            setRev(true);
            continue;
          }
        }

        try {
          const saved = localStorage.getItem(STORAGE_KEY(eleve.id));
          if (saved) {
            const data = JSON.parse(saved);
            if (data.scores) setSc(data.scores);
            if (data.pointsForts) setPF(data.pointsForts);
            if (data.axesAmelioration) setAx(data.axesAmelioration);
          }
        } catch { /* ignore */ }
      }

      try {
        const t = localStorage.getItem(timerKey);
        if (t) setSavedElapsed(parseInt(t, 10));
      } catch { /* ignore */ }

      restoredRef.current = true;
    }
    restore();
  }, [eleves[0].id, eleves[1].id, timerKey]);

  // Sauvegarder scores
  useEffect(() => {
    if (!restoredRef.current) return;
    for (let i = 0; i < 2; i++) {
      const eleve = eleves[i]!;
      const sc = i === 0 ? scoresA : scoresB;
      const pf = i === 0 ? pointsFortsA : pointsFortsB;
      const ax = i === 0 ? axesA : axesB;
      try {
        localStorage.setItem(STORAGE_KEY(eleve.id), JSON.stringify({
          scores: sc, pointsForts: pf, axesAmelioration: ax,
        }));
      } catch { /* ignore */ }
    }
  }, [scoresA, scoresB, pointsFortsA, pointsFortsB, axesA, axesB, eleves]);

  // Mettre en in_progress
  useEffect(() => {
    for (const eleve of eleves) {
      if (eleve.status !== 'validated' && eleve.status !== 'absent') {
        supabase.from('session_eleves').update({ status: 'in_progress' }).eq('id', eleve.id);
      }
    }
  }, [eleves]);

  const handleTimerTick = useCallback((elapsed: number) => {
    try { localStorage.setItem(timerKey, String(elapsed)); } catch { /* ignore */ }
  }, [timerKey]);

  const totalsA = computeTotals(scoresA, config);
  const totalsB = computeTotals(scoresB, config);
  const allScoredA = allCriteriaScored(scoresA, config);
  const allScoredB = allCriteriaScored(scoresB, config);
  const currentTotals = activeIdx === 0 ? totalsA : totalsB;
  const bothRevisit = isRevisitA && isRevisitB;

  const isEleveAbsent = (i: number) => eleves[i]!.status === 'absent';
  const effectiveScoredA = allScoredA || isEleveAbsent(0);
  const effectiveScoredB = allScoredB || isEleveAbsent(1);
  const canSubmit = effectiveScoredA && effectiveScoredB;

  const handleAbsent = useCallback(async (idx: number) => {
    const eleve = eleves[idx]!;
    const isCurrentlyAbsent = eleve.status === 'absent';
    const msg = isCurrentlyAbsent
      ? `Remettre ${eleve.display_name} comme "\u00c0 passer" ?`
      : `Marquer ${eleve.display_name} comme absent ?`;
    if (!window.confirm(msg)) return;

    const newStatus = isCurrentlyAbsent ? 'pending' : 'absent';
    await withRetry(() => supabase.from('session_eleves').update({ status: newStatus }).eq('id', eleve.id));
  }, [eleves]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    if (bothRevisit) {
      if (!window.confirm('Les deux \u00e9l\u00e8ves ont d\u00e9j\u00e0 \u00e9t\u00e9 not\u00e9s. \u00c9craser les notes pr\u00e9c\u00e9dentes ?')) return;
    }

    setSubmitting(true);
    setSubmitError(null);

    let dureePassage: number | null = null;
    try {
      const t = localStorage.getItem(timerKey);
      if (t) dureePassage = parseInt(t, 10);
    } catch { /* ignore */ }

    for (let i = 0; i < 2; i++) {
      const eleve = eleves[i]!;
      if (eleve.status === 'absent') continue;

      const sc = i === 0 ? scoresA : scoresB;
      const pf = i === 0 ? pointsFortsA : pointsFortsB;
      const ax = i === 0 ? axesA : axesB;
      const { total, categoryTotals } = computeTotals(sc, config);

      const scoresJsonb: Record<string, number> = {};
      for (const c of config.criteria) {
        if (sc[c.id] !== undefined) scoresJsonb[c.id] = sc[c.id]!;
      }

      const legacyEval: Record<string, unknown> = {};
      const legacyFinal: Record<string, unknown> = {};
      for (const [criterionId, colName] of Object.entries(LEGACY_SCORE_KEYS)) {
        if (sc[criterionId] !== undefined) {
          legacyEval[colName] = sc[criterionId];
          legacyFinal[colName] = sc[criterionId]!;
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
        points_forts: pf || null,
        axes_amelioration: ax || null,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'eleve_id,juror_slot' }));

      if (evalErr) {
        setSubmitError(`Erreur pour ${eleve.display_name}. R\u00e9essayez.`);
        console.error('[BinomeEvaluate] upsert evaluation:', evalErr);
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
        points_forts: pf || null,
        axes_amelioration: ax || null,
      }, { onConflict: 'eleve_id' }));

      if (fsErr) {
        setSubmitError(`Erreur pour ${eleve.display_name}. R\u00e9essayez.`);
        console.error('[BinomeEvaluate] upsert final_scores:', fsErr);
        setSubmitting(false);
        return;
      }

      await withRetry(() => supabase.from('session_eleves').update({
        status: 'validated',
        ...(dureePassage != null ? { duree_passage: dureePassage } : {}),
      }).eq('id', eleve.id));

      try { localStorage.removeItem(STORAGE_KEY(eleve.id)); } catch { /* ignore */ }
    }

    if (mountedRef.current) onDone();
  }, [scoresA, scoresB, pointsFortsA, pointsFortsB, axesA, axesB, eleves, onDone, submitting, bothRevisit, timerKey, config]);

  const allRevisit = isRevisitA && isRevisitB;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} disabled={submitting} style={{
            ...styles.backBtn,
            opacity: submitting ? 0.4 : 1,
          }}>\u2190 Retour</button>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
          }}>
            BIN\u00d4ME
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: 18,
            fontWeight: 800,
          }}>
            {currentTotals.total}<span style={{ fontSize: 12, opacity: 0.7 }}>/{maxTotal}</span>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {eleves.map((eleve, i) => {
            const isActive = activeIdx === i;
            const isAbs = eleve.status === 'absent';
            const scored = i === 0 ? allScoredA : allScoredB;
            const t = i === 0 ? totalsA : totalsB;
            const remaining = config.criteria.filter(c => (i === 0 ? scoresA : scoresB)[c.id] === undefined).length;
            return (
              <button
                key={eleve.id}
                onClick={() => setActiveIdx(i)}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: 10,
                  border: isActive ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  opacity: isAbs ? 0.5 : 1,
                  textAlign: 'center' as const,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>{eleve.display_name}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                  {isAbs ? 'Absent' : scored ? `${t.total}/${maxTotal}` : `${remaining} restant(s)`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Boutons absence */}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {eleves.map((eleve, i) => (
            <button
              key={`abs-${eleve.id}`}
              onClick={() => handleAbsent(i)}
              disabled={submitting}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11,
                cursor: 'pointer',
                padding: '2px 0',
              }}
            >
              {eleve.status === 'absent' ? 'Remettre pr\u00e9sent' : 'Absent'}
            </button>
          ))}
        </div>

        {allRevisit && (
          <div style={{
            marginTop: 4,
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
        {allRevisit ? (
          <Timer duration={TIMER_COLLECTIF} elapsedSeconds={savedElapsed ?? 0} />
        ) : (
          <Timer duration={TIMER_COLLECTIF} initialElapsed={savedElapsed} onTick={handleTimerTick} />
        )}
      </div>

      {/* Contenu */}
      {activeEleve.status === 'absent' ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>\u00c9l\u00e8ve absent</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Cliquez "Remettre pr\u00e9sent" pour annuler.</div>
        </div>
      ) : (<>
        {/* Sections par cat\u00e9gorie (dynamique) */}
        {config.categories.map((cat, catIdx) => {
          const catCriteria = config.criteria.filter(c => c.categoryId === cat.id);
          if (catCriteria.length === 0) return null;
          const catStyle = CATEGORY_STYLES[catIdx % CATEGORY_STYLES.length]!;
          const catTotal = currentTotals.categoryTotals[cat.id] ?? 0;
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
      </>)}

      {/* Erreur */}
      {submitError && (
        <div style={{ margin: '0 16px', padding: '10px 14px', background: '#fed7d7', color: '#9b2c2c', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {submitError}
        </div>
      )}

      {/* Valider */}
      <div style={{ padding: '4px 16px 24px' }}>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            ...styles.btnValidate,
            opacity: (canSubmit && !submitting) ? 1 : 0.45,
            background: canSubmit
              ? bothRevisit
                ? 'linear-gradient(135deg, #c05621 0%, #9c4221 100%)'
                : 'linear-gradient(135deg, #276749 0%, #22543d 100%)'
              : 'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)',
          }}
        >
          {submitting
            ? 'Enregistrement...'
            : canSubmit
              ? bothRevisit
                ? `Modifier \u2014 ${totalsA.total}/${maxTotal} \u00b7 ${totalsB.total}/${maxTotal}`
                : `\u2713 Valider le bin\u00f4me \u2014 ${totalsA.total}/${maxTotal} \u00b7 ${totalsB.total}/${maxTotal}`
              : `Crit\u00e8res restants`}
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
    background: 'linear-gradient(135deg, #553c9a 0%, #6b46c1 100%)',
    color: '#fff',
    padding: '16px 20px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 12px rgba(107,70,193,0.2)',
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
    boxShadow: '0 2px 8px rgba(107,70,193,0.3)',
  },
};
