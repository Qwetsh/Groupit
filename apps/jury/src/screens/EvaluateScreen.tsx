import { useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase,
  CRITERIA,
  TIMER_INDIVIDUEL,
  TIMER_COLLECTIF,
  computeTotals,
  allCriteriaScored,
} from '@groupit/shared';
import type { SessionEleveRow } from '@groupit/shared';
import { Timer } from '../components/Timer';
import { CriterionRow } from '../components/CriterionRow';

interface EvaluateScreenProps {
  eleve: SessionEleveRow;
  juryId: string;
  onDone: () => void;
  onBack: () => void;
}

export function EvaluateScreen({ eleve, juryId: _juryId, onDone, onBack }: EvaluateScreenProps) {
  void _juryId;
  const [scores, setScores] = useState<Record<string, number | undefined>>({});
  const [pointsForts, setPointsForts] = useState('');
  const [axesAmelioration, setAxesAmelioration] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Mettre le status en in_progress
  useEffect(() => {
    supabase.from('session_eleves').update({ status: 'in_progress' }).eq('id', eleve.id);
  }, [eleve.id]);

  const isCollectif = eleve.binome_id !== null;
  const timerDuration = isCollectif ? TIMER_COLLECTIF : TIMER_INDIVIDUEL;
  const totals = computeTotals(scores);
  const allScored = allCriteriaScored(scores);

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    const { totalOral, totalSujet, total } = computeTotals(scores);

    // Sauvegarder l'évaluation
    const { error: evalErr } = await supabase.from('evaluations').upsert({
      eleve_id: eleve.id,
      juror_slot: 'A',
      score_expression: scores.expression,
      score_diaporama: scores.diaporama,
      score_reactivite: scores.reactivite,
      score_contenu: scores.contenu,
      score_structure: scores.structure,
      score_engagement: scores.engagement,
      total_oral: totalOral,
      total_sujet: totalSujet,
      total,
      points_forts: pointsForts || null,
      axes_amelioration: axesAmelioration || null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'eleve_id,juror_slot' });

    if (evalErr) {
      setSubmitError('Erreur de sauvegarde. Réessayez.');
      console.error('[EvaluateScreen] upsert evaluation:', evalErr);
      return;
    }

    // Valider directement comme score final
    const { error: fsErr } = await supabase.from('final_scores').upsert({
      eleve_id: eleve.id,
      score_expression: scores.expression!,
      score_diaporama: scores.diaporama!,
      score_reactivite: scores.reactivite!,
      score_contenu: scores.contenu!,
      score_structure: scores.structure!,
      score_engagement: scores.engagement!,
      total_oral: totalOral,
      total_sujet: totalSujet,
      total,
      points_forts: pointsForts || null,
      axes_amelioration: axesAmelioration || null,
    }, { onConflict: 'eleve_id' });

    if (fsErr) {
      setSubmitError('Erreur de sauvegarde du score final.');
      console.error('[EvaluateScreen] upsert final_scores:', fsErr);
      return;
    }

    const { error: statusErr } = await supabase.from('session_eleves').update({ status: 'validated' }).eq('id', eleve.id);
    if (statusErr) console.error('[EvaluateScreen] update status:', statusErr);

    if (mountedRef.current) onDone();
  }, [scores, pointsForts, axesAmelioration, eleve.id, onDone]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={styles.backBtn}>← Retour</button>
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: 22,
            fontWeight: 800,
          }}>
            {totals.total}<span style={{ fontSize: 14, opacity: 0.7 }}>/20</span>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>{eleve.display_name}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {eleve.classe}
          {eleve.parcours && ` · ${eleve.parcours}`}
          {eleve.sujet && ` · ${eleve.sujet}`}
          {isCollectif && ' · Collectif'}
        </div>
      </div>

      {/* Timer */}
      <div style={{ padding: '12px 16px 0' }}>
        <Timer duration={timerDuration} />
      </div>

      {/* Oral */}
      <div style={{ margin: '12px 16px 0' }}>
        <div style={styles.sectionOral}>
          <div style={styles.sectionTitle}>
            <span>🗣️</span> PRÉSENTATION ORALE
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
              {totals.totalOral}/8
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
              {totals.totalSujet}/12
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
          disabled={!allScored}
          style={{
            ...styles.btnValidate,
            opacity: allScored ? 1 : 0.45,
            background: allScored
              ? 'linear-gradient(135deg, #276749 0%, #22543d 100%)'
              : 'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)',
          }}
        >
          {allScored
            ? `✓ Terminé — ${totals.total}/20`
            : `Critères restants : ${CRITERIA.filter(c => scores[c.id] === undefined).length}`}
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
    boxShadow: '0 2px 8px rgba(43,108,176,0.3)',
  },
};
