import { useState, useCallback } from 'react';
import { JoinScreen } from './screens/JoinScreen';
import { StudentListScreen } from './screens/StudentListScreen';
import { EvaluateScreen } from './screens/EvaluateScreen';
import { ReconcileScreen } from './screens/ReconcileScreen';
import { supabase } from '@groupit/shared';
import type { SessionEleveRow } from '@groupit/shared';

export type Screen =
  | { type: 'join' }
  | { type: 'students'; juryId: string; slot: 'A' | 'B'; mode: 'solo' | 'duo' }
  | { type: 'evaluate'; juryId: string; slot: 'A' | 'B'; mode: 'solo' | 'duo'; eleve: SessionEleveRow }
  | { type: 'reconcile'; juryId: string; slot: 'A' | 'B'; eleve: SessionEleveRow };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'join' });

  // Cleanup : supprimer la row jury_member quand on quitte
  const handleDisconnect = useCallback(async (juryId: string, slot: 'A' | 'B') => {
    await supabase.from('jury_members').delete().eq('jury_id', juryId).eq('slot', slot);
    setScreen({ type: 'join' });
  }, []);

  switch (screen.type) {
    case 'join':
      return <JoinScreen onJoined={(juryId, slot, mode) =>
        setScreen({ type: 'students', juryId, slot, mode })
      } />;

    case 'students':
      return <StudentListScreen
        juryId={screen.juryId}
        slot={screen.slot}
        mode={screen.mode}
        onSelectEleve={(eleve) =>
          setScreen({ type: 'evaluate', juryId: screen.juryId, slot: screen.slot, mode: screen.mode, eleve })
        }
        onDisconnect={() => handleDisconnect(screen.juryId, screen.slot)}
      />;

    case 'evaluate':
      return <EvaluateScreen
        eleve={screen.eleve}
        slot={screen.slot}
        mode={screen.mode}
        juryId={screen.juryId}
        onDone={(needsReconcile) => {
          if (needsReconcile) {
            setScreen({ type: 'reconcile', juryId: screen.juryId, slot: screen.slot, eleve: screen.eleve });
          } else {
            setScreen({ type: 'students', juryId: screen.juryId, slot: screen.slot, mode: screen.mode });
          }
        }}
        onBack={() =>
          setScreen({ type: 'students', juryId: screen.juryId, slot: screen.slot, mode: screen.mode })
        }
      />;

    case 'reconcile':
      return <ReconcileScreen
        eleve={screen.eleve}
        slot={screen.slot}
        juryId={screen.juryId}
        onValidated={() =>
          setScreen({ type: 'students', juryId: screen.juryId, slot: screen.slot, mode: 'duo' })
        }
      />;
  }
}
