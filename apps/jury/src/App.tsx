import { useState, useEffect, useRef } from 'react';
import { JoinScreen } from './screens/JoinScreen';
import { StudentListScreen } from './screens/StudentListScreen';
import { EvaluateScreen } from './screens/EvaluateScreen';
import { supabase } from '@groupit/shared';
import type { SessionEleveRow } from '@groupit/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type Screen =
  | { type: 'join' }
  | { type: 'students'; juryId: string; sessionId: string }
  | { type: 'evaluate'; juryId: string; sessionId: string; eleve: SessionEleveRow };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'join' });
  const [toast, setToast] = useState<string | null>(null);
  const presenceRef = useRef<RealtimeChannel | null>(null);

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

  const content = (() => {
    switch (screen.type) {
      case 'join':
        return <JoinScreen onJoined={(juryId, sessionId) =>
          setScreen({ type: 'students', juryId, sessionId })
        } />;

      case 'students':
        return <StudentListScreen
          juryId={screen.juryId}
          onSelectEleve={(eleve) =>
            setScreen({ type: 'evaluate', juryId: screen.juryId, sessionId: screen.sessionId, eleve })
          }
          onDisconnect={() => setScreen({ type: 'join' })}
        />;

      case 'evaluate':
        return <EvaluateScreen
          eleve={screen.eleve}
          juryId={screen.juryId}
          onDone={() => {
            setToast('Note enregistrée ✓');
            setScreen({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId });
          }}
          onBack={() =>
            setScreen({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId })
          }
        />;
    }
  })();

  return (
    <>
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
    </>
  );
}
