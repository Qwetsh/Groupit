import { useState } from 'react';
import { useSessionData } from './hooks/useSessionData';
import { useStats } from './hooks/useStats';
import { StatsCards } from './components/StatsCards';
import { DistributionChart, CritereRadarChart, JuryBarChart, ParcoursBarChart, DureeDistributionChart, DureeNoteScatterChart } from './components/Charts';
import { JuryTable } from './components/JuryTable';
import { ExportButton } from './components/ExportButton';
import { CriteriaConfigModal } from './components/CriteriaConfigModal';

export default function App() {
  const [sessionCode, setSessionCode] = useState('');
  const [activeCode, setActiveCode] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);

  const { jurys, allFinalScores, scenarioName, dateOral, criteriaConfig, sessionId, loading, error, refresh } = useSessionData(activeCode);
  const { globalStats, juryStats, parcoursStats, critereStats, distribution, dureeDistribution, dureeNoteData, maxTotal, maxByCategory } = useStats(jurys, allFinalScores, criteriaConfig);

  const isConnected = activeCode && !error && !loading;

  // Nombre d'eleves deja evalues (pour l'avertissement config)
  const evaluatedCount = allFinalScores.length;

  if (!activeCode) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.loginTitle}>\uD83D\uDCCA Tableau de bord \u2014 Oral DNB</div>
          <div style={styles.loginSub}>Entrez le code de session pour suivre les notes en temps r\u00e9el.</div>
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
            Acc\u00e9der au tableau de bord \u2192
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
          <button onClick={() => setActiveCode('')} style={styles.loginBtn}>\u2190 Retour</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.headerTitle}>\uD83D\uDCCA Oral DNB \u2014 {scenarioName || 'Tableau de bord'}</div>
          <div style={styles.headerSub}>
            Session : {activeCode}
            {dateOral && ` \u00b7 ${new Date(dateOral).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
            {isConnected && <span style={styles.liveBadge}>\u25CF En direct</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowConfigModal(true)} style={styles.configBtn} title="Configurer la grille de crit\u00e8res">
            \u2699\uFE0F
          </button>
          <ExportButton jurys={jurys} scenarioName={scenarioName} criteriaConfig={criteriaConfig} />
          <button onClick={refresh} style={styles.refreshBtn}>\u21BB</button>
          <button onClick={() => setActiveCode('')} style={styles.disconnectBtn}>D\u00e9connexion</button>
        </div>
      </header>

      {/* Modal config criteres */}
      {showConfigModal && (
        <CriteriaConfigModal
          sessionId={sessionId}
          currentConfig={criteriaConfig}
          evaluatedCount={evaluatedCount}
          onClose={() => setShowConfigModal(false)}
          onSaved={() => {
            setShowConfigModal(false);
            refresh();
          }}
        />
      )}

      {/* Contenu principal */}
      <main style={styles.main}>
        <StatsCards stats={globalStats} />

        <div style={styles.chartsGrid}>
          <DistributionChart data={distribution} />
          <CritereRadarChart data={critereStats} />
          <JuryBarChart data={juryStats} maxTotal={maxTotal} />
          <ParcoursBarChart data={parcoursStats} maxTotal={maxTotal} />
          <DureeDistributionChart data={dureeDistribution} />
          <DureeNoteScatterChart data={dureeNoteData} maxTotal={maxTotal} />
        </div>

        <h2 style={styles.sectionTitle}>D\u00e9tail par jury</h2>
        <JuryTable
          jurys={jurys}
          criteriaConfig={criteriaConfig}
          maxTotal={maxTotal}
          maxByCategory={maxByCategory}
        />
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
  configBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
