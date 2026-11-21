import { useState } from 'react';
import { joinJury, sanitizeSessionCode, ACCESS_DENIED_MESSAGES } from '@groupit/shared';
import type { CriteriaConfig } from '@groupit/shared';

interface JoinScreenProps {
  onJoined: (juryId: string, sessionId: string, criteriaConfig: CriteriaConfig | null) => void;
}

/**
 * Le QR code d'une convocation ouvre l'application avec `?session=CODE&jury=N` :
 * les deux champs sont préremplis, l'enseignant n'a plus qu'à valider.
 */
function readInvitation(): { sessionCode: string; juryNumber: string } {
  try {
    const params = new URLSearchParams(window.location.search);
    const sessionCode = sanitizeSessionCode(params.get('session') ?? '');
    const jury = params.get('jury') ?? '';
    return { sessionCode, juryNumber: /^\d{1,3}$/.test(jury) ? jury : '' };
  } catch {
    return { sessionCode: '', juryNumber: '' };
  }
}

export function JoinScreen({ onJoined }: JoinScreenProps) {
  const [invitation] = useState(readInvitation);
  const [sessionCode, setSessionCode] = useState(invitation.sessionCode);
  const [juryNumber, setJuryNumber] = useState(invitation.juryNumber);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError('');
    setLoading(true);

    try {
      // Le serveur vérifie le code, trouve le jury et attribue l'emplacement
      // (A ou B) en une seule opération.
      const result = await joinJury(sessionCode, parseInt(juryNumber, 10));
      if (!result.ok) {
        throw new Error(ACCESS_DENIED_MESSAGES[result.reason] ?? 'Impossible de rejoindre le jury');
      }

      // Sauvegarder l'emplacement pour les écrans de notation
      try { sessionStorage.setItem('jury-my-slot', result.slot); } catch { /* ignore */ }

      onJoined(result.juryId, result.sessionId, result.criteriaConfig);
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
          onChange={(e) => setSessionCode(sanitizeSessionCode(e.target.value))}
          maxLength={12}
          aria-label="Code de session"
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

      {/* Zone de test supprimée — la suppression de session doit se faire via le dashboard admin */}
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
