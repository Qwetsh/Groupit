import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@groupit/shared';
import type {
  SessionJuryRow,
  SessionEleveRow,
  EvaluationRow,
  FinalScoreRow,
} from '@groupit/shared';

export interface JuryWithEleves extends SessionJuryRow {
  eleves: SessionEleveRow[];
  finalScores: Map<string, FinalScoreRow>;
  evaluations: EvaluationRow[];
  connected: boolean;
}

export interface SessionData {
  sessionId: string;
  scenarioName: string;
  dateOral: string | null;
  jurys: JuryWithEleves[];
  allFinalScores: FinalScoreRow[];
  loading: boolean;
  error: string | null;
}

export function useSessionData(sessionCode: string): SessionData & { refresh: () => void } {
  const [sessionId, setSessionId] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [dateOral, setDateOral] = useState<string | null>(null);
  const [jurys, setJurys] = useState<JuryWithEleves[]>([]);
  const [allFinalScores, setAllFinalScores] = useState<FinalScoreRow[]>([]);
  const [connectedJuryIds, setConnectedJuryIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!sessionCode) return;

    try {
      // 1. Auth anonyme
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) {
        await supabase.auth.signInAnonymously();
      }

      // 2. Trouver la session
      const { data: session, error: sessErr } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('code', sessionCode.toUpperCase())
        .single();

      if (sessErr || !session) {
        setError('Session introuvable');
        setLoading(false);
        return;
      }

      setSessionId(session.id);
      setScenarioName(session.scenario_name || '');
      setDateOral(session.date_oral);

      // 3. Charger les jurys
      const { data: juryRows } = await supabase
        .from('session_jurys')
        .select('*')
        .eq('session_id', session.id)
        .order('jury_number');

      if (!juryRows) { setLoading(false); return; }

      // 4. Pour chaque jury : élèves, évaluations, scores finaux
      const jurysWithData: JuryWithEleves[] = await Promise.all(
        juryRows.map(async (jury) => {
          const { data: eleves } = await supabase
            .from('session_eleves').select('*').eq('jury_id', jury.id).order('ordre_passage');

          const eleveIds = (eleves || []).map(e => e.id);

          let evaluations: EvaluationRow[] = [];
          let finalScores: FinalScoreRow[] = [];

          if (eleveIds.length > 0) {
            const [{ data: evals }, { data: finals }] = await Promise.all([
              supabase.from('evaluations').select('*').in('eleve_id', eleveIds),
              supabase.from('final_scores').select('*').in('eleve_id', eleveIds),
            ]);
            evaluations = evals || [];
            finalScores = finals || [];
          }

          const scoreMap = new Map<string, FinalScoreRow>();
          for (const fs of finalScores) {
            scoreMap.set(fs.eleve_id, fs);
          }

          return {
            ...jury,
            eleves: eleves || [],
            finalScores: scoreMap,
            evaluations,
            connected: connectedJuryIds.has(jury.id),
          };
        })
      );

      setJurys(jurysWithData);

      // 5. Tous les scores finaux (pour les stats globales)
      const allScores = jurysWithData.flatMap(j => Array.from(j.finalScores.values()));
      setAllFinalScores(allScores);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [sessionCode]);

  // Chargement initial
  useEffect(() => { loadData(); }, [loadData]);

  // Debounced reload pour le realtime (évite thundering herd)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { loadData(); }, 500);
  }, [loadData]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Clear stale data when session code changes
  useEffect(() => {
    setJurys([]);
    setAllFinalScores([]);
    setScenarioName('');
    setSessionId('');
    setError(null);
    setLoading(true);
  }, [sessionCode]);

  // Realtime : écouter les changements scoped à cette session
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`dashboard-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'final_scores',
      }, () => { debouncedReload(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_eleves',
      }, () => { debouncedReload(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, debouncedReload]);

  // Presence : écouter les jurys connectés en temps réel
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`presence:session:${sessionId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setConnectedJuryIds(ids);
        // Mettre à jour les jurys existants sans reload complet
        setJurys(prev => prev.map(j => ({ ...j, connected: ids.has(j.id) })));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  return {
    sessionId,
    scenarioName,
    dateOral,
    jurys,
    allFinalScores,
    loading,
    error,
    refresh: loadData,
  };
}
