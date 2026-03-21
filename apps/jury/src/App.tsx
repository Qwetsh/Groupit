import { useState } from 'react';
import { JoinScreen } from './screens/JoinScreen';
import { StudentListScreen } from './screens/StudentListScreen';
import { EvaluateScreen } from './screens/EvaluateScreen';
import type { SessionEleveRow } from '@groupit/shared';

export type Screen =
  | { type: 'join' }
  | { type: 'students'; juryId: string }
  | { type: 'evaluate'; juryId: string; eleve: SessionEleveRow };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'join' });

  switch (screen.type) {
    case 'join':
      return <JoinScreen onJoined={(juryId) =>
        setScreen({ type: 'students', juryId })
      } />;

    case 'students':
      return <StudentListScreen
        juryId={screen.juryId}
        onSelectEleve={(eleve) =>
          setScreen({ type: 'evaluate', juryId: screen.juryId, eleve })
        }
        onDisconnect={() => setScreen({ type: 'join' })}
      />;

    case 'evaluate':
      return <EvaluateScreen
        eleve={screen.eleve}
        juryId={screen.juryId}
        onDone={() =>
          setScreen({ type: 'students', juryId: screen.juryId })
        }
        onBack={() =>
          setScreen({ type: 'students', juryId: screen.juryId })
        }
      />;
  }
}
