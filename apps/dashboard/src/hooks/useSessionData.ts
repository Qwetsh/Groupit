import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, DEFAULT_CRITERIA_CONFIG } from '@groupit/shared';
import type {
  SessionJuryRow,
  SessionEleveRow,
  EvaluationRow,
  FinalScoreRow,
  CriteriaConfig,
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
  criteriaConfig: CriteriaConfig;
  locked: boolean;
  jurys: JuryWithEleves[];
  allFinalScores: FinalScoreRow[];
  loading: boolean;
  error: string | null;
}

export function useSessionData(sessionCode: string): SessionData & { refresh: () => void; toggleLocked: () => Promise<void> } {
  const [sessionId, setSessionId] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [dateOral, setDateOral] = useState<string | null>(null);
  const [criteriaConfig, setCriteriaConfig] = useState<CriteriaConfig>(DEFAULT_CRITERIA_CONFIG);
  const [locked, setLocked] = useState(false);
  const [jurys, setJurys] = useState<JuryWithEleves[]>([]);
  const [allFinalScores, setAllFinalScores] = useState<FinalScoreRow[]>([]);
  const connectedJuryIdsRef = useRef<Set<string>>(new Set());
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

      // 2. Trouver la session (inclut criteria_config)
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
      setLocked(!!(session as Record<string, unknown>).locked);

      // Extraire criteria_config
      const rawConfig = (session as Record<string, unknown>).criteria_config as CriteriaConfig | null;
      setCriteriaConfig(rawConfig ?? DEFAULT_CRITERIA_CONFIG);

      // 3. Charger les jurys
      const { data: juryRows } = await supabase
        .from('session_jurys')
        .select('*')
        .eq('session_id', session.id)
        .order('jury_number');

      if (!juryRows) { setLoading(false); return; }

      // 4. Pour chaque jury : eleves, evaluations, scores finaux
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
            connected: connectedJuryIdsRef.current.has(jury.id),
          };
        })
      );

      setJurys(jurysWithData);

      // 5. Tous les scores finaux
      const allScores = jurysWithData.flatMap(j => Array.from(j.finalScores.values()));
      setAllFinalScores(allScores);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [sessionCode]);

  useEffect(() => { loadData(); }, [loadData]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { loadData(); }, 500);
  }, [loadData]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    setJurys([]);
    setAllFinalScores([]);
    setScenarioName('');
    setSessionId('');
    setCriteriaConfig(DEFAULT_CRITERIA_CONFIG);
    setError(null);
    setLoading(true);
  }, [sessionCode]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`dashboard-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'groupit',
        table: 'final_scores',
      }, () => { debouncedReload(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'groupit',
        table: 'session_eleves',
      }, () => { debouncedReload(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, debouncedReload]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase.channel(`presence:session:${sessionId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        connectedJuryIdsRef.current = ids;
        setJurys(prev => prev.map(j => ({ ...j, connected: ids.has(j.id) })));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const toggleLocked = useCallback(async () => {
    if (!sessionId) return;
    const newLocked = !locked;
    const { error: updErr } = await supabase
      .from('exam_sessions')
      .update({ locked: newLocked })
      .eq('id', sessionId);
    if (!updErr) setLocked(newLocked);
  }, [sessionId, locked]);

  return {
    sessionId,
    scenarioName,
    dateOral,
    criteriaConfig,
    locked,
    jurys,
    allFinalScores,
    loading,
    error,
    refresh: loadData,
    toggleLocked,
  };
}
