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
  const presenceRef = useRef<RealtimeChannel | null>(null);

  // Gérer le Presence : connecté quand on a un juryId, déconnecté sinon
  const activeSessionId = screen.type !== 'join' ? screen.sessionId : null;
  const activeJuryId = screen.type !== 'join' ? screen.juryId : null;

  useEffect(() => {
    if (!activeSessionId || !activeJuryId) {
      // Cleanup si retour au join
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
        onDone={() =>
          setScreen({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId })
        }
        onBack={() =>
          setScreen({ type: 'students', juryId: screen.juryId, sessionId: screen.sessionId })
        }
      />;
  }
}
