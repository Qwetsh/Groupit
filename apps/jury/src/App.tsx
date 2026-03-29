import { useState, useEffect, useRef, useCallback } from 'react';
import { JoinScreen } from './screens/JoinScreen';
import { StudentListScreen } from './screens/StudentListScreen';
import { EvaluateScreen } from './screens/EvaluateScreen';
import { BinomeEvaluateScreen } from './screens/BinomeEvaluateScreen';
import { CriteriaProvider } from './context/CriteriaContext';
import { supabase, DEFAULT_CRITERIA_CONFIG } from '@groupit/shared';
import type { SessionEleveRow, CriteriaConfig } from '@groupit/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Screen =
  | { type: 'join' }
  | { type: 'students'; juryId: string; sessionId: string }
  | { type: 'evaluate'; juryId: string; sessionId: string; eleve: SessionEleveRow }
  | { type: 'evaluate-binome'; juryId: string; sessionId: string; eleves: [SessionEleveRow, SessionEleveRow] };

const SESSION_NAV_KEY = 'jury-nav';
const CRITERIA_CONFIG_KEY = 'jury-criteria-config';

interface SavedNav {
  juryId: string;
  sessionId: string;
  eleveId?: string;
  eleveIds?: [string, string];
}

function saveNav(screen: Screen) {
  try {
    if (screen.type === 'join') {
      sessionStorage.removeItem(SESSION_NAV_KEY);
    } else if (screen.type === 'students') {
      sessionStorage.setItem(SESSION_NAV_KEY, JSON.stringify({
        juryId: screen.juryId, sessionId: screen.sessionId,
      }));
    } else if (screen.type === 'evaluate') {
      sessionStorage.setItem(SESSION_NAV_KEY, JSON.stringify({
        juryId: screen.juryId, sessionId: screen.sessionId, eleveId: screen.eleve.id,
      }));
    } else {
      sessionStorage.setItem(SESSION_NAV_KEY, JSON.stringify({
        juryId: screen.juryId, sessionId: screen.sessionId,
        eleveIds: [screen.eleves[0].id, screen.eleves[1].id],
      }));
    }
  } catch { /* ignore */ }
}

function loadNav(): SavedNav | null {
  try {
    const raw = sessionStorage.getItem(SESSION_NAV_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'join' });
  const [restoring, setRestoring] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [criteriaConfig, setCriteriaConfig] = useState<CriteriaConfig>(DEFAULT_CRITERIA_CONFIG);
  const presenceRef = useRef<RealtimeChannel | null>(null);

  // Restaurer la config critères du sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CRITERIA_CONFIG_KEY);
      if (saved) setCriteriaConfig(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Restaurer la navigation au chargement
  useEffect(() => {
    async function restore() {
      const nav = loadNav();
      if (!nav) { setRestoring(false); return; }

      // Restaurer criteria_config depuis la session Supabase
      try {
        const { data: session } = await supabase
          .from('exam_sessions')
          .select('criteria_config')
          .eq('id', nav.sessionId)
          .single();
        if (session) {
          const config = (session as Record<string, unknown>).criteria_config as CriteriaConfig | null;
          if (config) {
            setCriteriaConfig(config);
            sessionStorage.setItem(CRITERIA_CONFIG_KEY, JSON.stringify(config));
          }
        }
      } catch { /* ignore */ }

      if (nav.eleveIds) {
        const { data } = await supabase
          .from('session_eleves')
          .select('*')
          .in('id', nav.eleveIds);
        if (data && data.length === 2) {
          const sorted = nav.eleveIds.map(id => data.find(e => e.id === id));
          if (sorted.some(e => !e)) { setRestoring(false); return; }
          const validSorted = sorted as [SessionEleveRow, SessionEleveRow];
          setScreen({ type: 'evaluate-binome', juryId: nav.juryId, sessionId: nav.sessionId, eleves: validSorted });
          setRestoring(false);
          return;
        }
      }

      if (nav.eleveId) {
        const { data: eleve } = await supabase
          .from('session_eleves')
          .select('*')
          .eq('id', nav.eleveId)
          .single();

        if (eleve) {
          setScreen({ type: 'evaluate', juryId: nav.juryId, sessionId: nav.sessionId, eleve });
          setRestoring(false);
          return;
        }
      }

      setScreen({ type: 'students', juryId: nav.juryId, sessionId: nav.sessionId });
      setRestoring(false);
    }
    restore();
  }, []);

  const navigate = useCallback((s: Screen) => {
    setScreen(s);
    saveNav(s);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Gérer le Presence
  const activeSessionId = screen.type !== 'join' ? screen.sessionId : null;
  const activeJuryId = screen.type !== 'join' ? screen.juryId : null;

  useEffect(() => {
    if (!activeSessionId || !activeJuryId) {
      if (presenceRef.current) {
        supabase.removeChannel(presenceRef.current);
        presenceRef.current = null;
      }
      return;
    }

    const channel = supabase.channel(`presence:session:${activeSessionId}`, {
      config: { presence: { key: activeJuryId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ juryId: activeJuryId, connectedAt: new Date().toISOString() });
        }
      });

    presenceRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      presenceRef.current = null;
    };
  }, [activeSessionId, activeJuryId]);

  if (restoring) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#64748b' }}>
        Restauration...
      </div>
    );
  }

  const content = (() => {
    switch (screen.type) {
      case 'join':
        return <JoinScreen onJoined={(juryId, sessionId, config) => {
          if (config) {
            setCriteriaConfig(config);
            try { sessionStorage.setItem(CRITERIA_CONFIG_KEY, JSON.stringify(config)); } catch { /* ignore */ }
          } else {
            setCriteriaConfig(DEFAULT_CRITERIA_CONFIG);
            try { sessionStorage.removeItem(CRITERIA_CONFIG_KEY); } catch { /* ignore */ }
          }
          navigate({ type: 'students', juryId, sessionId });
        }} />;

      case 'students':
        return <StudentListScreen
          juryId={screen.juryId}
          onSelectEleve={(eleve) =>
            navigate({ type: 'evaluate', juryId: screen.juryId, sessionId: screen.sessionId, eleve })
          }
          onSelectBinome={(eleves) =>
            navigate({ type: 'evaluate-binome', juryId: screen.juryId, sessionId: screen.sessionId, eleves })
          }
          onDisconnect={() => navigate({ type: 'join' })}
        />;

      case 'evaluate':
        return <EvaluateScreen
          eleve={screen.eleve}
          juryId={screen.juryId}
          onDone={() => {
            setToast('Note enregistrée \u2713');
            navigate({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId });
          }}
          onBack={() =>
            navigate({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId })
          }
        />;

      case 'evaluate-binome':
        return <BinomeEvaluateScreen
          eleves={screen.eleves}
          juryId={screen.juryId}
          onDone={() => {
            setToast('Notes enregistrées \u2713');
            navigate({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId });
          }}
          onBack={() =>
            navigate({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId })
          }
        />;
    }
  })();

  return (
    <CriteriaProvider config={criteriaConfig}>
      {content}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#276749',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </CriteriaProvider>
  );
}
