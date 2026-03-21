import { useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase,
  CRITERIA,
  getDisagreements,
  computeTotals,
} from '@groupit/shared';
import type { SessionEleveRow, EvaluationRow } from '@groupit/shared';
import { CriterionRow } from '../components/CriterionRow';

interface ReconcileScreenProps {
  eleve: SessionEleveRow;
  slot: 'A' | 'B';
  juryId: string;
  onValidated: () => void;
}

// Convertir une évaluation DB en scores record
function evalToScores(ev: EvaluationRow): Record<string, number | undefined> {
  return {
    expression: ev.score_expression ?? undefined,
    diaporama: ev.score_diaporama ?? undefined,
    reactivite: ev.score_reactivite ?? undefined,
    contenu: ev.score_contenu ?? undefined,
    structure: ev.score_structure ?? undefined,
    engagement: ev.score_engagement ?? undefined,
  };
}

export function ReconcileScreen({ eleve, slot, juryId: _juryId, onValidated }: ReconcileScreenProps) {
  void _juryId;
  const [myScores, setMyScores] = useState<Record<string, number | undefined>>({});
  const [otherScores, setOtherScores] = useState<Record<string, number | undefined>>({});
  const [reconciledScores, setReconciledScores] = useState<Record<string, number | undefined>>({});
  const [otherReconciled, setOtherReconciled] = useState<Record<string, number | undefined>>({});
  const [myPointsForts, setMyPointsForts] = useState('');
  const [otherPointsForts, setOtherPointsForts] = useState('');
  const [myAxes, setMyAxes] = useState('');
  const [otherAxes, setOtherAxes] = useState('');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  const otherSlot = slot === 'A' ? 'B' : 'A';

  // Ref pour reconciledScores (évite stale closure dans le realtime handler)
  const reconciledRef = useRef(reconciledScores);
  reconciledRef.current = reconciledScores;

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Charger les 2 évaluations
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('evaluations')
        .select('*')
        .eq('eleve_id', eleve.id);

      if (!data) return;

      const myEval = data.find(e => e.juror_slot === slot);
      const otherEval = data.find(e => e.juror_slot === otherSlot);

      if (myEval) {
        const s = evalToScores(myEval);
        setMyScores(s);
        setMyPointsForts(myEval.points_forts || '');
        setMyAxes(myEval.axes_amelioration || '');
      }
      if (otherEval) {
        const s = evalToScores(otherEval);
        setOtherScores(s);
        setOtherPointsForts(otherEval.points_forts || '');
        setOtherAxes(otherEval.axes_amelioration || '');
      }

      setLoading(false);
    }
    load();
  }, [eleve.id, slot, otherSlot]);

  // Initialiser reconciled avec les critères en accord
  useEffect(() => {
    if (loading) return;
    const initial: Record<string, number | undefined> = {};
    for (const c of CRITERIA) {
      if (myScores[c.id] === otherScores[c.id]) {
        initial[c.id] = myScores[c.id];
      }
    }
    setReconciledScores(initial);
  }, [loading, myScores, otherScores]);

  // Stable ref pour onValidated (évite re-subscribe à chaque render du parent)
  const onValidatedRef = useRef(onValidated);
  onValidatedRef.current = onValidated;

  // Écouter les modifications de l'autre juré sur final_scores en temps réel
  useEffect(() => {
    if (loading) return;

    const channel = supabase
      .channel(`reconcile-${eleve.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'final_scores',
        filter: `eleve_id=eq.${eleve.id}`,
      }, async () => {
        // Recharger le final_score pour voir ce que l'autre a sélectionné
        const { data } = await supabase
          .from('final_scores')
          .select('*')
          .eq('eleve_id', eleve.id)
          .single();

        if (data) {
          const finalScores = {
            expression: data.score_expression,
            diaporama: data.score_diaporama,
            reactivite: data.score_reactivite,
            contenu: data.score_contenu,
            structure: data.score_structure,
            engagement: data.score_engagement,
          };

          if (mountedRef.current) setOtherReconciled(finalScores);

          // Vérifier si tout est aligné (utilise le ref pour la valeur courante)
          const currentReconciled = reconciledRef.current;
          const allAligned = CRITERIA.every(c =>
            currentReconciled[c.id] !== undefined &&
            finalScores[c.id as keyof typeof finalScores] === currentReconciled[c.id]
          );

          if (allAligned && data.validated_at) {
            await supabase.from('session_eleves').update({ status: 'validated' }).eq('id', eleve.id);
            if (mountedRef.current) onValidatedRef.current();
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loading, eleve.id]); // Stable deps — no more churn

  const disagreements = getDisagreements(myScores, otherScores);
  const agreedCriteria = CRITERIA.filter(c => myScores[c.id] === otherScores[c.id]);

  // Vérifier si toutes les notes réconciliées sont alignées entre les 2 jurés
  const allReconciled = disagreements.every(c => reconciledScores[c.id] !== undefined);
  const allAlignedWithOther = disagreements.every(c =>
    reconciledScores[c.id] !== undefined &&
    otherReconciled[c.id as keyof typeof otherReconciled] === reconciledScores[c.id]
  );

  // Fix #10 : canValidate exige que l'autre ait aussi soumis ses choix (pas de validation unilatérale)
  const canValidate = allReconciled && allAlignedWithOther;

  const handleValidate = useCallback(async () => {
    if (validating) return;
    setValidating(true);
    const allScores = { ...reconciledScores };
    // Ajouter les critères déjà en accord
    for (const c of agreedCriteria) {
      allScores[c.id] = myScores[c.id];
    }

    const totals = computeTotals(allScores);

    // Fusionner les commentaires
    const finalPointsForts = [myPointsForts, otherPointsForts].filter(Boolean).join(' | ') || null;
    const finalAxes = [myAxes, otherAxes].filter(Boolean).join(' | ') || null;

    const { error: fsErr } = await supabase.from('final_scores').upsert({
      eleve_id: eleve.id,
      score_expression: allScores.expression!,
      score_diaporama: allScores.diaporama!,
      score_reactivite: allScores.reactivite!,
      score_contenu: allScores.contenu!,
      score_structure: allScores.structure!,
      score_engagement: allScores.engagement!,
      total_oral: totals.totalOral,
      total_sujet: totals.totalSujet,
      total: totals.total,
      points_forts: finalPointsForts,
      axes_amelioration: finalAxes,
      validated_at: new Date().toISOString(),
    }, { onConflict: 'eleve_id' });

    if (fsErr) {
      console.error('[ReconcileScreen] upsert final_scores:', fsErr);
      setValidating(false);
      return;
    }

    // Si l'autre a déjà les mêmes scores → valider
    // Sinon l'autre recevra la mise à jour via realtime
    if (allAlignedWithOther) {
      await supabase.from('session_eleves').update({ status: 'validated' }).eq('id', eleve.id);
      if (mountedRef.current) onValidated();
    } else {
      setValidating(false);
    }
  }, [reconciledScores, agreedCriteria, myScores, myPointsForts, otherPointsForts, myAxes, otherAxes, eleve.id, allAlignedWithOther, onValidated, validating]);

  if (loading) {
    return <div style={styles.loading}>Chargement...</div>;
  }

  const totalReconciled = computeTotals({ ...myScores, ...reconciledScores });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{eleve.display_name}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          Réconciliation — Juré {slot}
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 18,
          fontWeight: 800,
          display: 'inline-block',
          marginTop: 8,
        }}>
          {totalReconciled.total}/20
        </div>
      </div>

      {/* Critères en accord */}
      {agreedCriteria.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            ✓ Critères en accord ({agreedCriteria.length})
          </div>
          {agreedCriteria.map(c => (
            <CriterionRow
              key={c.id}
              criterion={c}
              selected={myScores[c.id]}
              onSelect={() => {}}
              disabled
            />
          ))}
        </div>
      )}

      {/* Critères en désaccord */}
      {disagreements.length > 0 && (
        <div style={styles.section}>
          <div style={{ ...styles.sectionLabel, color: '#e53e3e' }}>
            ⚠ Critères en désaccord ({disagreements.length})
          </div>
          <div style={{
            fontSize: 12,
            color: '#64748b',
            marginBottom: 12,
            padding: '0 16px',
          }}>
            Discutez et sélectionnez la note commune. Le bouton "Valider" n'apparaîtra que quand les deux jurés auront choisi la même note.
          </div>
          {disagreements.map(c => (
            <div key={c.id} style={{ padding: '0 16px', marginBottom: 8 }}>
              <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 4,
                fontSize: 11,
                fontWeight: 600,
              }}>
                <span style={{ color: '#2b6cb0' }}>Juré {slot} (moi) : {myScores[c.id]}/{c.max}</span>
                <span style={{ color: '#94a3b8' }}>|</span>
                <span style={{ color: '#9b2c2c' }}>Juré {otherSlot} : {otherScores[c.id]}/{c.max}</span>
              </div>
              <CriterionRow
                criterion={c}
                selected={reconciledScores[c.id]}
                onSelect={(val) => setReconciledScores({ ...reconciledScores, [c.id]: val })}
              />
            </div>
          ))}
        </div>
      )}

      {/* Bouton valider */}
      <div style={{ padding: '12px 16px 32px' }}>
        {disagreements.length === 0 ? (
          // Pas de désaccord — tout est bon
          <button onClick={handleValidate} disabled={validating} style={{ ...styles.btnValidate, opacity: validating ? 0.6 : 1 }}>
            {validating ? '⏳ Validation...' : `✓ Valider — ${totalReconciled.total}/20`}
          </button>
        ) : canValidate ? (
          <button onClick={handleValidate} disabled={validating} style={{ ...styles.btnValidate, opacity: validating ? 0.6 : 1 }}>
            {validating ? '⏳ Validation...' : `✓ Valider les notes réconciliées — ${totalReconciled.total}/20`}
          </button>
        ) : (
          <div style={styles.waitingBox}>
            {allReconciled
              ? '⏳ En attente que l\'autre juré sélectionne les mêmes notes...'
              : `Sélectionnez les ${disagreements.filter(c => reconciledScores[c.id] === undefined).length} critère(s) restant(s)`}
          </div>
        )}
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
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: '#64748b',
  },
  header: {
    background: 'linear-gradient(135deg, #744210 0%, #975a16 100%)',
    color: '#fff',
    padding: '16px 20px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  section: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 800,
    color: '#276749',
    padding: '0 16px',
    marginBottom: 8,
  },
  btnValidate: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #276749 0%, #22543d 100%)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(39,103,73,0.3)',
  },
  waitingBox: {
    textAlign: 'center' as const,
    padding: '14px 20px',
    borderRadius: 12,
    background: '#fefcbf',
    color: '#975a16',
    fontSize: 14,
    fontWeight: 600,
    border: '1px solid #f6e05e',
  },
};
