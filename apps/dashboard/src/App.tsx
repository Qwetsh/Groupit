import { useState } from 'react';
import { useSessionData } from './hooks/useSessionData';
import { useStats } from './hooks/useStats';
import { StatsCards } from './components/StatsCards';
import { DistributionChart, CritereRadarChart, JuryBarChart, ParcoursBarChart, DureeDistributionChart, DureeNoteScatterChart } from './components/Charts';
import { JuryTable } from './components/JuryTable';
import { ExportButton } from './components/ExportButton';

export default function App() {
  const [sessionCode, setSessionCode] = useState('');
  const [activeCode, setActiveCode] = useState('');

  const { jurys, allFinalScores, scenarioName, dateOral, loading, error, refresh } = useSessionData(activeCode);
  const { globalStats, juryStats, parcoursStats, critereStats, distribution, dureeDistribution, dureeNoteData } = useStats(jurys, allFinalScores);

  const isConnected = activeCode && !error && !loading;

  // Écran de connexion
  if (!activeCode) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.loginTitle}>📊 Tableau de bord — Oral DNB</div>
          <div style={styles.loginSub}>Entrez le code de session pour suivre les notes en temps réel.</div>
          <input
            style={styles.loginInput}
            placeholder="Code de session (ex: ABC123)"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && sessionCode.trim() && setActiveCode(sessionCode.trim())}
            maxLength={8}
            autoFocus
          />
          <button
            onClick={() => sessionCode.trim() && setActiveCode(sessionCode.trim())}
            disabled={!sessionCode.trim()}
            style={{
              ...styles.loginBtn,
              opacity: sessionCode.trim() ? 1 : 0.5,
            }}
          >
            Accéder au tableau de bord →
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.loginContainer}>
        <div style={{ fontSize: 16, color: '#64748b' }}>Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={{ color: '#c53030', fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={() => setActiveCode('')} style={styles.loginBtn}>← Retour</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.headerTitle}>📊 Oral DNB — {scenarioName || 'Tableau de bord'}</div>
          <div style={styles.headerSub}>
            Session : {activeCode}
            {dateOral && ` · ${new Date(dateOral).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
            {isConnected && <span style={styles.liveBadge}>● En direct</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ExportButton jurys={jurys} scenarioName={scenarioName} />
          <button onClick={refresh} style={styles.refreshBtn}>↻</button>
          <button onClick={() => setActiveCode('')} style={styles.disconnectBtn}>Déconnexion</button>
        </div>
      </header>

      {/* Contenu principal */}
      <main style={styles.main}>
        {/* Stats globales */}
        <StatsCards stats={globalStats} />

        {/* Graphiques — 2 colonnes */}
        <div style={styles.chartsGrid}>
          <DistributionChart data={distribution} />
          <CritereRadarChart data={critereStats} />
          <JuryBarChart data={juryStats} />
          <ParcoursBarChart data={parcoursStats} />
          <DureeDistributionChart data={dureeDistribution} />
          <DureeNoteScatterChart data={dureeNoteData} />
        </div>

        {/* Tableaux détaillés par jury */}
        <h2 style={styles.sectionTitle}>Détail par jury</h2>
        <JuryTable jurys={jurys} />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#f0f4f8',
  },
  loginContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f0f4f8',
  },
  loginCard: {
    background: '#fff',
    borderRadius: 16,
    padding: 32,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#1e293b',
    marginBottom: 8,
  },
  loginSub: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  loginInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1.5px solid #d2dce6',
    fontSize: 16,
    color: '#1a202c',
    background: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box' as const,
    textAlign: 'center' as const,
    letterSpacing: 2,
    fontWeight: 700,
  },
  loginBtn: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 16,
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#1e293b',
  },
  headerSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  liveBadge: {
    marginLeft: 8,
    color: '#059669',
    fontWeight: 700,
    fontSize: 12,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#fff',
    fontSize: 18,
    cursor: 'pointer',
  },
  disconnectBtn: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  main: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '24px 32px',
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#1e293b',
    marginBottom: 16,
  },
};
