import { useState } from 'react';
import { supabase } from '@groupit/shared';

interface JoinScreenProps {
  onJoined: (juryId: string, slot: 'A' | 'B', mode: 'solo' | 'duo') => void;
}

export function JoinScreen({ onJoined }: JoinScreenProps) {
  const [sessionCode, setSessionCode] = useState('');
  const [juryNumber, setJuryNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError('');
    setLoading(true);

    try {
      // 1. Auth anonyme
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw new Error('Erreur de connexion');

      // 2. Trouver la session par code
      const { data: session, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('code', sessionCode.trim().toUpperCase())
        .single();

      if (sessionError || !session) {
        throw new Error('Code de session invalide');
      }

      // 3. Trouver le jury
      const { data: jury, error: juryError } = await supabase
        .from('session_jurys')
        .select('id, mode')
        .eq('session_id', session.id)
        .eq('jury_number', parseInt(juryNumber))
        .single();

      if (juryError || !jury) {
        throw new Error('Numéro de jury introuvable');
      }

      // 4. Rejoindre le jury (prendre le slot libre)
      // Essayer slot A d'abord, puis B
      let slot: 'A' | 'B' = 'A';
      const { error: joinErrorA } = await supabase
        .from('jury_members')
        .insert({ jury_id: jury.id, slot: 'A' });

      if (joinErrorA) {
        // Slot A pris, essayer B
        const { error: joinErrorB } = await supabase
          .from('jury_members')
          .insert({ jury_id: jury.id, slot: 'B' });

        if (joinErrorB) {
          throw new Error('Ce jury est complet (2 membres déjà connectés)');
        }
        slot = 'B';
      }

      onJoined(jury.id, slot, jury.mode as 'solo' | 'duo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerSub}>Diplôme National du Brevet</div>
        <div style={styles.headerTitle}>Soutenance Orale</div>
        <div style={styles.headerDate}>
          Notation jury — {new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>

      <div style={styles.card}>
        <label style={styles.label}>Code de session</label>
        <input
          style={styles.input}
          placeholder="Ex: ABC123"
          value={sessionCode}
          onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
          maxLength={8}
          autoFocus
        />

        <div style={{ marginTop: 14 }}>
          <label style={styles.label}>Numéro de jury</label>
          <input
            style={styles.input}
            placeholder="Ex: 1"
            type="number"
            inputMode="numeric"
            value={juryNumber}
            onChange={(e) => setJuryNumber(e.target.value)}
          />
        </div>

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <button
          onClick={handleJoin}
          disabled={!sessionCode.trim() || !juryNumber || loading}
          style={{
            ...styles.btn,
            opacity: (!sessionCode.trim() || !juryNumber || loading) ? 0.5 : 1,
          }}
        >
          {loading ? 'Connexion...' : 'Rejoindre le jury →'}
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
  },
  header: {
    background: 'linear-gradient(135deg, #1a365d 0%, #2c5282 100%)',
    color: '#fff',
    padding: '24px 20px 20px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 12px rgba(26,54,93,0.15)',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    opacity: 0.8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.3,
  },
  headerDate: {
    fontSize: 13,
    opacity: 0.75,
    marginTop: 2,
  },
  card: {
    background: '#ffffff',
    borderRadius: 14,
    padding: 18,
    margin: '16px 16px',
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
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #d2dce6',
    fontSize: 15,
    color: '#1a202c',
    background: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  error: {
    marginTop: 12,
    padding: '10px 14px',
    background: '#fed7d7',
    color: '#9b2c2c',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  btn: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 20,
    boxShadow: '0 2px 8px rgba(43,108,176,0.3)',
  },
};
