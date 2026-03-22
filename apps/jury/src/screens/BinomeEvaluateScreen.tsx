import { useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase,
  CRITERIA,
  TIMER_COLLECTIF,
  computeTotals,
  allCriteriaScored,
} from '@groupit/shared';
import type { SessionEleveRow } from '@groupit/shared';
import { Timer } from '../components/Timer';
import { CriterionRow } from '../components/CriterionRow';

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

// Clé timer partagée basée sur le plus petit ID pour être stable
function sharedTimerKey(a: string, b: string) {
  return TIMER_KEY(a < b ? a : b);
}

export function BinomeEvaluateScreen({ eleves, juryId: _juryId, onDone, onBack }: BinomeEvaluateScreenProps) {
  void _juryId;
  const [activeIdx, setActiveIdx] = useState(0);
  const activeEleve = eleves[activeIdx]!;

  // Scores séparés pour chaque élève
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

  // Restaurer scores des deux élèves
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
            setSc({
              expression: fs.score_expression ?? undefined,
              diaporama: fs.score_diaporama ?? undefined,
              reactivite: fs.score_reactivite ?? undefined,
              contenu: fs.score_contenu ?? undefined,
              structure: fs.score_structure ?? undefined,
              engagement: fs.score_engagement ?? undefined,
            });
            setPF(fs.points_forts || '');
            setAx(fs.axes_amelioration || '');
            setRev(true);
            continue;
          }
        }

        // Fallback localStorage
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

      // Timer partagé
      try {
        const t = localStorage.getItem(timerKey);
        if (t) setSavedElapsed(parseInt(t, 10));
      } catch { /* ignore */ }

      restoredRef.current = true;
    }
    restore();
  }, [eleves[0].id, eleves[1].id, timerKey]);

  // Sauvegarder scores dans localStorage
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

  const totalsA = computeTotals(scoresA);
  const totalsB = computeTotals(scoresB);
  const allScoredA = allCriteriaScored(scoresA);
  const allScoredB = allCriteriaScored(scoresB);
  const currentTotals = activeIdx === 0 ? totalsA : totalsB;
  const bothRevisit = isRevisitA && isRevisitB;

  const isEleveAbsent = (i: number) => eleves[i]!.status === 'absent';

  // Un élève absent est considéré "noté" pour la validation
  const effectiveScoredA = allScoredA || isEleveAbsent(0);
  const effectiveScoredB = allScoredB || isEleveAbsent(1);
  const canSubmit = effectiveScoredA && effectiveScoredB;

  const handleAbsent = useCallback(async (idx: number) => {
    const eleve = eleves[idx]!;
    const isCurrentlyAbsent = eleve.status === 'absent';
    const msg = isCurrentlyAbsent
      ? `Remettre ${eleve.display_name} comme "À passer" ?`
      : `Marquer ${eleve.display_name} comme absent ?`;
    if (!window.confirm(msg)) return;

    const newStatus = isCurrentlyAbsent ? 'pending' : 'absent';
    await withRetry(() => supabase.from('session_eleves').update({ status: newStatus }).eq('id', eleve.id));
  }, [eleves]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    if (bothRevisit) {
      if (!window.confirm('Les deux élèves ont déjà été notés. Écraser les notes précédentes ?')) return;
    }

    setSubmitting(true);
    setSubmitError(null);

    let dureePassage: number | null = null;
    try {
      const t = localStorage.getItem(timerKey);
      if (t) dureePassage = parseInt(t, 10);
    } catch { /* ignore */ }

    // Soumettre les deux élèves
    for (let i = 0; i < 2; i++) {
      const eleve = eleves[i]!;
      if (eleve.status === 'absent') continue;

      const sc = i === 0 ? scoresA : scoresB;
      const pf = i === 0 ? pointsFortsA : pointsFortsB;
      const ax = i === 0 ? axesA : axesB;
      const { totalOral, totalSujet, total } = computeTotals(sc);

      const { error: evalErr } = await withRetry(() => supabase.from('evaluations').upsert({
        eleve_id: eleve.id,
        juror_slot: 'A',
        score_expression: sc.expression,
        score_diaporama: sc.diaporama,
        score_reactivite: sc.reactivite,
        score_contenu: sc.contenu,
        score_structure: sc.structure,
        score_engagement: sc.engagement,
        total_oral: totalOral,
        total_sujet: totalSujet,
        total,
        points_forts: pf || null,
        axes_amelioration: ax || null,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'eleve_id,juror_slot' }));

      if (evalErr) {
        setSubmitError(`Erreur pour ${eleve.display_name}. Réessayez.`);
        console.error('[BinomeEvaluate] upsert evaluation:', evalErr);
        setSubmitting(false);
        return;
      }

      const { error: fsErr } = await withRetry(() => supabase.from('final_scores').upsert({
        eleve_id: eleve.id,
        score_expression: sc.expression!,
        score_diaporama: sc.diaporama!,
        score_reactivite: sc.reactivite!,
        score_contenu: sc.contenu!,
        score_structure: sc.structure!,
        score_engagement: sc.engagement!,
        total_oral: totalOral,
        total_sujet: totalSujet,
        total,
        points_forts: pf || null,
        axes_amelioration: ax || null,
      }, { onConflict: 'eleve_id' }));

      if (fsErr) {
        setSubmitError(`Erreur pour ${eleve.display_name}. Réessayez.`);
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
  }, [scoresA, scoresB, pointsFortsA, pointsFortsB, axesA, axesB, eleves, onDone, submitting, bothRevisit, timerKey]);

  const allRevisit = isRevisitA && isRevisitB;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} disabled={submitting} style={{
            ...styles.backBtn,
            opacity: submitting ? 0.4 : 1,
          }}>← Retour</button>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
          }}>
            BINÔME
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: 18,
            fontWeight: 800,
          }}>
            {currentTotals.total}<span style={{ fontSize: 12, opacity: 0.7 }}>/20</span>
          </div>
        </div>

        {/* Onglets élèves */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {eleves.map((eleve, i) => {
            const isActive = activeIdx === i;
            const isAbs = eleve.status === 'absent';
            const scored = i === 0 ? allScoredA : allScoredB;
            const t = i === 0 ? totalsA : totalsB;
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
                  {isAbs ? 'Absent' : scored ? `${t.total}/20` : `${CRITERIA.filter(c => (i === 0 ? scoresA : scoresB)[c.id] === undefined).length} restant(s)`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Boutons absence individuels */}
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
              {eleve.status === 'absent' ? 'Remettre présent' : 'Absent'}
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

      {/* Timer partagé */}
      <div style={{ padding: '12px 16px 0' }}>
        {allRevisit ? (
          <Timer duration={TIMER_COLLECTIF} elapsedSeconds={savedElapsed ?? 0} />
        ) : (
          <Timer duration={TIMER_COLLECTIF} initialElapsed={savedElapsed} onTick={handleTimerTick} />
        )}
      </div>

      {/* Contenu de l'élève actif (masqué si absent) */}
      {activeEleve.status === 'absent' ? (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Élève absent</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Cliquez "Remettre présent" pour annuler.</div>
        </div>
      ) : (<>
        {/* Oral */}
        <div style={{ margin: '12px 16px 0' }}>
          <div style={styles.sectionOral}>
            <div style={styles.sectionTitle}>
              <span>🗣️</span> PRÉSENTATION ORALE
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
                {currentTotals.totalOral}/8
              </span>
            </div>
            {CRITERIA.filter(c => c.category === 'oral').map(c => (
              <CriterionRow
                key={c.id}
                criterion={c}
                selected={scores[c.id]}
                onSelect={(val) => setScores({ ...scores, [c.id]: val })}
              />
            ))}
          </div>
        </div>

        {/* Sujet */}
        <div style={{ margin: '12px 16px 0' }}>
          <div style={styles.sectionSujet}>
            <div style={{ ...styles.sectionTitle, color: '#276749' }}>
              <span>🧠</span> MAÎTRISE DU SUJET
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
                {currentTotals.totalSujet}/12
              </span>
            </div>
            {CRITERIA.filter(c => c.category === 'sujet').map(c => (
              <CriterionRow
                key={c.id}
                criterion={c}
                selected={scores[c.id]}
                onSelect={(val) => setScores({ ...scores, [c.id]: val })}
              />
            ))}
          </div>
        </div>

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
            <label style={styles.label}>Axes d'amélioration</label>
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

      {/* Valider les deux */}
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
                ? `Modifier — ${totalsA.total}/20 · ${totalsB.total}/20`
                : `✓ Valider le binôme — ${totalsA.total}/20 · ${totalsB.total}/20`
              : `Critères restants`}
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
  sectionOral: {
    background: '#ebf4ff',
    borderRadius: 12,
    padding: '10px 14px 4px',
    border: '1px solid #bee3f8',
  },
  sectionSujet: {
    background: '#f0fff4',
    borderRadius: 12,
    padding: '10px 14px 4px',
    border: '1px solid #c6f6d5',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: '#2b6cb0',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
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
